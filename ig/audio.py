"""Episode sound mix and final MP4 muxing (ffmpeg)."""
import os
import subprocess

ROOM_TONE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sfx",
                         "room_tone.wav")


def mix(tl, out_wav, t0=0.0, t1=None):
    """Mix dialogue + sfx of a timeline into one stereo 48 kHz wav covering [t0, t1]."""
    t1 = t1 if t1 is not None else tl.duration
    items = [(ln["t"], ln["path"], 0.0, None, 0.0) for ln in tl.lines] + \
        [(s["t"], s["path"], s["gain"], s.get("dur"), s.get("fade", 0.05)) for s in tl.sounds]
    items = [it for it in items if it[0] < t1]
    args, chains = ["ffmpeg", "-v", "error", "-y"], []
    for i, (t, path, gain, cut, fade) in enumerate(items):
        args += ["-i", path]
        delay = max(0.0, t - t0)
        trim = max(0.0, t0 - t)
        end = f":end={trim + cut:.3f}" if cut else ""
        tail = f",afade=t=out:st={max(0.0, cut - fade):.3f}:d={fade:.3f}" if cut else ""
        chains.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start={trim:.3f}{end},"
                      f"asetpts=PTS-STARTPTS{tail},volume={gain:.1f}dB,adelay={int(delay * 1000)}:all=1[a{i}]")
    n = len(items)
    if os.path.exists(ROOM_TONE):
        args += ["-stream_loop", "-1", "-i", ROOM_TONE]
        chains.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{t1 - t0:.3f}[a{n}]")
        n += 1
    dur = t1 - t0
    chains.append("".join(f"[a{i}]" for i in range(n)) +
                  f"amix=inputs={n}:normalize=0:duration=longest,apad,atrim=0:{dur:.3f},"
                  f"loudnorm=I=-14:TP=-1.5:LRA=11[out]")
    args += ["-filter_complex", ";".join(chains), "-map", "[out]", "-ar", "48000", out_wav]
    subprocess.run(args, check=True)
    return out_wav


def tighten(src, dst, max_pause=0.35, tempo=1.0, sr=48000):
    """Shorten silences longer than `max_pause` and speed up speech (pitch kept).

    Shorts pacing: removes dead air inside a line without touching delivery.
    """
    import numpy as np
    import soundfile as sf
    from .lipsync import load_audio
    a = load_audio(src, sr).copy()
    hop = int(sr * 0.01)
    n = len(a) // hop
    env = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    env = np.convolve(env, np.ones(5) / 5, mode="same")
    quiet = env < np.percentile(env, 95) * 0.05
    keep = np.ones(len(a), bool)
    i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if i > 5 and j < n - 5 and (j - i) * 0.01 > max_pause:
                excess = int(((j - i) * 0.01 - max_pause) * sr)
                mid = (i + j) // 2 * hop
                keep[mid - excess // 2: mid - excess // 2 + excess] = False
            i = j
        else:
            i += 1
    out = a[keep]
    tmp = dst + ".tmp.wav"
    sf.write(tmp, out, sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", f"atempo={tempo:.3f}", "-ar", str(sr), dst],
                   check=True)
    os.remove(tmp)
    return dst


def encode(frames_pattern, fps, audio_wav, out_mp4, size=None, start_number=0):
    vf = ["format=yuv420p"]
    if size:
        vf.insert(0, f"scale={size[0]}:{size[1]}:flags=lanczos")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-start_number", str(start_number),
                    "-i", frames_pattern, "-i", audio_wav, "-vf", ",".join(vf), "-c:v", "libx264",
                    "-preset", "slow", "-crf", "17", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", out_mp4], check=True)
    return out_mp4


def srt(tl, path, texts, t0=0.0):
    """Subtitle file from the timeline's dialogue (texts: {line_id: text})."""
    def ts(x):
        x = max(0.0, x - t0)
        h, r = divmod(x, 3600)
        m, r = divmod(r, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(r):02d},{int(round((r % 1) * 1000)):03d}"
    rows = []
    for ln in sorted(tl.lines, key=lambda x: x["t"]):
        lid = os.path.splitext(os.path.basename(ln["path"]))[0]
        if lid in texts:
            rows.append(f"{len(rows) + 1}\n{ts(ln['t'])} --> {ts(ln['t'] + ln['dur'])}\n{texts[lid]}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(rows))
    return path


FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")
FONT = os.path.join(FONTS_DIR, "Nunito-Black.ttf")
if not os.path.exists(FONT):
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def finish(src_mp4, dst_mp4, ass=None, title=None, title_start=None):
    """Final pass: burn the captions (ASS) and fade in the series title at the end."""
    vf = []
    if ass:
        vf.append(f"subtitles={ass}:fontsdir={FONTS_DIR}")
    if title and title_start is not None:
        fade = f"if(lt(t,{title_start}),0,min(1,(t-{title_start})/0.4))"
        lines = title.split("\n")                     # long titles: one drawtext per line, sized to fit
        size = f"min(h/18\\,w*0.9/{0.68 * max(len(x) for x in lines):.2f})"
        for i, line in enumerate(lines):
            text = line.replace(":", "\\:")
            vf.append(f"drawtext=fontfile={FONT}:text='{text}':fontcolor=white:fontsize={size}:"
                      f"x=(w-text_w)/2:y=h*0.16+{i}*h/15:alpha='{fade}':borderw=6:bordercolor=black@0.85")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src_mp4, "-vf", ",".join(vf) or "null", "-c:v", "libx264",
                    "-preset", "slow", "-crf", "17", "-c:a", "copy", "-movflags", "+faststart", dst_mp4], check=True)
    return dst_mp4
