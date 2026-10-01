// IndicKLAR live demo backend (Cloudflare Worker).
//
// Asks Llama-3.1-8B-Instruct (Cloudflare Workers AI) one IndicKLAR fact in four input forms, building
// prompts like the paper's evaluation scripts: 3-shot demonstrations from the same relation, the test
// question, and its candidate list. Only bundled facts can be asked, and every answer is cached in KV,
// so total model usage is bounded by (facts x languages x forms) no matter how much traffic arrives.
import DATA from "./data.js";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8"; // Llama-3.1-8B-Instruct, 8-bit weights
const PAGE = "https://debajyotimaz.github.io/IndicKLAR_EMNLP_2026/";
const ORIGINS = ["https://debajyotimaz.github.io", "http://localhost:8765", "http://127.0.0.1:8765"];
const FORMS = ["native", "cm", "en", "tint_cm"];
const CACHE_VERSION = "v3"; // bump to discard cached answers after changing prompts or model

// (language name, script name, code-mixed name) as passed to the evaluation scripts
const LANG = {
  asm: ["Assamese", "Assamese", "Assamglish"], ben: ["Bengali", "Bengali", "Banglish"],
  guj: ["Gujarati", "Gujarati", "Gujlish"], hin: ["Hindi", "Hindi", "Hinglish"],
  mal: ["Malayalam", "Malayalam", "Malyalamglish"], mar: ["Marathi", "Marathi", "Marglish"],
  ori: ["Odia", "Odia", "Odiglish"], pun: ["Punjabi", "Punjabi", "Punglish"],
  san: ["Sanskrit", "Sanskrit", "Sanglish"], tam: ["Tamil", "Tamil", "Tamlish"],
  tel: ["Telugu", "Telugu", "Teluglish"],
};

const tintCM = (lang, script, cm) => `You are answering factual questions written in ${lang} (${script} script).

You MUST internally perform code-mixed transformation before answering.

INTERNAL STEP (DO NOT OUTPUT):
- Convert the question into ${cm} using ${lang} grammar with English content words
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
- The answer MUST be written in ${script} script only
- Do NOT use English in the answer

OUTPUT FORMAT (STRICT):
Output ONLY a JSON object with a single field:
{"answer": "<answer in ${script} script>"}

- Do NOT output the ${cm} translation
- Do NOT output any explanation

`;

const cands = (s) => String(s).split(",").map((c) => c.trim()).filter(Boolean);
const question = (tpl, subj) => tpl.replace("<subject>", subj).replace("<mask>", "").trim();

function factView(idx, lang, form) {
  const f = DATA.facts[idx], rel = f.r;
  if (form === "en") { const [s, o, c] = f.en; return [s, o, cands(c), DATA.templates.en[rel]]; }
  if (form === "cm") { const [s, o, c] = f.en; return [s, o, cands(c), DATA.templates[lang + "-cm"][rel]]; }
  const [s, o, c] = f[lang]; return [s, o, cands(c), DATA.templates[lang][rel]];
}

function buildPrompt(idx, lang, form) {
  const rel = DATA.facts[idx].r;
  const demos = DATA.order[rel].map(String).filter((i) => i !== idx).slice(0, 3); // fixed demonstrations
  const [subj, gold, cand, tpl] = factView(idx, lang, form);
  let p = "";
  if (form === "tint_cm") {
    p = tintCM(...LANG[lang]);
    for (const d of demos) {
      const [ds, dobj, dc, dt] = factView(d, lang, form);
      p += `Q: ${question(dt, ds)}\nCandidates: ${dc.join(", ")}\nOutput: {"answer": "${dobj}"}\n\n`;
    }
    p += `Q: ${question(tpl, subj)}\nCandidates: ${cand.join(", ")}\nOutput:`;
  } else {
    for (const d of demos) {
      const [ds, dobj, , dt] = factView(d, lang, form);
      p += `${question(dt, ds)} ${dobj}\n`;
    }
    p += `${question(tpl, subj)}\nCandidates: ${cand.join(", ")}\nAnswer:`;
  }
  return { prompt: p, gold, cand };
}

// The model's answer: the JSON "answer" field if present, else the first line (the scripts stop at the
// first newline). Returns the matching candidate, or the raw answer if it is not a candidate (incorrect).
function match(text, cand) {
  const m = text.match(/"answer"\s*:\s*"([^"]*)"/);
  let t = m ? m[1] : (text.split("\n").find((l) => l.trim()) || "");
  t = t.trim().replace(/^\.+|\.+$/g, "").trim();
  if (cand.includes(t)) return t;
  let best = null;
  for (const c of [...cand].sort((a, b) => b.length - a.length)) {
    const i = t.indexOf(c);
    if (i >= 0 && (best === null || i < best[0])) best = [i, c];
  }
  return best ? best[1] : (t.slice(0, 60) || null);
}

async function ask(env, idx, lang, form) {
  const key = `${CACHE_VERSION}|${idx}|${lang}|${form}`;
  const hit = await env.CACHE.get(key, "json");
  if (hit) return { ...hit, cached: true };
  const { prompt, gold, cand } = buildPrompt(idx, lang, form);
  // Raw completion (no chat template), as the paper's scripts ran the model through vLLM.
  // TinT used guided JSON decoding with schema {"answer": string}; forcing the reply to start with
  // '{"answer": "' and cutting it at the closing quote is the equivalent constraint here.
  const prefix = form === "tint_cm" ? ' {"answer": "' : "";
  const t0 = Date.now();
  const out = await env.AI.run(MODEL, {
    prompt: prompt + prefix, raw: true, temperature: 0, seed: 12345,
    max_tokens: form === "tint_cm" ? 80 : 24,
  });
  let raw = String(out.response ?? "");
  if (prefix) raw = prefix.trim() + raw.split('"')[0] + '"}';
  raw = raw.trim();
  const answer = match(raw, cand);
  const res = { answer, gold, correct: answer === gold, raw: raw.slice(0, 300), seconds: (Date.now() - t0) / 1000 };
  await env.CACHE.put(key, JSON.stringify(res));
  return { ...res, cached: false };
}

function cors(req) {
  const o = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    if (url.pathname === "/health") return json(req, { ok: true, model: MODEL, facts: Object.keys(DATA.facts).length });
    if (url.pathname !== "/ask" || req.method !== "POST") return Response.redirect(PAGE + "#demo", 302);

    let body;
    try { body = await req.json(); } catch { return json(req, { detail: "Bad JSON." }, 400); }
    const idx = String(body.idx), lang = body.lang;
    if (!(idx in DATA.facts) || !(lang in LANG)) return json(req, { detail: "Unknown fact or language." }, 400);

    const entries = await Promise.all(FORMS.map(async (f) => {
      try { return [f, await ask(env, idx, lang, f)]; }
      catch (e) { return [f, { error: String(e.message || e).slice(0, 200) }]; }
    }));
    return json(req, { model: "meta-llama/Llama-3.1-8B-Instruct", results: Object.fromEntries(entries) });
  },
};
