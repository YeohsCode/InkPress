"""YouTube source: channel RSS feeds + metadata. Watchlist channels."""
import argparse
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from pipeline.sources.common import fetch_text, parse_rss, within_days, dump  # noqa: E402
from pipeline.core import store  # noqa: E402

SOURCE = "youtube"
# Watchlist: add channel IDs here (UC...). TBPN handled by tbpn.py separately.
WATCHLIST = {
    "UCSHZKyawb77ixDdsGog4iWA": "Lex Fridman",
    "UCNJ1Ymd5yFuUPtn21xtRbbw": "AI Explained",
    "UCawZsQWbGSbCI5yjkdVkTA": "Matthew Berman",
    "UCZHmQk67mSJgfCCTn7xBfew": "Yannic Kilcher",
}


def fetch_channel(ch_id, retries=3):
    last_err = None
    for i in range(retries):
        try:
            xml = fetch_text(f"https://www.youtube.com/feeds/videos.xml?channel_id={ch_id}", timeout=40)
            entries = parse_rss(xml)
            for it in entries:
                m = re.search(r'views="(\d+)"', it["description"]) or re.search(r'(\d[\d,]*) views', it["description"])
                it["views"] = int(m.group(1).replace(",", "")) if m else 0
            return entries
        except Exception as e:
            last_err = e
            time.sleep(5 * (i + 1))
    raise last_err


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="1d")
    ap.add_argument("--min-views", type=int, default=20000)
    args = ap.parse_args()
    days = float(args.since.rstrip("d").rstrip("h") or 1)
    results = []
    for ch_id, name in WATCHLIST.items():
        if not name:
            continue
        try:
            entries = [e for e in fetch_channel(ch_id) if within_days(e["published_ts"], days)]
        except Exception as e:
            results.append({"channel": name, "error": str(e), "items": []})
            continue
        new = [e for e in entries if store.is_new(SOURCE, e["id"])]
        store.mark_seen(SOURCE, [e["id"] for e in entries])
        results.append({"channel": name, "new_count": len(new), "items": [
            {"item_id": e["id"][:120], "title": e["title"], "link": e["link"], "published_ts": e["published_ts"]}
            for e in entries]})
    dump({"source": SOURCE, "window": args.since, "channels": results})


if __name__ == "__main__":
    main()
