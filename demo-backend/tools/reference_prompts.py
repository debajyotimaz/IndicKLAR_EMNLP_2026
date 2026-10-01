"""Python reference of the demo's prompt construction and answer scoring (mirrors worker/src/index.js).

Builds prompts like the paper's evaluation scripts: 3-shot demonstrations from the same relation, the test
question, and its candidate list. Used by build_demo.py and record.py.
"""
import json
import os
import re

MODEL = "meta-llama/Llama-3.1-8B-Instruct"
FORMS = ("native", "cm", "en", "tint_cm")
DATA = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples.json"), encoding="utf-8"))

# (language name, script name, code-mixed name) as passed to the evaluation scripts
LANG = {
    "asm": ("Assamese", "Assamese", "Assamglish"), "ben": ("Bengali", "Bengali", "Banglish"),
    "doi": ("Dogri", "Dogri", "Dogrish"), "guj": ("Gujarati", "Gujarati", "Gujlish"),
    "hin": ("Hindi", "Hindi", "Hinglish"), "kan": ("Kannada", "Kannada", "Kanglish"),
    "kon": ("Konkani", "Konkani", "Konglish"), "mai": ("Maithili", "Maithili", "Maithilish"),
    "mal": ("Malayalam", "Malayalam", "Malyalamglish"), "mar": ("Marathi", "Marathi", "Marglish"),
    "nep": ("Nepali", "Nepali", "Nepglish"), "ori": ("Odia", "Odia", "Odiglish"),
    "pun": ("Punjabi", "Punjabi", "Punglish"), "san": ("Sanskrit", "Sanskrit", "Sanglish"),
    "snd": ("Sindhi", "Sindhi", "Sindlish"), "tam": ("Tamil", "Tamil", "Tamlish"),
    "tel": ("Telugu", "Telugu", "Teluglish"), "urd": ("Urdu", "Urdu", "Urlish"),
}

TINT_CM = """You are answering factual questions written in {lang} ({script} script).

You MUST internally perform code-mixed transformation before answering.

INTERNAL STEP (DO NOT OUTPUT):
- Convert the question into {cm} using {lang} grammar with English content words
- First romanize the original sentence preserving ALL words
- Then replace ONLY a few content words (nouns, main verbs, adjectives) with English
- Keep function words (question words, particles, auxiliaries, postpositions) unchanged
- Preserve word order exactly
- Do NOT rewrite or paraphrase

ILLUSTRATION (for understanding the process):
Input: Bharat ki rajdhani kya hai?
Internal form: Bharat ki capital kya hai?

RULES FOR INTERNAL TRANSFORMATION:
- It MUST NOT be a fluent English sentence
- It MUST NOT be a full translation
- It MUST preserve the original sentence structure
- At least 50% of the words should remain from the original (after romanization)
- Do NOT convert into known English question templates

ANSWERING:
- Answer based on the meaning of the question
- The answer MUST be consistent with the internal code-mixed interpretation
- The answer MUST be one of the listed candidates
- The answer MUST be written in {script} script only
- Do NOT use English in the answer

OUTPUT FORMAT (STRICT):
Output ONLY a JSON object with a single field:
{{"answer": "<answer in {script} script>"}}

- Do NOT output the {cm} translation
- Do NOT output any explanation

"""


def cands(s):
    return [c.strip() for c in str(s).split(",") if c.strip()]


def fact_view(idx: str, lang: str, form: str):
    """(subject, object, candidates, template) for one input form."""
    f = DATA["facts"][idx]
    rel = f["r"]
    if form == "en":
        s, o, c = f["en"]
        return s, o, cands(c), DATA["templates"]["en"][rel]
    if form == "cm":  # code-mixed questions use the English entity names
        s, o, c = f["en"]
        return s, o, cands(c), DATA["templates"][lang + "-cm"][rel]
    s, o, c = f[lang]
    return s, o, cands(c), DATA["templates"][lang][rel]


def question(tpl, subj):
    return tpl.replace("<subject>", subj).replace("<mask>", "").strip()


def build_prompt(idx: str, lang: str, form: str):
    rel = DATA["facts"][idx]["r"]
    pool = [str(i) for i in DATA["order"][rel] if str(i) != idx]
    demos = pool[:3]  # fixed demonstrations so a given question always gets the same prompt
    subj, gold, cand, tpl = fact_view(idx, lang, form)
    if form == "tint_cm":
        name, script, cm = LANG[lang]
        p = TINT_CM.format(lang=name, script=script, cm=cm)
        for d in demos:
            ds, do, dc, dt = fact_view(d, lang, form)
            p += f'Q: {question(dt, ds)}\nCandidates: {", ".join(dc)}\nOutput: {{"answer": "{do}"}}\n\n'
        p += f'Q: {question(tpl, subj)}\nCandidates: {", ".join(cand)}\nOutput:'
    else:
        p = ""
        for d in demos:
            ds, do, dc, dt = fact_view(d, lang, form)
            p += f"{question(dt, ds)} {do}\n"
        p += f'{question(tpl, subj)}\nCandidates: {", ".join(cand)}\nAnswer:'
    return p, gold, cand, question(tpl, subj)


def match(text, cand):
    """The model's answer: the JSON "answer" field if present, else the first line (the scripts stop
    generation at the first newline). Returns the matching candidate, or the raw answer if it names
    something outside the candidate list (which counts as incorrect)."""
    m = re.search(r'"answer"\s*:\s*"([^"]*)"', text)
    if m:
        text = m.group(1)
    else:
        text = next((ln for ln in text.splitlines() if ln.strip()), "")
    text = text.strip().strip(".").strip()
    for c in cand:
        if text == c:
            return c
    first = None
    for c in sorted(cand, key=len, reverse=True):
        i = text.find(c)
        if i >= 0 and (first is None or i < first[0]):
            first = (i, c)
    return first[1] if first else (text[:60] or None)
