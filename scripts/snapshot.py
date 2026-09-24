r"""每日成本快照（CI schedule job 调用）：抓 OpenRouter benchmarks 的
costPerRequest，baseSlug 化后存 data/snapshots/YYYY-MM-DD.json 并更新
index.json。前端「降价榜」读最近两份做 diff——纯静态站用 git 当历史数据库。

零第三方依赖：python3 scripts/snapshot.py
"""
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parents[1]
DIR = ROOT / "data" / "snapshots"
KEEP = 90  # 滚动保留 90 天


def base_slug(s):
    s = str(s or "").split(":")[0]
    return re.sub(r"-(19|20)\d{6}.*$", "", s)


def fetch_cost():
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                "https://openrouter.ai/api/frontend/v1/rankings/benchmarks",
                headers={"User-Agent": "mubang-snapshot/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                j = json.load(r)
            d = j.get("data", j)
            if isinstance(d, dict) and "costPerRequest" not in d and "data" in d:
                d = d["data"]
            cost = d["costPerRequest"]
            if not cost:
                raise ValueError("empty costPerRequest")
            return cost
        except Exception:
            if attempt == 2:
                raise


def main():
    cost = fetch_cost()
    clean = {}
    for k, v in cost.items():
        b = base_slug(k)
        if v:
            clean[b] = min(v, clean[b]) if b in clean else v  # 同 base 取最低价
    today = str(date.today())
    DIR.mkdir(parents=True, exist_ok=True)
    (DIR / f"{today}.json").write_text(
        json.dumps({"date": today, "cost": clean}, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )
    files = sorted(p.name for p in DIR.glob("*.json"))
    for old in files[:-KEEP]:  # 滚动清理
        (DIR / old).unlink()
    files = sorted(p.name for p in DIR.glob("*.json"))
    (DIR / "index.json").write_text(
        json.dumps({"files": files}, ensure_ascii=False), encoding="utf-8"
    )
    print(f"snapshot {today}: {len(clean)} models, {len(files)} files on disk")


if __name__ == "__main__":
    main()
