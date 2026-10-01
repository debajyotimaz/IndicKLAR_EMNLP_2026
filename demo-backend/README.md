# Live demo backend

The project page's live demo asks **Llama-3.1-8B-Instruct** (`@cf/meta/llama-3.1-8b-instruct-fp8` on
Cloudflare Workers AI, free tier) one IndicKLAR fact in four forms: native script, code-mixed, English, and
native script with the TinT-CM prompt.

- `worker/`: the Cloudflare Worker. Prompts follow the evaluation scripts: 3-shot demonstrations from the
  same relation, raw completion (no chat template), temperature 0; TinT output is constrained to
  `{"answer": ...}` like the paper's guided JSON decoding. Only bundled facts can be asked and every answer
  is cached in KV, so total model usage is bounded.
- `tools/`: `make_worker_data.py` builds `worker/src/data.js` from `samples.json`; `record.py` asks the
  deployed Worker about demo facts (warming the cache); `build_demo.py` writes `docs/static/data/demo.json`
  with flip examples first and recorded answers as an offline fallback. `reference_prompts.py` is the
  Python reference of the prompt construction these scripts share.

Deploy: `cd worker && python3 ../tools/make_worker_data.py && npx wrangler deploy`.
