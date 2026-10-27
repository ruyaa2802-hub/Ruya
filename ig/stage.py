"""Builds the standard stage for an episode: set, lights and the cast."""
import math

import bpy

from . import render
from .characters import battaniye, buzdolabi, kupa, peynir, sut, yastik
from .sets import bedroom, kitchen
from .util import collection, reset_scene

CAST = {"yastik": yastik, "battaniye": battaniye, "kupa": kupa, "buzdolabi": buzdolabi, "sut": sut,
        "peynir": peynir}
SETS = {"bedroom": bedroom, "kitchen": kitchen}

# default blocking in the bedroom
HOME = {
    "yastik": dict(loc=(0.0, 0.86, bedroom.MATTRESS_TOP - 0.012), rot=(math.radians(-13), 0, 0)),
    "battaniye": dict(loc=(1.18, -0.42, 0.0), rot=(0, 0, math.radians(28))),
    "kupa": dict(loc=(bedroom.NIGHTSTAND[0] - 0.12, bedroom.NIGHTSTAND[1] - 0.08, bedroom.NIGHTSTAND[2]),
                 rot=(0, 0, math.radians(-35))),         # on the nightstand, turned toward the bed
}


def build(cast=("yastik", "battaniye"), preset="preview", fps=24, home=None, set_name="bedroom"):
    """home: optional per-episode blocking overrides {name: dict(loc=..., rot=...)}."""
    reset_scene()
    render.setup(preset, fps)
    room = SETS[set_name]
    room.build(exclude={"mug"} if "kupa" in cast else ())   # the mug is a character now
    room.lighting()
    chars = {}
    for name in cast:
        col = collection(name.capitalize())
        chars[name] = CAST[name].build(col, **{**HOME.get(name, {}), **(home or {}).get(name, {})})
    bpy.context.view_layer.update()
    return chars
