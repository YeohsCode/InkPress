"""Shared generic RSS source runner.

Each concrete source module defines FEED_URL + SOURCE then calls run().
Item ids are the RSS guid/link, deduped via store.seen.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from pipeline.sources.common import fetch_text, parse_rss, within_days, dump  # noqa: E402
from pipeline.core import store  # noqa: E402


def run(source, feed_url, days, top=15, keywords=None):
    items = []
    try:
        raw = parse_rss(fetch_text(feed_url, timeout=40))
    except Exception as e:
        return {"source": source, "error": str(e)[:300], "items": []}
    for it in raw:
        if not within_days(it["published_ts"], days):
            continue
        blob = (it["title"] + " " + it["description"]).lower()
        if keywords and not any(k in blob for k in keywords):
            continue
        items.append({
            "item_id": it["id"][:200],
            "title": it["title"],
            "link": it["link"],
            "published_ts": it["published_ts"],
            "description": it["description"][:600],
        })
    items.sort(key=lambda x: x["published_ts"], reverse=True)
    items = items[:top]
    new = [i for i in items if store.is_new(source, i["item_id"])]
    store.mark_seen(source, [i["item_id"] for i in items])
    return {"source": source, "new_count": len(new), "items": items}


def main(source, feed_url, keywords=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="1d")
    ap.add_argument("--top", type=int, default=15)
    args = ap.parse_args()
    days = float(args.since.rstrip("d").rstrip("h") or 1)
    dump(run(source, feed_url, days, args.top, keywords))
