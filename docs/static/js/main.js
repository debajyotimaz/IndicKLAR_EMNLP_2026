/* IndicKLAR project page: theme toggle, copy buttons, live Llama-3.1-8B demo. */
(function () {
  "use strict";
  // Backend: a Cloudflare Worker running Llama-3.1-8B-Instruct on Workers AI (source in demo-backend/ in the repository).
  const API = new URLSearchParams(location.search).get("api") || "https://indicklar-demo.indicklar.workers.dev";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- theme ---------- */
  const root = document.documentElement;
  const themeBtn = $("#theme-btn");
  const currentTheme = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  function paintThemeBtn() {
    const dark = currentTheme() === "dark";
    themeBtn.textContent = dark ? "☀" : "☾";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  if (themeBtn) {
    paintThemeBtn();
    themeBtn.addEventListener("click", () => {
      root.dataset.theme = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
      paintThemeBtn();
    });
  }

  /* ---------- copy buttons ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const text = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); }
    catch (err) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove();
    }
    const old = b.textContent; b.textContent = "Copied ✓"; setTimeout(() => (b.textContent = old), 1400);
  });

  /* ---------- live demo ---------- */
  const askBtn = $("#ask"), nextBtn = $("#next"), status = $("#status");
  let demo = null, lang = "hin", pos = 0, busy = false;

  const facts = () => demo.langs[lang].facts;
  const fact = () => facts()[pos % facts().length];

  function resetCards() {
    $$(".tcard").forEach((c) => {
      c.classList.remove("ok", "no", "loading");
      c.hidden = c.dataset.form === "cm" && !fact().cm;
      $(".tans", c).textContent = "–";
    });
    $$(".tarrow")[0].hidden = !fact().cm;
  }

  function renderQuestion() {
    const f = fact(), L = demo.langs[lang];
    $("#qpanel").innerHTML = `
      <div class="qmain" lang="${L.bcp}"${L.rtl ? ' dir="rtl"' : ""}>${esc(f.native)}</div>
      <dl class="qalt">
        ${f.cm ? `<dt>Code-mixed</dt><dd lang="${L.bcp}">${esc(f.cm)}</dd>` : ""}
        <dt>English</dt><dd>${esc(f.en)}</dd>
      </dl>`;
    resetCards();
    status.textContent = "";
    askBtn.disabled = false;
  }

  function show(form, r) {
    const c = $(`.tcard[data-form="${form}"]`);
    if (!c || c.hidden) return;
    c.classList.remove("loading");
    if (!r || r.error || r.answer == null) {
      $(".tans", c).innerHTML = `<span class="muted">${r && r.error ? "provider error, try again" : "no answer"}</span>`;
      return;
    }
    c.classList.add(r.correct ? "ok" : "no");
    $(".tans", c).innerHTML = `<span class="ans-text">${esc(r.answer)}</span>
      <span class="verdict">${r.correct ? "✓ correct" : "✗ wrong"}</span>`;
  }

  async function ask() {
    if (busy) return;
    busy = true; askBtn.disabled = true;
    const f = fact();
    $$(".tcard").forEach((c) => { if (!c.hidden) { c.classList.add("loading"); $(".tans", c).textContent = "thinking…"; } });
    status.textContent = "Asking Llama-3.1-8B…";
    const slow = setTimeout(() => (status.textContent = "Still thinking… (the first ask of a question can take a few seconds)"), 5000);
    const ctrl = new AbortController(); const kill = setTimeout(() => ctrl.abort(), 90000);
    const t0 = performance.now();
    try {
      const res = await fetch(API + "/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idx: f.idx, lang }), signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "HTTP " + res.status);
      const data = await res.json();
      Object.entries(data.results).forEach(([form, r]) => show(form, r));
      const cached = Object.values(data.results).every((r) => r.cached);
      status.textContent = `${cached ? "Answered" : "Live answers"} in ${((performance.now() - t0) / 1000).toFixed(1)} s. Correct answer: ${f.gold}`;
    } catch (err) {
      if (f.rec) {
        Object.entries(f.rec).forEach(([form, r]) => show(form, r));
        status.textContent = `The live server is unavailable right now, so these are recorded answers from the same model. Correct answer: ${f.gold}`;
      } else {
        $$(".tcard").forEach((c) => { c.classList.remove("loading"); $(".tans", c).textContent = "–"; });
        status.textContent = "Could not reach the live server. Please try again in a minute.";
      }
    } finally {
      clearTimeout(slow); clearTimeout(kill);
      busy = false; askBtn.disabled = false;
    }
  }

  function initDemo(d) {
    demo = d;
    const chips = $("#lang-chips");
    chips.innerHTML = Object.entries(d.langs)
      .map(([k, L]) => `<button type="button" data-l="${k}" aria-pressed="${k === lang}"><span lang="${L.bcp}">${esc(L.native)}</span> <small>${esc(L.name)}</small></button>`)
      .join("");
    chips.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-l]"); if (!b || busy) return;
      lang = b.dataset.l; pos = 0;
      $$("button", chips).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderQuestion();
    });
    nextBtn.onclick = () => { if (!busy) { pos += 1; renderQuestion(); } };
    askBtn.onclick = ask;
    renderQuestion();
  }

  fetch("static/data/demo.json").then((r) => r.json()).then(initDemo).catch(() => {
    $("#qpanel").innerHTML = '<p class="note">Could not load the demo questions.</p>';
  });
})();
