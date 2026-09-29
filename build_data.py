#!/usr/bin/env python3
"""
tokai-hazardのearthquake_hazard.jsonを読み込み、sumai-checker用の
公開データ(市町村一覧 + 市町村ごとの地震データ)を生成する。
"""
import json
import pathlib

SRC = pathlib.Path.home() / "projects/tokai-hazard/earthquake_hazard.json"
OUT_DIR = pathlib.Path(__file__).parent / "data"
OUT_EQ_DIR = OUT_DIR / "earthquake"

OUT_EQ_DIR.mkdir(parents=True, exist_ok=True)

with open(SRC, encoding="utf-8") as f:
    records = json.load(f)

index = []
for r in records:
    eq = r["earthquake"]
    status = "error" if "error" in eq else ("approx" if eq.get("note") else "ok")
    index.append({
        "pref": r["pref"],
        "city_group": r["city_group"],
        "name": r["name"],
        "code": r["code"],
        "status": status,
    })
    with open(OUT_EQ_DIR / f"{r['code']}.json", "w", encoding="utf-8") as f:
        json.dump(eq, f, ensure_ascii=False, indent=2)

with open(OUT_DIR / "municipalities.json", "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print(f"{len(index)} municipalities written to {OUT_DIR}")
