"""30 saniyelik kurgunun zaman çizelgesi (konuşma sürelerinden hesaplanır)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
DUR = 30.0

SPK_LABEL = {"fincan": "FİNCAN", "tabak": "TABAK", "cayd": "ÇAYDANLIK", "tencere": "TENCERE SETİ",
             "kazan": "KAZAN", "evsahibi": "EV SAHİBİ (aşağıdan)"}
SPK_COLOR = {"fincan": (255, 150, 186), "tabak": (150, 204, 255), "cayd": (200, 226, 238), "tencere": (255, 196, 124),
             "kazan": (255, 124, 90), "evsahibi": (176, 255, 176)}
# karakter x konumları (dünya birimi)
CHAR_X = {"tabak": 78, "fincan": 192, "cayd": 306, "pot1": 394, "pot2": 448, "pot3": 494, "kazan": 606}
SPEAKER_TO_CHARS = {"fincan": ["fincan"], "tabak": ["tabak"], "cayd": ["cayd"], "tencere": ["pot1", "pot2", "pot3"],
                    "kazan": ["kazan"], "evsahibi": []}


def make_schedule():
    info = json.load(open(os.path.join(HERE, "build", "lines.json")))
    st = {}

    def put(lid, start):
        st[lid] = dict(start=start, end=start + info[lid]["dur"], spk=info[lid]["spk"], text=info[lid]["text"])
        return st[lid]["end"]

    e = put("L1", 0.85)
    e = put("L2", e + 0.10)
    e = put("L3", e + 0.10)
    e = put("L4", e + 0.10)
    e5 = put("L5", e + 0.15)
    a = put("L6a", e5 + 0.05)
    b = put("L6b", st["L6a"]["start"] + 0.30)
    c = put("L6c", st["L6b"]["start"] + 0.40)
    e = put("L7", max(a, b, c) + 0.16)
    e = put("L8", e + 0.20)
    e = put("L9", e + 0.10)
    e = put("L10", e + 0.06)
    e = put("L11", e + 0.12)
    assert e < 27.4, f"konuşma çok uzun: {e}"
    st["_end_speech"] = e
    return st
