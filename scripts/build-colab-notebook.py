#!/usr/bin/env python3
"""يبني colab/sawan_video_worker.ipynb من colab/sawan_worker.py (مصدر واحد للكود). تشغيل: python3 scripts/build-colab-notebook.py"""
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
worker = (root / "colab" / "sawan_worker.py").read_text(encoding="utf-8")


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(keepends=True)}


def code(text, form=False):
    meta = {"cellView": "form"} if form else {}
    return {"cell_type": "code", "execution_count": None, "metadata": meta, "outputs": [], "source": text.strip("\n").splitlines(keepends=True)}


cells = [
    md("""
# عامل فيديو استوديو ساجد على Colab
يسحب هذا الدفتر مهام تحريك الصور من طابور Cloudflare الخاص بك ويرفع المقاطع الناتجة، فيصنع التطبيق الفيديو تلقائياً.

**قبل البدء (مرة واحدة):**
1. `Runtime ← Change runtime type` ثم اختر GPU (يفضّل A100 المتاح مع اشتراك Google AI Pro).
2. من أيقونة المفتاح في Colab (Secrets) أضف سرّين وفعّل «Notebook access»:
   - `SAWAN_URL` = رابط الـWorker مثل `https://sawan-video-queue.xxx.workers.dev`
   - `SAWAN_TOKEN` = قيمة `WORKER_TOKEN` (أو `APP_TOKEN` إن لم تضع غيره)
3. شغّل الخلايا بالترتيب، واترك آخر خلية تعمل واحتفظ بتبويب Colab مفتوحاً أثناء توليد الفيديو.

> الاتصال صادر فقط: لا خادم ولا نفق، فيلتزم بشروط استخدام Colab.
"""),
    code(
        """
#@title 1) الإعدادات
MODEL = "wan-ti2v-5b"  #@param ["wan-ti2v-5b", "wan-i2v-a14b"]
# wan-ti2v-5b: أسرع (720p، 24fps). wan-i2v-a14b: أعلى جودة وأبطأ بكثير (480p، 16fps) ويحتاج ذاكرة GPU كبيرة.
""",
        form=True,
    ),
    code(
        """
#@title 2) تثبيت المكتبات
!nvidia-smi --query-gpu=name,memory.total --format=csv
!pip install -q "git+https://github.com/huggingface/diffusers" transformers accelerate sentencepiece ftfy imageio imageio-ffmpeg
""",
        form=True,
    ),
    code("%%writefile sawan_worker.py\n" + worker),
    code(
        """
#@title 3) تشغيل العامل (اترك هذه الخلية تعمل)
from google.colab import userdata
import sawan_worker as sw

URL = userdata.get("SAWAN_URL")
TOKEN = userdata.get("SAWAN_TOKEN")
sw.main(URL, TOKEN, MODEL)
""",
        form=True,
    ),
]

nb = {
    "cells": cells,
    "metadata": {
        "accelerator": "GPU",
        "colab": {"gpuType": "A100", "provenance": []},
        "kernelspec": {"display_name": "Python 3", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 0,
}
out = root / "colab" / "sawan_video_worker.ipynb"
out.write_text(json.dumps(nb, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"wrote {out.relative_to(root)} ({len(cells)} cells)")
