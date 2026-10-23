"""اختبار حلقة العامل مع Worker محلي (wrangler dev) ونموذج وهمي: python3 test_worker.py [url] [appToken] [workerToken]"""
import json
import sys
import threading
import urllib.request

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import sawan_worker as sw

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8788"
app = sys.argv[2] if len(sys.argv) > 2 else "aaaaaaaaaaaaaaaaaaaa"
wrk = sys.argv[3] if len(sys.argv) > 3 else "bbbbbbbbbbbbbbbbbbbb"
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cfc0f01f0005850180847a98c10000000049454e44ae426082")
failed = 0


def check(name, cond):
    global failed
    failed += 0 if cond else 1
    print(("PASS " if cond else "FAIL ") + name)


def call(method, path, key, body=None, headers=None):
    req = urllib.request.Request(base + path, data=body, method=method)
    req.add_header("x-sawan-key", key)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


def enqueue(key, prompt):
    _, body = call("POST", "/jobs", app, json.dumps({"key": key, "prompt": prompt, "aspect": "16:9", "seconds": 5, "mime": "image/png"}).encode(), {"content-type": "application/json"})
    jid = json.loads(body)["id"]
    call("PUT", f"/jobs/{jid}/image", app, PNG, {"content-type": "image/png"})
    return jid


import time
RUN = str(int(time.time()))
ok_id = enqueue("py:ok:" + RUN, "a good job")
bad_id = enqueue("py:bad:" + RUN, "explode")


def generate(job, image_bytes):
    assert image_bytes == PNG, "image bytes mismatch"
    if job["prompt"] == "explode":
        raise ValueError("CUDA out of memory (stub)")
    return b"FAKE-MP4-" + job["id"].encode(), "video/mp4"


logs = []
sw.run_forever(sw.Queue(base, wrk), generate, stop=lambda: False, max_jobs=2, log=logs.append, sleep=lambda s: None)
status_ok, body_ok = call("GET", f"/jobs/{ok_id}/video", app)
check("video uploaded and served", status_ok == 200 and body_ok == b"FAKE-MP4-" + ok_id.encode())
_, st_bad = call("GET", f"/jobs/{bad_id}", app)
bad = json.loads(st_bad)
check("failure reported with reason", bad["status"] == "error" and "CUDA out of memory" in bad["error"])
check("worker kept going after failure", sum(l.startswith("مهمة ") for l in logs) == 2)
check("frames are 4k+1", all(sw.frames_for(s, f) % 4 == 1 for s in (2, 5, 6, 9) for f in (16, 24)) and sw.frames_for(5, 24) == 121 and sw.frames_for(5, 16) == 81)
check("crop keeps 16:9", sw.crop_ratio(1376, 768, "16:9") == (0, 0, 1376, 768) and sw.crop_ratio(1024, 768, "16:9")[3] - sw.crop_ratio(1024, 768, "16:9")[1] == 576)
check("crop to 9:16", sw.crop_ratio(1000, 1000, "9:16") == (219, 0, 781, 1000))
try:
    sw.run_forever(sw.Queue(base, "wrong-token-wrong-token"), generate, max_jobs=1, log=logs.append, sleep=lambda s: None)
    check("bad token raises", False)
except PermissionError:
    check("bad token raises", True)
print("ALL PASSED" if not failed else f"{failed} FAILED")
sys.exit(1 if failed else 0)
