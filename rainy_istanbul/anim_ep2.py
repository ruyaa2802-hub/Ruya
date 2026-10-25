"""Episode 2 "Hayatının En Büyük Kovalamacası": chase, boarding, final.

Reuses the rig helpers / IK set-up of animation.py (episode 1). New here: a run
gait (same footstep planner, run timings), 2D foot plans for turning and stepping
up into the bus, a sidewalk-aware ground height, the bus motion and a cut-based
camera.
"""
import bpy
import math
from mathutils import Vector, Quaternion, Matrix

import animation as A
from animation import smooth, ease, set_abs_rotations, rot_world, noise1, R_OBJ
import bus as B
import env

FPS = 30
DURATION = 14.2
FRAMES = int(DURATION * FPS)

WALK_X = A.WALK_X
Y0 = 8.0
GROUND_SIDEWALK = env.CURB_H          # the man stands on the sidewalk, not on the road

# bus timing
BUS_FRONT0 = 24.0
BUS_T_GO, BUS_ACC, BUS_V = 0.3, 1.0, 2.7
BUS_T_BRAKE, BUS_T_STOP = 5.6, 7.0

# man timing
T_RUN, V_RUN, T_ARRIVE = 1.5, 5.5, 7.1
RUN_STEP_T, RUN_SWING_T = 0.35, 0.52
T_TURN = 8.0
T_LOOK_SIGN = 9.15
T_LOOK_CAM = 11.0
T_LINE = 11.2           # dialogue start (lip sync is added from the audio envelope)

# shots: (start time, name)
SHOTS = [(0.0, "ots"), (0.9, "crash"), (1.9, "side"), (4.0, "front"), (6.7, "arrive"),
         (9.0, "inside"), (9.8, "sign"), (10.6, "closeup")]


def ft(f):
    return (f - 1) / FPS


# ---------------------------------------------------------------- bus motion

def _bus_v(t):
    if t < BUS_T_GO:
        return 0.0
    v = min(BUS_V, BUS_ACC * (t - BUS_T_GO))
    if t > BUS_T_BRAKE:
        v *= 1 - smooth((t - BUS_T_BRAKE) / (BUS_T_STOP - BUS_T_BRAKE))
    return v


def _integrate(vfun, dt=1 / 600, t_end=DURATION + 1):
    out, s, t = [0.0], 0.0, 0.0
    while t < t_end:
        s += vfun(t + dt / 2) * dt
        t += dt
        out.append(s)
    return out


_BUS_S = _integrate(_bus_v)


def bus_front(t):
    return BUS_FRONT0 + _BUS_S[min(len(_BUS_S) - 1, max(0, int(t * 600)))]


DOOR_Y_END = bus_front(DURATION) + (B.DOOR_Y[0] + B.DOOR_Y[1]) / 2


# ---------------------------------------------------------------- man locomotion

def _man_v(t):
    return V_RUN * ease(t, T_RUN, T_RUN + 0.75) * (1 - ease(t, T_ARRIVE - 0.75, T_ARRIVE))


_raw = _integrate(_man_v)
_SCALE = (DOOR_Y_END - Y0) / _raw[-1]       # land exactly at the door
_MAN_S = [s * _SCALE for s in _raw]


def man_s(t):
    return _MAN_S[min(len(_MAN_S) - 1, max(0, int(t * 600)))]


def man_v(t):
    return _man_v(t) * _SCALE


def ground_at(x):
    if x < B.X_CENTER + B.WIDTH / 2 - 0.02:
        return B.FLOOR
    return GROUND_SIDEWALK if x > env.CURB_X else 0.0


def plan_feet():
    """Each step: (t_lift, t_land, (x,y,g) from, (x,y,g) to, yaw_to, kind)."""
    steps = {"l": [], "r": []}
    pos = {"l": (WALK_X - A.FOOT_LAT, Y0, GROUND_SIDEWALK), "r": (WALK_X + A.FOOT_LAT, Y0, GROUND_SIDEWALK)}
    s_end = DOOR_Y_END - Y0
    t, foot = T_RUN + 0.02, "r"
    while t < T_ARRIVE + 1.0:
        t_land = t + RUN_SWING_T
        v = man_v(t_land)
        tgt = min(man_s(t_land) + 0.5 * v * (2 * RUN_STEP_T - RUN_SWING_T), s_end)
        lat = A.FOOT_LAT * (1 if foot == "r" else -1)
        p1 = (WALK_X + lat * 0.7, Y0 + tgt, GROUND_SIDEWALK)
        if abs(p1[1] - pos[foot][1]) > 0.03 or abs(p1[0] - pos[foot][0]) > 0.02:
            # short swings for the stopping steps
            sw = RUN_SWING_T if v > 1.5 else 0.3
            steps[foot].append((t, t + sw, pos[foot], p1, 0.0, "run" if v > 1.5 else "walk"))
            pos[foot] = p1
        if all(abs(pos[k][1] - (Y0 + s_end)) < 0.03 for k in "lr"):
            break
        t += RUN_STEP_T
        foot = "l" if foot == "r" else "r"
    # settle feet side by side (normal stance width)
    yd = Y0 + s_end
    for k, side in (("r", 1), ("l", -1)):
        p1 = (WALK_X + side * A.FOOT_LAT, yd, GROUND_SIDEWALK)
        last_t = steps[k][-1][1] if steps[k] else T_ARRIVE
        steps[k].append((max(last_t + 0.05, T_ARRIVE + 0.05 + (0.18 if k == "l" else 0)),
                         max(last_t + 0.05, T_ARRIVE + 0.05 + (0.18 if k == "l" else 0)) + 0.28, pos[k], p1, 0.0, "walk"))
        pos[k] = p1
    # turn to the bus (face -x) and step up into it
    yaw = math.pi / 2
    plan = [("r", T_TURN, 0.3, (2.92, yd + 0.11, GROUND_SIDEWALK)),
            ("l", T_TURN + 0.26, 0.3, (2.62, yd - 0.11, GROUND_SIDEWALK)),
            ("r", T_TURN + 0.52, 0.34, (2.0, yd + 0.11, B.FLOOR)),
            ("l", T_TURN + 0.8, 0.34, (1.78, yd - 0.12, B.FLOOR))]
    for k, t0, dur, p1 in plan:
        steps[k].append((t0, t0 + dur, pos[k], p1, yaw, "walk"))
        pos[k] = p1
    return steps


def foot_state(steps, t):
    """(x, y, z_ankle_offset_from_ground, ground, pitch, yaw) for one foot."""
    if not steps:
        return None
    prev = steps[0][2]
    prev_yaw = 0.0
    for (t0, t1, a, b, yaw, kind) in steps:
        run = kind == "run"
        if t < t0:
            pre_win = 0.12 if run else 0.24
            pmax = math.radians(42 if run else 24)
            pre = ease(t, t0 - pre_win, t0)
            return (a[0], a[1], 0.13 * math.sin(pmax * pre), a[2], pmax * pre, prev_yaw)
        if t <= t1:
            u = (t - t0) / (t1 - t0)
            span = min(1.0, math.hypot(b[0] - a[0], b[1] - a[1]) / 0.6)
            x = a[0] + (b[0] - a[0]) * smooth(u)
            y = a[1] + (b[1] - a[1]) * smooth(u)
            g = a[2] + (b[2] - a[2]) * smooth(min(1.0, u * 1.6))
            if run:
                # heel kicks up behind early in the swing, foot reaches forward late
                lift = 0.34 * math.sin(math.pi * min(1.0, u * 1.15)) ** 1.5 * span + 0.02
                pitch = math.radians(42) * (1 - smooth(u / 0.3)) - math.radians(10) * smooth((u - 0.7) / 0.3)
            else:
                step_up = max(0.0, b[2] - a[2])
                lift = (0.09 * span + 0.03 + 0.12 * (step_up > 0.05)) * math.sin(math.pi * u) ** 1.2
                pitch = math.radians(24) * (1 - smooth(u / 0.35)) * span - math.radians(12) * smooth((u - 0.55) / 0.45) * span
            heel = 0.13 * math.sin(max(0.0, pitch))
            yw = prev_yaw + (yaw - prev_yaw) * smooth(u)
            return (x, y, lift + heel, g, pitch, yw)
        prev, prev_yaw = b, yaw
        if t < t1 + 0.1:
            k = 1 - ease(t, t1, t1 + 0.1)
            return (b[0], b[1], 0.0, b[2], -math.radians(10) * k, yaw)
    return (prev[0], prev[1], 0.0, prev[2], 0.0, prev_yaw)


def root_path(t, feet_l, feet_r):
    """Root xy + facing yaw (0 = facing +y, +pi/2 = facing -x)."""
    s = man_s(t)
    x, y = WALK_X, Y0 + s
    yaw = 0.0
    if t > T_TURN - 0.1:
        # during the turn/step-in the pelvis follows the feet
        mx = (feet_l[0] + feet_r[0]) / 2
        my = (feet_l[1] + feet_r[1]) / 2
        k = ease(t, T_TURN - 0.1, T_TURN + 0.3)
        x = x + (mx - x) * k
        y = y + (my - y) * k
        yaw = math.pi / 2 * ease(t, T_TURN - 0.05, T_TURN + 0.55)
    return x, y, yaw


def look_angles(head_pos, yaw_body, target):
    """Head yaw (left positive) and pitch (up positive) to look at target, body-relative."""
    d = target - head_pos
    c, s_ = math.cos(-yaw_body), math.sin(-yaw_body)
    dx, dy = c * d.x - s_ * d.y, s_ * d.x + c * d.y     # into the facing-+y frame
    yaw = math.atan2(-dx, dy)
    pitch = math.atan2(d.z, math.hypot(dx, dy))
    return yaw, pitch


def place_hand(rig, h, side, p_rig):
    pb = rig.data.bones["pelvis"]
    m = pb.matrix_local.copy()
    m.translation = pb.tail_local
    h.matrix_parent_inverse = Matrix.Identity(4)
    h.location = m.inverted() @ Vector(p_rig)


def animate_man(rig, sign_world):
    scn = bpy.context.scene
    ctrls = A.setup_ik(rig)
    steps = plan_feet()
    foot_rest = {s: rig.data.bones[f"foot_{s}"].matrix_local.to_quaternion() for s in "lr"}
    ankle_rest_z = rig.data.bones["foot_l"].head_local.z
    hip_rest = rig.data.bones["thigh_l"].head_local
    leg_len = (rig.data.bones["thigh_l"].length + rig.data.bones["calf_l"].length) * 0.995
    hip_off = {"l": Vector((-0.118, 0.0)), "r": Vector((0.118, 0.0))}   # facing +y frame, world x

    data = []
    for f in range(1, FRAMES + 1):
        t = ft(f)
        fl = foot_state(steps["l"], t)
        fr = foot_state(steps["r"], t)
        rx, ry, yaw = root_path(t, fl, fr)
        running = man_v(t) > 1.5
        c, s_ = math.cos(yaw), math.sin(yaw)
        # pelvis height from leg reach
        h = None
        for side, fs in (("l", fl), ("r", fr)):
            ox, oy = hip_off[side]
            hx, hy = rx + c * ox - s_ * oy, ry + s_ * ox + c * oy
            dxy = math.hypot(fs[0] - hx, fs[1] - hy)
            hz = fs[3] + ankle_rest_z + fs[2] + math.sqrt(max(0.01, leg_len ** 2 - dxy ** 2))
            h = hz if h is None else min(h, hz)
        base = (fl[3] + fr[3]) / 2
        crouch = 0.05 * ease(man_v(t), 0.0, 3.0) + 0.02 * ease(t, T_ARRIVE - 0.2, T_ARRIVE + 0.3) * (1 - ease(t, T_TURN, T_TURN + 0.6))
        dz = min(base, h - hip_rest.z) - crouch
        data.append(dict(t=t, fl=fl, fr=fr, rx=rx, ry=ry, yaw=yaw, dz=dz, running=running))
    raw = [d["dz"] for d in data]
    for i, d in enumerate(data):
        acc = wsum = 0.0
        for k in range(-2, 3):
            j = min(len(raw) - 1, max(0, i + k))
            w = math.exp(-(k * k) / 2.0)
            acc += raw[j] * w
            wsum += w
        d["dz"] = min(acc / wsum, raw[i] + 0.008)

    for i, d in enumerate(data):
        f = i + 1
        t = d["t"]
        scn.frame_set(f)
        rig.location = (d["rx"], d["ry"], d["dz"])
        rig.rotation_euler = (0, 0, math.pi + d["yaw"])
        rig.keyframe_insert("location", frame=f)
        rig.keyframe_insert("rotation_euler", frame=f)
        for side, fs in (("l", d["fl"]), ("r", d["fr"])):
            tgt = ctrls[side][0]
            x, y, lift, g, pitch, fyaw = fs
            tgt.location = (x, y, g + ankle_rest_z + lift)
            tgt.rotation_quaternion = Quaternion((0, 0, 1), fyaw) @ Quaternion((1, 0, 0), -pitch) @ R_OBJ @ foot_rest[side]
            tgt.keyframe_insert("location", frame=f)
            tgt.keyframe_insert("rotation_quaternion", frame=f)

        run_k = ease(man_v(t), 0.5, 3.5)
        # gait phase from the feet (along the walking direction before the turn)
        phase = max(-1.0, min(1.0, (d["fr"][1] - d["fl"][1]) / 0.9)) if t < T_TURN else 0.0
        pelvis_yaw = math.radians(5 + 6 * run_k) * phase
        lean = -math.radians(13) * run_k
        # out of breath after the sprint
        pant_amp = ease(t, T_ARRIVE - 0.3, T_ARRIVE + 0.2) * (1 - 0.6 * ease(t, 9.5, 12.5))
        pant = math.radians(3.0) * pant_amp * math.sin(2 * math.pi * 1.9 * t)
        bend = -math.radians(16) * ease(t, T_ARRIVE - 0.1, T_ARRIVE + 0.35) * (1 - ease(t, 7.75, 8.25))
        # head behaviour
        head_pos = Vector((d["rx"], d["ry"], d["dz"] + 1.75))
        distracted = 1 - ease(t, 0.55, 0.85)          # looking at a shop window at the start
        hy, hp = 0.0, 0.0
        hy += -math.radians(55) * distracted
        hp += -math.radians(6) * distracted
        if t > 0.6:   # spots the bus: snap toward it, chin up a little (startled)
            k = ease(t, 0.6, 0.8) * (1 - ease(t, 1.45, 1.7))
            by, bp = look_angles(head_pos, d["yaw"], Vector((B.X_CENTER, bus_front(t) - B.LENGTH + 1.0, 1.6)))
            hy += by * k
            hp += math.radians(5) * k
        sign_k = ease(t, T_LOOK_SIGN, T_LOOK_SIGN + 0.45) * (1 - ease(t, T_LOOK_CAM, T_LOOK_CAM + 0.5))
        if sign_k > 0:
            sy, sp = look_angles(head_pos, d["yaw"], sign_world)
            hy += sy * sign_k
            hp += sp * sign_k
        cam_k = ease(t, T_LOOK_CAM, T_LOOK_CAM + 0.5)
        hy += math.radians(-4) * cam_k
        hp += math.radians(-2) * cam_k
        torso_yaw = hy * 0.25
        hy += math.radians(1.5) * noise1(t, 3) * (1 - run_k)
        hp += math.radians(1.0) * noise1(t, 7)
        breath = math.radians(1.0) * math.sin(2 * math.pi * t / 4.0)
        deltas = {
            "pelvis": rot_world((0, 0, 1), pelvis_yaw) @ rot_world((1, 0, 0), lean * 0.4 + bend * 0.3),
            "spine_01": rot_world((0, 0, 1), pelvis_yaw * 0.4) @ rot_world((1, 0, 0), lean * 0.7 + bend * 0.6 + math.radians(3)),
            "spine_02": rot_world((0, 0, 1), -pelvis_yaw * 0.3 + torso_yaw * 0.5) @ rot_world((1, 0, 0), lean * 0.9 + bend * 0.8 + math.radians(3) + breath + pant),
            "spine_03": rot_world((0, 0, 1), -pelvis_yaw * 0.7 + torso_yaw) @ rot_world((1, 0, 0), lean + bend + math.radians(2) + breath * 0.6 + pant * 1.3),
            "neck_01": rot_world((0, 0, 1), torso_yaw + (hy - torso_yaw) * 0.45) @ rot_world((1, 0, 0), -lean * 0.6 - bend * 0.6 + hp * 0.4 - math.radians(3)),
            "head": rot_world((0, 0, 1), hy) @ rot_world((1, 0, 0), -lean * 0.9 - bend * 0.8 + hp),
        }
        set_abs_rotations(rig, deltas)
        for name in deltas:
            rig.pose.bones[name].keyframe_insert("rotation_quaternion", frame=f)
        # arms: pockets -> pumping while running -> hanging, catching breath
        pocket_k = 1 - ease(t, T_RUN - 0.2, T_RUN + 0.25)
        for side in "lr":
            sx = 1 if side == "l" else -1
            h = ctrls[side][2]
            # left arm forward when the right leg is forward
            pump = phase * (1 if side == "l" else -1)
            run_p = Vector((sx * 0.17, -0.02 - 0.24 * pump, 1.10 + 0.13 * pump))
            pocket = Vector((sx * 0.205, -0.085, 0.97))
            hang = Vector((sx * 0.24, -0.12, 0.86))
            p = pocket.lerp(run_p, max(run_k, 1 - pocket_k) if t < T_ARRIVE else run_k)
            p = p.lerp(hang, ease(t, T_ARRIVE - 0.4, T_ARRIVE + 0.2))
            place_hand(rig, h, side, p)
            h.keyframe_insert("location", frame=f)
    for o in [rig] + [c for side in ctrls.values() for c in side]:
        if o.animation_data and o.animation_data.action:
            for fc in o.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
    return ctrls, steps


def animate_bus(root, leaves, wheels):
    for f in range(1, FRAMES + 1):
        t = ft(f)
        yf = bus_front(t)
        acc = (_bus_v(t + 0.05) - _bus_v(t - 0.05)) / 0.1
        root.location = (B.X_CENTER, yf, 0.0)
        root.rotation_euler = (math.radians(0.6) * max(-1.0, min(1.0, -acc)) * 0.6, 0, 0)
        root.keyframe_insert("location", frame=f)
        root.keyframe_insert("rotation_euler", frame=f)
        for w in wheels:
            w.rotation_euler.x = -(yf - BUS_FRONT0) / 0.5
            w.keyframe_insert("rotation_euler", frame=f)
        frac = ease(t, BUS_T_STOP + 0.05, BUS_T_STOP + 0.6)
        B.door_open(leaves, frac, f)
    for o in [root] + leaves + wheels:
        for fc in o.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


# ---------------------------------------------------------------- camera (cuts)

def shot_at(t):
    name, start = SHOTS[0][1], 0.0
    for (s, n) in SHOTS:
        if t >= s:
            name, start = n, s
    return name, start


def animate_camera(cam, rig, sign_world):
    scn = bpy.context.scene
    cd = cam.data
    cd.sensor_width = 36
    cd.dof.use_dof = True
    eyes = []
    for f in range(1, FRAMES + 1):
        scn.frame_set(f)
        hb = rig.pose.bones["head"]
        hpos = rig.matrix_world @ (hb.head + (hb.tail - hb.head) * 0.3)
        body_fwd = (rig.matrix_world.to_3x3() @ Vector((0, -1, 0))).normalized()
        eyes.append((hpos, body_fwd))
    prev_shot = None
    for i in range(FRAMES):
        f = i + 1
        t = ft(f)
        H, fwd = eyes[i]
        name, st = shot_at(t)
        u = t - st
        if name == "ots":
            p = Vector((WALK_X - 1.0, Y0 - 3.8 + 0.25 * u, 1.75))
            look = Vector((2.3, bus_front(t) - 6.0, 1.6))
            lens, fst, focus = 30, 2.8, (Vector((1.6, bus_front(t) - 9.0, 1.6)) - p).length
        elif name == "crash":
            k = smooth(min(1.0, max(0.0, (u - 0.12) / 0.32)))     # fast push-in
            off = Vector((-0.45, 2.1, -0.05)).lerp(Vector((-0.12, 0.62, 0.0)), k)
            p = H + off
            look = H + Vector((0, 0, 0.01 * k))
            lens, fst = 45 + 40 * k, 2.2
            focus = (H + fwd * 0.08 - p).length
        elif name == "side":
            p = Vector((4.32, H.y - 0.35 + 0.3 * u / 2.1, 1.2))
            look = Vector((H.x - 1.1, H.y + 0.45, H.z - 0.3))
            lens, fst = 20, 2.8
            focus = (Vector((H.x, H.y, H.z)) - p).length
        elif name == "front":
            p = Vector((3.05, H.y + 3.6 - 0.5 * u / 2.7, 0.95))
            look = Vector((3.0, H.y, 1.35))
            lens, fst = 35, 2.0
            focus = (H - p).length
        elif name == "arrive":
            k = smooth(u / 2.3)
            p = Vector((4.35, DOOR_Y_END - 4.2 + 0.9 * k, 1.5 - 0.1 * k))
            look = Vector((2.4, DOOR_Y_END + 0.2, 1.35))
            lens, fst = 30 + 6 * k, 2.4
            focus = (H - p).length
        elif name == "inside":
            p = Vector((1.15, DOOR_Y_END + 1.75, 2.05))
            look = H + Vector((0, 0, -0.15))
            lens, fst = 30, 2.2
            focus = (H - p).length
        elif name == "sign":
            k = smooth(u / 0.8)
            # his point of view, slow push toward the whole sign
            p = sign_world + Vector((-0.02, -1.3 + 0.15 * k, -0.5))     # between the hand poles
            look = sign_world + Vector((0, 0, -0.02))
            lens, fst = 20, 4.0
            focus = (sign_world - p).length
        else:   # closeup: in front of the face, slow push, settles
            k = 1 - (1 - smooth(u / 2.4)) ** 2
            p = H + Vector((-0.95, 0.22, -0.02)).lerp(Vector((-0.62, 0.12, -0.02)), k)
            look = H + Vector((0, 0.02, -0.02))
            lens, fst = 60 + 10 * k, 1.8
            focus = (H + Vector((-0.09, 0, 0)) - p).length
        hh = 0.004 if name not in ("side", "front") else 0.012
        p = p + Vector((noise1(t * 0.9, 1) * hh, noise1(t * 0.8, 2) * hh * 0.5, noise1(t * 1.1, 3) * hh))
        cam.location = p
        q = (look - p).normalized().to_track_quat("-Z", "Y")
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q @ Quaternion((0, 0, 1), math.radians(0.5) * noise1(t * 0.6, 9))
        cd.lens = lens
        cd.dof.aperture_fstop = fst
        cd.dof.focus_distance = focus
        for idb, path in ((cam, "location"), (cam, "rotation_quaternion"), (cd, "lens"),
                          (cd.dof, "aperture_fstop"), (cd.dof, "focus_distance")):
            idb.keyframe_insert(path, frame=f)
    # linear within shots, constant on the last frame of each shot (clean cuts with
    # motion blur starting on the frame)
    cut_frames = {int(round(s * FPS)) for (s, _) in SHOTS[1:]}
    for idb in (cam, cd):
        for fc in idb.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT" if int(kp.co.x) in cut_frames else "LINEAR"
    return cut_frames
