"""عامل فيديو ساجد على Colab: يسحب المهام من طابور Cloudflare بنفسه (اتصال صادر فقط، بلا خادم ولا نفق).

مكتبة بايثون القياسية فقط لجزء الطابور؛ مكتبات النماذج تُستورد عند الحاجة داخل make_generator.
"""
import io
import json
import os
import tempfile
import time
import traceback
import urllib.error
import urllib.request
import zlib

NEGATIVE = "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走，text, watermark, logo, extra limbs, distorted face"
MAX_VIDEO_BYTES = 23_000_000

# مواصفات النماذج: المساحة القصوى للإطار، الإطارات في الثانية، خطوات الاستدلال، مقياس التوجيه
MODELS = {
    "wan-ti2v-5b": {"repo": "Wan-AI/Wan2.2-TI2V-5B-Diffusers", "max_area": 704 * 1280, "fps": 24, "steps": 30, "guidance": 5.0, "fp32_vae": True},
    "wan-i2v-a14b": {"repo": "Wan-AI/Wan2.2-I2V-A14B-Diffusers", "max_area": 480 * 832, "fps": 16, "steps": 40, "guidance": 3.5, "fp32_vae": False},
}


class Queue:
    def __init__(self, base, token, timeout=60):
        self.base = base.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _call(self, method, path, data=None, headers=None):
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("x-sawan-key", self.token)
        req.add_header("user-agent", "sawan-colab-worker/1")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return res.status, res.read(), res.headers
        except urllib.error.HTTPError as err:
            return err.code, err.read(), err.headers

    def claim(self):
        status, body, _ = self._call("POST", "/claim")
        if status == 204:
            return None
        if status == 401:
            raise PermissionError("الرمز مرفوض: تأكد من SAWAN_TOKEN.")
        if status != 200:
            raise RuntimeError(f"claim فشل ({status}): {body[:200]!r}")
        return json.loads(body)["job"]

    def image(self, job_id):
        status, body, _ = self._call("GET", f"/jobs/{job_id}/image")
        if status != 200:
            raise RuntimeError(f"تعذر تنزيل الصورة ({status})")
        return body

    def upload(self, job_id, data, mime="video/mp4"):
        status, body, _ = self._call("PUT", f"/jobs/{job_id}/video", data, {"content-type": mime})
        if status != 200:
            raise RuntimeError(f"تعذر رفع المقطع ({status}): {body[:200]!r}")

    def fail(self, job_id, message):
        try:
            self._call("POST", f"/jobs/{job_id}/fail", json.dumps({"error": str(message)[:400]}).encode(), {"content-type": "application/json"})
        except Exception:
            pass


def frames_for(seconds, fps, cap_seconds=6):
    """عدد الإطارات يجب أن يكون 4k+1 لنماذج Wan."""
    n = round(min(max(seconds, 2), cap_seconds) * fps)
    return (n // 4) * 4 + 1


def crop_ratio(width, height, aspect):
    """مربع القص المركزي ليطابق نسبة الفيديو المطلوبة (16:9 أو 9:16)."""
    target = 16 / 9 if aspect == "16:9" else 9 / 16
    current = width / height
    if abs(current - target) / target < 0.01:
        return 0, 0, width, height
    if current > target:
        w = round(height * target)
        left = (width - w) // 2
        return left, 0, left + w, height
    h = round(width / target)
    top = (height - h) // 2
    return 0, top, width, top + h


def make_generator(model_name):
    """يحمّل النموذج ويعيد دالة generate(job, image_bytes) -> (bytes, mime)."""
    import numpy as np
    import torch
    from PIL import Image
    from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
    from diffusers.utils import export_to_video

    cfg = MODELS[model_name]
    if cfg["fp32_vae"]:
        vae = AutoencoderKLWan.from_pretrained(cfg["repo"], subfolder="vae", torch_dtype=torch.float32)
        pipe = WanImageToVideoPipeline.from_pretrained(cfg["repo"], vae=vae, torch_dtype=torch.bfloat16)
    else:
        pipe = WanImageToVideoPipeline.from_pretrained(cfg["repo"], torch_dtype=torch.bfloat16)
    vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
    if vram_gb >= 70 and model_name == "wan-ti2v-5b":
        pipe.to("cuda")
    else:
        pipe.enable_model_cpu_offload()
    mod = pipe.vae_scale_factor_spatial * pipe.transformer.config.patch_size[1]

    def generate(job, image_bytes):
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.crop(crop_ratio(img.width, img.height, job["aspect"]))
        ratio = img.height / img.width
        height = round(np.sqrt(cfg["max_area"] * ratio)) // mod * mod
        width = round(np.sqrt(cfg["max_area"] / ratio)) // mod * mod
        img = img.resize((width, height), Image.LANCZOS)
        generator = torch.Generator(device="cuda").manual_seed(zlib.crc32(job["id"].encode()))
        out = pipe(
            image=img,
            prompt=job["prompt"],
            negative_prompt=NEGATIVE,
            height=height,
            width=width,
            num_frames=frames_for(job.get("seconds", 5), cfg["fps"]),
            guidance_scale=cfg["guidance"],
            num_inference_steps=cfg["steps"],
            generator=generator,
        ).frames[0]
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "clip.mp4")
            export_to_video(out, path, fps=cfg["fps"])
            with open(path, "rb") as fh:
                data = fh.read()
        torch.cuda.empty_cache()
        return data, "video/mp4"

    return generate


def run_forever(queue, generate, idle_min=5, idle_max=20, stop=lambda: False, max_jobs=None, log=print, sleep=time.sleep):
    """حلقة السحب: مهمة واحدة في كل مرة، وأي خطأ في مهمة يُرسَل للطابور ولا يوقف العامل."""
    done = 0
    wait = idle_min
    while not stop() and (max_jobs is None or done < max_jobs):
        try:
            job = queue.claim()
        except PermissionError:
            raise
        except Exception as err:  # شبكة أو Cloudflare مؤقتاً
            log(f"تعذر الاتصال بالطابور: {err}")
            sleep(min(idle_max * 2, 60))
            continue
        if not job:
            sleep(wait)
            wait = min(idle_max, wait + 3)
            continue
        wait = idle_min
        started = time.time()
        log(f"مهمة {job['id'][:8]} · {job['aspect']} · {job.get('seconds', 5)}ث")
        try:
            data, mime = generate(job, queue.image(job["id"]))
            if len(data) > MAX_VIDEO_BYTES:
                raise RuntimeError("المقطع الناتج أكبر من الحد المسموح للرفع.")
            queue.upload(job["id"], data, mime)
            log(f"تم في {time.time() - started:.0f} ثانية ({len(data) / 1e6:.1f}MB)")
        except Exception as err:
            log("فشلت المهمة:\n" + traceback.format_exc(limit=3))
            queue.fail(job["id"], f"{type(err).__name__}: {err}")
        done += 1


def main(url, token, model="wan-ti2v-5b"):
    queue = Queue(url, token)
    print("تحميل النموذج (أول مرة يستغرق عدة دقائق)…")
    generate = make_generator(model)
    print("العامل جاهز ويسحب المهام. اترك هذه الخلية تعمل.")
    run_forever(queue, generate)
