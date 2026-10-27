"""Burned-in Shorts captions (ASS / libass).

Short chunks (max 3 words) timed from the per-word timings of each line, the
spoken word filling in with the speaker's colour (karaoke \\k), a small pop
on every chunk, thick outline, placed above the Shorts UI.
"""
import difflib
import os

from . import lipsync

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(ROOT, "assets", "fonts")
FONT = "Nunito Black"

# speaker colours as (R, G, B); text is white until the word is spoken
SPEAKERS = {"yastik": (120, 200, 255), "battaniye": (255, 196, 64)}
DEFAULT = (255, 230, 120)


def _ass_color(rgb, alpha=0):
    r, g, b = rgb
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def _ts(t):
    t = max(0.0, t)
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def _norm(w):
    return w.replace("İ", "i").replace("I", "ı").lower().strip(".,!?…\"'“”—- ")


def _align(tokens, words):
    """Give each script token a (start, end) from the recognised words."""
    if len(tokens) == len(words):
        return [(w["start"], w["end"]) for w in words]
    a, b = [_norm(t) for t in tokens], [_norm(w["word"]) for w in words]
    times = [None] * len(tokens)
    for blk in difflib.SequenceMatcher(None, a, b).get_matching_blocks():
        for k in range(blk.size):
            w = words[blk.b + k]
            times[blk.a + k] = (w["start"], w["end"])
    # fill gaps by interpolating between known neighbours
    t0 = words[0]["start"] if words else 0.0
    t1 = words[-1]["end"] if words else 1.0
    known = [(i, t) for i, t in enumerate(times) if t]
    for i in range(len(tokens)):
        if times[i]:
            continue
        p, (_, a_t) = max((k for k in known if k[0] < i), default=(-1, (t0, t0)))
        n, (b_t, _) = min((k for k in known if k[0] > i), default=(len(tokens), (t1, t1)))
        slot = max(b_t - a_t, 0.0) / (n - p - 1)        # share the gap evenly between unmatched tokens
        k = i - p - 1
        times[i] = (a_t + slot * k, a_t + slot * (k + 1))
    return times


def _chunks(tokens, max_words=3, max_chars=18):
    out, cur = [], []
    for i, tok in enumerate(tokens):
        cur.append(i)
        text = " ".join(tokens[j] for j in cur)
        if len(cur) >= max_words or len(text) >= max_chars or tok[-1:] in ".!?…,":
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def build_ass(lines, texts, path, t0=0.0, width=1080, height=1920, y=0.72):
    """lines: timeline line dicts (who, t, dur, path); texts: {line_id: script text}."""
    fs = int(height * 0.048)
    head = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {width}", f"PlayResY: {height}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding",
    ]
    for name, rgb in list(SPEAKERS.items()) + [("Default", DEFAULT)]:
        head.append(f"Style: {name},{FONT},{fs},{_ass_color(rgb)},{_ass_color((255, 255, 255))},"
                    f"{_ass_color((10, 10, 20))},{_ass_color((0, 0, 0), 110)},0,0,0,0,100,100,1,0,1,"
                    f"{max(4, fs // 11)},{max(2, fs // 28)},5,60,60,0,1")
    head += ["", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    events = []
    for ln in sorted(lines, key=lambda x: x["t"]):
        lid = os.path.splitext(os.path.basename(ln["path"]))[0]
        if lid not in texts:
            continue
        tokens = lipsync._tokens(texts[lid])
        words = lipsync.words(ln["path"])
        if not tokens or not words:
            continue
        times = _align(tokens, words)
        groups = _chunks(tokens)
        style = ln["who"] if ln["who"] in SPEAKERS else "Default"
        for gi, g in enumerate(groups):
            start = ln["t"] + times[g[0]][0] - 0.05
            if gi + 1 < len(groups):
                end = ln["t"] + times[groups[gi + 1][0]][0] - 0.05
            else:
                end = ln["t"] + max(times[g[-1]][1] + 0.35, ln["dur"])
            parts, cursor = [], start
            for j in g:
                w_start = ln["t"] + times[j][0]
                w_end = ln["t"] + times[j][1]
                gap = max(0.0, w_start - cursor)
                if gap > 0.01:
                    parts.append(f"{{\\k{int(round(gap * 100))}}}")
                parts.append(f"{{\\kf{max(1, int(round((w_end - max(w_start, cursor)) * 100)))}}}{tokens[j]} ")
                cursor = max(cursor, w_end)
            events.append([start, end, style, "".join(parts).rstrip()])
    # never stack two captions: each one ends when the next begins
    events.sort(key=lambda e: e[0])
    for cur, nxt in zip(events, events[1:]):
        cur[1] = min(cur[1], nxt[0] - 0.01)
    pop = "{\\fscx82\\fscy82\\t(0,90,\\fscx100\\fscy100)}"
    pos = f"{{\\pos({width // 2},{int(height * y)})}}"
    rows = [f"Dialogue: 0,{_ts(a - t0)},{_ts(b - t0)},{st},,0,0,0,,{pos}{pop}{txt}" for a, b, st, txt in events]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(head + rows) + "\n")
    return path
