"""Character: MakeHuman (MPFB2, CC0 assets) man in a long black coat, game-engine rig."""
import bpy
import os
import math
from mathutils import Vector

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

ASSETS = "/root/.config/blender/4.2/extensions/.user/user_default/mpfb/data"


def a(*p):
    return os.path.join(ASSETS, *p)


def build_character():
    macro = TargetService.get_default_macro_info_dict()
    macro["gender"] = 1.0
    macro["age"] = 0.62
    macro["muscle"] = 0.6
    macro["weight"] = 0.55
    macro["height"] = 0.62
    macro["proportions"] = 0.7
    macro["race"]["caucasian"] = 0.8
    macro["race"]["asian"] = 0.1
    macro["race"]["african"] = 0.1
    body = HumanService.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
    body.name = "Man"
    rig = HumanService.add_builtin_rig(body, "game_engine", import_weights=True)
    rig.name = "ManRig"
    HumanService.set_character_skin(a("skins", "middleage_caucasian_male", "middleage_caucasian_male.mhmat"),
                                    body, skin_type="ENHANCED_SSS")
    for kind, path in [
        ("Eyes", a("eyes", "high-poly", "high-poly.mhclo")),
        ("Eyebrows", a("eyebrows", "eyebrow001", "eyebrow001.mhclo")),
        ("Eyelashes", a("eyelashes", "eyelashes01", "eyelashes01.mhclo")),
        ("Teeth", a("teeth", "teeth_base", "teeth_base.mhclo")),
        ("Hair", a("hair", "short02", "short02.mhclo")),
        ("Clothes", a("clothes", "male_elegantsuit01", "male_elegantsuit01.mhclo")),
        ("Clothes", a("clothes", "shoes02", "shoes02.mhclo")),
    ]:
        if not os.path.exists(path):
            print("MISSING ASSET", path)
            continue
        HumanService.add_mhclo_asset(path, body, asset_type=kind, subdiv_levels=1, material_type="MAKESKIN")
    return body, rig


if __name__ == "__main__":
    pass
