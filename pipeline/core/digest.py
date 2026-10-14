"""Digest: merge source outputs into one candidate JSON for the agent."""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
SOURCES = ["tbpn", "a16z", "reddit", "youtube", "hn",
           "openai_news", "techcrunch_ai", "arstechnica", "simonw", "latent_space"]
EDITORIAL_RULES = {
    "rules_file": "EDITORIAL_RULES.md",
    "removed_sections": ["跟你有什么关系", "接下来干什么"],
    "instruction": "禁止读者关系页、行动建议页及其换名变体；按事件事实、机制、证据与分析推进，结尾继续讲事件，不对读者喊话或布置任务。",
}


def run_source(module, since):
    cmd = [sys.executable, "-m", f"pipeline.sources.{module}", "--since", since]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=600)
    if r.returncode != 0:
        return {"error": r.stderr[-500:]}
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"error": "bad json", "raw": r.stdout[-300:]}


def recent_topics(mode):
    """Topics published by the pipeline in the last 7 days (used to skip reposts).

    Pulls from two places: the digests table (saved digest content) and
    recent git log subjects of the output repo, if available.
    """
    window_days = 7 if mode == "daily" else 14
    topics = []

    # 1) previously saved digests
    db = os.path.join(DATA, "pipeline.db")
    if os.path.exists(db):
        import sqlite3
        import time as _t
        cutoff = _t.time() - window_days * 86400
        try:
            conn = sqlite3.connect(db)
            rows = conn.execute(
                "SELECT content FROM digests WHERE created_at >= ? ORDER BY created_at DESC",
                (cutoff,)).fetchall()
            conn.close()
            for (content,) in rows:
                topics.extend(_titles_from_digest(content))
        except Exception:
            pass

    # 2) current report.json (today's already-produced story, prevents re-pick)
    try:
        rep = json.load(open(os.path.join(DATA, "report.json"), encoding="utf-8"))
        lines = rep.get("cover", {}).get("title_lines", [])
        titles = [ln for ln in lines if ln]
        titles += [c.get("title", "") for c in rep.get("cards", []) if c.get("title")]
        topics.extend(titles)
    except Exception:
        pass

    # 3) recent commit subjects (published digests are committed to scripts/)
    try:
        r = subprocess.run(["git", "log", "--since", f"{window_days}.days", "--pretty=%s"],
                           capture_output=True, text=True, cwd=ROOT, timeout=15)
        if r.returncode == 0:
            topics.extend(l for l in r.stdout.splitlines() if l.strip())
    except Exception:
        pass

    # split into words, drop very short fragments
    words = set()
    for t in topics:
        for w in re.findall(r"[A-Za-z][A-Za-z0-9\-\.]{3,}", t):
            words.add(w)
    return sorted(words)


def _titles_from_digest(content):
    """Extract candidate topic titles from a stored digest content blob."""
    try:
        d = json.loads(content)
    except Exception:
        return re.findall(r"[^\n]{10,120}", content)[:30]
    titles = []
    if isinstance(d, dict):
        for v in d.values():
            if isinstance(v, dict):
                for item in v.get("items", []) or v.get("top", []) or []:
                    if isinstance(item, dict) and item.get("title"):
                        titles.append(item["title"])
    return titles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["daily", "weekly"], default="daily")
    args = ap.parse_args()
    since = "1d" if args.mode == "daily" else "7d"
    today = datetime.date.today().isoformat()
    os.makedirs(DATA, exist_ok=True)

    digest = {"mode": args.mode, "date": today, "editorial_rules": EDITORIAL_RULES,
              "sources": {}}
    for mod in SOURCES:
        digest["sources"][mod] = run_source(mod, since)
        if digest["sources"][mod].get("auth_required"):
            digest["sources"][mod]["note"] = "需要配置 data/reddit.env（见 reddit.env.example）"

    digest["recent_topics"] = recent_topics(args.mode)

    out = os.path.join(DATA, f"{args.mode}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(digest, f, ensure_ascii=False, indent=1)
    print(out)


if __name__ == "__main__":
    main()
