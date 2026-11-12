# -*- coding: utf-8 -*-
# Строит data/index.json из оглавления Essential (только номера и названия юнитов).
import re, json, sys, os
src = sys.argv[1]
out = sys.argv[2]
sections, cur = [], None
for line in open(src, encoding="utf-8"):
    m = re.match(r"### (.+?) \(юниты", line)
    if m:
        cur = {"title": m.group(1), "units": []}
        sections.append(cur)
        continue
    m = re.match(r"- \[\[Essential Unit (\d+)\|(\d+) · (.+?)\]\]", line)
    if m and cur is not None:
        cur["units"].append({"id": int(m.group(1)), "title": m.group(3).strip()})
json.dump({"book": "Essential Grammar in Use", "sections": sections}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(sum(len(s["units"]) for s in sections), "units,", len(sections), "sections")
