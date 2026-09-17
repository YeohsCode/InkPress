"""Reddit source: official OAuth API (client_credentials, read-only).
Public JSON endpoints are IP-blocked (403) on this machine, so OAuth is required.

Setup (one-time, ~30s):
  1. https://www.reddit.com/prefs/apps -> "create another app..." -> type: script
  2. Fill pipeline/data/reddit.env with:
       REDDIT_CLIENT_ID=xxx
       REDDIT_CLIENT_SECRET=xxx
     (or export env vars with the same names)
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from pipeline.sources.common import dump  # noqa: E402
from pipeline.core import store  # noqa: E402

SOURCE = "reddit"
SUBREDDITS = ["OpenAI", "LocalLLaMA", "singularity", "artificial", "MachineLearning", "ClaudeAI", "ChatGPT", "ChatGPTCoding"]
TOP_N = 10
ENV_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "reddit.env")
UA = "macos:content-pipeline:v1.0 (research)"


class RedditAuthError(Exception):
    pass


def load_creds():
    cid = os.environ.get("REDDIT_CLIENT_ID", "")
    csec = os.environ.get("REDDIT_CLIENT_SECRET", "")
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding="utf-8"):
            line = line.strip()
            if line.startswith("REDDIT_CLIENT_ID="):
                cid = line.split("=", 1)[1].strip()
            elif line.startswith("REDDIT_CLIENT_SECRET="):
                csec = line.split("=", 1)[1].strip()
    return cid, csec


_token_cache = {"v": None, "exp": 0}


def get_token():
    if _token_cache["v"] and _token_cache["exp"] > time.time():
        return _token_cache["v"]
    cid, csec = load_creds()
    if not cid or not csec:
        raise RedditAuthError(
            "Reddit OAuth 凭据缺失。一次配置(30秒): https://www.reddit.com/prefs/apps "
            "创建 script 类型 app, 然后把 REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET "
            f"写进 {ENV_FILE}")
    req = urllib.request.Request(
        "https://www.reddit.com/api/v1/access_token",
        data=urllib.parse.urlencode({"grant_type": "client_credentials"}).encode(),
        headers={
            "Authorization": "Basic " + base64.b64encode(f"{cid}:{csec}".encode()).decode(),
            "User-Agent": UA,
        })
    d = json.load(urllib.request.urlopen(req, timeout=30))
    _token_cache["v"] = d["access_token"]
    _token_cache["exp"] = time.time() + int(d.get("expires_in", 3600)) - 120
    return _token_cache["v"]


def api(path, params=""):
    tok = get_token()
    url = f"https://oauth.reddit.com{path}?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}", "User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=30))


def fetch_sub(sub):
    raw = api(f"/r/{sub}/top", "t=day&limit=25")
    posts = []
    for child in raw.get("data", {}).get("children", []):
        d = child.get("data", {})
        if d.get("stickied"):
            continue
        posts.append({
            "item_id": d.get("id", ""),
            "sub": sub,
            "title": d.get("title", ""),
            "score": d.get("score", 0),
            "comments": d.get("num_comments", 0),
            "url": "https://reddit.com" + d.get("permalink", ""),
            "selftext": (d.get("selftext") or "")[:1500],
            "created_ts": d.get("created_utc", 0),
        })
    return posts


def top_comments(permalink, n=3):
    try:
        raw = api(permalink.rstrip("/"), "limit=6&sort=top")
        out = []
        for child in raw[1]["data"]["children"][:n]:
            body = child.get("data", {}).get("body", "")
            if body and body not in ("[deleted]", "[removed]"):
                out.append({"score": child["data"].get("score", 0), "body": body[:600]})
        return out
    except Exception:
        return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="1d", help="(informational; endpoint returns daily top)")
    ap.add_argument("--min-score", type=int, default=50)
    ap.add_argument("--with-comments", action="store_true")
    args = ap.parse_args()
    try:
        all_posts = []
        errors = {}
        for sub in SUBREDDITS:
            try:
                all_posts.extend(fetch_sub(sub))
            except Exception as e:
                errors[sub] = str(e)[:120]
        if errors and not all_posts:
            dump({"source": SOURCE, "error": "all subs failed", "detail": errors})
            return
        new = [p for p in all_posts if p["score"] >= args.min_score and store.is_new(SOURCE, p["item_id"])]
        store.mark_seen(SOURCE, [p["item_id"] for p in all_posts])
        ranked = sorted(new, key=lambda p: p["score"] + p["comments"] * 2, reverse=True)[:TOP_N]
        if args.with_comments:
            for p in ranked:
                p["top_comments"] = top_comments(p["url"].replace("https://reddit.com", ""))
        dump({"source": SOURCE, "new_count": len(new), "top": ranked, "sub_errors": errors})
    except RedditAuthError as e:
        dump({"source": SOURCE, "auth_required": True, "message": str(e)})


if __name__ == "__main__":
    main()
