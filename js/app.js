// Grammar Essential — роутинг, отрисовка юнитов, проверка упражнений, прогресс.
(function () {
  const app = document.getElementById("app");
  const E = window.MD.esc;
  let INDEX = null;
  window.CURRENT_UNIT = null; // для чата: контекст текущей темы

  // ---------- прогресс (только localStorage, всё в try/catch) ----------
  const KEY = "egu-progress-v1";
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* приватный режим и т.п. */ }
  }
  function setExerciseResult(unitId, exIdx, correct, total) {
    const p = loadProgress();
    p[unitId] = p[unitId] || {};
    p[unitId][exIdx] = { c: correct, t: total };
    saveProgress(p);
  }

  // ---------- нормализация ответов ----------
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[‘’ʼ`´]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, " ")
      .replace(/\s*([,.!?])\s*/g, "$1 ")
      .trim()
      .replace(/[.!?\s]+$/, "")
      .trim();
  }
  function matches(value, answer) {
    const v = norm(value);
    if (!v) return false;
    return String(answer).split("|").some(a => norm(a) === v);
  }
  // показываем вариант без начального апострофа ("is", а не "'s"), чтобы не было «She 's got»
  function firstAnswer(a) {
    const alts = String(a).split("|");
    return alts.find(x => !/^['’]/.test(x.trim())) || alts[0];
  }

  // ---------- загрузка ----------
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function getIndex() {
    if (!INDEX) INDEX = await getJSON("data/index.json");
    return INDEX;
  }
  function allUnits(idx) {
    return idx.sections.flatMap(s => s.units.map(u => Object.assign({ section: s.title }, u)));
  }
  const pad = n => String(n).padStart(3, "0");

  // ---------- главная ----------
  async function renderHome() {
    window.CURRENT_UNIT = null;
    const idx = await getIndex();
    const prog = loadProgress();
    const ready = new Set(idx.ready || []);
    let html = `
      <section class="hero">
        <h1>Английская грамматика по шагам</h1>
        <p>Темы <i>Essential Grammar in Use</i>: объяснение на русском и английском, схема построения и упражнения с проверкой. Если что-то непонятно — нажмите <b>?</b> внизу справа и спросите помощника.</p>
        <label class="search"><input id="search" type="search" placeholder="Поиск темы: past simple, much, if…" autocomplete="off"></label>
      </section>`;
    for (const s of idx.sections) {
      html += `<section class="section" data-section><h2>${E(s.title)}</h2><ul class="unit-list">`;
      for (const u of s.units) {
        const isReady = ready.has(u.id);
        const p = prog[u.id] ? Object.values(prog[u.id]) : [];
        const done = p.length;
        const badge = !isReady ? '<span class="badge soon">скоро</span>'
          : done ? `<span class="badge done">${done} упр.</span>` : "";
        html += `<li data-title="${E((u.id + " " + u.title).toLowerCase())}">
          <a class="unit-link${isReady ? "" : " disabled"}" href="#/unit/${u.id}">
            <span class="num">${u.id}</span><span class="t">${E(u.title)}</span>${badge}
          </a></li>`;
      }
      html += "</ul></section>";
    }
    app.innerHTML = html;
    const search = document.getElementById("search");
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      app.querySelectorAll("[data-section]").forEach(sec => {
        let any = false;
        sec.querySelectorAll("li").forEach(li => {
          const ok = !q || li.dataset.title.includes(q);
          li.hidden = !ok; any = any || ok;
        });
        sec.hidden = !any;
      });
    });
  }

  // ---------- юнит ----------
  async function renderUnit(id) {
    const idx = await getIndex();
    const units = allUnits(idx);
    const pos = units.findIndex(u => u.id === id);
    if (pos < 0) { app.innerHTML = `<p>Юнит не найден. <a href="#/">К списку</a></p>`; return; }
    const meta = units[pos];
    const prev = units[pos - 1], next = units[pos + 1];
    const nav = `<nav class="unit-nav">
        ${prev ? `<a href="#/unit/${prev.id}">← ${prev.id}</a>` : "<span></span>"}
        <a href="#/">Все юниты</a>
        ${next ? `<a href="#/unit/${next.id}">${next.id} →</a>` : "<span></span>"}
      </nav>`;

    let unit;
    try { unit = await getJSON(`data/units/unit-${pad(id)}.json`); }
    catch (e) {
      window.CURRENT_UNIT = { id, title: meta.title };
      app.innerHTML = `${nav}<h1 class="unit-title"><span class="num">Unit ${id}</span> ${E(meta.title)}</h1>
        <div class="card"><p>Этот юнит ещё готовится. Пока можно спросить помощника по этой теме — кнопка <b>?</b> внизу справа.</p></div>${nav}`;
      return;
    }
    window.CURRENT_UNIT = { id, title: unit.title || meta.title };

    let html = `${nav}
      <p class="crumb">${E(meta.section)}</p>
      <h1 class="unit-title"><span class="num">Unit ${id}</span> ${E(unit.title || meta.title)}</h1>
      ${unit.summary ? `<p class="lead">${MD.inline(unit.summary)}</p>` : ""}
      <section class="card">
        <div class="tabs" role="tablist">
          <button class="tab active" data-tab="ru" role="tab">Объяснение · RU</button>
          <button class="tab" data-tab="en" role="tab">Explanation · EN</button>
        </div>
        <div class="tab-body md" data-body="ru">${MD.render(unit.ru)}</div>
        <div class="tab-body md" data-body="en" hidden>${MD.render(unit.en)}</div>
      </section>
      <section class="card">
        <h2>Построение</h2>
        <div class="md">${MD.render(unit.structure)}</div>
      </section>
      <h2 class="ex-heading">Упражнения</h2>`;
    (unit.exercises || []).forEach((ex, i) => { html += exerciseHTML(ex, i); });
    html += nav;
    app.innerHTML = html;

    app.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
      app.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      app.querySelectorAll(".tab-body").forEach(b => { b.hidden = b.dataset.body !== btn.dataset.tab; });
    }));
    (unit.exercises || []).forEach((ex, i) => bindExercise(ex, i, id));
    window.scrollTo(0, 0);
  }

  // ---------- упражнения: разметка ----------
  const TYPE_LABEL = { gap: "Вставьте пропуски", choice: "Выберите вариант", write: "Напишите" };

  function gapText(text, exI, itI) {
    let k = 0;
    const parts = String(text).split(/(\{\{[^}]*\}\})/);
    return parts.map(part => {
      const m = part.match(/^\{\{([^}]*)\}\}$/);
      if (!m) return MD.inline(part);
      const ans = m[1];
      // ширина «корзинами», чтобы длина поля не подсказывала ответ
      const len = firstAnswer(ans).length;
      const w = len <= 5 ? 8 : len <= 12 ? 14 : 24;
      return `<input class="gap" data-answer="${E(ans)}" data-k="${k++}" style="width:${w}ch" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Пропуск">`;
    }).join("");
  }

  function exerciseHTML(ex, i) {
    const n = i + 1;
    let body = "";
    if (ex.type === "gap") {
      body = `<ol class="items">${ex.items.map((it, j) => `<li class="item">${gapText(it.text, i, j)}${it.hint ? ` <span class="hint">(${E(it.hint)})</span>` : ""}</li>`).join("")}</ol>`;
    } else if (ex.type === "choice") {
      body = `<ol class="items">${ex.items.map((it, j) => `
        <li class="item choice" data-j="${j}">
          <div class="q">${MD.inline(it.q)}</div>
          <div class="options">${it.options.map((o, k) => `
            <label class="opt"><input type="radio" name="ex${i}-q${j}" value="${k}"> <span>${MD.inline(o)}</span></label>`).join("")}
          </div>
          ${it.why ? `<div class="why" hidden>${MD.inline(it.why)}</div>` : ""}
        </li>`).join("")}</ol>`;
    } else if (ex.type === "write") {
      body = `<ol class="items">${ex.items.map((it, j) => `
        <li class="item write" data-j="${j}">
          <div class="q">${MD.inline(it.prompt)}</div>
          <textarea rows="2" class="w-input" autocapitalize="sentences" spellcheck="false" placeholder="Ваш ответ…"></textarea>
          <div class="sample" hidden>${it.answers ? "Ожидаемый ответ: " : "Пример ответа: "}<b>${MD.inline(it.answers ? firstAnswer(it.answers[0]) : it.sample || "")}</b>${it.answers && it.sample ? `<br><span class="muted">${MD.inline(it.sample)}</span>` : ""}
            <span class="mismatch" hidden><br>Ваш вариант не совпал с ожидаемым, но тоже может быть верным.</span>
            <br><button class="link-btn ask" type="button">Спросить помощника про мой ответ →</button></div>
        </li>`).join("")}</ol>`;
    }
    const src = ex.source === "book" ? '<span class="tag">по мотивам учебника</span>' : '<span class="tag ai">дополнительно</span>';
    return `<section class="card exercise" id="ex-${i}">
      <div class="ex-head"><h3>${n}. ${E(ex.title || TYPE_LABEL[ex.type] || "Упражнение")}</h3>${src}</div>
      ${ex.instruction ? `<p class="instruction">${MD.inline(ex.instruction)}</p>` : ""}
      ${ex.example ? `<p class="ex-example">Пример: ${MD.inline(ex.example)}</p>` : ""}
      ${body}
      <div class="ex-actions">
        <button class="btn check" type="button">Проверить</button>
        <button class="btn ghost show" type="button">Показать ответы</button>
        <button class="btn ghost reset" type="button">Сбросить</button>
        <span class="score" aria-live="polite"></span>
      </div>
    </section>`;
  }

  // ---------- упражнения: логика ----------
  function bindExercise(ex, i, unitId) {
    const root = document.getElementById("ex-" + i);
    const score = root.querySelector(".score");
    const report = (c, t) => {
      score.textContent = `${c} из ${t}`;
      score.className = "score " + (c === t ? "good" : c >= t * 0.7 ? "ok" : "bad");
      setExerciseResult(unitId, i, c, t);
    };

    if (ex.type === "gap") {
      const inputs = [...root.querySelectorAll("input.gap")];
      inputs.forEach(inp => inp.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); const nx = inputs[inputs.indexOf(inp) + 1]; nx ? nx.focus() : root.querySelector(".check").click(); }
      }));
      root.querySelector(".check").onclick = () => {
        let c = 0;
        inputs.forEach(inp => {
          const ok = matches(inp.value, inp.dataset.answer);
          inp.classList.toggle("right", ok); inp.classList.toggle("bad", !ok);
          if (ok) c++;
        });
        report(c, inputs.length);
      };
      root.querySelector(".show").onclick = () => inputs.forEach(inp => {
        if (!matches(inp.value, inp.dataset.answer)) { inp.value = firstAnswer(inp.dataset.answer); inp.classList.remove("bad"); inp.classList.add("shown"); }
      });
      root.querySelector(".reset").onclick = () => { inputs.forEach(inp => { inp.value = ""; inp.className = "gap"; }); score.textContent = ""; };
    }

    if (ex.type === "choice") {
      const items = [...root.querySelectorAll(".item.choice")];
      const check = (reveal) => {
        let c = 0;
        items.forEach((li, j) => {
          const right = ex.items[j].answer;
          const picked = li.querySelector("input:checked");
          li.querySelectorAll(".opt").forEach((lab, k) => {
            lab.classList.remove("right", "bad");
            if (k === right && (reveal || picked)) lab.classList.add("right");
          });
          if (picked && +picked.value === right) c++;
          else if (picked) picked.closest(".opt").classList.add("bad");
          const why = li.querySelector(".why");
          if (why && (picked || reveal)) why.hidden = false;
        });
        return c;
      };
      root.querySelector(".check").onclick = () => report(check(false), items.length);
      root.querySelector(".show").onclick = () => check(true);
      root.querySelector(".reset").onclick = () => {
        items.forEach(li => {
          li.querySelectorAll("input").forEach(r => { r.checked = false; });
          li.querySelectorAll(".opt").forEach(l => l.classList.remove("right", "bad"));
          const why = li.querySelector(".why"); if (why) why.hidden = true;
        });
        score.textContent = "";
      };
    }

    if (ex.type === "write") {
      const items = [...root.querySelectorAll(".item.write")];
      root.querySelector(".check").onclick = () => {
        let c = 0, auto = 0;
        items.forEach((li, j) => {
          const it = ex.items[j], ta = li.querySelector("textarea");
          li.querySelector(".sample").hidden = false;
          if (it.answers) {
            auto++;
            const ok = it.answers.some(a => matches(ta.value, a));
            // несовпадение — не обязательно ошибка (свободная формулировка), поэтому жёлтым, а не красным
            ta.classList.toggle("right", ok); ta.classList.toggle("unsure", !ok);
            li.querySelector(".mismatch").hidden = ok || !ta.value.trim();
            if (ok) c++;
          }
        });
        if (auto) report(c, auto);
        else { score.textContent = "Сравните с образцом"; score.className = "score ok"; setExerciseResult(unitId, i, 0, 0); }
      };
      root.querySelector(".show").onclick = () => items.forEach(li => { li.querySelector(".sample").hidden = false; });
      items.forEach((li, j) => {
        li.querySelector(".ask").onclick = () => {
          const it = ex.items[j];
          const mine = li.querySelector("textarea").value.trim() || "(пока ничего не написала)";
          const expected = it.answers ? firstAnswer(it.answers[0]) : (it.sample || "");
          if (window.Chat) window.Chat.ask(
            `Задание: ${ex.instruction || ex.title || ""}\n${it.prompt}\nМой ответ: ${mine}\nОжидаемый ответ: ${expected}\nМой ответ верный? Если нет — объясни ошибку.`);
        };
      });
      root.querySelector(".reset").onclick = () => {
        items.forEach(li => { const ta = li.querySelector("textarea"); ta.value = ""; ta.className = "w-input"; li.querySelector(".sample").hidden = true; li.querySelector(".mismatch").hidden = true; });
        score.textContent = "";
      };
    }
  }

  // ---------- роутер ----------
  async function route() {
    const h = location.hash || "#/";
    const m = h.match(/^#\/unit\/(\d+)/);
    try {
      if (m) await renderUnit(parseInt(m[1], 10));
      else await renderHome();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="card"><p>Не удалось загрузить данные. Обновите страницу.</p></div>`;
    }
  }
  window.addEventListener("hashchange", route);
  route();
})();
