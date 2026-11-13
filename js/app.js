// Grammar — библиотека: Essential, Advanced (юниты с упражнениями) и адаптированная книга (читалка).
// Роутинг, отрисовка, проверка упражнений, прогресс.
(function () {
  const app = document.getElementById("app");
  const E = window.MD.esc;
  window.CURRENT_UNIT = null; // для чата: { label } — что сейчас открыто

  // ---------- книги ----------
  // Essential оставлен на старых адресах (#/unit/N) и старом ключе прогресса — ссылки и прогресс не теряются.
  const BOOKS = {
    essential: {
      key: "essential", name: "Essential Grammar in Use", short: "Essential", level: "A1–B1",
      base: "data/", progressKey: "egu-progress-v1",
      list: "#/essential", unit: id => `#/unit/${id}`,
      about: "Базовая грамматика: от am/is/are до условных предложений. 114 тем.",
      search: "Поиск темы: past simple, much, if…"
    },
    advanced: {
      key: "advanced", name: "Advanced Grammar in Use", short: "Advanced", level: "B2–C1",
      base: "data/advanced/", progressKey: "agu-progress-v1",
      list: "#/advanced", unit: id => `#/adv/unit/${id}`,
      about: "Продвинутый уровень: тонкости времён, модальных глаголов, пассива, артиклей, инверсии. 100 тем.",
      search: "Поиск темы: inversion, subjunctive, whom…"
    }
  };
  const READERS = {
    metamorphosis: {
      id: "metamorphosis", title: "Metamorphosis", author: "Franz Kafka", level: "A2",
      about: "«Превращение» Кафки, адаптированное до уровня A2, без сокращений. Перевод слов по нажатию, словарик и вопросы к каждой главе."
    }
  };

  // ---------- хранилище (только localStorage, всё в try/catch) ----------
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* приватный режим и т.п. */ }
  }
  function resultSaver(progressKey, unitId) {
    return (exIdx, correct, total) => {
      const p = load(progressKey);
      p[unitId] = p[unitId] || {};
      p[unitId][exIdx] = { c: correct, t: total };
      save(progressKey, p);
    };
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
  const cache = {};
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function getIndex(book) {
    if (!cache[book.key]) cache[book.key] = await getJSON(book.base + "index.json");
    return cache[book.key];
  }
  async function getBook(id) {
    const k = "read:" + id;
    if (!cache[k]) cache[k] = await getJSON(`data/books/${id}.json`);
    return cache[k];
  }
  function allUnits(idx) {
    return idx.sections.flatMap(s => s.units.map(u => Object.assign({ section: s.title }, u)));
  }
  const pad = n => String(n).padStart(3, "0");

  function setNav(active) {
    document.querySelectorAll(".topnav a").forEach(a => a.classList.toggle("active", a.dataset.nav === active));
  }

  // ---------- библиотека (главная) ----------
  async function renderLibrary() {
    window.CURRENT_UNIT = null;
    setNav("home");
    let cards = "";
    for (const b of Object.values(BOOKS)) {
      let total = 0, ready = 0, done = 0;
      try {
        const idx = await getIndex(b);
        total = allUnits(idx).length; ready = (idx.ready || []).length;
        done = Object.keys(load(b.progressKey)).length;
      } catch (e) { /* покажем карточку без цифр */ }
      const stat = ready < total ? `готово ${ready} из ${total} тем` : `${total} тем`;
      cards += `<a class="book-card" href="${b.list}">
        <span class="level">${E(b.level)}</span>
        <h2>${E(b.short)}</h2>
        <p>${E(b.about)}</p>
        <span class="meta">${E(stat)}${done ? ` · начато тем: ${done}` : ""}</span></a>`;
    }
    for (const r of Object.values(READERS)) {
      const st = load("read-" + r.id);
      cards += `<a class="book-card reader" href="#/read/${r.id}${st.last ? "/" + st.last : ""}">
        <span class="level">${E(r.level)}</span>
        <h2>${E(r.title)}</h2>
        <p>${E(r.about)}</p>
        <span class="meta">${E(r.author)} · книга${st.last ? ` · продолжить с главы ${st.last}` : ""}</span></a>`;
    }
    app.innerHTML = `
      <section class="hero">
        <h1>Английский по шагам</h1>
        <p>Грамматика по темам учебников Р. Мёрфи (объяснения на русском и английском, схемы, упражнения с проверкой) и книга для чтения. Если что-то непонятно, нажмите <b>?</b> внизу справа и спросите помощника.</p>
      </section>
      <div class="book-grid">${cards}</div>`;
  }

  // ---------- список юнитов книги ----------
  async function renderList(book) {
    window.CURRENT_UNIT = { label: book.name };
    setNav(book.key);
    const idx = await getIndex(book);
    const prog = load(book.progressKey);
    const ready = new Set(idx.ready || []);
    let html = `
      <section class="hero">
        <p class="crumb"><a href="#/">Библиотека</a> · уровень ${E(book.level)}</p>
        <h1>${E(book.name)}</h1>
        <p>${E(book.about)}</p>
        <label class="search"><input id="search" type="search" placeholder="${E(book.search)}" autocomplete="off"></label>
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
          <a class="unit-link${isReady ? "" : " disabled"}" href="${book.unit(u.id)}">
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
  async function renderUnit(book, id) {
    setNav(book.key);
    const idx = await getIndex(book);
    const units = allUnits(idx);
    const pos = units.findIndex(u => u.id === id);
    if (pos < 0) { app.innerHTML = `<p>Юнит не найден. <a href="${book.list}">К списку</a></p>`; return; }
    const meta = units[pos];
    const prev = units[pos - 1], next = units[pos + 1];
    const nav = `<nav class="unit-nav">
        ${prev ? `<a href="${book.unit(prev.id)}">← ${prev.id}</a>` : "<span></span>"}
        <a href="${book.list}">Все юниты ${E(book.short)}</a>
        ${next ? `<a href="${book.unit(next.id)}">${next.id} →</a>` : "<span></span>"}
      </nav>`;
    const label = t => `${book.name}, Unit ${id}: ${t} (уровень ${book.level})`;

    let unit;
    try { unit = await getJSON(`${book.base}units/unit-${pad(id)}.json`); }
    catch (e) {
      window.CURRENT_UNIT = { label: label(meta.title) };
      app.innerHTML = `${nav}<h1 class="unit-title"><span class="num">Unit ${id}</span> ${E(meta.title)}</h1>
        <div class="card"><p>Этот юнит ещё готовится. Пока можно спросить помощника по этой теме — кнопка <b>?</b> внизу справа.</p></div>${nav}`;
      return;
    }
    window.CURRENT_UNIT = { label: label(unit.title || meta.title) };

    let html = `${nav}
      <p class="crumb">${E(book.short)} · ${E(meta.section)}</p>
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
    const onResult = resultSaver(book.progressKey, id);
    (unit.exercises || []).forEach((ex, i) => bindExercise(ex, i, onResult));
    window.scrollTo(0, 0);
  }

  // ---------- читалка: оглавление ----------
  async function renderBookHome(rid) {
    const r = READERS[rid];
    if (!r) { app.innerHTML = `<p>Книга не найдена. <a href="#/">В библиотеку</a></p>`; return; }
    setNav("read");
    const book = await getBook(rid);
    const st = load("read-" + rid);
    const done = st.quiz || {};
    window.CURRENT_UNIT = { label: `чтение книги ${book.title}` };
    app.innerHTML = `
      <section class="hero">
        <p class="crumb"><a href="#/">Библиотека</a> · книга · уровень ${E(r.level)}</p>
        <h1>${E(r.title)}</h1>
        <p>${E(book.intro)}</p>
        <p>${E(r.about)}</p>
      </section>
      <ul class="unit-list">${book.chapters.map((c, i) => `
        <li><a class="unit-link" href="#/read/${rid}/${i + 1}">
          <span class="num">${i + 1}</span><span class="t">${E(c.title)} <span class="muted">· ${c.words.length} слов, ${c.questions.length} вопросов</span></span>
          ${done[i + 1] ? `<span class="badge done">вопросы: ${done[i + 1].c} из ${done[i + 1].t}</span>` : st.last === i + 1 ? '<span class="badge soon">читаю</span>' : ""}
        </a></li>`).join("")}
      </ul>`;
    window.scrollTo(0, 0);
  }

  // ---------- читалка: глава ----------
  let scrollSaver = null;
  async function renderChapter(rid, n) {
    const r = READERS[rid];
    if (!r) { app.innerHTML = `<p>Книга не найдена. <a href="#/">В библиотеку</a></p>`; return; }
    setNav("read");
    const book = await getBook(rid);
    const ch = book.chapters[n - 1];
    if (!ch) { app.innerHTML = `<p>Глава не найдена. <a href="#/read/${rid}">К оглавлению</a></p>`; return; }
    const stKey = "read-" + rid;
    const st = load(stKey);
    st.last = n; save(stKey, st);
    window.CURRENT_UNIT = { label: `чтение книги ${book.title} (адаптация A2), ${ch.title}` };

    const dict = {};
    ch.words.forEach(w => { dict[w.en.toLowerCase()] = w.ru; });
    // **слово** → кнопка с переводом по нажатию (текст уже экранирован в MD.inline)
    const para = p => MD.inline(p).replace(/<strong>([^<]+)<\/strong>/g, (m, w) => {
      const ru = dict[w.toLowerCase()];
      return ru ? `<button type="button" class="w" data-ru="${E(ru)}">${w}</button>` : m;
    });
    const nav = `<nav class="unit-nav">
        ${n > 1 ? `<a href="#/read/${rid}/${n - 1}">← Глава ${n - 1}</a>` : "<span></span>"}
        <a href="#/read/${rid}">Оглавление</a>
        ${n < book.chapters.length ? `<a href="#/read/${rid}/${n + 1}">Глава ${n + 1} →</a>` : "<span></span>"}
      </nav>`;

    // вопросы главы → упражнения: «True or false» с автопроверкой, остальные — ответ своими словами + образец
    const tf = ch.questions.filter(q => "tf" in q), open = ch.questions.filter(q => !("tf" in q));
    const exs = [];
    if (tf.length) exs.push({ type: "choice", title: "True or false?", instruction: "Верно или неверно? Отметьте ответ и нажмите «Проверить».",
      items: tf.map(q => ({ q: q.q.replace(/^true or false:\s*/i, ""), options: ["True", "False"], answer: q.tf ? 0 : 1, why: q.answer })) });
    if (open.length) exs.push({ type: "write", title: "Ответьте на вопросы", instruction: "Ответьте по-английски коротко, своими словами, затем сравните с образцом.",
      items: open.map(q => ({ prompt: q.q, sample: q.answer })) });

    let html = `${nav}
      <p class="crumb">${E(book.title)} · ${E(r.author)}</p>
      <h1 class="unit-title">${E(ch.title)}</h1>
      <p class="muted reader-tip">Нажмите на выделенное слово, чтобы увидеть перевод.</p>
      <article class="card reader-text">${ch.paragraphs.map(p => `<p>${para(p)}</p>`).join("")}</article>
      <section class="card"><h2>Words</h2>
        <div class="table-wrap"><table><thead><tr><th>English</th><th>Русский</th></tr></thead><tbody>
        ${ch.words.map(w => `<tr><td><b>${E(w.en)}</b></td><td>${E(w.ru)}</td></tr>`).join("")}
        </tbody></table></div></section>
      <h2 class="ex-heading">Вопросы к главе</h2>`;
    exs.forEach((ex, i) => { html += exerciseHTML(ex, i); });
    html += nav;
    app.innerHTML = html;

    const onResult = (i, c, t) => {
      if (exs[i].type !== "choice") return;
      const s = load(stKey); s.quiz = s.quiz || {}; s.quiz[n] = { c, t }; save(stKey, s);
    };
    exs.forEach((ex, i) => bindExercise(ex, i, onResult));

    // перевод слова: одно открытое за раз, закрывается повторным нажатием или нажатием в другом месте
    app.querySelectorAll(".reader-text .w").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const was = b.classList.contains("open");
      app.querySelectorAll(".w.open").forEach(x => x.classList.remove("open"));
      if (!was) {
        b.classList.toggle("flip", b.getBoundingClientRect().left > window.innerWidth / 2);
        b.classList.add("open");
      }
    }));

    // позиция чтения в главе
    const pos = (load(stKey).pos || {})[n];
    window.scrollTo(0, pos || 0);
    if (scrollSaver) window.removeEventListener("scroll", scrollSaver);
    let tmr = null;
    scrollSaver = () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        if (location.hash !== `#/read/${rid}/${n}`) return;
        const s = load(stKey); s.pos = s.pos || {}; s.pos[n] = Math.round(window.scrollY); save(stKey, s);
      }, 400);
    };
    window.addEventListener("scroll", scrollSaver, { passive: true });
  }
  document.addEventListener("click", () => {
    document.querySelectorAll(".w.open").forEach(x => x.classList.remove("open"));
  });

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
    const src = ex.source === "book" ? '<span class="tag">по мотивам учебника</span>' : ex.source === "ai" ? '<span class="tag ai">дополнительно</span>' : "";
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
  function bindExercise(ex, i, onResult) {
    const root = document.getElementById("ex-" + i);
    const score = root.querySelector(".score");
    const report = (c, t) => {
      score.textContent = `${c} из ${t}`;
      score.className = "score " + (c === t ? "good" : c >= t * 0.7 ? "ok" : "bad");
      onResult(i, c, t);
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
        else { score.textContent = "Сравните с образцом"; score.className = "score ok"; onResult(i, 0, 0); }
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
    if (scrollSaver && !h.startsWith("#/read/")) { window.removeEventListener("scroll", scrollSaver); scrollSaver = null; }
    let m;
    try {
      if ((m = h.match(/^#\/unit\/(\d+)/))) await renderUnit(BOOKS.essential, parseInt(m[1], 10));
      else if ((m = h.match(/^#\/adv\/unit\/(\d+)/))) await renderUnit(BOOKS.advanced, parseInt(m[1], 10));
      else if (h.startsWith("#/essential")) await renderList(BOOKS.essential);
      else if (h.startsWith("#/advanced")) await renderList(BOOKS.advanced);
      else if ((m = h.match(/^#\/read\/([a-z0-9-]+)\/(\d+)/))) await renderChapter(m[1], parseInt(m[2], 10));
      else if ((m = h.match(/^#\/read\/([a-z0-9-]+)/))) await renderBookHome(m[1]);
      else await renderLibrary();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="card"><p>Не удалось загрузить данные. Обновите страницу.</p></div>`;
    }
  }
  window.addEventListener("hashchange", route);
  route();
})();
