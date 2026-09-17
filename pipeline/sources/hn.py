"""Hacker News source (OPTIONAL extra, not in daily digest by default).
Kept after user feedback: HN was mistakenly swapped in as a Reddit replacement;
it is restored as a standalone optional source. Enable by adding "hn" to
digest.py module list."""
import argparse
import json
import os
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from pipeline.sources.common import fetch_text, dump  # noqa: E402
from pipeline.core import store  # noqa: E402

SOURCE = "hn"
HN_QUERIES = ["AI", "OpenAI", "LLM", "Anthropic", "Claude", "ChatGPT", "startup"]


def hn_top(days, min_points):
    seen = {}
    for q in HN_QUERIES:
        qe = urllib.parse.quote(q)
        url = (f"https://hn.algolia.com/api/v1/search?query={qe}&tags=story"
               f"&numericFilters=points>{min_points},created_at_i>{int(time.time()-days*86400)}"
               f"&hitsPerPage=20")
        try:
            d = json.loads(fetch_text(url, timeout=25))
        except Exception:
            continue
        for h in d.get("hits", []):
            oid = h.get("objectID")
            if not oid or oid in seen:
                continue
            seen[oid] = {
                "item_id": f"hn-{oid}",
                "title": h.get("title") or "",
                "points": h.get("points", 0),
                "comments": h.get("num_comments", 0),
                "link": h.get("url") or f"https://news.ycombinator.com/item?id={oid}",
                "hn_url": f"https://news.ycombinator.com/item?id={oid}",
                "created_ts": h.get("created_at_i", 0),
                "query": q,
            }
    return sorted(seen.values(), key=lambda x: x["points"] + x["comments"] * 2, reverse=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="1d")
    ap.add_argument("--min-points", type=int, default=80)
    ap.add_argument("--top", type=int, default=10)
    args = ap.parse_args()
    days = float(args.since.rstrip("d") or 1)
    posts = hn_top(days, args.min_points)[:args.top]
    new = [p for p in posts if store.is_new(SOURCE, p["item_id"])]
    store.mark_seen(SOURCE, [p["item_id"] for p in posts])
    dump({"source": SOURCE, "window": args.since, "new_count": len(new), "top": posts})


if __name__ == "__main__":
    main()
