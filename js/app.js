// ============================================================
// UI: instellingen → toets → resultaat met foutanalyse
// ============================================================
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const course = window.COURSES[0];
  const engine = Engine.build(course);
  const missionTitle = Object.fromEntries(course.missions.map((m) => [m.id, m.titel]));
  const STORE_KEY = "oefentoets-frans-settings";

  const courseName = course.cursus.replace(/\s*\(.*\)$/, "");
  $("#courseTitle").textContent = courseName + " · woordenschat & grammatica";
  $("#footerCourse").textContent = "Leerstof: " + courseName;
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3200); };

  // ---------- instellingen ----------
  function renderTree() {
    const byMission = {};
    engine.units.forEach((u) => (byMission[u.mission] = byMission[u.mission] || []).push(u));
    $("#unitTree").innerHTML = Object.entries(byMission).map(([mid, list]) => {
      const group = (kind, title) => {
        const items = list.filter((u) => u.kind === kind);
        if (!items.length) return "";
        return `<div class="kindgroup"><div class="kindtitle">${title}</div>` + items.map((u) =>
          `<label class="unit"><input type="checkbox" class="unit-cb" data-kind="${u.kind}" data-mission="${mid}" value="${u.id}" ${u.defaultOn ? "checked" : ""}> ${esc(u.label)} <small>p.${u.page}</small></label>`).join("") + `</div>`;
      };
      const name = mid.startsWith("M") ? `Mission ${mid.slice(1)} – ${missionTitle[mid]}` : missionTitle[mid];
      return `<details class="mission" open><summary><label><input type="checkbox" class="mission-cb" data-mission="${mid}"> ${esc(name)}</label></summary>
        <div class="kinds">${group("vocab", "Woordenschat")}${group("gram", "Grammatica")}</div></details>`;
    }).join("");
    $$(".mission-cb").forEach((cb) => cb.addEventListener("change", () => {
      $$(`.unit-cb[data-mission="${cb.dataset.mission}"]`).forEach((u) => (u.checked = cb.checked));
      syncMissionBoxes();
    }));
    $$(".unit-cb").forEach((cb) => cb.addEventListener("change", syncMissionBoxes));
  }
  function syncMissionBoxes() {
    $$(".mission-cb").forEach((cb) => {
      const units = $$(`.unit-cb[data-mission="${cb.dataset.mission}"]`);
      const n = units.filter((u) => u.checked).length;
      cb.checked = n === units.length; cb.indeterminate = n > 0 && n < units.length;
    });
    const n = $$(".unit-cb:checked").length;
    const s = readSettings();
    $("#allInfo").classList.toggle("hidden", s.count !== "all");
    $("#bothDirsWrap").classList.toggle("hidden", s.dir !== "both");
    $("#setupMsg").textContent = !n ? "Kies minstens één onderdeel"
      : s.count === "all" ? `${n} ${n === 1 ? "onderdeel" : "onderdelen"} gekozen · ${engine.countAll(s)} vragen`
      : `${n} ${n === 1 ? "onderdeel" : "onderdelen"} gekozen · ${s.count} vragen`;
  }
  $$("[data-quick]").forEach((b) => b.addEventListener("click", () => {
    const q = b.dataset.quick;
    $$(".unit-cb").forEach((cb) => {
      const isExtra = !engine.units.find((u) => u.id === cb.value).defaultOn;
      cb.checked = q === "all" ? !isExtra : q === "none" ? false : cb.dataset.kind === q && !isExtra;
    });
    syncMissionBoxes();
  }));

  function readSettings() {
    return {
      units: $$(".unit-cb:checked").map((c) => c.value),
      dir: $('input[name="dir"]:checked').value,
      level: $('input[name="level"]:checked').value,
      count: (v => v === "all" ? "all" : +v)($('input[name="count"]:checked').value),
      bothDirs: $("#bothDirs").checked,
    };
  }
  function saveSettings(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {} }
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!s) return;
      $$(".unit-cb").forEach((c) => (c.checked = s.units.includes(c.value)));
      const set = (n, v) => { const el = $(`input[name="${n}"][value="${v}"]`); if (el) el.checked = true; };
      set("dir", s.dir); set("level", s.level); set("count", s.count); $("#bothDirs").checked = !!s.bothDirs;
    } catch (e) {}
  }

  // ---------- toets ----------
  let state = null;

  function show(id) { $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id)); $("#stopBtn").classList.toggle("hidden", id !== "screen-quiz"); window.scrollTo(0, 0); }

  function start(settings, questions) {
    questions = questions || engine.makeQuiz(settings);
    if (!questions.length) { $("#setupMsg").textContent = "Kies minstens één onderdeel"; return; }
    saveSettings(settings);
    state = { settings, questions, i: 0, results: [], answered: false, choice: null };
    show("screen-quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.i];
    state.answered = false; state.choice = null;
    $("#progressBar").style.width = (state.i / state.questions.length) * 100 + "%";
    $("#qCounter").textContent = `Vraag ${state.i + 1} van ${state.questions.length}`;
    $("#qTopic").textContent = q.unitLabel;
    $("#qInstruction").textContent = q.instruction;
    $("#qPrompt").textContent = q.prompt;
    $("#qHint").textContent = q.hint || "";
    $("#qFeedback").innerHTML = ""; $("#qFeedback").className = "feedback";
    $("#nextBtn").textContent = "Controleer ✓";
    const area = $("#qAnswerArea");
    if (q.mode === "mc") {
      area.innerHTML = `<div class="options">${q.options.map((o, k) => `<button class="option" data-k="${k}"><span class="key">${k + 1}</span>${esc(o)}</button>`).join("")}</div>`;
      $$(".option").forEach((b) => b.addEventListener("click", () => {
        if (state.answered) return;
        $$(".option").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected"); state.choice = q.options[+b.dataset.k];
        submit();
      }));
    } else {
      const accents = ["é", "è", "ê", "à", "â", "ç", "ù", "û", "ô", "î", "ë", "ï", "'"];
      area.innerHTML = `<input id="answer" class="answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Typ je antwoord…">
        <div class="acc-label">Klik om accenten in te voegen:</div><div class="accents">${accents.map((a) => `<button type="button" class="acc">${a}</button>`).join("")}</div>`;
      const inp = $("#answer");
      $$(".acc").forEach((b) => b.addEventListener("click", () => {
        const s = inp.selectionStart ?? inp.value.length;
        inp.value = inp.value.slice(0, s) + b.textContent + inp.value.slice(inp.selectionEnd ?? s);
        inp.focus(); inp.setSelectionRange(s + 1, s + 1);
      }));
      setTimeout(() => inp.focus(), 30);
    }
  }

  const STATUS_TEXT = {
    correct: "Juist!",
    accent: "Bijna: let op het accent.",
    article: "Het woord is juist, maar het lidwoord niet.",
    spelling: "Bijna: één letter fout.",
    wrong: "Fout.",
  };

  function submit() {
    if (state.answered) return next();
    const q = state.questions[state.i];
    const given = q.mode === "mc" ? state.choice : $("#answer").value;
    if (given == null || (q.mode === "text" && !given.trim())) { $("#qFeedback").textContent = "Geef eerst een antwoord."; return; }
    const r = engine.check(given, q, state.settings.level);
    state.results.push({ q, given, ...r });
    state.answered = true;
    const ok = r.points > 0;
    const fb = $("#qFeedback");
    fb.className = "feedback " + (r.status === "correct" ? "ok" : ok ? "warn" : "bad");
    fb.innerHTML = `<b>${STATUS_TEXT[r.status]}</b>` +
      (r.status !== "correct" ? ` Juist antwoord: <b>${esc(q.answerShown)}</b>` : "") +
      (r.status === "accent" && !ok ? " (op 'Moeilijk' telt een accentfout als fout)" : "") +
      (!ok && q.rule ? `<div class="rule">📘 p.${q.page}: ${esc(q.rule)}</div>` : "");
    if (q.mode === "mc") $$(".option").forEach((b) => {
      const o = q.options[+b.dataset.k];
      if (q.accepted.map(Engine.norm).includes(Engine.norm(o))) b.classList.add("right");
      else if (b.classList.contains("selected")) b.classList.add("wrongopt");
      b.disabled = true;
    });
    else $("#answer").readOnly = true;
    $("#nextBtn").textContent = state.i + 1 < state.questions.length ? "Volgende ➔" : "Bekijk resultaat 🏁";
    $("#nextBtn").focus();
  }

  function next() {
    state.i++;
    if (state.i < state.questions.length) renderQuestion(); else finish();
  }

  // ---------- resultaat ----------
  function finish() {
    const a = Engine.analyse(state.results, engine.units, missionTitle);
    state.analysis = a;
    $("#progressBar").style.width = "100%";
    $("#scoreBadge").textContent = a.pct >= 90 ? "🏆 Super gedaan!" : a.pct >= 70 ? "👍 Goed bezig" : a.pct >= 50 ? "💪 Nog even oefenen" : "📖 Herhalen maar!";
    $("#scoreBox").innerHTML = `<div class="big">${a.points} / ${a.total}</div><div class="sub">${a.pct}% juist · niveau ${({ easy: "makkelijk", normal: "normaal", hard: "moeilijk" })[state.settings.level]}</div>`;
    $("#conclusions").innerHTML = a.conclusions.map((c) => `<li class="${c.type}">${c.text}</li>`).join("");
    $("#topicTable").innerHTML = `<table><thead><tr><th>Onderdeel</th><th>Score</th><th></th></tr></thead><tbody>` +
      Object.values(a.byUnit).sort((x, y) => x.ok / x.n - y.ok / y.n).map((u) => {
        const p = Math.round((u.ok / u.n) * 100);
        return `<tr><td>${esc(u.label)} <small>${u.mission} · p.${u.page}</small></td><td>${u.ok}/${u.n}</td><td><div class="bar"><div class="${p >= 80 ? "ok" : p >= 60 ? "warn" : "bad"}" style="width:${p}%"></div></div></td></tr>`;
      }).join("") + `</tbody></table>`;
    $("#mistakeList").innerHTML = a.mistakes.length ? a.mistakes.map((r) => `
      <div class="mistake ${r.points ? "warn" : "bad"}">
        <div class="mq"><small>${esc(r.q.unitLabel)} · p.${r.q.page}</small><br>${esc(r.q.instruction)}: <b>${esc(r.q.prompt)}</b></div>
        <div>Jouw antwoord: <span class="given">${esc(r.given || "—")}</span> · Juist: <b>${esc(r.q.answerShown)}</b> <span class="tag">${({ accent: "accent", article: "lidwoord", spelling: "spelling", wrong: "fout" })[r.status]}</span></div>
      </div>`).join("") : "<p>Geen fouten!</p>";
    $("#retryMistakesBtn").style.display = a.mistakes.length ? "" : "none";
    show("screen-result");
  }

  // ---------- knoppen ----------
  $("#startBtn").addEventListener("click", () => start(readSettings()));
  $("#nextBtn").addEventListener("click", submit);
  $("#stopBtn").addEventListener("click", () => { if (state.results.length) finish(); else show("screen-setup"); });
  $("#againBtn").addEventListener("click", () => start(state.settings));
  $("#homeBtn").addEventListener("click", () => show("screen-setup"));
  $("#retryMistakesBtn").addEventListener("click", () => {
    const qs = state.analysis.mistakes.map((r) => ({ ...r.q }));
    start(state.settings, qs.sort(() => Math.random() - 0.5));
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#screen-quiz").classList.contains("active")) return;
    const q = state && state.questions[state.i];
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (q && q.mode === "mc" && !state.answered && /^[1-9]$/.test(e.key)) {
      const b = $$(".option")[+e.key - 1]; if (b) b.click();
    }
  });

  // ---------- later: koffie / feedback ----------
  const cfg = window.APP_CONFIG || {};
  const links = [];
  if (cfg.showCoffee !== false) links.push(cfg.buyMeACoffeeUrl
    ? `<a class="coffee" href="${esc(cfg.buyMeACoffeeUrl)}" target="_blank" rel="noopener">☕ Buy me a coffee</a>`
    : `<button type="button" class="coffee" id="coffeeBtn">☕ Buy me a coffee</button>`);
  if (cfg.feedbackEmail) links.push(`<a class="mail" href="mailto:${esc(cfg.feedbackEmail)}?subject=${encodeURIComponent("Suggestie oefentoets Frans")}">✉️ Suggestie?</a>`);
  $("#extraLinks").innerHTML = links.join("");
  const cb = $("#coffeeBtn");
  if (cb) cb.addEventListener("click", () => toast("Bedankt! ☕ De koffiepagina komt binnenkort online."));

  $$('input[type="radio"], #bothDirs').forEach((el) => el.addEventListener("change", syncMissionBoxes));
  renderTree(); loadSettings(); syncMissionBoxes();
})();
