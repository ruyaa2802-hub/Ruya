import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import assemble

FFMPEG_AVAILABLE = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def make_clip(path, seconds, color, with_audio):
    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", f"color=c={color}:s=640x360:r=30:d={seconds}"]
    if with_audio:
        args += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-c:a", "aac"]
    args += ["-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)]
    subprocess.run(args, check=True)


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def manifest(durations, fade=0.4):
    return {"output": "out.mp4", "width": 1080, "height": 1920, "fps": 30, "fade": fade,
            "clips": [{"path": f"c{i}.mp4", "duration": d} for i, d in enumerate(durations)]}


class BuildCommandTest(unittest.TestCase):
    def graph(self, cmd):
        return cmd[cmd.index("-filter_complex") + 1]

    def test_crossfades_every_join(self):
        cmd = assemble.build_command(manifest([2, 2, 1.5]), [True, False, True])
        graph = self.graph(cmd)
        self.assertEqual(graph.count("xfade="), 2)
        self.assertEqual(graph.count("acrossfade="), 2)
        self.assertNotIn("concat=", graph)

    def test_zero_fade_uses_hard_cuts(self):
        graph = self.graph(assemble.build_command(manifest([2, 2], fade=0), [True, True]))
        self.assertIn("concat=n=2:v=1:a=0", graph)
        self.assertNotIn("xfade=", graph)

    def test_total_duration_subtracts_overlaps(self):
        self.assertAlmostEqual(assemble.total_duration(manifest([2, 2, 1.5])), 4.7)

    def test_output_is_vertical_hd(self):
        cmd = assemble.build_command(manifest([2]), [False])
        self.assertIn("scale=1080:1920:force_original_aspect_ratio=increase", self.graph(cmd))


@unittest.skipUnless(FFMPEG_AVAILABLE, "ffmpeg/ffprobe not installed")
class RenderTest(unittest.TestCase):
    def test_renders_vertical_mp4_with_audio(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            make_clip(tmp / "a.mp4", 2, "red", with_audio=False)
            make_clip(tmp / "b.mp4", 2, "blue", with_audio=True)
            make_clip(tmp / "c.mp4", 1.5, "green", with_audio=False)
            subprocess.run(
                ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                 "-f", "lavfi", "-i", "sine=frequency=220:duration=1", "-c:a", "aac", str(tmp / "voice.m4a")],
                check=True)
            spec = {"output": "build/test.mp4", "fade": 0.4,
                    "clips": [{"path": "a.mp4", "duration": 2},
                              {"path": "b.mp4", "duration": 2},
                              {"path": "c.mp4", "duration": 1.5}],
                    "voiceover": {"path": "voice.m4a", "start": 0.5}}
            (tmp / "manifest.json").write_text(json.dumps(spec), encoding="utf-8")
            output = assemble.render(tmp / "manifest.json")
            info = probe(output)

        streams = {s["codec_type"]: s for s in info["streams"]}
        self.assertEqual((streams["video"]["width"], streams["video"]["height"]), (1080, 1920))
        self.assertIn("audio", streams)
        self.assertAlmostEqual(float(info["format"]["duration"]), 4.7, delta=0.15)


if __name__ == "__main__":
    unittest.main()
