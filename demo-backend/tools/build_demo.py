"""Build docs/static/data/demo.json for the project page's live demo.

Usage: python3 build_demo.py <out.json> <recorded.json>
recorded.json maps "lang|idx" -> {form: result} from record.py (Llama-3.1-8B-Instruct, temperature 0, so a
repeat call returns the same answer). Only fully recorded facts are included; those showing the paper's
pattern (native wrong, code-mixed / TinT-CM right) come first.
"""
import json, sys
import reference_prompts as app

NATIVE = {"asm": ("অসমীয়া", "as"), "ben": ("বাংলা", "bn"), "guj": ("ગુજરાતી", "gu"), "hin": ("हिन्दी", "hi"),
          "mal": ("മലയാളം", "ml"), "mar": ("मराठी", "mr"), "ori": ("ଓଡ଼ିଆ", "or"), "pun": ("ਪੰਜਾਬੀ", "pa"),
          "san": ("संस्कृतम्", "sa"), "tam": ("தமிழ்", "ta"), "tel": ("తెలుగు", "te")}
ORDER = ["hin", "ben", "mar", "tam", "tel", "guj", "pun", "mal", "asm", "ori", "san"]
def shown(q):
    """Display form: drop the trailing "The answer is:"-style cue that follows the question mark."""
    for mark in ("?", "؟", "।"):
        i = q.rfind(mark)
        if 0 < i < len(q) - 1:
            return q[: i + 1]
    return q


rec = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else {}

def complete(lang, idx):
    r = rec.get(f"{lang}|{idx}")
    return bool(r) and all(isinstance(v, dict) and "correct" in v for v in r.values()) and set(r) >= {"native", "cm", "en", "tint_cm"}


def score(lang, idx):
    r = rec.get(f"{lang}|{idx}")
    if not r or any("correct" not in v for v in r.values()):
        return 0
    flip = (not r["native"]["correct"]) and r["en"]["correct"]
    return 2 * flip + r["cm"]["correct"] * flip + r["tint_cm"]["correct"] * flip

out = {"model": app.MODEL, "langs": {}}
for lang in ORDER:
    ids = [str(i) for rel in app.DATA["relations"] for i in app.DATA["order"][rel]]
    # only facts with a complete recorded run: the page shows these answers, no live calls
    ids = [i for i in dict.fromkeys(ids) if complete(lang, i)]
    ids.sort(key=lambda i: -score(lang, i))
    facts = []
    for idx in ids:
        _, gold, _, qn = app.build_prompt(idx, lang, "native")
        _, gold_en, _, qc = app.build_prompt(idx, lang, "cm")
        _, _, _, qe = app.build_prompt(idx, lang, "en")
        f = {"idx": idx, "native": shown(qn), "cm": shown(qc), "en": shown(qe), "gold": f"{gold} ({gold_en})"}
        r = rec.get(f"{lang}|{idx}")
        if r:
            f["rec"] = {k: {"answer": v.get("answer"), "correct": v.get("correct")} for k, v in r.items()}
        facts.append(f)
    out["langs"][lang] = {"name": app.LANG[lang][0], "native": NATIVE[lang][0], "bcp": NATIVE[lang][1], "facts": facts}
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("wrote", sys.argv[1], sum(len(v["facts"]) for v in out["langs"].values()), "facts")
