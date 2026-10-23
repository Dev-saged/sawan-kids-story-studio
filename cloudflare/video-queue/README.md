# طابور فيديو ساجد (Cloudflare Worker)

وسيط صغير بين التطبيق ودفتر Colab. التطبيق يضع مهمة تحريك (صورة + وصف حركة)، ودفتر Colab يسحبها بنفسه ويرفع المقطع، ثم يستلمه التطبيق ويدمجه مع صوت الراوي. الاتصال من Colab صادر فقط (بلا خادم ولا نفق).

- التخزين: D1 لحالة المهام، وKV للصور والمقاطع (تُحذف تلقائياً بعد 24 ساعة).
- الخطة المجانية تكفي: KV يسمح بـ1000 كتابة يومياً (نحو 300 مقطع)، والـWorker يستهلك CPU ضئيلاً لأن الملفات تمر بلا معالجة.
- بدون بطاقة بنكية: D1 وKV مجانيان بخلاف R2.

## النشر بالأوامر (من كمبيوتر)
```bash
cd cloudflare/video-queue
npx wrangler login
npx wrangler d1 create sawan-video-queue        # انسخ database_id إلى wrangler.toml
npx wrangler kv namespace create BLOBS           # انسخ id إلى wrangler.toml
npx wrangler secret put APP_TOKEN                # رمز التطبيق: 16 حرفاً فأكثر، عشوائي
npx wrangler secret put WORKER_TOKEN             # رمز Colab (اختياري، وإن غاب يُستعمل APP_TOKEN)
npx wrangler deploy
```
ينشئ الـWorker جداوله تلقائياً عند أول طلب، فلا حاجة لتنفيذ `schema.sql`.

## النشر من لوحة Cloudflare (من الموبايل)
1. Workers & Pages ← Create ← Worker، سمّه `sawan-video-queue`، ثم الصق محتوى `worker.js` في المحرر وانشر.
2. Storage & databases ← D1 ← أنشئ قاعدة `sawan-video-queue`. وKV ← أنشئ namespace باسم `BLOBS`.
3. في الـWorker: Settings ← Bindings: أضف D1 باسم `DB` وKV باسم `BLOBS`.
4. Settings ← Variables and Secrets: أضف `APP_TOKEN` (و`WORKER_TOKEN` اختيارياً) كـSecret.
5. افتح `https://اسم-الـworker.workers.dev/health` ويجب أن يظهر `{"ok":true,...}`.

## الربط
- التطبيق: تصدير الفيديو ← حرّك بالذكاء الاصطناعي ← Colab ← الصق الرابط و`APP_TOKEN` ← «حفظ واختبار».
- Colab: افتح `colab/sawan_video_worker.ipynb`، أضف في Secrets: `SAWAN_URL` و`SAWAN_TOKEN` (= `WORKER_TOKEN` أو `APP_TOKEN`)، واختر GPU، وشغّل الخلايا. اترك آخر خلية تعمل.

## الأمان
- كل الطلبات عدا `/health` تحتاج الترويسة `x-sawan-key`. رمز التطبيق لا يستطيع السحب ولا رفع المقاطع، ورمز Colab لا يستطيع إنشاء مهام.
- حدود: صورة حتى 6MB، مقطع حتى 24MB، 40 مهمة منتظرة كحد أقصى.
- الرابط والرمز يُحفظان في متصفحك فقط. لا تشارك `APP_TOKEN` علناً؛ من يملكه يستطيع إدخال مهام في طابورك.

## الاختبار المحلي
```bash
npx wrangler dev --local --port 8788 --var APP_TOKEN:aaaaaaaaaaaaaaaaaaaa --var WORKER_TOKEN:bbbbbbbbbbbbbbbbbbbb
node test-queue.mjs                # اختبار الطابور
python3 ../../colab/test_worker.py # اختبار حلقة العامل بنموذج وهمي
```
