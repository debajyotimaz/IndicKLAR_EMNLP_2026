# Regenerates docs/static/data/{results,samples}.json for the project-page demo.
# Usage: python3 build_data.py <paper_latex_dir> <unzipped IndicKLAR dataset dir> <docs/static/data>
import json, re, random, os, sys
P = sys.argv[1]; DATA = sys.argv[2]; OUT = sys.argv[3]
MODELS = ["Llama-3.1-8B","Llama-3.2-1B","Llama-3.2-3B","Gemma-3-1B","Gemma-3-4B","Gemma-3-12B","Qwen2.5-1.5B","Qwen2.5-7B","Qwen2.5-14B"]
def parse(fn):
    res, lang = {}, None
    for line in open(fn, encoding="utf8"):
        s = line.strip()
        if s.startswith("%"): continue
        m = re.search(r"\\multirow\{7\}\{\*\}\{(\w+)\}", s)
        if m: lang = m.group(1); res[lang] = {}; continue
        if s == "English": lang = "English"; res[lang] = {}; continue
        m = re.match(r"&\s*([\w\-\+]+)\s*&(.*)\\\\", s)
        if m and lang:
            vals = [float(v) for v in m.group(2).split("&")]
            assert len(vals) == 9, (lang, s)
            res[lang][m.group(1)] = vals
    out = {}
    for L, rows in res.items():
        base = rows["Baseline"]; out[L] = {"Baseline": base}
        for k, v in rows.items():
            if k != "Baseline": out[L][k] = [round(b + d, 3) for b, d in zip(base, v)]
    return out
acc = parse(f"{P}/tables/accuracy_table_13_languages_longtable_delta.tex")
clc = parse(f"{P}/tables/clc_13_languages_delta.tex")
assert len(acc) == 19 and len(clc) == 18, (len(acc), len(clc))
json.dump({"models": MODELS, "strategies": list(clc["Hindi"].keys()), "accuracy": acc, "clc": clc}, open(f"{OUT}/results.json","w"), separators=(",",":"))

# ---- benchmark sample bundle ----
LANGS = {"asm":"Assamese","ben":"Bengali","doi":"Dogri","guj":"Gujarati","hin":"Hindi","kan":"Kannada","kon":"Konkani","mai":"Maithili","mal":"Malayalam","mar":"Marathi","nep":"Nepali","ori":"Odia","pun":"Punjabi","san":"Sanskrit","snd":"Sindhi","tam":"Tamil","tel":"Telugu","urd":"Urdu"}
rels = sorted(f[:-5] for f in os.listdir(f"{DATA}/en"))
random.seed(7); bundle = {"relations": rels, "languages": {}, "facts": {}}
en = {r: json.load(open(f"{DATA}/en/{r}.json", encoding="utf8")) for r in rels}
picked = {}
for r in rels:
    idx = [s["index"] for s in en[r]["samples"]]
    # keep facts present in every native language file
    common = set(idx)
    for code in LANGS:
        common &= {s["index"] for s in json.load(open(f"{DATA}/{code}/{r}.json", encoding="utf8"))["samples"]}
    picked[r] = sorted(random.sample(sorted(common), min(8, len(common))))
    # always include the paper's Hindi "Ronaldo" illustration (appendix) and show it first
    for s in en[r]["samples"]:
        if s["subject"] == "Ronaldo" and s["index"] in common:
            picked[r] = [s["index"]] + [i for i in picked[r] if i != s["index"]][:7]
    for s in en[r]["samples"]:
        if s["index"] in picked[r]:
            bundle["facts"][s["index"]] = {"r": r, "en": [s["subject"], s["object"], s["object_candidates"]]}
bundle["order"] = {r: picked[r] for r in rels}
bundle["templates"] = {"en": {r: en[r]["prompt_templates"][0] for r in rels}}
for code, name in LANGS.items():
    has_cm = os.path.isdir(f"{DATA}/{code}-en")
    bundle["languages"][code] = {"name": name, "cm": has_cm}
    bundle["templates"][code] = {}
    if has_cm: bundle["templates"][code + "-cm"] = {}
    for r in rels:
        d = json.load(open(f"{DATA}/{code}/{r}.json", encoding="utf8"))
        bundle["templates"][code][r] = d["prompt_templates"][0]
        for s in d["samples"]:
            if s["index"] in picked[r]:
                bundle["facts"][s["index"]][code] = [s["subject"], s["object"], s["object_candidates"]]
        if has_cm:
            c = json.load(open(f"{DATA}/{code}-en/{r}.json", encoding="utf8"))
            bundle["templates"][code + "-cm"][r] = c["prompt_templates"][0]
json.dump(bundle, open(f"{OUT}/samples.json","w", encoding="utf8"), ensure_ascii=False, separators=(",",":"))
print(len(bundle["facts"]), "facts;", [k for k,v in bundle["languages"].items() if v["cm"]])
