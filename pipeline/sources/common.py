"""Common source utilities: HTTP fetch, RSS parse, time windows."""
import email.utils
import gzip
import io
import json
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            encoding = resp.headers.get("Content-Encoding")
    except (ssl.SSLError, urllib.error.URLError) as error:
        reason = getattr(error, "reason", error)
        if not isinstance(reason, ssl.SSLError) or not url.startswith("https://"):
            raise
        # macOS curl uses a separate TLS stack; keep certificate verification enabled.
        return subprocess.check_output([
            "curl", "--fail", "--silent", "--show-error", "--location",
            "--proto", "=https", "--proto-redir", "=https", "--compressed",
            "--max-time", str(timeout), "--user-agent", UA, url,
        ], timeout=timeout + 5)
    if encoding == "gzip" or data[:2] == b"\x1f\x8b":
        data = gzip.GzipFile(fileobj=io.BytesIO(data)).read()
    return data


def fetch_text(url, timeout=30):
    return fetch(url, timeout).decode("utf-8", "ignore")


def parse_rss(xml_text):
    """Minimal RSS/Atom parser returning [{title, link, published_ts, id, description, enclosure}]."""
    items = []
    for block in re.findall(r"<item>(.*?)</item>", xml_text, re.S) or \
                 re.findall(r"<entry>(.*?)</entry>", xml_text, re.S):
        def tag(name):
            m = re.search(r"<%s(?:[^>]*)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</%s>" % (name, name), block, re.S)
            return m.group(1).strip() if m else ""
        title = tag("title")
        link = tag("link") or ""
        if not link:
            m = re.search(r'<link[^>]*href="([^"]+)"', block)
            link = m.group(1) if m else ""
        pub = tag("pubDate") or tag("published") or tag("updated")
        ts = 0
        if pub:
            try:
                ts = email.utils.parsedate_to_datetime(pub).timestamp()
            except Exception:
                ts = 0
        guid = tag("guid") or tag("id") or link or title
        desc = tag("description") or tag("summary") or tag("content")
        enc = re.search(r'<enclosure[^>]*url="([^"]+)"', block)
        items.append({"title": title, "link": link, "published_ts": ts, "id": guid,
                      "description": desc, "enclosure": enc.group(1) if enc else ""})
    return items


def within_days(ts, days):
    return ts >= time.time() - days * 86400 if ts else False


def html_to_text(html):
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def dump(result):
    print(json.dumps(result, ensure_ascii=False, indent=1))
