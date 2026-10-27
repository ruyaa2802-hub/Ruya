"""The human (only ever seen in part): pyjama legs in fluffy slippers and one
sleeved arm. Not a Character – it has no face; episodes move it with
Timeline.prop() on the pieces returned by build():

    root   empty on the floor between the feet (walk it around: location / rotation_euler)
    torso  pyjama top up to the neck – keep the head out of frame
    leg_L, leg_R   pivot at the hip joint (swing: rotation_euler.x)
    arm    pivot at the right shoulder (reach: rotation_euler)
"""
import math

import bpy

from .. import materials as M
from ..shapes import rounded_tube
from ..sets.bedroom import _blobs
from ..util import empty, link

HIP_Z = 0.9
SHOULDER = (0.19, 0.0, 1.42)


def _leg(name, col, pyjama, slipper):
    rings = [(-0.86, 0.058, 0.062), (-0.84, 0.064, 0.07), (-0.6, 0.07, 0.074), (-0.4, 0.078, 0.08),
             (-0.2, 0.085, 0.088), (0.0, 0.09, 0.095)]
    leg = rounded_tube(name, rings, segs=24, n=2.4, col=col)
    leg.data.materials.append(pyjama)
    cuff = rounded_tube(name + "_cuff", [(-0.875, 0.06, 0.064), (-0.86, 0.062, 0.066)], segs=24, n=2.4, col=col)
    cuff.data.materials.append(pyjama)
    cuff.parent = leg
    foot = _blobs(name + "_slipper", [((0, -0.07, -0.89), (0.06, 0.13, 0.045)), ((0, -0.02, -0.865), (0.065, 0.08,
                                                                                                     0.04)),
                                      ((-0.03, -0.17, -0.86), (0.025, 0.025, 0.025)),
                                      ((0.03, -0.17, -0.86), (0.025, 0.025, 0.025))],
                  slipper, col, rings=8, segs=14, subsurf=1)
    foot.parent = leg
    return leg


def build(col=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    pyjama = M.fabric("pyjama", (0.2, 0.27, 0.5), pattern="plaid", accent=(0.75, 0.8, 0.92),
                      accent2=(0.55, 0.15, 0.2), sheen=0.5, wrinkle=0.04)
    slipper = M.fabric("slipper_fluffy", (0.72, 0.68, 0.64), sheen=1.0, fuzz=0.6, wrinkle=0.0)
    skin_m = M.skin("human_skin")

    root = empty("insan_root", loc, 0.1, col)
    root.rotation_euler = rot
    legs = {}
    for side, x in (("L", -0.1), ("R", 0.1)):
        leg = _leg(f"insan_leg_{side}", col, pyjama, slipper)
        leg.parent = root
        leg.location = (x, 0.0, HIP_Z)
        legs[side] = leg
    torso = rounded_tube("insan_torso", [(0.8, 0.17, 0.11), (0.95, 0.18, 0.12), (1.15, 0.19, 0.12),
                                         (1.35, 0.2, 0.12), (1.45, 0.17, 0.1), (1.5, 0.08, 0.06)],
                         segs=32, n=2.6, col=col)
    torso.data.materials.append(pyjama)
    torso.parent = root
    # right arm: sleeve (upper arm + forearm, slightly bent) and a hand, built hanging from the shoulder
    arm = rounded_tube("insan_arm", [(-0.6, 0.042, 0.042), (-0.56, 0.046, 0.046), (-0.3, 0.05, 0.052),
                                     (-0.1, 0.058, 0.06), (0.0, 0.06, 0.062)], segs=24, n=2.2, col=col)
    arm.data.materials.append(pyjama)
    arm.parent = root
    arm.location = SHOULDER
    hand = _blobs("insan_hand", [((0, -0.005, -0.66), (0.038, 0.022, 0.06)),          # palm
                                 ((0, -0.006, -0.73), (0.034, 0.018, 0.035)),         # fingers
                                 ((-0.035, -0.02, -0.65), (0.012, 0.012, 0.03))],     # thumb
                  skin_m, col, rings=10, segs=14, subsurf=1)
    hand.parent = arm
    return dict(root=root, leg_L=legs["L"], leg_R=legs["R"], arm=arm, hand=hand, torso=torso)
