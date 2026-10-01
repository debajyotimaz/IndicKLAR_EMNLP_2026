/* IndicKLAR project page: theme toggle, copy buttons, live Llama-3.1-8B demo. */
(function () {
  "use strict";
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

  /* ---------- demo: recorded Llama-3.1-8B-Instruct answers (temperature 0, so identical on every call) ---------- */
  const askBtn = $("#ask"), nextBtn = $("#next"), status = $("#status");
  let demo = null, lang = "hin", pos = 0;

  const facts = () => demo.langs[lang].facts;
  const fact = () => facts()[pos % facts().length];

  function resetCards() {
    $$(".tcard").forEach((c) => {
      c.classList.remove("ok", "no");
      $(".tans", c).textContent = "?";
    });
  }

  function renderQuestion() {
    const f = fact(), L = demo.langs[lang];
    $("#qpanel").innerHTML = `
      <div class="qmain" lang="${L.bcp}"${L.rtl ? ' dir="rtl"' : ""}>${esc(f.native)}</div>
      <dl class="qalt">
        <dt>Code-mixed</dt><dd lang="${L.bcp}">${esc(f.cm)}</dd>
        <dt>English</dt><dd>${esc(f.en)}</dd>
      </dl>`;
    resetCards();
    status.textContent = "";
    askBtn.disabled = false;
  }

  function show(form, r) {
    const c = $(`.tcard[data-form="${form}"]`);
    if (!c) return;
    if (!r || r.answer == null) { $(".tans", c).innerHTML = '<span class="muted">no answer</span>'; return; }
    c.classList.add(r.correct ? "ok" : "no");
    $(".tans", c).innerHTML = `<span class="ans-text">${esc(r.answer)}</span>
      <span class="verdict">${r.correct ? "✓ correct" : "✗ wrong"}</span>`;
  }

  function reveal() {
    const f = fact();
    // reveal left to right so the flip reads as a trajectory
    ["native", "cm", "en", "tint_cm"].forEach((form, i) => setTimeout(() => show(form, f.rec[form]), i * 180));
    status.textContent = `Correct answer: ${f.gold}`;
    askBtn.disabled = true;
  }

  function initDemo(d) {
    demo = d;
    const chips = $("#lang-chips");
    chips.innerHTML = Object.entries(d.langs)
      .map(([k, L]) => `<button type="button" data-l="${k}" aria-pressed="${k === lang}"><span lang="${L.bcp}">${esc(L.native)}</span> <small>${esc(L.name)}</small></button>`)
      .join("");
    chips.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-l]"); if (!b) return;
      lang = b.dataset.l; pos = 0;
      $$("button", chips).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderQuestion();
    });
    nextBtn.onclick = () => { pos += 1; renderQuestion(); };
    askBtn.onclick = reveal;
    renderQuestion();
  }

  fetch("static/data/demo.json").then((r) => r.json()).then(initDemo).catch(() => {
    $("#qpanel").innerHTML = '<p class="note">Could not load the demo questions.</p>';
  });
})();
