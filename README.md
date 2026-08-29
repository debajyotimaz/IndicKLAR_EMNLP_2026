# IndicKLAR: Cross-Lingual Consistency Evaluation

A research evaluation framework for studying how large language models answer factual questions in Indic languages — across prompting strategies that include **code-mixing**, **transliteration**, **English translation**, and **implicit reasoning**.

Accompanying the EMNLP 2026 submission. Paper preprint: **[arXiv:2605.29637](https://arxiv.org/abs/2605.29637)**. The dataset is released separately on the Hugging Face Hub: **[debajyotimaz/IndicKLAR](https://huggingface.co/datasets/debajyotimaz/IndicKLAR)**.

Code is released under the [MIT License](LICENSE); the dataset is released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Dataset Structure](#2-dataset-structure)
3. [Prompting Strategies](#3-prompting-strategies)
4. [Setup](#4-setup)
   - [Create a Virtual Environment](#41-create-a-virtual-environment)
   - [Install Dependencies](#42-install-dependencies)
5. [Running Experiments](#5-running-experiments)
   - [Using the Automation Script](#51-using-the-automation-script)
   - [Running a Single Script Manually](#52-running-a-single-script-manually)
6. [Output Format](#6-output-format)
7. [CLC Score Formula](#7-clc-score-formula)
8. [new\_data\_with\_context — Extended Experiments](#8-new_data_with_context--extended-experiments)
9. [Language & Script Reference](#9-language--script-reference)

---

## 1. Project Structure

```
cross_lingual_consistency/
├── requirements.txt
│
├── Evaluation_Scripts_IndicKLAR/         ← Main evaluation scripts (single dataset)
│   ├── IndicKLAR/                        ← Dataset folder (unzip IndicKLAR.zip here)
│   │   ├── hin/
│   │   │   ├── capital.json
│   │   │   ├── place_of_birth.json
│   │   │   └── ...
│   │   ├── hin-en/
│   │   ├── ben/
│   │   ├── ben-en/
│   │   ├── asm/
│   │   ├── asm-en/
│   │   └── en/
│   │
│   ├── filter_knowns_live.py             ← Base (EN/NA/CM) — no candidates
│   ├── filter_knowns_live_obj.py         ← Base (EN/NA/CM) — with candidates
│   ├── 1_call_cm_placeholder.py          ← 1Step-CM+Ans
│   ├── 1_call_en_placeholder.py          ← 1Step-EN+Ans
│   ├── 1_call_pure_implicit_cm.py        ← TinT-CM
│   ├── 1_call_pure_implicit_en.py        ← TinT-EN
│   ├── 2_call_cm_placeholder_correct.py  ← 2Step-CM
│   ├── 2_call_en_placeholder.py          ← 2Step-EN
│   ├── 2_call_transliteration.py         ← 2Step-Translit
│   └── automation.sh                     ← Master orchestrator
│
└── new_data_with_context/                ← Extended experiments on contextual dataset
    ├── new_data/                         ← Extended dataset folder
    │   ├── hin/
    │   ├── ben/
    │   └── ...
    ├── new_data_baseline.py
    ├── new_data_baseline_obj.py
    ├── new_data_tint_cm.py
    ├── new_data_tint_en.py
    └── new_data.sh
```

> **Important:** All Python scripts in `Evaluation_Scripts_IndicKLAR/` must be run from **inside** that directory, as data paths are resolved relative to the working directory.

---

## 2. Dataset Structure

Place the dataset inside `Evaluation_Scripts_IndicKLAR/IndicKLAR/`. Scripts glob for files at the pattern `IndicKLAR/*/*.json`, where the intermediate folder is the **language code**.

```bash
cd Evaluation_Scripts_IndicKLAR/
unzip IndicKLAR.zip -d IndicKLAR/
```

### JSON file format

Each relation file follows this schema:

```json
{
  "prompt_templates": [
    "<subject> का जन्म स्थान <mask> है।"
  ],
  "samples": [
    {
      "index": 0,
      "subject": "महात्मा गांधी",
      "object": "पोरबंदर",
      "object_candidates": ["पोरबंदर", "दिल्ली", "मुंबई", "चेन्नई"]
    }
  ]
}
```

- `prompt_templates[0]` — question template; `<subject>` and `<mask>` are filled at runtime.
- `object_candidates` — optional multiple-choice list. If absent, scripts fall back to open-ended prefix matching.

### Supported relations (20 total)

```
applies_to_jurisdiction  capital             capital_of       continent
country_of_citizenship   developer           field_of_work    headquarters_location
instrument               language_of_work_or_name             languages_spoken
location_of_formation    manufacturer        native_language  occupation
official_language        owned_by            place_of_birth   place_of_death
religion
```

---

## 3. Prompting Strategies

| Strategy | Script File | Transformation | Description |
|---|---|---|---|
| **Base (EN/NA/CM)** | `filter_knowns_live.py` / `filter_knowns_live_obj.py` | None | Direct prompting in the source language |
| **2Step-CM** | `2_call_cm_placeholder_correct.py` | Code-mix conversion | Convert to code-mixed form (call 1), then answer (call 2) |
| **2Step-EN** | `2_call_en_placeholder.py` | English translation | Translate to English (call 1), then answer (call 2) |
| **2Step-Translit** | `2_call_transliteration.py` | Roman transliteration | Transliterate to Roman script (call 1), then answer (call 2) |
| **1Step-CM+Ans** | `1_call_cm_placeholder.py` | Code-mix conversion | Emit code-mixed form and answer in a single pass |
| **1Step-EN+Ans** | `1_call_en_placeholder.py` | English translation | Emit English translation and answer in a single pass |
| **TinT-CM** | `1_call_pure_implicit_cm.py` | Latent code-mixed reasoning | Reason internally in code-mix; output only the answer |
| **TinT-EN** | `1_call_pure_implicit_en.py` | Latent English reasoning | Reason internally in English; output only the answer |

> All strategies start from the source query in the native script.

---

## 4. Setup

### 4.1 Create a Virtual Environment

```bash
# From the repo root (cross_lingual_consistency/)
python3 -m venv venv

# Activate — Linux / macOS
source venv/bin/activate

# Activate — Windows
venv\Scripts\activate
```

### 4.2 Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Key packages:**

| Package | Version | Role |
|---|---|---|
| `vllm` | 0.20.1 | LLM inference engine with guided JSON decoding |
| `torch` | 2.11.0 | Deep learning backend (CUDA required) |
| `transformers` | 5.8.0.dev0 | Model loading and tokenization |
| `datasets` | 3.3.1 | Data utilities |
| `huggingface_hub` | 1.14.0 | Model download and HF authentication |
| `numpy` | 2.3.5 | Numerical operations |
| `pandas` | 3.0.2 | Result aggregation and export |
| `openpyxl` | 3.1.5 | Excel output support |
| `matplotlib` | 3.10.1 | Plotting and analysis |
| `tqdm` | 4.67.1 | Progress bars |

> **CUDA note:** The pinned `torch` version requires CUDA. If your machine uses a different CUDA version, install torch separately first:
> ```bash
> pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cu121
> pip install -r requirements.txt
> ```

**For gated models** (e.g. Llama, Gemma), authenticate with Hugging Face once:

```bash
huggingface-cli login
# Paste your access token from https://huggingface.co/settings/tokens
```

---

## 5. Running Experiments

> All commands below must be run from inside `Evaluation_Scripts_IndicKLAR/`.

```bash
cd Evaluation_Scripts_IndicKLAR/
```

### 5.1 Using the Automation Script

`automation.sh` runs **all prompting strategies** for every configured language–model combination sequentially.

```bash
chmod +x automation.sh   # first time only
bash automation.sh
```

To configure which models and languages to run, edit the `MODELS` array and `run_language` calls in `automation.sh`:

```bash
MODELS=(
    "meta-llama/Llama-3.1-8B-Instruct"
    # "Qwen/Qwen2.5-7B"
    # "google/gemma-7b"
)

run_language  "hin"  "Hindi"    "Hindi"    "Hinglish"
run_language  "ben"  "Bengali"  "Bengali"  "Banglish"
run_language_en     # English baseline (no code-mixed variant)
```

All stdout and stderr are saved to `logs/<lang_code>/` automatically.

### 5.2 Running a Single Script Manually

```bash
# Example: 1Step-CM+Ans for Hindi
python 1_call_cm_placeholder.py \
    --model_name "meta-llama/Llama-3.1-8B-Instruct" \
    --lang_code "hin" \
    --data_dir "IndicKLAR" \
    --source_lang "Hindi" \
    --source_script "Hindi" \
    --target_lang "Hinglish"

# Example: TinT-CM for Bengali
python 1_call_pure_implicit_cm.py \
    --model_name "meta-llama/Llama-3.1-8B-Instruct" \
    --lang_code "ben" \
    --data_dir "IndicKLAR" \
    --source_lang "Bengali" \
    --source_script "Bengali" \
    --target_lang "Banglish"

# Example: 2Step-EN for Odia
python 2_call_en_placeholder.py \
    --model_name "meta-llama/Llama-3.1-8B-Instruct" \
    --lang_code "ori" \
    --data_dir "IndicKLAR" \
    --source_lang "Odia" \
    --source_script "Odia" \
    --target_lang "English"
```

Monitor live progress in a second terminal:

```bash
tail -f <output_dir>/<model_name>/<lang_code>/LIVE.json
```

---

## 6. Output Format

Every script creates a structured output directory:

```
<output_dir>/
└── <model_name>/
    └── <lang_code>/
        ├── summary.json    ← accuracy and CLC scores
        ├── detailed.json   ← per-sample results with full prompts
        └── LIVE.json       ← updated in real time during the run
```

### `summary.json`

```json
{
  "overall_acc": 0.632,
  "overall_clc": 0.581,
  "per_language_acc": {
    "hin": 0.71,
    "ben": 0.55
  },
  "per_language_clc": {
    "hin": 0.60,
    "ben": 0.56
  }
}
```

- **`overall_acc`** — fraction of questions answered correctly across all languages.
- **`overall_clc`** — Cross-Lingual Consistency score (Jaccard overlap of correct sample indices across languages).
- **`per_language_acc / clc`** — per-language breakdown.

### `detailed.json`

A JSON array where each entry contains:

| Field | Description |
|---|---|
| `index` | Sample index from the source file |
| `relation` | Relation name (e.g. `place_of_birth`) |
| `subject` | The subject entity |
| `question_<lang>` | The question shown to the model |
| `model_prediction` | Parsed answer from the model |
| `matched_candidate` | Which candidate was matched |
| `object_candidates` | Full candidate list |
| `ground_truth` | Correct answer |
| `is_correct` | Boolean correctness flag |
| `raw_output` | Exact model output text |
| `final_prompt` | The complete prompt sent to the model |

For two-call scripts, `stage1_prompt`, `stage1_raw_output`, `stage2_prompt`, and `stage2_raw_output` are also included.

---

## 7. CLC Score Formula

CLC measures how consistently the model answers the **same questions correctly across languages**, using pairwise Jaccard overlap of correct sample index sets.

**Per-language CLC** for language $L_i$:

$$\text{CLC}(L_i) = \frac{1}{|L| - 1} \sum_{j \neq i} \frac{|C_i \cap C_j|}{|C_i \cup C_j|}$$

**Overall CLC** — macro-average across all languages:

$$\text{CLC}_{\text{overall}} = \frac{1}{|L|} \sum_{i} \text{CLC}(L_i)$$

Where $C_i$ is the set of sample indices answered correctly in language $L_i$.

> A CLC of 1.0 means the model answers exactly the same questions correctly in every language. A CLC of 0.0 means no overlap across languages.

---

## 8. new\_data\_with\_context — Extended Experiments

The `new_data_with_context/` folder is a **separate, self-contained experiment suite** that runs the same prompting strategies on a contextual variant of the dataset. It mirrors the structure of `Evaluation_Scripts_IndicKLAR/` but covers a **reduced set of 9 relations** and includes additional contextual information in each sample.

### Scripts

| File | Strategy | Description |
|---|---|---|
| `new_data_baseline.py` | Base (NA/CM) | Direct prompting; no candidates |
| `new_data_baseline_obj.py` | Base (NA/CM) with candidates | Direct prompting; model selects from candidate list |
| `new_data_tint_cm.py` | TinT-CM | Latent code-mixed reasoning; output only the answer |
| `new_data_tint_en.py` | TinT-EN | Latent English reasoning; output only the answer |
| `new_data.sh` | Orchestrator | Runs all scripts for all language–model combinations |

### Dataset (`new_data/`)

Place the extended dataset inside `new_data_with_context/new_data/`:

```
new_data/
├── hin/
│   ├── capital.json
│   ├── official_language.json
│   └── ...
├── ben/
├── asm/
└── ...
```

**Supported relations (9):**

```
capital  capital_of  continent  country_of_citizenship
headquarters_location  languages_spoken  manufacturer
native_language  official_language
```

> This is a subset of the 20 relations used in the main evaluation suite.

### Running

```bash
cd new_data_with_context/

# Run all experiments
chmod +x new_data.sh
bash new_data.sh

# Or run a single script manually
python new_data_tint_cm.py \
    --model_name "meta-llama/Llama-3.1-8B-Instruct" \
    --lang_code "hin" \
    --data_dir "new_data" \
    --source_lang "Hindi" \
    --source_script "Hindi" \
    --target_lang "Hinglish"
```

Output follows the same `summary.json / detailed.json / LIVE.json` structure as the main experiments.

---

## 9. Language & Script Reference

| Lang Code | Language | Script (`--source_script`) | CM Target (`--target_lang`) |
|---|---|---|---|
| `hin` | Hindi | Hindi | Hinglish |
| `ben` | Bengali | Bengali | Banglish |
| `asm` | Assamese | Assamese | Assamglish |
| `ori` | Odia | Odia | Odiglish |
| `guj` | Gujarati | Gujarati | Gujlish |
| `tel` | Telugu | Telugu | Teluglish |
| `mal` | Malayalam | Malayalam | Malyalamglish |
| `mar` | Marathi | Marathi | Marglish |
| `mai` | Maithili | Maithili | Maithilish |
| `nep` | Nepali | Nepali | Nepglish |
| `pun` | Punjabi | Punjabi | Punglish |
| `kan` | Kannada | Kannada | Kanglish |
| `tam` | Tamil | Tamil | Tamlish |
| `urd` | Urdu | Urdu | Urlish |
| `snd` | Sindhi | Sindhi | Sindlish |
| `doi` | Dogri | Dogri | Dogrish |
| `kon` | Konkani | Konkani | Konglish |
| `san` | Sanskrit | Sanskrit | Sanglish |
| `en` | English | — | — (use `run_language_en`) |

The `-en` suffix subdirectories (e.g. `hin-en`, `ben-en`) contain code-mixed/romanized versions of the questions and are used only by the baseline scripts.
