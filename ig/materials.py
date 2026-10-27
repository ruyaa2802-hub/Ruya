"""Procedural, reusable Cycles materials.

Every factory caches by name, so characters and sets that ask for the same
material share one datablock. Patterns are driven by UVs in meters, so a
stripe or plaid keeps its physical size on any mesh.
"""
import bpy


class NB:
    """Tiny node-tree builder."""

    def __init__(self, mat):
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new("ShaderNodeOutputMaterial")
        self.x = 0

    def n(self, kind, inputs=None, **props):
        node = self.nt.nodes.new(kind)
        node.location = (self.x, 0)
        self.x -= 200
        for k, v in props.items():
            setattr(node, k, v)
        for k, v in (inputs or {}).items():
            if isinstance(v, bpy.types.NodeSocket):
                self.nt.links.new(v, node.inputs[k])
            else:
                node.inputs[k].default_value = v
        return node

    def link(self, a, b):
        self.nt.links.new(a, b)

    # math sugar -------------------------------------------------------
    def math(self, op, a, b=0.0, clamp=False):
        return self.n("ShaderNodeMath", {0: a, 1: b}, operation=op, use_clamp=clamp).outputs[0]

    def mix(self, a, b, fac):
        node = self.n("ShaderNodeMix", data_type="RGBA", blend_type="MIX")
        for sock, val in ((node.inputs[0], fac), (node.inputs[6], a), (node.inputs[7], b)):
            if isinstance(val, bpy.types.NodeSocket):
                self.link(val, sock)
            else:
                sock.default_value = val
        return node.outputs[2]

    def band(self, coord, period, width, soft):
        """1 inside a stripe of `width` repeating every `period`, smooth edges."""
        f = self.math("FRACT", self.math("DIVIDE", coord, period))
        d = self.math("ABSOLUTE", self.math("SUBTRACT", f, 0.5))
        half = width / period / 2
        s = soft / period
        mr = self.n("ShaderNodeMapRange", {"Value": d, 1: half + s, 2: max(half - s, 0.0), 3: 0.0, 4: 1.0},
                    interpolation_type="SMOOTHSTEP")
        return mr.outputs[0]

    def uv_xy(self):
        uv = self.n("ShaderNodeUVMap", uv_map="UVMap")
        sep = self.n("ShaderNodeSeparateXYZ", {0: uv.outputs[0]})
        return sep.outputs[0], sep.outputs[1], uv.outputs[0]

    def principled(self, **inputs):
        p = self.n("ShaderNodeBsdfPrincipled", inputs)
        self.link(p.outputs[0], self.out.inputs[0])
        return p


def _new(name):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat, None
    mat = bpy.data.materials.new(name)
    return mat, NB(mat)


def _rgba(c):
    return (c[0], c[1], c[2], 1.0)


def _weave_bump(nb, u, v, period=0.0016, strength=0.25, wrinkle=0.0, wrinkle_scale=6.0, detail=False):
    """Soft large wrinkles; with detail=True also a woven-thread micro bump.

    The weave is sub-pixel below ~4K and only adds sampling noise, so it is
    off by default (render time drops ~40%).
    """
    height = None
    if detail:
        su = nb.math("SINE", nb.math("MULTIPLY", u, 6.2832 / period))
        sv = nb.math("SINE", nb.math("MULTIPLY", v, 6.2832 / period))
        height = nb.math("MULTIPLY", nb.math("MULTIPLY", su, sv), 0.5)
    if wrinkle > 0:
        noise = nb.n("ShaderNodeTexNoise", {"Scale": wrinkle_scale, "Detail": 1.0, "Roughness": 0.45})
        w = nb.math("MULTIPLY", noise.outputs[0], wrinkle * 20)
        height = w if height is None else nb.math("ADD", height, w)
    if height is None:
        return None
    bump = nb.n("ShaderNodeBump", {"Strength": strength, "Distance": 0.002, "Height": height})
    return bump.outputs[0]


def _plaid(nb, u, v, base, accent, accent2):
    wide_u = nb.band(u, 0.11, 0.036, 0.003)
    wide_v = nb.band(v, 0.11, 0.036, 0.003)
    thin_u = nb.band(nb.math("ADD", u, 0.055), 0.11, 0.005, 0.0012)
    thin_v = nb.band(nb.math("ADD", v, 0.055), 0.11, 0.005, 0.0012)
    either = nb.math("MAXIMUM", wide_u, wide_v)
    both = nb.math("MULTIPLY", wide_u, wide_v)
    c = nb.mix(_rgba(base), _rgba(accent), nb.math("MULTIPLY", either, 0.75))
    c = nb.mix(c, _rgba(tuple(x * 0.55 for x in accent)), nb.math("MULTIPLY", both, 0.8))
    thin = nb.math("MAXIMUM", thin_u, thin_v)
    return nb.mix(c, _rgba(accent2), nb.math("MULTIPLY", thin, 0.9))


PALETTE = [(0.95, 0.35, 0.45), (0.25, 0.6, 0.95), (1.0, 0.78, 0.2), (0.3, 0.8, 0.55), (0.65, 0.4, 0.9)]


def _confetti(nb, u, v, base, scale=14.0, radius=0.2):
    """Scattered colourful dots (confetti print)."""
    vec = nb.n("ShaderNodeCombineXYZ", {0: u, 1: v, 2: 0.0}).outputs[0]
    vor = nb.n("ShaderNodeTexVoronoi", {"Vector": vec, "Scale": scale, "Randomness": 0.85},
               voronoi_dimensions="2D", feature="F1")
    mask = nb.n("ShaderNodeMapRange", {"Value": vor.outputs["Distance"], 1: radius + 0.025, 2: radius,
                                       3: 0.0, 4: 1.0}, interpolation_type="SMOOTHSTEP").outputs[0]
    pick = nb.n("ShaderNodeSeparateColor", {0: vor.outputs["Color"]}).outputs[0]
    ramp = nb.n("ShaderNodeValToRGB", {"Fac": pick})
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, _rgba(PALETTE[0])
    els[1].position, els[1].color = 0.2, _rgba(PALETTE[1])
    for i, c in enumerate(PALETTE[2:]):
        e = els.new(0.4 + 0.2 * i)
        e.color = _rgba(c)
    return nb.mix(_rgba(base), ramp.outputs[0], mask)


def _pattern(nb, pattern, u, v, base, accent, accent2):
    if pattern == "pinstripe":
        stripe = nb.band(u, 0.028, 0.0035, 0.0008)
        return nb.mix(_rgba(base), _rgba(accent), nb.math("MULTIPLY", stripe, 0.85))
    if pattern == "stripes":
        stripe = nb.band(u, 0.11, 0.045, 0.002)
        return nb.mix(_rgba(base), _rgba(accent), stripe)
    if pattern == "plaid":
        return _plaid(nb, u, v, base, accent, accent2)
    if pattern == "confetti":
        return _confetti(nb, u, v, base)
    return _rgba(base)


def fabric(name, base, pattern=None, accent=(0.2, 0.3, 0.5), accent2=(0.9, 0.85, 0.75),
           roughness=0.85, sheen=0.6, weave=0.0016, bump=0.2, wrinkle=0.02, fuzz=0.0, mapping="uv",
           detail=False):
    """Cotton / fleece fabric.

    pattern: None | 'pinstripe' | 'plaid'
    mapping: 'uv'        – UV map in meters (procedural character meshes)
             'object'    – object space (set dressing built from primitives)
             'triplanar' – rest-pose attributes `rest`/`rest_n` blended over three
                           planes; stable under deformation, no UV poles.
    """
    mat, nb = _new(name)
    if nb is None:
        return mat
    if mapping == "object":
        sep = nb.n("ShaderNodeSeparateXYZ", {0: nb.n("ShaderNodeTexCoord").outputs["Object"]})
        # skewed planar mapping: varies on top, front and side faces alike
        u = nb.math("ADD", sep.outputs[0], nb.math("MULTIPLY", sep.outputs[1], 0.7))
        v = nb.math("ADD", sep.outputs[1], sep.outputs[2])
        color = _pattern(nb, pattern, u, v, base, accent, accent2)
    elif mapping == "triplanar":
        rest = nb.n("ShaderNodeSeparateXYZ",
                    {0: nb.n("ShaderNodeAttribute", attribute_name="rest").outputs["Vector"]}).outputs
        rn = nb.n("ShaderNodeSeparateXYZ",
                  {0: nb.n("ShaderNodeAttribute", attribute_name="rest_n").outputs["Vector"]}).outputs
        w = [nb.math("POWER", nb.math("ABSOLUTE", rn[i]), 4.0) for i in range(3)]
        c_x = _pattern(nb, pattern, rest[1], rest[2], base, accent, accent2)   # side-facing: YZ plane
        c_y = _pattern(nb, pattern, rest[0], rest[2], base, accent, accent2)   # front-facing: XZ plane
        c_z = _pattern(nb, pattern, rest[0], rest[1], base, accent, accent2)   # top-facing: XY plane
        wxy = nb.math("ADD", w[0], w[1])
        c = nb.mix(c_x, c_y, nb.math("DIVIDE", w[1], nb.math("MAXIMUM", wxy, 1e-4)))
        color = nb.mix(c, c_z, nb.math("DIVIDE", w[2], nb.math("MAXIMUM", nb.math("ADD", wxy, w[2]), 1e-4)))
        u, v = nb.math("ADD", rest[0], rest[1]), rest[2]
    else:
        u, v, _ = nb.uv_xy()
        color = _pattern(nb, pattern, u, v, base, accent, accent2)
    normal = _weave_bump(nb, u, v, weave, bump, wrinkle, detail=detail)
    if fuzz > 0 and detail:
        fz = nb.n("ShaderNodeTexNoise", {"Scale": 900.0, "Detail": 2.0})
        fb = nb.n("ShaderNodeBump", {"Strength": fuzz, "Distance": 0.001, "Height": fz.outputs[0]})
        if normal is not None:
            nb.link(normal, fb.inputs["Normal"])
        normal = fb.outputs[0]
    inputs = {"Base Color": color, "Roughness": roughness, "Sheen Weight": sheen, "Sheen Roughness": 0.35,
              "Sheen Tint": _rgba(tuple(min(1.0, 0.35 + c) for c in base)), "Specular IOR Level": 0.3}
    if normal is not None:
        inputs["Normal"] = normal
    nb.principled(**inputs)
    return mat


def wood(name, light=(0.55, 0.33, 0.17), dark=(0.30, 0.15, 0.07), roughness=0.45,
         planks=False, scale=1.0, coat=0.25):
    mat, nb = _new(name)
    if nb is None:
        return mat
    tc = nb.n("ShaderNodeTexCoord")
    coords = tc.outputs["Object"]
    # long streaky grain along X, broken up by a slow warp
    warp = nb.n("ShaderNodeTexNoise", {"Vector": coords, "Scale": 1.2 * scale, "Detail": 0.0})
    wv = nb.n("ShaderNodeVectorMath", {0: coords, 1: warp.outputs[1]}, operation="ADD")
    wvs = nb.n("ShaderNodeVectorMath", {0: wv.outputs[0], 1: (0.06, 0.06, 0.06)}, operation="MULTIPLY")
    mixed = nb.n("ShaderNodeVectorMath", {0: coords, 1: wvs.outputs[0]}, operation="ADD")
    mapping = nb.n("ShaderNodeMapping", {"Vector": mixed.outputs[0], "Scale": (0.8 * scale, 30 * scale, 30 * scale)})
    streak = nb.n("ShaderNodeTexNoise", {"Vector": mapping.outputs[0], "Scale": 1.0, "Detail": 3.0,
                                         "Roughness": 0.6})
    fine = nb.n("ShaderNodeTexNoise", {"Vector": mapping.outputs[0], "Scale": 6.0, "Detail": 1.0})
    grain = nb.n("ShaderNodeMapRange", {"Value": nb.math("ADD", nb.math("MULTIPLY", streak.outputs[0], 0.75),
                                                          nb.math("MULTIPLY", fine.outputs[0], 0.25)),
                                         1: 0.3, 2: 0.7, 3: 0.0, 4: 1.0}).outputs[0]
    ramp = nb.n("ShaderNodeValToRGB", {"Fac": grain})
    ramp.color_ramp.elements[0].color = _rgba(dark)
    ramp.color_ramp.elements[1].color = _rgba(light)
    color = ramp.outputs[0]
    height = grain
    if planks:
        brick = nb.n("ShaderNodeTexBrick", {"Vector": coords, "Scale": 1.0, "Mortar Size": 0.004,
                                            "Brick Width": 1.2, "Row Height": 0.14,
                                            "Color1": (1, 1, 1, 1), "Color2": (0.78, 0.78, 0.78, 1),
                                            "Mortar": (0.05, 0.05, 0.05, 1)},
                     offset=0.5, squash=1.0)
        tint = nb.n("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
        tint.inputs[0].default_value = 1.0
        nb.link(color, tint.inputs[6])
        nb.link(brick.outputs[0], tint.inputs[7])
        color = tint.outputs[2]
        height = nb.math("ADD", nb.math("MULTIPLY", grain, 0.3), brick.outputs[1])
    bump = nb.n("ShaderNodeBump", {"Strength": 0.15, "Distance": 0.003, "Height": height})
    nb.principled(**{"Base Color": color, "Roughness": roughness, "Coat Weight": coat,
                     "Coat Roughness": 0.25, "Normal": bump.outputs[0]})
    return mat


def ceramic(name, color, roughness=0.12):
    mat, nb = _new(name)
    if nb is None:
        return mat
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 40.0, "Detail": 2.0})
    bump = nb.n("ShaderNodeBump", {"Strength": 0.02, "Height": noise.outputs[0]})
    nb.principled(**{"Base Color": _rgba(color), "Roughness": roughness, "Coat Weight": 0.6,
                     "Coat Roughness": 0.05, "Subsurface Weight": 0.05, "Normal": bump.outputs[0]})
    return mat


def metal(name, color=(0.8, 0.8, 0.8), roughness=0.3):
    mat, nb = _new(name)
    if nb is None:
        return mat
    nb.principled(**{"Base Color": _rgba(color), "Metallic": 1.0, "Roughness": roughness})
    return mat


def plastic(name, color, roughness=0.35):
    mat, nb = _new(name)
    if nb is None:
        return mat
    nb.principled(**{"Base Color": _rgba(color), "Roughness": roughness, "Specular IOR Level": 0.5})
    return mat


def paint(name, color, roughness=0.75, texture=0.08):
    """Matte painted plaster."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 25.0, "Detail": 2.0})
    bump = nb.n("ShaderNodeBump", {"Strength": texture, "Height": noise.outputs[0]})
    var = nb.n("ShaderNodeTexNoise", {"Scale": 1.5, "Detail": 0.0})
    c = nb.mix(_rgba(color), _rgba(tuple(x * 0.92 for x in color)), var.outputs[0])
    nb.principled(**{"Base Color": c, "Roughness": roughness, "Normal": bump.outputs[0]})
    return mat


def emission(name, color, strength):
    mat, nb = _new(name)
    if nb is None:
        return mat
    e = nb.n("ShaderNodeEmission", {"Color": _rgba(color), "Strength": strength})
    nb.link(e.outputs[0], nb.out.inputs[0])
    return mat


def lampshade(name, color):
    """Thin fabric shade that glows from a light inside."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    nb.principled(**{"Base Color": _rgba(color), "Roughness": 0.9, "Sheen Weight": 0.3})
    return mat


def eye(name, iris=(0.25, 0.45, 0.6), iris_ratio=0.56, pupil_ratio=0.42):
    """Glossy cartoon eyeball. The iris is painted around the local -Y pole."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    tc = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ", {0: tc.outputs["Object"]})
    x, y, z = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    # radial distance from the front axis, normalised by the eye radius (object scale = radius)
    r = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", x, x), nb.math("MULTIPLY", z, z)))
    front = nb.math("LESS_THAN", y, 0.0)
    ri = nb.math("MULTIPLY", r, 1.0)
    iris_mask = nb.n("ShaderNodeMapRange", {"Value": ri, 1: iris_ratio + 0.015, 2: iris_ratio - 0.015,
                                            3: 0.0, 4: 1.0}, interpolation_type="SMOOTHSTEP").outputs[0]
    iris_mask = nb.math("MULTIPLY", iris_mask, front)
    pr = iris_ratio * pupil_ratio
    pupil_mask = nb.n("ShaderNodeMapRange", {"Value": ri, 1: pr + 0.01, 2: pr - 0.01, 3: 0.0, 4: 1.0},
                      interpolation_type="SMOOTHSTEP").outputs[0]
    pupil_mask = nb.math("MULTIPLY", pupil_mask, front)
    # iris detail: radial fibres + darker limbal ring + lighter inner ring
    ang = nb.n("ShaderNodeMath", {0: z, 1: x}, operation="ARCTAN2").outputs[0]
    fib = nb.n("ShaderNodeTexNoise", {"Vector": nb.n("ShaderNodeCombineXYZ",
                                                       {0: nb.math("MULTIPLY", ang, 6.0), 1: ri, 2: 0.0}).outputs[0],
                                      "Scale": 6.0, "Detail": 4.0})
    rr = nb.n("ShaderNodeMapRange", {"Value": ri, 1: pr, 2: iris_ratio, 3: 0.0, 4: 1.0}).outputs[0]
    ramp = nb.n("ShaderNodeValToRGB", {"Fac": rr})
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, _rgba(tuple(min(1, c * 1.7) for c in iris))
    els[1].position, els[1].color = 0.75, _rgba(iris)
    e = els.new(1.0)
    e.color = _rgba(tuple(c * 0.25 for c in iris))
    iris_col = nb.mix(ramp.outputs[0], _rgba(tuple(c * 0.6 for c in iris)), nb.math("MULTIPLY", fib.outputs[0], 0.6))
    sclera = (0.93, 0.92, 0.9, 1)
    c = nb.mix(sclera, iris_col, iris_mask)
    c = nb.mix(c, (0.01, 0.01, 0.012, 1), pupil_mask)
    nb.principled(**{"Base Color": c, "Roughness": 0.25, "Coat Weight": 1.0, "Coat Roughness": 0.02,
                     "Coat IOR": 1.45})
    return mat


def mouth_inner(name="mouth_inner"):
    """Dark mouth cavity with a tongue tint toward the bottom (object-local Z)."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    tc = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ", {0: tc.outputs["Object"]})
    t = nb.n("ShaderNodeMapRange", {"Value": sep.outputs[2], 1: -0.006, 2: -0.035, 3: 0.0, 4: 1.0},
             interpolation_type="SMOOTHSTEP").outputs[0]
    # darker toward the centre so the flat cavity reads as depth
    r = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", sep.outputs[0], sep.outputs[0]),
                                nb.math("MULTIPLY", sep.outputs[2], sep.outputs[2])))
    edge = nb.n("ShaderNodeMapRange", {"Value": r, 1: 0.0, 2: 0.03, 3: 0.0, 4: 1.0}).outputs[0]
    c = nb.mix((0.018, 0.003, 0.004, 1), (0.36, 0.07, 0.08, 1), t)
    c = nb.mix(c, (0.16, 0.03, 0.035, 1), nb.math("MULTIPLY", edge, 0.5))
    nb.principled(**{"Base Color": c, "Roughness": 0.6, "Specular IOR Level": 0.2})
    return mat


def coffee_cold(name="coffee_cold"):
    """Coffee that went cold hours ago: dark and glossy, with a dull skin on top."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 38.0, "Detail": 6.0, "Roughness": 0.6})
    film = nb.n("ShaderNodeMapRange", {"Value": noise.outputs[0], 1: 0.48, 2: 0.6, 3: 0.0, 4: 1.0},
                interpolation_type="SMOOTHSTEP").outputs[0]
    c = nb.mix((0.04, 0.02, 0.009, 1), (0.27, 0.17, 0.1, 1), film)
    rough = nb.n("ShaderNodeMapRange", {"Value": film, 3: 0.05, 4: 0.5}).outputs[0]
    bump = nb.n("ShaderNodeBump", {"Strength": 0.12, "Height": noise.outputs[0]})
    nb.principled(**{"Base Color": c, "Roughness": rough, "Normal": bump.outputs[0]})
    return mat


def glass(name, color=(0.9, 0.97, 1.0), roughness=0.03):
    mat, nb = _new(name)
    if nb is None:
        return mat
    nb.principled(**{"Base Color": _rgba(color), "Roughness": roughness, "Transmission Weight": 1.0, "IOR": 1.45})
    return mat


def skin(name, color=(0.86, 0.62, 0.5)):
    mat, nb = _new(name)
    if nb is None:
        return mat
    nb.principled(**{"Base Color": _rgba(color), "Roughness": 0.45, "Subsurface Weight": 0.15,
                     "Subsurface Radius": (0.02, 0.008, 0.005)})
    return mat


def cheese(name="cheese_kasar", color=(0.98, 0.76, 0.2)):
    """Yellow cheese with round eyes (holes) in object space."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    tc = nb.n("ShaderNodeTexCoord")
    vor = nb.n("ShaderNodeTexVoronoi", {"Vector": tc.outputs["Object"], "Scale": 38.0, "Randomness": 0.9})
    hole = nb.n("ShaderNodeMapRange", {"Value": vor.outputs["Distance"], 1: 0.2, 2: 0.14, 3: 0.0, 4: 1.0},
                interpolation_type="SMOOTHSTEP").outputs[0]
    noise = nb.n("ShaderNodeTexNoise", {"Vector": tc.outputs["Object"], "Scale": 60.0, "Detail": 3.0})
    c = nb.mix(_rgba(color), _rgba(tuple(x * 0.8 for x in color)), nb.math("MULTIPLY", noise.outputs[0], 0.4))
    c = nb.mix(c, (0.78, 0.5, 0.1, 1), hole)
    bump = nb.n("ShaderNodeBump", {"Strength": 0.6, "Distance": 0.004, "Height": nb.math("SUBTRACT", 1.0, hole)})
    nb.principled(**{"Base Color": c, "Roughness": 0.45, "Subsurface Weight": 0.25,
                     "Subsurface Radius": (0.01, 0.006, 0.002), "Normal": bump.outputs[0]})
    return mat


def bisque(name, color=(0.82, 0.68, 0.52)):
    """Unglazed fired clay (a mug's foot ring)."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 300.0, "Detail": 2.0})
    bump = nb.n("ShaderNodeBump", {"Strength": 0.25, "Height": noise.outputs[0]})
    nb.principled(**{"Base Color": _rgba(color), "Roughness": 0.85, "Normal": bump.outputs[0]})
    return mat


def tiles(name, a, b=None, size=0.3, grout=(0.55, 0.55, 0.52), plane="xy", subway=False, roughness=0.2):
    """Glazed tiles in object space (meters): a checkerboard of a/b, or offset subway bricks (b=None).

    plane: the two object axes the tiles lie in ("xy" floor, "xz" wall).
    """
    mat, nb = _new(name)
    if nb is None:
        return mat
    tc = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ", {0: tc.outputs["Object"]})
    u = sep.outputs[0]
    v = sep.outputs[1] if plane == "xy" else sep.outputs[2]
    w, h = (size, size / 2) if subway else (size, size)
    row = nb.math("FLOOR", nb.math("DIVIDE", v, h))
    if subway:                                   # every other row shifted by half a brick
        u = nb.math("ADD", u, nb.math("MULTIPLY", nb.math("MODULO", row, 2.0), w / 2))
    col = nb.math("FLOOR", nb.math("DIVIDE", u, w))
    fu = nb.math("FRACT", nb.math("DIVIDE", u, w))
    fv = nb.math("FRACT", nb.math("DIVIDE", v, h))
    gw = 0.004
    edge_u = nb.math("MINIMUM", nb.math("MULTIPLY", fu, w), nb.math("MULTIPLY", nb.math("SUBTRACT", 1.0, fu), w))
    edge_v = nb.math("MINIMUM", nb.math("MULTIPLY", fv, h), nb.math("MULTIPLY", nb.math("SUBTRACT", 1.0, fv), h))
    edge = nb.math("MINIMUM", edge_u, edge_v)
    g = nb.n("ShaderNodeMapRange", {"Value": edge, 1: gw * 0.6, 2: gw, 3: 1.0, 4: 0.0},
             interpolation_type="SMOOTHSTEP").outputs[0]
    if b is None:
        noise = nb.n("ShaderNodeTexNoise", {"Vector": tc.outputs["Object"], "Scale": 9.0, "Detail": 1.0})
        c = nb.mix(_rgba(a), _rgba(tuple(x * 0.93 for x in a)), noise.outputs[0])
    else:
        checker = nb.math("MODULO", nb.math("ADD", nb.math("ADD", row, col), 1000.0), 2.0)
        c = nb.mix(_rgba(a), _rgba(b), checker)
    c = nb.mix(c, _rgba(grout), g)
    rough = nb.n("ShaderNodeMapRange", {"Value": g, 3: roughness, 4: 0.8}).outputs[0]
    bump = nb.n("ShaderNodeBump", {"Strength": 0.4, "Height": nb.math("SUBTRACT", 1.0, g)})
    nb.principled(**{"Base Color": c, "Roughness": rough, "Normal": bump.outputs[0], "Coat Weight": 0.3})
    return mat


def kilim(name="kilim"):
    """Turkish kilim: navy field, red/cream diamonds, orange bands (object space, meters)."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    sep = nb.n("ShaderNodeSeparateXYZ", {0: nb.n("ShaderNodeTexCoord").outputs["Object"]})
    x, y = sep.outputs[0], sep.outputs[1]
    fx = nb.math("FRACT", nb.math("DIVIDE", x, 0.24))
    fy = nb.math("FRACT", nb.math("DIVIDE", nb.math("ADD", y, 0.12), 0.24))
    dd = nb.math("ADD", nb.math("ABSOLUTE", nb.math("SUBTRACT", fx, 0.5)),
                 nb.math("ABSOLUTE", nb.math("SUBTRACT", fy, 0.5)))
    big = nb.n("ShaderNodeMapRange", {"Value": dd, 1: 0.34, 2: 0.31, 3: 0.0, 4: 1.0}).outputs[0]
    ring = nb.n("ShaderNodeMapRange", {"Value": dd, 1: 0.24, 2: 0.21, 3: 0.0, 4: 1.0}).outputs[0]
    core = nb.n("ShaderNodeMapRange", {"Value": dd, 1: 0.11, 2: 0.08, 3: 0.0, 4: 1.0}).outputs[0]
    band = nb.band(nb.math("ADD", y, 0.0), 0.24, 0.03, 0.003)
    c = nb.mix((0.05, 0.08, 0.22, 1), (0.75, 0.1, 0.08, 1), big)
    c = nb.mix(c, (0.93, 0.85, 0.68, 1), ring)
    c = nb.mix(c, (0.95, 0.5, 0.1, 1), core)
    c = nb.mix(c, (0.95, 0.55, 0.12, 1), nb.math("MULTIPLY", band, nb.math("SUBTRACT", 1.0, big)))
    noise = nb.n("ShaderNodeTexNoise", {"Scale": 60.0, "Detail": 1.0})
    bump = nb.n("ShaderNodeBump", {"Strength": 0.25, "Height": noise.outputs[0]})
    nb.principled(**{"Base Color": c, "Roughness": 0.95, "Sheen Weight": 0.6, "Normal": bump.outputs[0]})
    return mat


def poster_sunset(name="poster_sunset"):
    """Flat illustrated poster: gradient sky, sun, two rows of hills (object space of a 0.5x0.7 m board)."""
    mat, nb = _new(name)
    if nb is None:
        return mat
    sep = nb.n("ShaderNodeSeparateXYZ", {0: nb.n("ShaderNodeTexCoord").outputs["Object"]})
    x, z = sep.outputs[0], sep.outputs[2]
    sky_t = nb.n("ShaderNodeMapRange", {"Value": z, 1: -0.1, 2: 0.33, 3: 0.0, 4: 1.0}).outputs[0]
    ramp = nb.n("ShaderNodeValToRGB", {"Fac": sky_t})
    els = ramp.color_ramp.elements
    els[0].color = (1.0, 0.62, 0.25, 1)
    els[1].color = (0.42, 0.25, 0.62, 1)
    mid = els.new(0.5)
    mid.color = (0.98, 0.38, 0.45, 1)
    dx, dz = nb.math("SUBTRACT", x, 0.06), nb.math("SUBTRACT", z, 0.02)
    r = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", dx, dx), nb.math("MULTIPLY", dz, dz)))
    sun = nb.n("ShaderNodeMapRange", {"Value": r, 1: 0.115, 2: 0.105, 3: 0.0, 4: 1.0}).outputs[0]
    c = nb.mix(ramp.outputs[0], (1.0, 0.88, 0.35, 1), sun)
    for base, amp, freq, ph, col in ((-0.05, 0.05, 9.0, 0.4, (0.12, 0.45, 0.45)),
                                     (-0.15, 0.04, 13.0, 2.0, (0.05, 0.28, 0.32))):
        hill = nb.math("ADD", base, nb.math("MULTIPLY", nb.math("SINE", nb.math("ADD", nb.math("MULTIPLY", x, freq), ph)), amp))
        m = nb.n("ShaderNodeMapRange", {"Value": nb.math("SUBTRACT", hill, z), 1: -0.003, 2: 0.003, 3: 0.0, 4: 1.0}).outputs[0]
        c = nb.mix(c, _rgba(col), m)
    nb.principled(**{"Base Color": c, "Roughness": 0.55})
    return mat
