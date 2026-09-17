"""Digest: merge source outputs into one candidate JSON for the agent."""
import argparse
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")


def run_source(module, since):
    cmd = [sys.executable, "-m", f"pipeline.sources.{module}", "--since", since]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=600)
    if r.returncode != 0:
        return {"error": r.stderr[-500:]}
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"error": "bad json", "raw": r.stdout[-300:]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["daily", "weekly"], default="daily")
    args = ap.parse_args()
    since = "1d" if args.mode == "daily" else "7d"
    today = datetime.date.today().isoformat()
    os.makedirs(DATA, exist_ok=True)

    digest = {"mode": args.mode, "date": today, "sources": {}}
    for mod in ["tbpn", "a16z", "reddit", "youtube"]:
        digest["sources"][mod] = run_source(mod, since)
        if digest["sources"][mod].get("auth_required"):
            digest["sources"][mod]["note"] = "需要配置 data/reddit.env（见 reddit.env.example）"

    out = os.path.join(DATA, f"{args.mode}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(digest, f, ensure_ascii=False, indent=1)
    print(out)


if __name__ == "__main__":
    main()
