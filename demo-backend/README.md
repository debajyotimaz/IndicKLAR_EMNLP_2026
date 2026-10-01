# Demo answers

The project page's demo shows real answers from **Llama-3.1-8B-Instruct** to IndicKLAR facts asked in four
forms: native script, code-mixed, English, and native script with the TinT-CM prompt. Prompts follow the
evaluation scripts (3-shot demonstrations from the same relation, raw completion, temperature 0; TinT output
constrained to `{"answer": ...}`). At temperature 0 the model gives the same answer on every call, so the page
ships the recorded answers (`docs/static/data/demo.json`) instead of calling a model: no quotas, no server.

- `worker/`: the Cloudflare Worker (Workers AI, `@cf/meta/llama-3.1-8b-instruct-fp8`) used to generate the
  answers. Its free daily allowance covers only a few dozen new questions, which is why the page does not
  call it live.
- `tools/record.py`: asks the Worker about demo facts and saves `recorded.json`.
- `tools/build_demo.py`: writes `docs/static/data/demo.json` from `recorded.json`, flip examples first.
- `tools/reference_prompts.py`: Python reference of the prompt construction and answer scoring.
- `tools/make_worker_data.py`: builds `worker/src/data.js` from `samples.json`.

To add questions: deploy the Worker (`cd worker && python3 ../tools/make_worker_data.py && npx wrangler deploy`),
run `record.py` (spread over days if the free allowance runs out), then `build_demo.py`.
