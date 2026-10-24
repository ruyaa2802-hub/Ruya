"""Procedural character animation + camera for the 10 s shot.

Legs use IK with a footstep planner (planted feet never slide), pelvis height is
solved from leg reach, hands rest in the coat pockets via arm IK. Everything is
baked to per-frame keys so the cloth sim and the renderer see the same motion.
"""
import bpy
import math
from mathutils import Vector, Quaternion, Matrix, Euler

FPS = 30
FRAMES = 300
WALK_X = 3.15
Y0 = 14.0          # where the man stands at the start
V_WALK = 1.2       # m/s
T_START = 3.0
T_STOP = 7.75
STEP_T = 0.5       # time between successive foot landings
SWING_T = 0.4
FOOT_LAT = 0.105   # lateral offset of each ankle from the walk line


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (6 * x - 15) + 10)


def ease(t, t0, t1):
    return smooth((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t1)


def frame_time(f):
    return (f - 1) / FPS


# ------------------------------------------------------------------ locomotion

def velocity(t):
    return V_WALK * ease(t, T_START, T_START + 0.8) * (1 - ease(t, T_STOP - 0.9, T_STOP))


def build_distance_table(dt=1 / 600):
    ts, ss = [0.0], [0.0]
    t, s = 0.0, 0.0
    while t < FRAMES / FPS + 1:
        s += velocity(t + dt / 2) * dt
        t += dt
        ts.append(t)
        ss.append(s)
    return ts, ss


_TS, _SS = build_distance_table()


def dist(t):
    if t <= 0:
        return 0.0
    i = min(len(_TS) - 1, int(t * 600))
    return _SS[i]


def plan_steps():
    """Returns per-foot list of (t_lift, t_land, s_from, s_to)."""
    feet = {"r": [], "l": []}
    pos = {"r": 0.0, "l": 0.0}
    s_end = dist(20.0)
    t = T_START + 0.05
    foot = "r"
    while True:
        t_land = t + SWING_T
        # symmetric stance: the foot lands as far ahead as it will be behind at lift-off
        target = dist(t_land) + 0.5 * velocity(t_land) * (2 * STEP_T - SWING_T)
        target = min(target, s_end)
        if abs(target - pos[foot]) > 0.02:
            feet[foot].append((t, t_land, pos[foot], target))
            pos[foot] = target
        if abs(pos["r"] - s_end) < 0.02 and abs(pos["l"] - s_end) < 0.02:
            break
        t += STEP_T
        foot = "l" if foot == "r" else "r"
        if t > 9.5:
            break
    return feet


def foot_state(steps, t):
    """Ankle forward distance, lift height and pitch (toes-down positive, radians)."""
    s = steps[0][2] if steps else 0.0
    for (t0, t1, a, b) in steps:
        if t < t0:
            # heel rise before lift-off
            pre = ease(t, t0 - 0.26, t0)
            return a, 0.12 * math.sin(math.radians(26) * pre), math.radians(26) * pre
        if t <= t1:
            u = (t - t0) / (t1 - t0)
            span = min(1.0, abs(b - a) / 0.6)
            x = a + (b - a) * smooth(u)
            lift = (0.10 * span + 0.02) * math.sin(math.pi * u) ** 1.2
            # toe-off pitch fading to heel-strike (toes up)
            pitch = math.radians(26) * (1 - smooth(u / 0.35)) * span - math.radians(14) * smooth((u - 0.55) / 0.45) * span
            heel_lift = 0.12 * math.sin(max(0.0, pitch)) if pitch > 0 else 0.0
            return x, lift + heel_lift, pitch
        s = b
        # flatten after heel strike
        if t < t1 + 0.12:
            k = 1 - ease(t, t1, t1 + 0.12)
            return s, 0.0, -math.radians(14) * k * min(1.0, abs(b - a) / 0.6)
    return s, 0.0, 0.0


# ------------------------------------------------------------------ rig helpers

R_OBJ = Quaternion((0, 0, 1), math.pi)   # the rig is turned to face +Y


def world_delta_to_arm(q):
    return R_OBJ.inverted() @ q @ R_OBJ


def set_abs_rotations(rig, deltas):
    """deltas: bone -> armature-space absolute rotation delta (rest -> pose)."""
    order = [b.name for b in rig.data.bones]
    abs_d = {}
    for name in order:
        b = rig.data.bones[name]
        parent_d = abs_d.get(b.parent.name, Quaternion()) if b.parent else Quaternion()
        d = deltas.get(name)
        if d is None:
            abs_d[name] = parent_d
            continue
        abs_d[name] = d
        m = b.matrix_local.to_quaternion()
        q = m.inverted() @ parent_d.inverted() @ d @ m
        pb = rig.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = q


def rot_world(axis, ang):
    return world_delta_to_arm(Quaternion(axis, ang))


def noise1(t, seed):
    return (math.sin(t * 1.7 + seed) * 0.5 + math.sin(t * 2.9 + seed * 2.1) * 0.3 + math.sin(t * 5.3 + seed * 0.7) * 0.2)


def setup_ik(rig):
    col = bpy.context.collection
    ctrls = {}
    for side, sx in (("l", 1), ("r", -1)):
        tgt = bpy.data.objects.new(f"FootIK_{side}", None)
        tgt.empty_display_size = 0.1
        tgt.rotation_mode = "QUATERNION"
        col.objects.link(tgt)
        pole = bpy.data.objects.new(f"KneePole_{side}", None)
        col.objects.link(pole)
        pole.parent = rig
        pole.location = (sx * 0.17, -0.9, 0.55)    # rig-local front is -Y
        c = rig.pose.bones[f"calf_{side}"].constraints.new("IK")
        c.target = tgt
        c.pole_target = pole
        c.pole_angle = math.radians(-90)
        c.chain_count = 2
        c.use_stretch = False
        cr = rig.pose.bones[f"foot_{side}"].constraints.new("COPY_ROTATION")
        cr.target = tgt
        # hands in pockets
        h = bpy.data.objects.new(f"HandIK_{side}", None)
        col.objects.link(h)
        h.parent = rig
        h.parent_type = "BONE"
        h.parent_bone = "pelvis"
        hp = bpy.data.objects.new(f"ElbowPole_{side}", None)
        col.objects.link(hp)
        hp.parent = rig
        hp.location = (sx * 0.55, 0.45, 1.2)
        c2 = rig.pose.bones[f"lowerarm_{side}"].constraints.new("IK")
        c2.target = h
        c2.pole_target = hp
        c2.pole_angle = math.radians(-90 if side == "l" else -90)
        c2.chain_count = 2
        ctrls[side] = (tgt, pole, h, hp)
    return ctrls


def place_hand_target(rig, h, side, swing):
    """Pocket position given in rig space, converted to pelvis-bone space."""
    sx = 1 if side == "l" else -1
    p_rig = Vector((sx * 0.205, -0.085 - swing, 0.97))
    pb = rig.data.bones["pelvis"]
    # parent_type BONE: child space is the bone tail frame
    m = pb.matrix_local.copy()
    m.translation = pb.tail_local
    h.matrix_parent_inverse = Matrix.Identity(4)
    h.location = m.inverted() @ p_rig


def animate(rig, head_focus=None):
    scn = bpy.context.scene
    ctrls = setup_ik(rig)
    steps = plan_steps()
    foot_rest = {s: rig.data.bones[f"foot_{s}"].matrix_local.to_quaternion() for s in ("l", "r")}
    ankle_rest_z = rig.data.bones["foot_l"].head_local.z
    hip_rest = rig.data.bones["thigh_l"].head_local
    leg_len = (rig.data.bones["thigh_l"].length + rig.data.bones["calf_l"].length) * 0.995
    pelvis_rest_z = 0.0

    # pass 1: feet + raw pelvis height
    data = []
    for f in range(1, FRAMES + 1):
        t = frame_time(f)
        s = dist(t)
        fl = foot_state(steps["l"], t)
        fr = foot_state(steps["r"], t)
        # lateral weight shift toward the stance foot
        sway = 0.0
        if T_START - 0.3 < t < T_STOP + 0.2:
            sway = 0.018 * math.sin(math.pi * (t - T_START) / STEP_T) * ease(t, T_START - 0.3, T_START + 0.4) * (1 - ease(t, T_STOP - 0.5, T_STOP + 0.2))
        idle_sway = 0.012 * math.sin(t * 0.9) * (1 - ease(t, 2.6, 3.1)) + 0.008 * math.sin(t * 0.8) * ease(t, T_STOP, T_STOP + 0.8)
        root_x = WALK_X + sway + idle_sway
        # max pelvis height so both grounded legs reach
        h = 0.0
        for (fs, lat) in ((fl, -FOOT_LAT), (fr, FOOT_LAT)):
            ax, lift, pitch = fs
            dx = (ax - s)
            dz_ground = ankle_rest_z + lift
            hip_x = root_x + (0.118 if lat > 0 else -0.118)
            lateral = (WALK_X + lat) - hip_x
            reach2 = leg_len ** 2 - dx ** 2 - lateral ** 2
            hip_z_max = dz_ground + math.sqrt(max(0.01, reach2))
            h = hip_z_max if h == 0 else min(h, hip_z_max)
        dz = min(0.0, h - hip_rest.z) - 0.012 * ease(t, T_START - 0.2, T_START + 0.5) * (1 - ease(t, T_STOP, T_STOP + 0.6))
        breathe = 0.003 * math.sin(2 * math.pi * t / 4.0)
        data.append(dict(t=t, s=s, fl=fl, fr=fr, root_x=root_x, dz=dz + breathe))
    # smooth pelvis height (keeps the min-constraint mostly intact)
    raw = [d["dz"] for d in data]
    sm = []
    for i in range(len(raw)):
        acc, wsum = 0.0, 0.0
        for k in range(-3, 4):
            j = min(len(raw) - 1, max(0, i + k))
            w = math.exp(-(k * k) / 4.0)
            acc += raw[j] * w
            wsum += w
        sm.append(min(acc / wsum, raw[i] + 0.006))
    for d, z in zip(data, sm):
        d["dz"] = z

    for i, d in enumerate(data):
        f = i + 1
        t, s = d["t"], d["s"]
        scn.frame_set(f)
        rig.location = (d["root_x"], Y0 + s, d["dz"])
        rig.rotation_euler = (0, 0, math.pi)
        rig.keyframe_insert("location", frame=f)
        rig.keyframe_insert("rotation_euler", frame=f)
        for side, fs, lat in (("l", d["fl"], -FOOT_LAT), ("r", d["fr"], FOOT_LAT)):
            tgt = ctrls[side][0]
            ax, lift, pitch = fs
            # rig-space ankle x of the left foot is +x, which maps to world -x after the 180° turn
            tgt.location = (WALK_X + lat, Y0 + ax, ankle_rest_z + lift)
            q = Quaternion((1, 0, 0), -pitch) @ R_OBJ @ foot_rest[side]
            tgt.rotation_quaternion = q
            tgt.keyframe_insert("location", frame=f)
            tgt.keyframe_insert("rotation_quaternion", frame=f)
        # pelvis yaw follows the legs, upper body counter-rotates
        yaw = math.radians(6) * ((d["fr"][0] - d["fl"][0]) / 0.68)
        breath = math.radians(1.2) * math.sin(2 * math.pi * t / 4.0)
        # head behaviour
        look_back = ease(t, 4.35, 4.95) * (1 - ease(t, 5.55, 6.25))
        look_far = ease(t, T_STOP - 0.4, T_STOP + 0.9)
        idle_down = (1 - ease(t, 2.2, 3.0)) * math.radians(8)
        head_yaw = math.radians(78) * look_back + math.radians(4) * look_far + math.radians(2.0) * noise1(t, 3)
        head_pitch = -idle_down + math.radians(6) * look_far - math.radians(5) * look_back + math.radians(1.0) * noise1(t, 7)
        torso_yaw = math.radians(16) * look_back
        deltas = {}
        deltas["pelvis"] = rot_world((0, 0, 1), yaw)
        deltas["spine_01"] = rot_world((0, 0, 1), yaw * 0.5) @ rot_world((1, 0, 0), math.radians(3))
        deltas["spine_02"] = rot_world((0, 0, 1), -yaw * 0.2 + torso_yaw * 0.4) @ rot_world((1, 0, 0), math.radians(3) + breath)
        deltas["spine_03"] = rot_world((0, 0, 1), -yaw * 0.5 + torso_yaw) @ rot_world((1, 0, 0), math.radians(2) + breath * 0.6)
        deltas["neck_01"] = rot_world((0, 0, 1), torso_yaw + head_yaw * 0.45) @ rot_world((1, 0, 0), head_pitch * 0.4 - math.radians(3))
        deltas["head"] = rot_world((0, 0, 1), torso_yaw + head_yaw) @ rot_world((1, 0, 0), head_pitch)
        set_abs_rotations(rig, deltas)
        for name in deltas:
            rig.pose.bones[name].keyframe_insert("rotation_quaternion", frame=f)
        # hands: small swing opposite the legs
        for side in ("l", "r"):
            h = ctrls[side][2]
            sw = 0.025 * ((d["fl"][0] - d["fr"][0]) / 0.68) * (1 if side == "r" else -1)
            place_hand_target(rig, h, side, sw)
            h.keyframe_insert("location", frame=f)
    # linear interpolation everywhere: values are already per-frame
    for o in [rig] + [c for side in ctrls.values() for c in side]:
        if o.animation_data and o.animation_data.action:
            for fc in o.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
    return ctrls, steps


# ------------------------------------------------------------------ camera

def head_world(rig, f):
    bpy.context.scene.frame_set(f)
    pb = rig.pose.bones["head"]
    return rig.matrix_world @ (pb.head + (pb.tail - pb.head) * 0.35)


def animate_camera(cam, rig, focus):
    scn = bpy.context.scene
    cd = cam.data
    cd.sensor_width = 36
    cd.dof.use_dof = True
    cd.dof.focus_object = None
    heads = [head_world(rig, f) for f in range(1, FRAMES + 1)]
    eyes = []
    for f in range(1, FRAMES + 1):
        bpy.context.scene.frame_set(f)
        hb = rig.pose.bones["head"]
        m = rig.matrix_world @ hb.matrix
        # eye level, a bit in front of the head bone (bone-local -Z is the face direction here)
        fwd = (m.to_3x3() @ Vector((0, 0, 1))).normalized()
        if fwd.dot(rig.matrix_world.to_3x3() @ Vector((0, -1, 0))) < 0:
            fwd = -fwd
        eyes.append(rig.matrix_world @ (hb.head + (hb.tail - hb.head) * 0.3) + fwd * 0.08)
    # smooth head track for the camera (cameras don't follow every bob)
    sm = []
    for i in range(len(heads)):
        acc = Vector()
        wsum = 0
        for k in range(-12, 13):
            j = min(len(heads) - 1, max(0, i + k))
            w = math.exp(-(k * k) / 50.0)
            acc += heads[j] * w
            wsum += w
        sm.append(acc / wsum)
    for i in range(FRAMES):
        f = i + 1
        t = frame_time(f)
        H = sm[i]
        # shot A: wide dolly into the street
        ua = smooth(t / 3.6)
        pa = Vector((0.2, Y0 - 17.0, 3.4)).lerp(Vector((1.0, Y0 - 7.0, 2.2)), ua)
        la = Vector((1.4, Y0 + 30, 2.0)).lerp(Vector((WALK_X - 0.4, Y0 + 6, 1.3)), ua)
        lens_a = 24 + 4 * ua
        # shot B: side tracking from the road
        pb = Vector((WALK_X - 1.95, H.y + 2.3, 1.5))
        lb = Vector((WALK_X + 0.1, H.y - 0.25, H.z - 0.32))
        lens_b = 40
        # shot C: slow push to a 3/4 front close-up
        uc = ease(t, 7.2, 10.0)
        uc = 1 - (1 - uc) ** 2.2   # long ease-out so the move settles
        pc = H + Vector((-0.75, 2.4, 0.04)).lerp(Vector((-0.30, 0.98, 0.0)), uc)
        lc = H + Vector((0.0, 0.0, -0.03))
        lens_c = 50 + 15 * uc
        wb = ease(t, 2.8, 4.2)
        wc = ease(t, 6.9, 8.2)
        p = pa.lerp(pb, wb).lerp(pc, wc)
        l = la.lerp(lb, wb).lerp(lc, wc)
        lens = lens_a + (lens_b - lens_a) * wb
        lens = lens + (lens_c - lens) * wc
        # subtle handheld drift
        hh = 0.006 + 0.004 * (1 - wc)
        p += Vector((noise1(t * 0.7, 1) * hh, noise1(t * 0.6, 2) * hh * 0.5, noise1(t * 0.8, 3) * hh))
        cam.location = p
        d = (l - p).normalized()
        q = d.to_track_quat("-Z", "Y")
        roll = math.radians(0.4) * noise1(t * 0.5, 9)
        q = q @ Quaternion((0, 0, 1), roll)
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q
        cd.lens = lens
        cd.dof.aperture_fstop = 2.8 + (1.8 - 2.8) * wb
        cd.dof.aperture_fstop += (1.6 - cd.dof.aperture_fstop) * wc
        cd.dof.focus_distance = (eyes[i] - p).length
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        cd.keyframe_insert("lens", frame=f)
        cd.dof.keyframe_insert("aperture_fstop", frame=f)
        cd.dof.keyframe_insert("focus_distance", frame=f)
    for idb in (cam, cd):
        if idb.animation_data and idb.animation_data.action:
            for fc in idb.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
