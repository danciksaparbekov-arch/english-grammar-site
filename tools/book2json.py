# -*- coding: utf-8 -*-
"""Конвертация адаптированной книги (Markdown) в data/books/<id>.json для читалки сайта.
Формат входа: '# Chapter N', абзацы, '## Words' (таблица EN|RU), '## Questions' и '## Answers' (нумерованные).
Запуск: python -I -X utf8 tools/book2json.py <файл.md> <id>"""
import json, os, re, sys

src, book_id = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = open(src, encoding="utf-8").read().replace("\r\n", "\n").split("\n")

title, intro, chapters, ch, part = "", [], [], None, "text"
for ln in lines:
    t = ln.strip()
    if t.startswith("# ") and not t.startswith("# Chapter"):
        title = t[2:].strip(); continue
    if t.startswith("# Chapter"):
        ch = {"title": t[2:].strip(), "paragraphs": [], "words": [], "questions": [], "answers": []}
        chapters.append(ch); part = "text"; continue
    if t.startswith("## "):
        part = t[3:].strip().lower(); continue
    if not t:
        continue
    if ch is None:
        intro.append(t); continue
    if part == "text":
        ch["paragraphs"].append(t)
    elif part == "words" and t.startswith("|") and not re.match(r"^\|[\s:|-]+\|$", t):
        cells = [c.strip() for c in t.strip("|").split("|")]
        if cells[0].lower() != "english":
            ch["words"].append({"en": cells[0], "ru": cells[1]})
    elif part in ("questions", "answers"):
        m = re.match(r"^\d+\.\s*(.*)$", t)
        if m:
            ch[part].append(m.group(1))

for c in chapters:
    assert len(c["questions"]) == len(c["answers"]), c["title"]
    qs = []
    for q, a in zip(c.pop("questions"), c.pop("answers")):
        tf = q.lower().startswith("true or false:")
        item = {"q": q, "answer": a}
        if tf:  # «True or false» → тест с автопроверкой
            item["tf"] = a.lower().startswith("true")
        qs.append(item)
    c["questions"] = qs

out = {"id": book_id, "title": title, "intro": " ".join(intro), "chapters": chapters}
dst = os.path.join(ROOT, "data", "books", book_id + ".json")
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(dst, [(c["title"], len(c["paragraphs"]), len(c["words"]), len(c["questions"])) for c in chapters])
