# -*- coding: utf-8 -*-
"""Проверка data/units/*.json по tools/SCHEMA.md и обновление списка готовых юнитов в data/index.json.
Запуск из корня сайта:  python -I tools/validate.py
Код возврата 1, если найдены ошибки."""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
idx_path = os.path.join(ROOT, "data", "index.json")
idx = json.load(open(idx_path, encoding="utf-8"))
titles = {u["id"]: u["title"] for s in idx["sections"] for u in s["units"]}

# --only A-B : проверять только юниты из диапазона и НЕ трогать index.json (для параллельной работы)
ONLY = None
if "--only" in sys.argv:
    a, b = sys.argv[sys.argv.index("--only") + 1].split("-")
    ONLY = range(int(a), int(b) + 1)

errors, ready = [], []
GAP = re.compile(r"\{\{([^}]*)\}\}")


def err(f, msg):
    errors.append(f"{os.path.basename(f)}: {msg}")


for f in sorted(glob.glob(os.path.join(ROOT, "data", "units", "unit-*.json"))):
    try:
        u = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        err(f, f"не JSON: {e}")
        continue
    m = re.search(r"unit-(\d{3})\.json$", f)
    n = int(m.group(1)) if m else None
    if ONLY is not None and n not in ONLY:
        continue
    if u.get("id") != n:
        err(f, f"id={u.get('id')} не совпадает с именем файла")
    if n not in titles:
        err(f, "такого юнита нет в index.json")
    for k in ("title", "summary", "ru", "en", "structure"):
        if not isinstance(u.get(k), str) or not u[k].strip():
            err(f, f"пустое поле {k}")
    if len(u.get("ru", "")) < 800:
        err(f, "ru слишком короткое (<800 символов)")
    if "<" in u.get("ru", "") + u.get("en", "") + u.get("structure", ""):
        err(f, "в тексте есть '<' — HTML не используется")
    exs = u.get("exercises", [])
    if not (6 <= len(exs) <= 9):
        err(f, f"упражнений {len(exs)} (нужно 6–8)")
    kinds = [e.get("type") for e in exs]
    for t in ("gap", "choice", "write"):
        if kinds.count(t) < 2:
            err(f, f"упражнений типа {t} меньше 2")
    for i, e in enumerate(exs, 1):
        t = e.get("type")
        if e.get("source") not in ("book", "ai"):
            err(f, f"упр.{i}: source должен быть book/ai")
        items = e.get("items") or []
        if not (3 <= len(items) <= 12):
            err(f, f"упр.{i}: пунктов {len(items)}")
        for j, it in enumerate(items, 1):
            where = f"упр.{i} п.{j}"
            if t == "gap":
                gaps = GAP.findall(it.get("text", ""))
                if not gaps:
                    err(f, f"{where}: нет пропуска {{...}}")
                if any(not g.split("|")[0].strip() for g in gaps):
                    err(f, f"{where}: пустой ответ в пропуске")
            elif t == "choice":
                opts = it.get("options")
                a = it.get("answer")
                if not it.get("q") or not isinstance(opts, list) or len(opts) < 2:
                    err(f, f"{where}: нет вопроса/вариантов")
                elif not isinstance(a, int) or not (0 <= a < len(opts)):
                    err(f, f"{where}: answer вне диапазона")
                elif len(set(opts)) != len(opts):
                    err(f, f"{where}: повторяются варианты")
                if not it.get("why"):
                    err(f, f"{where}: нет why")
            elif t == "write":
                if not it.get("prompt"):
                    err(f, f"{where}: нет prompt")
                if not it.get("answers") and not it.get("sample"):
                    err(f, f"{where}: нужен answers или sample")
                if "answers" in it and not (isinstance(it["answers"], list) and it["answers"]):
                    err(f, f"{where}: answers должен быть непустым списком")
            else:
                err(f, f"упр.{i}: неизвестный type {t}")
    ready.append(n)

if ONLY is None:
    idx["ready"] = sorted(x for x in ready if x is not None)
    json.dump(idx, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Проверено юнитов: {len(ready)}")
if errors:
    print("ОШИБКИ:")
    print("\n".join(errors))
    sys.exit(1)
print("Ошибок нет")
