"""Write worker/src/data.js (the facts the Worker may be asked about) from samples.json."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, "samples.json"), encoding="utf-8"))
L = ["hin", "ben", "mar", "tam", "tel", "guj", "pun", "mal", "asm", "ori", "san"]
facts = {k: {"r": v["r"], "en": v["en"], **{l: v[l] for l in L}} for k, v in d["facts"].items()}
tpl = {"en": d["templates"]["en"]}
for l in L:
    tpl[l] = d["templates"][l]; tpl[l + "-cm"] = d["templates"][l + "-cm"]
out = os.path.join(here, "..", "worker", "src", "data.js")
open(out, "w", encoding="utf-8").write("export default " + json.dumps({"facts": facts, "order": d["order"], "templates": tpl}, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("wrote", out)
