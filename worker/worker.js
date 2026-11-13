// Cloudflare Worker: прокси к Gemini API для чата на сайте.
// Ключ хранится в секрете GEMINI_API_KEY (wrangler secret put GEMINI_API_KEY) — в репозитории его нет.
// Переменные (wrangler.toml → [vars]): ALLOWED_ORIGINS, GEMINI_MODEL.
// Необязательная привязка LIMITER (Rate Limiting) ограничивает частоту запросов с одного IP.

const SYSTEM_PROMPT = `Ты — дружелюбный репетитор английского языка для русскоязычной ученицы.
На сайте три раздела: грамматика по темам Essential Grammar in Use (A1–B1), Advanced Grammar in Use (B2–C1) и книга Kafka «Metamorphosis», адаптированная до A2.
Подстраивай уровень объяснения под открытый раздел: для Essential и книги — просто, для Advanced — с тонкостями (стиль, оттенки значения, исключения).
Если ученица читает книгу и спрашивает про слово или фразу — переведи, объясни грамматику простыми словами и дай 1–2 примера.
Правила:
- Отвечай по-русски, примеры давай на английском (с переводом, если он помогает).
- Пиши коротко и понятно: правило → 2–4 примера → типичная ошибка, если уместно.
- Если ученица прислала своё предложение, сначала скажи, верно ли оно, затем исправь и объясни почему.
- Можно отвечать на любые вопросы по английскому языку (лексика, произношение, перевод), но не уходи в посторонние темы.
- Не выдумывай: если не уверен, скажи об этом.
- Форматирование только простое: **жирный**, списки через "- ". Без HTML.`;

const MAX_MESSAGES = 12;
const MAX_TEXT = 2000;
const MAX_BODY = 30000;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, origin ? corsHeaders(origin) : {})
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const originOk = allowed.includes(origin);

    if (request.method === "OPTIONS") {
      return originOk ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, originOk ? origin : "");
    if (!originOk) return json({ error: "forbidden origin" }, 403, "");

    // Ограничение частоты (если привязка настроена)
    if (env.LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: "слишком много запросов, подождите минуту" }, 429, origin);
    }

    // Разбор и проверка тела
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "слишком длинный запрос" }, 413, origin);
    let body;
    try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad json" }, 400, origin); }

    const msgs = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    const contents = [];
    for (const m of msgs) {
      if (!m || (m.role !== "user" && m.role !== "model") || typeof m.text !== "string") continue;
      const text = m.text.slice(0, MAX_TEXT).trim();
      if (text) contents.push({ role: m.role, parts: [{ text }] });
    }
    // Gemini требует, чтобы диалог начинался с user
    while (contents.length && contents[0].role !== "user") contents.shift();
    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return json({ error: "пустой вопрос" }, 400, origin);
    }

    const unit = typeof body.unit === "string" ? body.unit.slice(0, 200) : "";
    const system = SYSTEM_PROMPT + (unit ? `\nСейчас у ученицы открыто: ${unit}.` : "");

    if (!env.GEMINI_API_KEY) return json({ error: "ключ API не настроен" }, 500, origin);
    // Основная модель + запасные (через запятую): при перегрузке/отсутствии модели пробуем следующую
    const models = [env.GEMINI_MODEL || "gemini-3.8-flash"]
      .concat(String(env.GEMINI_FALLBACK || "").split(","))
      .map(s => s.trim()).filter(Boolean).slice(0, 3);
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      // модели 3.x тратят часть лимита на «размышления» — запас побольше
      generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
    });

    let r, data = {}, used = "";
    for (const model of models) {
      used = model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      try {
        r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: payload
        });
      } catch (e) {
        r = null;
        continue;
      }
      data = await r.json().catch(() => ({}));
      if (r.ok || ![404, 500, 503].includes(r.status)) break;
    }
    if (!r) return json({ error: "сервис недоступен" }, 502, origin);
    if (!r.ok) {
      if (r.status === 503) return json({ error: "модель сейчас перегружена, попробуйте через минуту" }, 502, origin);
      // Подробности ошибки Google наружу не отдаём
      return json({ error: r.status === 429 ? "лимит модели исчерпан, попробуйте позже" : "ошибка модели (" + r.status + ")" }, 502, origin);
    }
    const reply = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("").trim();
    if (!reply) return json({ error: "пустой ответ модели" }, 502, origin);
    // какая модель ответила — для диагностики (видно в ответе, ключ не раскрывает)
    return json({ reply, model: data.modelVersion || used }, 200, origin);
  }
};
