"""Ask the deployed Worker about demo facts (warming its answer cache) and save the results for
build_demo.py (ordering + offline fallback). Usage: python3 record.py <out.json> [facts_per_lang]"""
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import reference_prompts as app  # for the bundled fact list only

API = "https://indicklar-demo.indicklar.workers.dev/ask"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 12
LANGS = ["hin", "ben", "mar", "tam", "tel", "guj", "pun", "mal", "asm", "ori", "san"]
ids = [str(i) for rel in app.DATA["relations"] for i in app.DATA["order"][rel]]
step = max(1, len(ids) // N)
picked = ids[::step][:N]
jobs = [(l, i) for l in LANGS for i in picked + (["3326"] if l != "hin" or "3326" not in picked else [])]

def run(job):
    l, i = job
    req = urllib.request.Request(API, data=json.dumps({"idx": i, "lang": l}).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "indicklar-record"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return job, json.load(r)["results"]
    except Exception as e:
        return job, {"error": str(e)[:200]}

out = {}
with ThreadPoolExecutor(4) as ex:
    for (l, i), res in ex.map(run, jobs):
        out[f"{l}|{i}"] = res
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=0)
ok = {k: v for k, v in out.items() if "error" not in v and all("correct" in r for r in v.values())}
print(len(jobs), "facts asked;", len(ok), "complete")
for f in app.FORMS:
    xs = [v[f]["correct"] for v in ok.values()]
    print(f"{f:8s} accuracy {sum(xs)/len(xs):.2f}")
flips = [k for k, v in ok.items() if not v["native"]["correct"] and v["en"]["correct"] and (v["cm"]["correct"] or v["tint_cm"]["correct"])]
print("flip examples:", len(flips), sorted({k.split('|')[0] for k in flips}))
