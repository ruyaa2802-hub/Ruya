"""Turkish lip sync from a dialogue audio file.

1. faster-whisper gives word timings (cached next to the audio as .words.json)
2. each word is trimmed to where the audio is actually voiced (RMS envelope)
3. Turkish spelling is close to phonemic, so letters map straight to visemes
4. viseme targets are interpolated per frame and scaled by loudness, so
   whispers stay small and shouts open wide; breaths/sighs get a slight open.
"""
import json
import math
import os
import subprocess

import numpy as np

SR = 16000
HOP = 0.01  # envelope resolution (s)

# open amounts are pushed past "realistic": a 9:16 phone frame needs readable mouths
VISEMES = {
    "A": {"m_open": 1.0, "m_wide": 0.2},
    "E": {"m_open": 0.65, "m_wide": 0.6},
    "I": {"m_open": 0.38, "m_wide": 0.8},      # i
    "Y": {"m_open": 0.42, "m_wide": 0.35},     # ı
    "O": {"m_open": 0.7, "m_round": 0.8},
    "U": {"m_open": 0.32, "m_round": 1.0},
    "MBP": {"m_press": 1.0},
    "FV": {"m_open": 0.12, "m_wide": 0.3, "m_press": 0.35},
    "SH": {"m_open": 0.3, "m_round": 0.5},
    "T": {"m_open": 0.33, "m_wide": 0.25},     # t d n l r s z y k g h …
}
LETTER = {
    "a": "A", "â": "A", "e": "E", "i": "I", "î": "I", "ı": "Y", "o": "O", "ö": "O", "u": "U", "ü": "U", "û": "U",
    "b": "MBP", "p": "MBP", "m": "MBP", "f": "FV", "v": "FV",
    "c": "SH", "ç": "SH", "j": "SH", "ş": "SH",
}
WEIGHT = {"A": 1.0, "E": 1.0, "I": 0.9, "Y": 0.9, "O": 1.0, "U": 0.95, "MBP": 0.75, "FV": 0.7, "SH": 0.8, "T": 0.6}
MOUTH = ("m_open", "m_wide", "m_round", "m_press")


def load_audio(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def envelope(audio, sr=SR):
    hop = int(sr * HOP)
    n = len(audio) // hop
    frames = audio[: n * hop].reshape(n, hop)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    k = np.hanning(7)
    rms = np.convolve(rms, k / k.sum(), mode="same")
    ref = np.percentile(rms, 97) or 1.0
    return np.clip(rms / ref, 0, 1.5)


_model = None


def _tokens(text):
    return [t for t in text.replace("—", " ").replace("…", "… ").split() if any(c.isalpha() for c in t)]


def words(path, language="tr", model="small", text=None):
    """Word timings for an audio file, cached as <file>.words.json.

    With `text` (the script line), recognised words are replaced by the script's
    words when the counts match, so whispered or rare words keep correct spelling
    for visemes and subtitles while timings still come from the audio.
    """
    cache = os.path.splitext(path)[0] + ".words.json"
    if os.path.exists(cache) and os.path.getmtime(cache) >= os.path.getmtime(path) and text is None:
        with open(cache) as f:
            return json.load(f)
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(model, device="cpu", compute_type="int8")
    segs, _info = _model.transcribe(load_audio(path), language=language, word_timestamps=True)
    out = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)}
           for s in segs for w in s.words]
    if text:
        script = _tokens(text)
        if len(script) == len(out):
            for w, t in zip(out, script):
                w["asr"], w["word"] = w["word"], t
    with open(cache, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    return out


def _trim(env, start, end, thresh=0.1):
    """Shrink [start, end] to the voiced part of the envelope."""
    a, b = int(start / HOP), max(int(end / HOP), int(start / HOP) + 1)
    seg = env[a:b]
    voiced = np.nonzero(seg > thresh)[0]
    if len(voiced) == 0:
        return start, end
    s = (a + voiced[0]) * HOP
    e = (a + voiced[-1] + 1) * HOP
    if e - s < 0.06:
        e = s + 0.06
    return s, e


def phonemes(word):
    w = word.lower().replace("ğ", "")
    out = []
    for ch in w:
        if not ch.isalpha():
            continue
        v = LETTER.get(ch, "T")
        if out and out[-1] == v and v not in ("MBP",):
            continue          # doubled letters read as one longer sound
        out.append(v)
    return out


def track(path, intensity=1.0):
    """Return (times, {channel: values}) at HOP resolution for one line."""
    audio = load_audio(path)
    env = envelope(audio)
    n = len(env)
    t = np.arange(n) * HOP
    keys = []  # (time, viseme)
    for w in words(path):
        s, e = _trim(env, w["start"], w["end"])
        ph = phonemes(w["word"])
        if not ph:
            continue
        wts = np.array([WEIGHT[p] for p in ph])
        edges = s + (e - s) * np.concatenate([[0], np.cumsum(wts) / wts.sum()])
        keys.append((s - 0.03, None))
        for p, a, b in zip(ph, edges[:-1], edges[1:]):
            keys.append(((a + b) / 2, p))
        keys.append((e + 0.03, None))
    chans = {c: np.zeros(n) for c in MOUTH}
    if keys:
        kt = np.array([k[0] for k in keys])
        for c in MOUTH:
            kv = np.array([VISEMES[k[1]].get(c, 0.0) if k[1] else 0.0 for k in keys])
            chans[c] = np.interp(t, kt, kv, left=0.0, right=0.0)
    # loudness shaping: open scales with level; quiet breaths still part the lips
    level = np.clip(0.45 + 0.8 * env, 0, 1.3) * intensity
    speaking = np.zeros(n)
    for w in words(path):
        s, e = _trim(env, w["start"], w["end"])
        speaking[int(s / HOP):int(e / HOP) + 1] = 1.0
    speaking = np.convolve(speaking, np.ones(5) / 5, mode="same")
    chans["m_open"] = chans["m_open"] * level + (1 - speaking) * np.clip(env - 0.15, 0, 1) * 0.35
    chans["m_wide"] *= np.clip(level, 0, 1.0)
    # light smoothing (coarticulation) ~30 ms
    k = np.hanning(5)
    for c in MOUTH:
        chans[c] = np.convolve(chans[c], k / k.sum(), mode="same")
    chans["_env"] = env
    chans["_speaking"] = speaking
    return t, chans


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())
