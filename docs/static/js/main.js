/* IndicKLAR project page: theme toggle, copy buttons, benchmark explorer, results explorer. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- theme ---------- */
  const root = document.documentElement;
  const themeBtn = $("#theme-btn");
  function currentTheme() {
    return root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function paintThemeBtn() {
    const dark = currentTheme() === "dark";
    themeBtn.textContent = dark ? "☀" : "☾";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  try { const t = localStorage.getItem("theme"); if (t) root.dataset.theme = t; } catch (e) {}
  if (themeBtn) {
    paintThemeBtn();
    themeBtn.addEventListener("click", () => {
      root.dataset.theme = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
      paintThemeBtn();
    });
  }

  /* ---------- copy buttons ---------- */
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove();
    }
    const old = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = old), 1400);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const src = b.dataset.copy === "self" ? b.dataset.text : $(b.dataset.copy).textContent;
    copyText(src, b);
  });

  /* ---------- benchmark explorer ---------- */
  // Script and code-mixed target names exactly as used by the evaluation scripts (README §9).
  const LANGINFO = {
    asm: ["Assamese", "Assamese", "Assamglish", "as"], ben: ["Bengali", "Bengali", "Banglish", "bn"],
    doi: ["Dogri", "Dogri", "Dogrish", "doi"], guj: ["Gujarati", "Gujarati", "Gujlish", "gu"],
    hin: ["Hindi", "Hindi", "Hinglish", "hi"], kan: ["Kannada", "Kannada", "Kanglish", "kn"],
    kon: ["Konkani", "Konkani", "Konglish", "gom"], mai: ["Maithili", "Maithili", "Maithilish", "mai"],
    mal: ["Malayalam", "Malayalam", "Malyalamglish", "ml"], mar: ["Marathi", "Marathi", "Marglish", "mr"],
    nep: ["Nepali", "Nepali", "Nepglish", "ne"], ori: ["Odia", "Odia", "Odiglish", "or"],
    pun: ["Punjabi", "Punjabi", "Punglish", "pa"], san: ["Sanskrit", "Sanskrit", "Sanglish", "sa"],
    snd: ["Sindhi", "Sindhi", "Sindlish", "sd"], tam: ["Tamil", "Tamil", "Tamlish", "ta"],
    tel: ["Telugu", "Telugu", "Teluglish", "te"], urd: ["Urdu", "Urdu", "Urlish", "ur"],
  };
  const RTL = new Set(["snd", "urd"]);
  const pretty = (r) => r.replace(/_/g, " ");

  const PROMPTS = {
    Baseline: (L, q, c) => `${q}\nCandidates: ${c}\nAnswer:`,
    "TinT-CM": (L, q, c) => {
      const [lang, script, cm] = LANGINFO[L];
      return `You are answering factual questions written in ${lang} (${script} script).

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

Q: ${q}
Candidates: ${c}
Output:`;
    },
    "TinT-EN": (L, q, c) => {
      const [lang, script] = LANGINFO[L];
      return `You are answering factual questions written in ${lang} (${script} script).

You MUST internally translate the question into English to fully understand its meaning.
The translation must preserve the exact factual meaning of the question.

IMPORTANT:
- This translation is ONLY for internal reasoning
- Do NOT output the English translation under any circumstances

You MUST then select the correct answer based on this understanding.

Output MUST be a JSON object with EXACTLY one field:
  "answer": the correct answer chosen from the provided candidates

STRICT RULES:
- The answer MUST be chosen EXACTLY from the candidate list
- The answer MUST be written in ${lang} (${script} script) only
- Do NOT use English in the answer
- Do NOT output the translation
- Do NOT include any explanation
- Do NOT include any extra fields

FORMAT REQUIREMENT:
{"answer": "<candidate>"}

Q: ${q}
Candidates: ${c}
Output:`;
    },
  };

  let bench = null;
  const st = { lang: "hin", rel: "country_of_citizenship", idx: null, strat: "TinT-CM" };

  function fill(tpl, subj, blank) {
    const parts = tpl.split("<subject>");
    const withSubj = parts.join("\u0000");
    const plain = tpl.replace("<subject>", subj).replace("<mask>", "").trim();
    if (!blank) return plain;
    return esc(withSubj).replace("\u0000", `<b>${esc(subj)}</b>`).replace("&lt;mask&gt;", '<span class="blank" aria-label="answer blank"></span>');
  }
  const splitC = (c) => String(c).split(",").map((s) => s.trim()).filter(Boolean);

  function card(tier, tag, langAttr, rtl, tpl, fact) {
    const [subj, obj, cands] = fact;
    const chips = splitC(cands).map((c) => `<span class="cand${c === obj ? " gold" : ""}">${esc(c)}</span>`).join("");
    const plain = fill(tpl, subj, false);
    return `<article class="qcard" lang="${langAttr}"${rtl ? ' dir="rtl"' : ""}>
      <header dir="ltr"><span class="tier">${tier}</span>${tag}
        <button class="copy" type="button" data-copy="self" data-text="${esc(plain)}" aria-label="Copy ${tier} question">Copy</button></header>
      <div class="q">${fill(tpl, subj, true)}</div>
      <div class="cands" aria-label="Answer candidates">${chips}</div>
    </article>`;
  }

  function factsFor(rel) {
    return bench.order[rel].map(String);
  }

  function renderBench() {
    if (!bench) return;
    const ids = factsFor(st.rel);
    if (!ids.includes(st.idx)) st.idx = ids[0];
    const f = bench.facts[st.idx];
    const L = st.lang, info = LANGINFO[L], hasCM = bench.languages[L].cm;
    const en = card("English", "", "en", false, bench.templates.en[st.rel], f.en);
    const na = card(`Native · ${info[0]}`, "", info[3], RTL.has(L), bench.templates[L][st.rel], f[L]);
    const cm = hasCM
      ? card(`Code-mixed · ${info[2]}`, "", info[3], false, bench.templates[L + "-cm"][st.rel], f.en)
      : `<article class="qcard na"><div><b>No code-mixed variant</b><br>Code-mixed versions exist for 11 languages, where native-speaker verifiers were available. Try Hindi, Bengali, Tamil or Telugu.</div></article>`;
    $("#qgrid").innerHTML = en + na + cm;
    $("#fact-meta").textContent =
      `Fact #${st.idx} · ${pretty(st.rel)} · ${ids.indexOf(st.idx) + 1} of ${ids.length} sampled facts for this category`;
    renderPrompt();
  }

  function renderPrompt() {
    const f = bench.facts[st.idx];
    const L = st.lang;
    const [subj, , cands] = f[L];
    const q = bench.templates[L][st.rel].replace("<subject>", subj).replace("<mask>", "").trim();
    const c = splitC(cands).join(", ");
    const text = PROMPTS[st.strat](L, q, c);
    const pre = $("#prompt");
    const at = text.lastIndexOf("Q: ") >= 0 && st.strat !== "Baseline" ? text.lastIndexOf("Q: ") : 0;
    pre.innerHTML = esc(text.slice(0, at)) + `<span class="hl">${esc(text.slice(at))}</span>`;
    pre.setAttribute("lang", "und");
    $("#prompt-copy").dataset.text = text;
    $$("#strat-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === st.strat)));
  }

  function initBench() {
    const langSel = $("#lang-sel"), relSel = $("#rel-sel");
    langSel.innerHTML = Object.entries(LANGINFO)
      .map(([k, v]) => `<option value="${k}">${v[0]}${bench.languages[k].cm ? " (+ code-mixed)" : ""}</option>`).join("");
    relSel.innerHTML = bench.relations.map((r) => `<option value="${r}">${pretty(r)}</option>`).join("");
    langSel.value = st.lang; relSel.value = st.rel;
    langSel.onchange = () => { st.lang = langSel.value; renderBench(); };
    relSel.onchange = () => { st.rel = relSel.value; st.idx = null; renderBench(); };
    $("#shuffle").onclick = () => {
      const ids = factsFor(st.rel).filter((i) => i !== st.idx);
      st.idx = ids[Math.floor(Math.random() * ids.length)];
      renderBench();
    };
    $("#strat-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-s]"); if (!b) return;
      st.strat = b.dataset.s; renderPrompt();
    });
    // opens on the paper's Hindi "Ronaldo" illustration (first fact of country_of_citizenship)
    st.idx = factsFor(st.rel)[0];
    renderBench();
  }

  /* ---------- results explorer (dumbbell: baseline -> strategy, per language) ---------- */
  let res = null;
  const rs = { metric: "accuracy", model: 0, strat: "TinT-CM", sort: "gain" };
  const CM_LANGS = new Set(["Assamese", "Bengali", "Gujarati", "Hindi", "Malayalam", "Marathi", "Odia", "Punjabi", "Sanskrit", "Tamil", "Telugu"]);
  const f3 = (v) => v.toFixed(3);
  const sign = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(3);

  function renderChart() {
    const M = res[rs.metric];
    const langs = Object.keys(M).filter((l) => l !== "English");
    let rows = langs.map((l) => ({ l, b: M[l].Baseline[rs.model], s: M[l][rs.strat][rs.model] }));
    if (rs.sort === "gain") rows.sort((a, b) => (b.s - b.b) - (a.s - a.b));
    else if (rs.sort === "base") rows.sort((a, b) => a.b - b.b);
    else rows.sort((a, b) => a.l.localeCompare(b.l));
    const enRef = rs.metric === "accuracy" ? M.English.Baseline[rs.model] : null;

    const W = Math.max(320, Math.min(760, $("#chart-wrap").clientWidth || 760)), narrow = W < 520;
    const rowH = 28, top = 26, left = narrow ? 84 : 104, right = narrow ? 58 : 84, H = top + rows.length * rowH + 8;
    const x = (v) => left + v * (W - left - right);
    let g = "";
    for (let t = 0; t <= 1.0001; t += narrow ? 0.25 : 0.2) {
      g += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 4}"/>` +
           `<text x="${x(t)}" y="${top - 12}" text-anchor="middle">${narrow ? t.toFixed(2).replace(/0$/, "") : t.toFixed(1)}</text>`;
    }
    g += `<text x="${W - 4}" y="${top - 12}" text-anchor="end">Change</text>`;
    if (enRef != null) {
      g += `<line class="ref" x1="${x(enRef)}" x2="${x(enRef)}" y1="${top - 6}" y2="${H - 4}"/>` +
           `<text x="${x(enRef) + 4}" y="${H + 12}" text-anchor="middle" style="font-size:11.5px">English ${enRef.toFixed(2)}</text>`;
    }
    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2, d = r.s - r.b, neg = d < 0;
      g += `<g class="row" tabindex="0" data-i="${i}" aria-label="${r.l}: baseline ${f3(r.b)}, ${rs.strat} ${f3(r.s)}, change ${sign(d)}">
        <rect class="hit" x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" rx="4"/>
        <text class="lbl" x="${left - 10}" y="${y + 4}" text-anchor="end">${r.l}${CM_LANGS.has(r.l) ? " •" : ""}</text>
        <line class="stem${neg ? " neg" : ""}" x1="${x(r.b)}" x2="${x(r.s)}" y1="${y}" y2="${y}"/>
        <circle class="dot-base" cx="${x(r.b)}" cy="${y}" r="5.5"/>
        <circle class="dot-main" cx="${x(r.s)}" cy="${y}" r="5.5"/>
        <text x="${W - 4}" y="${y + 4}" text-anchor="end" style="font-variant-numeric:tabular-nums;fill:var(${neg ? "--bad" : "--text"})">${sign(d)}</text>
      </g>`;
    });
    const svg = $("#chart");
    svg.setAttribute("viewBox", `0 0 ${W} ${H + 18}`);
    svg.innerHTML = g;

    const model = res.models[rs.model];
    const mname = rs.metric === "accuracy" ? "Accuracy" : "Cross-lingual consistency (CLC)";
    $("#chart-title").textContent = `${mname}: Baseline → ${rs.strat}, ${model}`;
    const gains = rows.filter((r) => r.s > r.b).length;
    const mean = rows.reduce((a, r) => a + (r.s - r.b), 0) / rows.length;
    $("#chart-sub").textContent =
      `${rs.strat} improves ${gains} of ${rows.length} languages; mean change ${sign(mean)}.` +
      (enRef != null ? " Dashed line: the same model's accuracy on English." : "");

    // tooltip
    const tip = $("#tip"), wrap = $("#chart-wrap");
    function show(el) {
      const r = rows[+el.dataset.i];
      tip.innerHTML = `<b>${r.l}</b>${CM_LANGS.has(r.l) ? ' <span class="tag">has code-mixed</span>' : ""}
        <div class="r"><span>Baseline</span><span>${f3(r.b)}</span></div>
        <div class="r"><span>${rs.strat}</span><span>${f3(r.s)}</span></div>
        <div class="r"><span>Change</span><span>${sign(r.s - r.b)}</span></div>`;
      const wb = wrap.getBoundingClientRect(), eb = el.getBoundingClientRect();
      let left = Math.min(wb.width - 190, Math.max(0, eb.left - wb.left + eb.width * 0.55));
      tip.style.left = left + "px";
      tip.style.top = (eb.top - wb.top + eb.height + 4) + "px";
      tip.style.opacity = 1;
    }
    $$(".row", svg).forEach((el) => {
      el.addEventListener("mouseenter", () => show(el));
      el.addEventListener("focus", () => show(el));
      el.addEventListener("mouseleave", () => (tip.style.opacity = 0));
      el.addEventListener("blur", () => (tip.style.opacity = 0));
    });

    // table view
    $("#chart-table").innerHTML =
      `<thead><tr><th>Language</th><th>Baseline</th><th>${esc(rs.strat)}</th><th>Change</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td>${r.l}</td><td>${f3(r.b)}</td><td>${f3(r.s)}</td><td>${sign(r.s - r.b)}</td></tr>`).join("") +
      (enRef != null ? `<tr><td>English (reference)</td><td>${f3(enRef)}</td><td></td><td></td></tr>` : "") + "</tbody>";

    $$("#metric-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === rs.metric)));
  }

  function initResults() {
    const ms = $("#model-sel"), ss = $("#strat-sel"), so = $("#sort-sel");
    ms.innerHTML = res.models.map((m, i) => `<option value="${i}">${m}</option>`).join("");
    ss.innerHTML = res.strategies.filter((s) => s !== "Baseline").map((s) => `<option>${s}</option>`).join("");
    ss.value = rs.strat;
    ms.onchange = () => { rs.model = +ms.value; renderChart(); };
    ss.onchange = () => { rs.strat = ss.value; renderChart(); };
    so.onchange = () => { rs.sort = so.value; renderChart(); };
    $("#metric-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-m]"); if (!b) return;
      rs.metric = b.dataset.m; renderChart();
    });
    renderChart();
    let rw = 0;
    window.addEventListener("resize", () => { clearTimeout(rw); rw = setTimeout(renderChart, 150); });
  }

  /* ---------- lazy data loading ---------- */
  function load(url, cb, errSel) {
    fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(cb).catch(() => {
      const el = $(errSel); if (el) el.innerHTML = `<p class="note">Could not load the demo data (${esc(url)}). If you opened this file directly from disk, serve it over HTTP instead (e.g. <code>python3 -m http.server</code>).</p>`;
    });
  }
  function whenVisible(el, fn) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "400px" });
    io.observe(el);
  }
  whenVisible($("#explore"), () => load("static/data/samples.json", (d) => { bench = d; initBench(); }, "#qgrid"));
  whenVisible($("#results-explorer"), () => load("static/data/results.json", (d) => { res = d; initResults(); }, "#chart-wrap"));
})();
