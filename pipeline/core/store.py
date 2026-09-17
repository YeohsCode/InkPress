"""SQLite store: seen-item dedup, candidate picks, digest log."""
import json
import os
import sqlite3
import time

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "pipeline.db")

def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""CREATE TABLE IF NOT EXISTS seen (
        source TEXT NOT NULL, item_id TEXT NOT NULL, first_seen REAL NOT NULL,
        PRIMARY KEY (source, item_id))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL, item_id TEXT NOT NULL, added_at REAL NOT NULL,
        digest_date TEXT NOT NULL, payload TEXT NOT NULL)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS digests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL, digest_date TEXT NOT NULL, created_at REAL NOT NULL,
        content TEXT NOT NULL)""")
    return conn

def is_new(source, item_id):
    with _conn() as c:
        row = c.execute("SELECT 1 FROM seen WHERE source=? AND item_id=?", (source, item_id)).fetchone()
        return row is None

def mark_seen(source, item_ids):
    with _conn() as c:
        now = time.time()
        c.executemany("INSERT OR IGNORE INTO seen VALUES (?,?,?)",
                      [(source, i, now) for i in item_ids])

def seen_ids(source):
    with _conn() as c:
        return {r[0] for r in c.execute("SELECT item_id FROM seen WHERE source=?", (source,))}

def add_picks(source, items, digest_date):
    """items: list of dicts with item_id + arbitrary payload fields."""
    with _conn() as c:
        now = time.time()
        c.executemany(
            "INSERT INTO picks (source, item_id, added_at, digest_date, payload) VALUES (?,?,?,?,?)",
            [(source, it["item_id"], now, digest_date, json.dumps(it, ensure_ascii=False)) for it in items])

def picks_since(days, source=None):
    cutoff = time.time() - days * 86400
    q = "SELECT source, payload FROM picks WHERE added_at >= ?"
    args = [cutoff]
    if source:
        q += " AND source=?"
        args.append(source)
    with _conn() as c:
        return [(s, json.loads(p)) for s, p in c.execute(q, args)]

def save_digest(kind, digest_date, content):
    with _conn() as c:
        c.execute("INSERT INTO digests (kind, digest_date, created_at, content) VALUES (?,?,?,?)",
                  (kind, digest_date, time.time(), content))

def stats():
    with _conn() as c:
        seen = dict(c.execute("SELECT source, COUNT(*) FROM seen GROUP BY source").fetchall())
        picks = dict(c.execute("SELECT source, COUNT(*) FROM picks GROUP BY source").fetchall())
        return {"seen": seen, "picks": picks}
