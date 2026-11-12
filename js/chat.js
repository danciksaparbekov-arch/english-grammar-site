// Чат с ИИ-помощником (Gemini через прокси Cloudflare Worker).
// Ключ API на сайте не хранится — его знает только Worker.
(function () {
  const cfg = window.APP_CONFIG || {};
  const toggle = document.getElementById("chat-toggle");
  const panel = document.getElementById("chat-panel");
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const SKEY = "egu-chat-v1";
  const MAX_HISTORY = 12;

  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(SKEY) || "[]") || []; } catch (e) { history = []; }
  const save = () => { try { sessionStorage.setItem(SKEY, JSON.stringify(history.slice(-30))); } catch (e) {} };

  function bubble(role, text, extraClass) {
    const div = document.createElement("div");
    div.className = "msg " + role + (extraClass ? " " + extraClass : "");
    div.innerHTML = role === "model" ? MD.render(text) : MD.esc(text).replace(/\n/g, "<br>");
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function greet() {
    log.innerHTML = "";
    const u = window.CURRENT_UNIT;
    bubble("model", u
      ? `Привет! Сейчас открыта тема **Unit ${u.id}: ${u.title}**. Спрашивайте про правило, примеры или почему ответ в упражнении именно такой.`
      : "Привет! Я помогу с английской грамматикой: объясню правило, разберу ошибку, приведу примеры.", "intro");
    history.forEach(m => bubble(m.role, m.text));
  }

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { greet(); input.focus(); }
  });
  document.getElementById("chat-close").addEventListener("click", () => { panel.hidden = true; });
  document.getElementById("chat-clear").addEventListener("click", () => { history = []; save(); greet(); });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!cfg.chatEndpoint) {
      bubble("user", text);
      bubble("model", "Чат пока не подключён: администратор сайта ещё не указал адрес сервера (см. README).", "error");
      input.value = "";
      return;
    }
    input.value = "";
    bubble("user", text);
    history.push({ role: "user", text });
    save();
    const wait = bubble("model", "Думаю…", "pending");
    form.querySelector("button").disabled = true;
    try {
      const u = window.CURRENT_UNIT;
      const r = await fetch(cfg.chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit: u ? `Unit ${u.id}: ${u.title}` : "",
          messages: history.slice(-MAX_HISTORY)
        })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.reply) throw new Error(data.error || ("HTTP " + r.status));
      wait.remove();
      bubble("model", data.reply);
      history.push({ role: "model", text: data.reply });
      save();
    } catch (err) {
      wait.remove();
      bubble("model", "Не получилось получить ответ (" + String(err.message || err) + "). Попробуйте ещё раз чуть позже.", "error");
      history.pop(); // не оставляем вопрос без ответа в истории
      save();
    } finally {
      form.querySelector("button").disabled = false;
    }
  });
})();
