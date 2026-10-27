"""Episode timeline: keyed channel transitions + procedural layers, baked to keyframes.

Episode scripts only call the Timeline API (set / expr / look / hop / move /
shake / say / sfx / shot); everything is evaluated per frame, then baked to
regular Blender keyframes so the .blend stays editable by hand.
"""
import math
import random
import zlib

import bpy
import numpy as np
from mathutils import Vector

from . import lipsync, render
from .expressions import EXPR
from .util import clamp, ease, lerp

RESET_ON_EXPR = (
    "lid_u", "lid_l", "lid_u_L", "lid_u_R", "squint", "brow_up", "brow_up_L", "brow_up_R",
    "brow_ang", "brow_ang_L", "brow_ang_R", "m_open", "m_wide", "m_round", "m_press", "m_smile",
    "m_frown", "m_sneer", "nod", "tilt",
)


class Track:
    def __init__(self):
        self.tr = []          # (t0, t1, target, kind)
        self.sorted = True

    def add(self, t0, t1, target, kind):
        self.tr.append((t0, max(t1, t0 + 1e-4), target, kind))
        self.sorted = False

    def value(self, t):
        if not self.sorted:
            self.tr.sort(key=lambda x: x[0])
            self.sorted = True
        v = 0.0
        for t0, t1, target, kind in self.tr:
            if t < t0:
                break
            if t >= t1:
                v = target
            else:
                v = lerp(v, target, ease((t - t0) / (t1 - t0), kind))
        return v


class Line:
    """A placed dialogue line; word timings let acting land on specific words."""

    def __init__(self, who, t, path, dur, words):
        self.who, self.t, self.path, self.dur, self.words = who, t, path, dur, words
        self.end = t + dur

    def at(self, i, edge="start"):
        """Absolute time of word i (negative indexes from the end)."""
        return self.t + self.words[i][edge]

    def find(self, prefix, nth=0, edge="start"):
        """Absolute time of the nth word starting with `prefix` (Turkish-aware, case-insensitive).

        Robust to re-recorded audio: acting stays on the word, not on a fixed second.
        """
        norm = lambda w: w.replace("İ", "i").replace("I", "ı").lower().strip(".,!?…\"'“”‘’—- ")
        hits = [w for w in self.words if norm(w["word"]).startswith(norm(prefix))]
        if len(hits) <= nth:
            raise KeyError(f"{self.path}: no word '{prefix}' #{nth} in {[w['word'] for w in self.words]}")
        return self.t + hits[nth][edge]


class Timeline:
    def __init__(self, chars, fps=24, seed=11):
        self.chars = chars
        self.fps = fps
        self.rng = random.Random(seed)
        self.tracks = {n: {} for n in chars}
        self.layers = {n: [] for n in chars}
        self.lines, self.sounds, self.shots = [], [], []
        self.duration = 0.0
        self.blink_off = {n: [] for n in chars}
        self.springs = {n: 1.0 for n in chars}
        self.props = {}
        bpy.context.view_layer.update()
        self.rest_face = {n: c.face.anchor.matrix_world.copy() for n, c in chars.items()}

    # ------------------------------------------------------------ keyed
    def track(self, who, ch):
        return self.tracks[who].setdefault(ch, Track())

    def set(self, who, t, dur=0.25, kind="inout", **values):
        for ch, v in values.items():
            self.track(who, ch).add(t, t + dur, v, kind)
        self.duration = max(self.duration, t + dur)

    def expr(self, who, t, name, dur=0.3, kind="inout", **extra):
        preset = {**EXPR[name], **extra}
        for ch in set(RESET_ON_EXPR) | set(preset):
            self.track(who, ch).add(t, t + dur, preset.get(ch, 0.0), kind)

    def face_matrix(self, who, t):
        """World matrix of a character's face at time t (root motion only)."""
        from mathutils import Matrix
        c = self.chars[who]
        extra = {}
        for t0, t1, fn in self.layers[who]:
            if t0 <= t <= t1:
                for k, v in fn(t).items():
                    if k in ("pos_x", "pos_y", "pos_z", "turn"):
                        extra[k] = extra.get(k, 0.0) + v
        tv = lambda ch: self.track(who, ch).value(t) + extra.get(ch, 0.0)
        rest = Matrix.Translation(c.base_loc) @ Matrix.Rotation(c.base_rot.z, 4, "Z") @ \
            Matrix.Rotation(c.base_rot.x, 4, "X")
        now = Matrix.Translation(c.base_loc + Vector((tv("pos_x"), tv("pos_y"), tv("pos_z")))) @ \
            Matrix.Rotation(c.base_rot.z + tv("turn"), 4, "Z") @ Matrix.Rotation(c.base_rot.x, 4, "X")
        return now @ rest.inverted() @ self.rest_face[who]

    def face_pos(self, who, t=0.0):
        return self.face_matrix(who, t).translation.copy()

    def look(self, who, t, target, dur=0.2, head=0.4, kind="inout", up=0.0):
        """Aim gaze (and part of the head) at a world point or another character."""
        if isinstance(target, str):
            target = self.face_pos(target, t + dur)
        m = self.face_matrix(who, t + dur)
        d = m.inverted() @ Vector(target)
        yaw = math.atan2(d.x, -d.y)
        pitch = math.atan2(d.z, math.hypot(d.x, d.y)) + up
        yaw = clamp(yaw, -1.4, 1.4)
        self.set(who, t, dur, kind,
                 gaze_x=clamp(yaw * (1 - head), -0.55, 0.55),
                 gaze_y=clamp(pitch * (1 - head * 0.5), -0.45, 0.45),
                 twist=yaw * head)

    def look_cam(self, who, t, dur=0.2):
        self.set(who, t, dur, gaze_x=0.0, gaze_y=0.0, twist=0.0)

    # ------------------------------------------------------------ set dressing
    def prop(self, obj, fn, t0=-1e9, t1=1e9):
        """Animate a set object: fn(t) -> {"rotation_euler": (dx, dy, dz), ...}, added to its rest pose."""
        if obj not in self.props:
            self.props[obj] = ({p: tuple(getattr(obj, p)) for p in ("location", "rotation_euler", "scale")}, [])
        self.props[obj][1].append((fn, t0, t1))

    # ------------------------------------------------------------ additive layers
    def layer(self, who, fn, t0=-1e9, t1=1e9):
        self.layers[who].append((t0, t1, fn))
        self.duration = max(self.duration, min(t1, 1e6))

    def hop(self, who, t, height=0.08, dur=0.42, squash=0.14):
        """Anticipate, jump, land and settle (additive on pos_z / squash)."""
        pre = 0.12

        def fn(tt):
            u = tt - t
            if u < 0:
                k = (u + pre) / pre
                return {"squash": -squash * math.sin(k * math.pi / 2) * 0.8}
            if u < dur:
                k = u / dur
                return {"pos_z": 4 * height * k * (1 - k),
                        "squash": squash * 0.7 * math.sin(k * math.pi) - squash * 0.8 * (1 - k) ** 6}
            k = (u - dur)
            return {"squash": -squash * math.exp(-k * 9) * math.cos(k * 28)}
        self.layer(who, fn, t - pre, t + dur + 0.6)

    def move(self, who, t, dur, dx=0.0, dy=0.0, dz=0.0, hops=0, height=0.06, kind="inout", turn=None):
        cur = {c: self.track(who, c).value(t) for c in ("pos_x", "pos_y", "pos_z")}
        self.set(who, t, dur, kind, pos_x=cur["pos_x"] + dx, pos_y=cur["pos_y"] + dy, pos_z=cur["pos_z"] + dz)
        if turn is not None:
            self.set(who, t, min(dur, 0.4), "inout", turn=turn)
        for i in range(hops):
            self.hop(who, t + dur * i / hops, height, dur / hops, 0.1)

    def shake(self, who, t, dur, channel, amp, freq=6.0, decay=True):
        def fn(tt):
            u = (tt - t) / dur
            env = (1 - u) ** 2 if decay else math.sin(u * math.pi)
            return {channel: amp * env * math.sin((tt - t) * freq * 2 * math.pi)}
        self.layer(who, fn, t, t + dur)

    def pulse(self, who, t, dur, **amps):
        """Smooth there-and-back bump on several channels (e.g. a gasp)."""
        def fn(tt):
            u = (tt - t) / dur
            s = math.sin(u * math.pi) ** 2
            return {k: v * s for k, v in amps.items()}
        self.layer(who, fn, t, t + dur)

    def eyes_closed(self, who, t0, t1, fade=0.12):
        self.set(who, t0, fade, blink=1.0)
        self.set(who, t1, fade, blink=0.0)
        self.blink_off[who].append((t0 - 0.3, t1 + 0.6))

    # ------------------------------------------------------------ dialogue & sound
    def say(self, who, t, path, intensity=1.0, text="", bob=1.0):
        times, ch = lipsync.track(path, intensity)
        dur = times[-1] + lipsync.HOP if len(times) else lipsync.duration(path)
        self.lines.append(dict(who=who, t=t, path=path, text=text, dur=dur))
        env = ch["_env"]
        speaking = ch["_speaking"]
        slow = np.convolve(env, np.ones(25) / 25, mode="same")
        accent = np.clip(env - slow, 0, 1)
        phase = self.rng.random() * 6

        def fn(tt):
            u = tt - t
            i = int(u / lipsync.HOP)
            if i < 0 or i >= len(times):
                return {}
            out = {c: float(ch[c][i]) for c in lipsync.MOUTH}
            # talking body language: accents nod the head, energy breathes the body
            out["nod"] = bob * (0.11 * float(accent[i]) + 0.015 * math.sin(u * 3.1 + phase) * speaking[i])
            out["tilt"] = bob * 0.03 * math.sin(u * 1.7 + phase) * float(speaking[i])
            out["squash"] = bob * 0.035 * float(accent[i])
            out["brow_up"] = bob * 0.25 * float(accent[i])
            return out
        self.layer(who, fn, t, t + dur)
        self.duration = max(self.duration, t + dur)
        return Line(who, t, path, dur, lipsync.words(path))

    def sfx(self, t, path, gain_db=0.0, dur=None, fade=0.05):
        """Play a sound at t; dur cuts it off (with a short fade), e.g. music that stops dead on a gag."""
        self.sounds.append(dict(t=t, path=path, gain=gain_db, dur=dur, fade=fade))

    # ------------------------------------------------------------ cameras
    def shot(self, t, name, loc, target, lens=40, fstop=2.8, to_loc=None, to_target=None, dur=None,
             kind="inout", focus=None, shake=0.0):
        """Cut to a new camera at `t`; optionally move it from loc/target to to_loc/to_target."""
        cam = bpy.data.objects.get(name) or render.camera(name, loc, target, lens, fstop)
        cam.data.lens = lens
        cam.data.dof.aperture_fstop = fstop
        self.shots.append(dict(t=t, cam=cam, loc=Vector(loc), target=Vector(target),
                               to_loc=Vector(to_loc or loc), to_target=Vector(to_target or target),
                               dur=dur, kind=kind, focus=focus, shake=shake))
        self.shots.sort(key=lambda s: s["t"])

    def face_shot(self, t, name, who, dist=0.9, yaw=0.0, height=0.04, lens=50, fstop=2.8,
                  push=0.0, look=(0, 0, -0.03), dur=None, **kw):
        """Close shot framed on a character's face, resolved where the character is at `t`."""
        self.shot(t, name, (0, 0, 0), (0, 0, 1), lens, fstop, dur=dur, focus=who, **kw)
        for s in self.shots:
            if s["t"] == t and s["cam"].name == name:
                s["rel"] = dict(who=who, dist=dist, yaw=yaw, height=height, push=push, look=look)

    def _shot_at(self, t):
        cur = None
        for s in self.shots:
            if s["t"] <= t + 1e-6:
                cur = s
        return cur

    # ------------------------------------------------------------ evaluation
    def _procedural(self, who, t, seed):
        out = {}
        # breathing
        out["squash"] = 0.011 * math.sin(2 * math.pi * t / 3.4 + seed)
        out["nod"] = 0.008 * math.sin(2 * math.pi * t / 3.4 + seed + 1.2)
        return out

    def _blinks(self, who, length):
        rng = random.Random(zlib.crc32(who.encode()))          # stable across runs (str hash is salted)
        t, times = rng.uniform(0.5, 2.0), []
        while t < length:
            if not any(a <= t <= b for a, b in self.blink_off[who]):
                times.append(t)
            t += rng.uniform(2.0, 4.6)
        return times

    def _saccades(self, who, length):
        rng = random.Random(zlib.crc32(who.encode()) >> 4)
        t, out = 0.3, []
        while t < length:
            out.append((t, rng.uniform(-0.05, 0.05), rng.uniform(-0.03, 0.03)))
            t += rng.uniform(0.5, 1.6)
        return out

    def evaluate(self, who, t, extras):
        ch = {c: tr.value(t) for c, tr in self.tracks[who].items()}
        for k, v in self._procedural(who, t, extras["seed"]).items():
            ch[k] = ch.get(k, 0.0) + v
        for t0, t1, fn in self.layers[who]:
            if t0 <= t <= t1:
                for k, v in fn(t).items():
                    ch[k] = ch.get(k, 0.0) + v
        for bt in extras["blinks"]:
            u = t - bt
            if 0 <= u < 0.2:
                b = u / 0.06 if u < 0.06 else 1.0 if u < 0.09 else 1 - (u - 0.09) / 0.11
                ch["blink"] = max(ch.get("blink", 0.0), b)
        sx = sy = 0.0
        for st, gx, gy in extras["saccades"]:
            if st <= t:
                sx, sy = gx, gy
        ch["gaze_x"] = ch.get("gaze_x", 0.0) + sx
        ch["gaze_y"] = ch.get("gaze_y", 0.0) + sy
        ch["blink"] = min(ch.get("blink", 0.0), 1.0)
        return ch

    def bake(self, frame_start=0, frame_end=None, log=True):
        sc = bpy.context.scene
        fps = self.fps
        length = self.duration
        frame_end = frame_end if frame_end is not None else int(math.ceil(length * fps))
        sc.frame_start, sc.frame_end = frame_start, frame_end
        extras = {n: dict(seed=i * 1.7, blinks=self._blinks(n, length + 1), saccades=self._saccades(n, length + 1))
                  for i, n in enumerate(self.chars)}
        frames = list(range(frame_start, frame_end + 1))
        values = {n: [self.evaluate(n, f / fps, extras[n]) for f in frames] for n in self.chars}
        # secondary motion: a damped spring on squash/tilt driven by body acceleration
        for n, seq in values.items():
            x = v = 0.0
            xs = vs = 0.0
            dt = 1.0 / fps
            for i in range(len(seq)):
                p = lambda j, c: seq[min(max(j, 0), len(seq) - 1)].get(c, 0.0)
                az = (p(i + 1, "pos_z") - 2 * p(i, "pos_z") + p(i - 1, "pos_z")) / dt ** 2
                ax = (p(i + 1, "pos_x") - 2 * p(i, "pos_x") + p(i - 1, "pos_x")) / dt ** 2
                a = -(v * 9 + x * 160) - az * 0.004
                v += a * dt
                x += v * dt
                aa = -(vs * 8 + xs * 120) + ax * 0.02
                vs += aa * dt
                xs += vs * dt
                seq[i]["squash"] = seq[i].get("squash", 0.0) + clamp(x, -0.15, 0.15) * self.springs[n]
                seq[i]["tilt"] = seq[i].get("tilt", 0.0) + clamp(xs, -0.2, 0.2) * self.springs[n]
        for m in list(sc.timeline_markers):
            sc.timeline_markers.remove(m)
        last_cam = None
        for idx, f in enumerate(frames):
            t = f / fps
            for n, c in self.chars.items():
                c.apply(values[n][idx])
                for obj, path in c.keyable():
                    obj.keyframe_insert(path, frame=f)
            for obj, (rest, fns) in self.props.items():
                pose = {p: list(v) for p, v in rest.items()}
                for fn, t0, t1 in fns:
                    if t0 <= t <= t1:
                        for p, d in fn(t).items():
                            pose[p] = [a + b for a, b in zip(pose[p], d)]
                for p, v in pose.items():
                    setattr(obj, p, v)
                    obj.keyframe_insert(p, frame=f)
            s = self._shot_at(t)
            if s and s.get("rel") and not s.get("resolved"):
                r = s["rel"]
                bpy.context.view_layer.update()
                ch = self.chars[r["who"]]
                loc, tgt = render.face_frame(ch, r["dist"], r["yaw"], r["height"], r["look"])
                s["loc"], s["target"] = Vector(loc), Vector(tgt)
                s["to_loc"], s["to_target"] = Vector(loc), Vector(tgt)
                if r["push"]:
                    to_loc, _ = render.face_frame(ch, r["dist"] * (1 - r["push"]), r["yaw"],
                                                  r["height"] * (1 - r["push"]), r["look"])
                    s["to_loc"] = Vector(to_loc)
                s["resolved"] = True
            if s:
                cam = s["cam"]
                if cam is not last_cam:
                    mk = sc.timeline_markers.new(cam.name, frame=f)
                    mk.camera = cam
                    if last_cam is None:
                        sc.camera = cam
                    last_cam = cam
                dur = s["dur"] or 1e9
                k = ease((t - s["t"]) / dur, s["kind"]) if s["dur"] else 0.0
                loc = s["loc"].lerp(s["to_loc"], k)
                tgt = s["target"].lerp(s["to_target"], k)
                if s["shake"]:
                    amp = s["shake"]
                    loc = loc + Vector((math.sin(t * 37) * amp, 0, math.sin(t * 29 + 1) * amp))
                bpy.context.view_layer.update()
                if s.get("rel"):
                    # follow the face like an operator would: ease toward where it is now
                    face = self.chars[s["rel"]["who"]].face.anchor.matrix_world.translation + Vector(s["rel"]["look"])
                    prev = s.get("_aim")
                    k_follow = 1 - math.exp(-1.0 / (fps * 0.3))
                    s["_aim"] = face.copy() if prev is None else prev.lerp(face, k_follow)
                    tgt = tgt.lerp(s["_aim"], 0.85)
                focus = self.chars[s["focus"]].face.anchor.matrix_world.translation if s["focus"] else tgt
                render.aim(cam, loc, tgt, focus)
                cam.keyframe_insert("location", frame=f)
                cam.keyframe_insert("rotation_euler", frame=f)
                cam.data.dof.keyframe_insert("focus_distance", frame=f)
            if log and idx % 48 == 0:
                print(f"[bake] frame {f}/{frame_end}", flush=True)
        return frame_start, frame_end
