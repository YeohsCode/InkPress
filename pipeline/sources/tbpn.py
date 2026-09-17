"""TBPN source: podcast RSS -> new episodes -> whisper-cpp transcription (daily: metadata only)."""
import argparse
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from pipeline.sources.common import fetch_text, parse_rss, within_days, dump  # noqa: E402
from pipeline.core import store  # noqa: E402

RSS_URL = "https://feeds.transistor.fm/technology-brother"
SOURCE = "tbpn"
WHISPER_BIN = os.path.expanduser("~/bin-whisper/ggml-large-v3-turbo.bin")
RAW_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "raw", "tbpn")


def list_episodes(days):
    xml = fetch_text(RSS_URL, timeout=60)
    episodes = []
    for it in parse_rss(xml):
        m = re.search(r'itunes:duration>(\d+)<', it["description"]) or re.search(r'itunes:duration>(\d+)<', xml)
        episodes.append({
            "item_id": it["id"][:200],
            "title": it["title"],
            "link": it["link"],
            "published_ts": it["published_ts"],
            "audio_url": it.get("enclosure") or _audio_url(it["description"]) or it["link"],
        })
    return [e for e in episodes if within_days(e["published_ts"], days)]


def _audio_url(block):
    m = re.search(r'<enclosure[^>]*url="(https://media\.transistor\.fm/[^"]+)"', block)
    return m.group(1) if m else None


def transcribe(episode):
    """Download mp3, convert to 16k wav via ffmpeg, run whisper-cpp, return text."""
    os.makedirs(RAW_DIR, exist_ok=True)
    eid = re.sub(r"[^A-Za-z0-9]", "", episode["item_id"])[:24] or str(episode["published_ts"])
    mp3 = os.path.join(RAW_DIR, eid + ".mp3")
    wav = os.path.join(RAW_DIR, eid + ".wav")
    txt = os.path.join(RAW_DIR, eid + ".txt")
    if os.path.exists(txt):
        return open(txt, encoding="utf-8").read()
    if not os.path.exists(mp3):
        subprocess.run(["curl", "-sL", "--max-time", "900", "-A", "Mozilla/5.0",
                        "-o", mp3, episode["audio_url"]], check=True)
    if os.path.getsize(mp3) < 100000:
        os.remove(mp3)
        raise RuntimeError(f"audio download too small: {mp3}")
    if not os.path.exists(wav):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ar", "16000", "-ac", "1", wav], check=True)
    subprocess.run(["whisper-cli", "-m", WHISPER_BIN, "-f", wav, "-otxt", "-of", txt[:-4], "-l", "en"],
                   check=True, capture_output=True)
    return open(txt, encoding="utf-8").read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="1d", help="time window like 1d/2d/7d")
    ap.add_argument("--transcribe", metavar="ITEM_INDEX", type=int, help="transcribe Nth episode in window (0-based)")
    args = ap.parse_args()
    days = float(args.since.rstrip("d").rstrip("h") or 1)
    episodes = list_episodes(days)
    new = [e for e in episodes if store.is_new(SOURCE, e["item_id"])]
    store.mark_seen(SOURCE, [e["item_id"] for e in episodes])
    if args.transcribe is not None:
        if not episodes or args.transcribe >= len(episodes):
            dump({"error": "index out of range", "window_count": len(episodes)})
            return
        text = transcribe(episodes[args.transcribe])
        dump({"episode": episodes[args.transcribe]["title"], "chars": len(text), "text_head": text[:3000]})
        return
    dump({"source": SOURCE, "window": args.since, "episodes": episodes, "new_count": len(new)})


if __name__ == "__main__":
    main()
