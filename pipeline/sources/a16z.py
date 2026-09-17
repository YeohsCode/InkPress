"""a16z source: news-content listing page -> new articles (a16z RSS is dead, 404)."""
import argparse
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from pipeline.sources.common import fetch_text, html_to_text, dump  # noqa: E402
from pipeline.core import store  # noqa: E402

SOURCE = "a16z"
LIST_URL = "https://a16z.com/news-content/"


def list_articles(limit=25):
    html = fetch_text(LIST_URL, timeout=40)
    cards = re.findall(r'<a[^>]*href="(https://a16z\.com/[a-z0-9-]{20,}/)"[^>]*>(.{0,400}?)</a>', html, re.S)
    seen = {}
    for url, inner in cards:
        t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", inner)).strip()
        if url not in seen and t:
            seen[url] = t
    return [{"item_id": url, "title": t[:150], "link": url} for url, t in list(seen.items())[:limit]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="1d", help="(informational; listing is latest-N)")
    ap.add_argument("--full-text", action="store_true")
    ap.add_argument("--new-only", action="store_true", help="only items not yet in seen (first run marks all)")
    args = ap.parse_args()
    items = list_articles()
    if args.new_only:
        items = [it for it in items if store.is_new(SOURCE, it["item_id"])]
    store.mark_seen(SOURCE, [it["item_id"] for it in list_articles(40)])
    if args.full_text:
        for it in items:
            try:
                it["text"] = html_to_text(fetch_text(it["link"], timeout=40))[:12000]
            except Exception as e:
                it["text_error"] = str(e)
    dump({"source": SOURCE, "new_count": len(items), "items": items})


if __name__ == "__main__":
    main()
