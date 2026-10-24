#!/usr/bin/env python3
"""Assemble a vertical 9:16 MP4 from clips, narration and music.

Usage:
    python3 assemble.py path/to/manifest.json

Manifest (JSON). Relative paths are resolved from the manifest's folder.
    {
      "output": "build/test_scene.mp4",
      "width": 1080,
      "height": 1920,
      "fps": 30,
      "fade": 0.4,
      "clips": [{"path": "clips/shot01.mp4", "duration": 8.0}],
      "voiceover": {"path": "audio/narration.mp3", "start": 0.5, "volume": 1.0},
      "music": {"path": "audio/score.mp3", "volume": 0.15}
    }

Each clip is cropped to fill the frame and trimmed to "duration". A clip's own
audio is kept when the file has an audio track, otherwise silence is used.
Clips are joined with crossfades of "fade" seconds (0 means hard cuts).
"""
import json
import subprocess
import sys
from pathlib import Path

DEFAULTS = {"output": "build/out.mp4", "width": 1080, "height": 1920, "fps": 30, "fade": 0.4}


def load_manifest(manifest_path):
    path = Path(manifest_path).resolve()
    manifest = {**DEFAULTS, **json.loads(path.read_text(encoding="utf-8"))}
    base = path.parent

    def resolve(p):
        resolved = (base / p).resolve()
        if not resolved.is_file():
            raise FileNotFoundError(f"Missing input: {resolved}")
        return str(resolved)

    clips = manifest.get("clips") or []
    if not clips:
        raise ValueError("Manifest needs at least one clip")
    if manifest["fade"] < 0 or manifest["fade"] >= min(c["duration"] for c in clips):
        raise ValueError("fade must be >= 0 and shorter than every clip")
    for clip in clips:
        if clip["duration"] <= 0:
            raise ValueError(f"Clip duration must be positive: {clip['path']}")
        clip["path"] = resolve(clip["path"])
    for key in ("voiceover", "music"):
        if manifest.get(key):
            manifest[key]["path"] = resolve(manifest[key]["path"])
    manifest["output"] = str((base / manifest["output"]).resolve())
    return manifest


def has_audio(path):
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True)
    return bool(probe.stdout.strip())


def total_duration(manifest):
    durations = [c["duration"] for c in manifest["clips"]]
    return sum(durations) - manifest["fade"] * (len(durations) - 1)


def join_video(labels, durations, fade):
    if len(labels) == 1:
        return [f"{labels[0]}null[vout]"]
    if fade == 0:
        return ["".join(labels) + f"concat=n={len(labels)}:v=1:a=0[vout]"]
    filters, current, offset = [], labels[0], durations[0] - fade
    for i in range(1, len(labels)):
        out = "[vout]" if i == len(labels) - 1 else f"[vx{i}]"
        filters.append(f"{current}{labels[i]}xfade=transition=fade:duration={fade}:offset={offset:.3f}{out}")
        current = out
        offset += durations[i] - fade
    return filters


def join_audio(labels, fade):
    if len(labels) == 1:
        return [f"{labels[0]}anull[abase]"]
    if fade == 0:
        return ["".join(labels) + f"concat=n={len(labels)}:v=0:a=1[abase]"]
    filters, current = [], labels[0]
    for i in range(1, len(labels)):
        out = "[abase]" if i == len(labels) - 1 else f"[ax{i}]"
        filters.append(f"{current}{labels[i]}acrossfade=d={fade}{out}")
        current = out
    return filters


def build_command(manifest, clip_has_audio):
    clips = manifest["clips"]
    width, height, fps, fade = manifest["width"], manifest["height"], manifest["fps"], manifest["fade"]
    total = total_duration(manifest)
    voice, music = manifest.get("voiceover"), manifest.get("music")

    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for clip in clips:
        args += ["-i", clip["path"]]
    next_input = len(clips)
    voice_input = music_input = None
    if voice:
        args += ["-i", voice["path"]]
        voice_input, next_input = next_input, next_input + 1
    if music:
        args += ["-stream_loop", "-1", "-i", music["path"]]
        music_input = next_input

    filters, video_labels, audio_labels, durations = [], [], [], []
    for i, clip in enumerate(clips):
        d = clip["duration"]
        durations.append(d)
        filters.append(
            f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},setsar=1,fps={fps},format=yuv420p,"
            f"trim=duration={d},setpts=PTS-STARTPTS[v{i}]")
        video_labels.append(f"[v{i}]")
        source = f"[{i}:a]" if clip_has_audio[i] else "anullsrc=sample_rate=48000:channel_layout=stereo,"
        filters.append(
            f"{source}aformat=sample_rates=48000:channel_layouts=stereo,"
            f"atrim=duration={d},asetpts=PTS-STARTPTS[a{i}]")
        audio_labels.append(f"[a{i}]")

    filters += join_video(video_labels, durations, fade)
    filters += join_audio(audio_labels, fade)

    audio_out = "[abase]"
    if voice or music:
        layers = ["[abase]"]
        if voice:
            delay_ms = int(voice.get("start", 0) * 1000)
            filters.append(
                f"[{voice_input}:a]adelay={delay_ms}:all=1,atrim=duration={total:.3f},"
                f"volume={voice.get('volume', 1.0)}[avoice]")
            layers.append("[avoice]")
        if music:
            filters.append(
                f"[{music_input}:a]atrim=duration={total:.3f},asetpts=PTS-STARTPTS,"
                f"volume={music.get('volume', 0.15)}[amusic]")
            layers.append("[amusic]")
        filters.append("".join(layers) + f"amix=inputs={len(layers)}:duration=first:normalize=0[afinal]")
        audio_out = "[afinal]"

    args += [
        "-filter_complex", ";".join(filters),
        "-map", "[vout]", "-map", audio_out,
        "-t", f"{total:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        manifest["output"],
    ]
    return args


def render(manifest_path):
    manifest = load_manifest(manifest_path)
    clip_has_audio = [has_audio(c["path"]) for c in manifest["clips"]]
    Path(manifest["output"]).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(build_command(manifest, clip_has_audio), check=True)
    return manifest["output"]


def main(argv):
    if len(argv) != 2:
        print("usage: python3 assemble.py manifest.json", file=sys.stderr)
        return 2
    print(render(argv[1]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
