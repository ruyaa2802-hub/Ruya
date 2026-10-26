"""Builds the standard stage for an episode: set, lights and the cast."""
import math

import bpy

from . import render
from .characters import battaniye, yastik
from .sets import bedroom
from .util import collection, reset_scene

CAST = {"yastik": yastik, "battaniye": battaniye}

# default blocking in the bedroom
HOME = {
    "yastik": dict(loc=(0.0, 0.86, bedroom.MATTRESS_TOP - 0.012), rot=(math.radians(-13), 0, 0)),
    "battaniye": dict(loc=(1.18, -0.42, 0.0), rot=(0, 0, math.radians(28))),
}


def build(cast=("yastik", "battaniye"), preset="preview", fps=24, home=None):
    """home: optional per-episode blocking overrides {name: dict(loc=..., rot=...)}."""
    reset_scene()
    render.setup(preset, fps)
    bedroom.build()
    bedroom.lighting()
    chars = {}
    for name in cast:
        col = collection(name.capitalize())
        chars[name] = CAST[name].build(col, **{**HOME[name], **(home or {}).get(name, {})})
    bpy.context.view_layer.update()
    return chars
