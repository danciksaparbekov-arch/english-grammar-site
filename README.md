# English по шагам

Учебный сайт-библиотека:
- **Essential** — 114 юнитов по темам *Essential Grammar in Use* (R. Murphy), A1–B1;
- **Advanced** — 100 юнитов по темам *Advanced Grammar in Use*, B2–C1;
- **Книга** — Kafka, *Metamorphosis*, адаптация до A2 (по переводу David Wyllie, PG #5200): перевод слов по нажатию, словарик и вопросы к главам.

В каждом юните объяснение на русском и английском, схема построения и упражнения с автопроверкой (пропуски, тесты, письменные задания). Есть чат-помощник на Gemini.

Сайт статический (HTML/CSS/JS, без сборки) и работает на **GitHub Pages**. Прогресс хранится только в браузере (localStorage).

> Тексты объяснений и упражнений авторские, созданы по темам учебника. Текст учебника не копируется.

## Структура

| Путь | Что там |
|---|---|
| `index.html`, `css/`, `js/` | сам сайт |
| `js/config.js` | настройки, в том числе адрес чата `chatEndpoint` |
| `data/index.json` | список разделов и юнитов, поле `ready` заполняет `tools/validate.py` |
| `data/units/unit-NNN.json` | содержимое юнита, формат описан в `tools/SCHEMA.md` |
| `data/advanced/` | то же для Advanced (`index.json`, `units/`), требования — `tools/SCHEMA-ADVANCED.md` |
| `data/books/<id>.json` | книги для читалки, собираются `tools/book2json.py` из Markdown |
| `worker/` | Cloudflare Worker, прокси к Gemini (ключ хранится только там) |
| `tools/` | проверка данных и генерация индекса |

## Локальный запуск

```bash
python -m http.server 8000
# открыть http://localhost:8000
```

## Добавить или изменить юнит

1. Отредактировать или создать `data/units/unit-NNN.json` по `tools/SCHEMA.md`.
2. Запустить `python tools/validate.py` (для Advanced — `python tools/validate.py --book advanced`). Скрипт проверит формат и обновит список готовых юнитов.
3. Закоммитить и запушить. GitHub Pages обновится за минуту-две.

## Обновить книгу

```bash
python -X utf8 tools/book2json.py "<путь>/Metamorphosis A2 (full).md" metamorphosis
```

Входной Markdown: `# Chapter N`, абзацы (слова для словаря — `**жирным**`), `## Words` (таблица), `## Questions`, `## Answers`.
Новая книга добавляется ещё и в `READERS` в `js/app.js`.

## Чат с Gemini

Ключ Gemini **нельзя** класть в код сайта: репозиторий публичный, и ключ сразу утечёт. Поэтому запросы идут через бесплатный Cloudflare Worker, который хранит ключ в секрете.

1. Получить ключ: <https://aistudio.google.com/apikey>.
2. Установить Node.js и выполнить в папке `worker/`:
   ```bash
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put GEMINI_API_KEY   # вставить ключ
   ```
3. Wrangler покажет адрес вида `https://grammar-chat.<ваш-поддомен>.workers.dev`. Вписать его в `js/config.js`:
   ```js
   window.APP_CONFIG = { chatEndpoint: "https://grammar-chat.<...>.workers.dev" };
   ```
4. Закоммитить и запушить.

Защита в Worker:
- запросы принимаются только с адресов из `ALLOWED_ORIGINS` в `wrangler.toml`;
- не больше 15 запросов в минуту с одного IP;
- длина вопроса и истории ограничена;
- ошибки Google наружу не передаются.

Модель задаётся переменной `GEMINI_MODEL`.
