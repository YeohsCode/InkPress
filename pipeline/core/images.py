"""XHS image generator. Single source of truth: data/report.json.
Style v3: PingFang fonts, 1.6x line spacing, word-level wrapping
(English words never split, punctuation never starts a line)."""
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "data", "images")

# Modern fonts: PingFang SC looks far better than STHeiti
def _pingfang():
    """Locate PingFang.ttc (macOS moves it around version to version)."""
    import subprocess
    try:
        out = subprocess.run(
            ["fc-list", ":lang=zh", "file"], capture_output=True, text=True, timeout=5
        ).stdout
        for ln in out.splitlines():
            if "PingFang" in ln and ".ttc" in ln:
                return ln.split(":")[0].strip()
    except Exception:
        pass
    for p in ("/System/Library/Fonts/PingFang.ttc",
              "/System/Library/Fonts/Supplemental/PingFang.ttc"):
        if os.path.exists(p):
            return p
    raise FileNotFoundError("PingFang.ttc not found; set FONT_BOLD/FONT_LIGHT env")

FONT_BOLD = os.environ.get("FONT_BOLD") or _pingfang()
FONT_LIGHT = os.environ.get("FONT_LIGHT") or FONT_BOLD
BOLD_IDX = 11     # PingFang SC Semibold
LIGHT_IDX = 3     # PingFang SC Regular

BG = "#FAF7F2"
INK = "#1A1A1A"
ACCENT = "#C8442A"
GRAY = "#8A8A8A"

W, H = 1242, 1656  # 3:4 XHS ratio

# Punctuation that must never start a line (CJK closing punct + a few ASCII)
NO_LINE_START = set("，。、；：？！）」』》〉…％%,.;:?!)]}>%\"'")
# Opening brackets must never END a line
NO_LINE_END = set("（「『《〈([{“")


def _font(path, size, idx=1):
    return ImageFont.truetype(path, size, index=idx)


def _center(draw, text, y, font, fill):
    w = draw.textlength(text, font=font)
    draw.text(((W - w) / 2, y), text, font=font, fill=fill)


def _tokens(text):
    """Split text into unbreakable tokens: latin words/numbers stay whole,
    each CJK char is its own token."""
    return re.findall(r"[A-Za-z0-9]+[%＄$]?", text) or []


def wrap(text, max_chars):
    """Word-aware wrapping. English words/numbers never split across lines;
    punctuation never starts a line; opening brackets never end a line.
    Width budget: CJK char = 1, latin char = 0.55."""
    lines, line, width = [], "", 0.0
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "\n":
            lines.append(line); line, width = "", 0.0; i += 1; continue
        # latin run -> whole word token
        if ch.isascii() and (ch.isalnum() or ch in "％$"):
            m = re.match(r"[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*[%＄$]?", text[i:])
            token = m.group(0)
            tw = len(token) * 0.55
            if width + tw > max_chars and line:
                lines.append(line.rstrip()); line, width = "", 0.0
            line += token; width += tw; i += len(token); continue
        # CJK char or single symbol
        if width + 1 > max_chars and line:
            # check last char of line: closing punct should move with us? No:
            # never START next line with closing punct -> pull it back
            lines.append(line.rstrip()); line, width = "", 0.0
        if ch in NO_LINE_START and line == "":
            # attach to previous line end
            if lines:
                lines[-1] += ch
                i += 1
                continue
            line += ch; width += 1; i += 1; continue
        line += ch; width += 1; i += 1
    if line:
        lines.append(line.rstrip())
    # post-pass: opening bracket must not end a line
    fixed = []
    for ln in lines:
        if ln and ln[-1] in NO_LINE_END and len(ln) > 1:
            # move opening bracket to next line: merge with next handled simply by
            # swapping: give back last char
            fixed.append((ln, True))
        else:
            fixed.append((ln, False))
    # simple second pass rebuild
    out, i2 = [], 0
    flat = []
    for ln, moved in fixed:
        flat.append(ln)
    # rebuild with bracket rule by re-wrapping greedily
    return _fix_brackets(flat, max_chars)


def _fix_brackets(lines, max_chars):
    """Ensure no line ends with an opening bracket: move bracket down by
    borrowing from next line, else trim."""
    out = []
    for idx, ln in enumerate(lines):
        nxt = lines[idx + 1] if idx + 1 < len(lines) else None
        while ln and ln[-1] in NO_LINE_END:
            if nxt:
                nxt = ln[-1] + nxt
            ln = ln[:-1]
        out.append(ln)
        if nxt is not None and idx + 1 == len(lines) - 1:
            lines[idx + 1] = nxt
    if out and lines:
        out[-1] = lines[-1]
    # dedupe continuity: lines after first may have been modified only for last
    return [l for l in out if l]


def cover(spec):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    y = 200
    if spec.get("kicker"):
        _center(d, spec["kicker"], y, _font(FONT_LIGHT, 40, LIGHT_IDX), GRAY)
        y += 96
    f_big = _font(FONT_BOLD, 116, BOLD_IDX)
    accent = spec.get("accent_word")
    for line in spec["title_lines"]:
        if accent and accent in line:
            pre, post = line.split(accent, 1)
            x = (W - d.textlength(line, font=f_big)) / 2
            d.text((x, y), pre, font=f_big, fill=INK)
            x += d.textlength(pre, font=f_big)
            d.text((x, y), accent, font=f_big, fill=ACCENT)
            x += d.textlength(accent, font=f_big)
            d.text((x, y), post, font=f_big, fill=INK)
        else:
            _center(d, line, y, f_big, INK)
        y += 178
    d.rectangle([(W - 260) / 2, H - 300, (W + 260) / 2, H - 294], fill=INK)
    _center(d, spec.get("series", "AI 圈每日一读"), H - 240, _font(FONT_LIGHT, 42, LIGHT_IDX), GRAY)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "cover.png")
    img.save(out)
    return out


def info_card(card, index):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    y = 130
    f_title = _font(FONT_BOLD, 80, BOLD_IDX)
    title = card["title"]
    tw = d.textlength(title, font=f_title)
    if tw > W - 200:
        # wrap title at 2 lines if too long
        for ln in wrap(title, 11):
            _center(d, ln, y, f_title, INK)
            y += 108
    else:
        _center(d, title, y, f_title, INK)
        y += 120
    d.rectangle([(W - 120) / 2, y, (W + 120) / 2, y + 6], fill=ACCENT)
    y += 70

    f_body = _font(FONT_LIGHT, 44, LIGHT_IDX)
    LH = 74          # line height ~1.7x
    PARA_GAP = 44
    max_chars = 22
    # overflow guard: shrink body font until everything (incl. page number at H-130) fits
    body_top = y
    avail_bottom = H - 200   # keep clear of page number zone
    for mc in range(22, 11, -1):
        est = sum(len(wrap(card["points"][j], mc)) for j in range(len(card["points"])))
        fs = int(44 * mc / 22)
        lh = int(74 * fs / 44)
        need = est * lh + (len(card["points"]) - 1) * 44
        if body_top + need <= avail_bottom:
            max_chars, f_body, LH = mc, _font(FONT_LIGHT, fs, LIGHT_IDX), lh
            break
    for p in card["points"]:
        for ln in wrap(p, max_chars):
            d.text((200, y), ln, font=f_body, fill=INK)
            y += LH
        y += PARA_GAP
    if card.get("index_label"):
        # flowing page number: fixed at H-130 unless body reaches it, then below body
        py = H - 130 if y + 60 < H - 130 else min(y + 10, H - 50)
        _center(d, card["index_label"], py, _font(FONT_LIGHT, 38, LIGHT_IDX), GRAY)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"info_{index:02d}.png")
    img.save(out)
    return out


def generate_from_report(report_path):
    report = json.load(open(report_path, encoding="utf-8"))
    paths = [cover(report["cover"])]
    for i, card in enumerate(report["cards"], 1):
        card.setdefault("index_label", f"{i:02d} / {len(report['cards'])}")
        paths.append(info_card(card, i))
    return paths


if __name__ == "__main__":
    ap = sys.argv[1:]
    report_path = os.path.join(ROOT, "data", "report.json")
    if "--report" in ap:
        report_path = ap[ap.index("--report") + 1]
    for p in generate_from_report(report_path):
        print(p)
