"""Expression presets (channel dicts). Layer them under lip sync and gestures."""

EXPR = {
    "neutral": {},
    "tired": {"lid_u": 0.1, "brow_up": -0.2, "brow_ang": -0.25, "m_frown": 0.25, "nod": 0.05},
    "sleep": {"blink": 1.0, "m_frown": 0.1},
    "relief": {"lid_u": 0.25, "brow_up": 0.3, "brow_ang": -0.4, "m_smile": 0.35},
    "deadpan": {"lid_u": 0.25, "brow_up": -0.1, "m_press": 0.3, "m_frown": 0.1},
    "sarcastic": {"lid_u": 0.15, "lid_u_L": 0.15, "brow_up_R": 0.6, "brow_up_L": -0.2, "m_sneer": 0.6,
                  "m_smile": 0.15},
    "annoyed": {"lid_u": 0.1, "brow_ang": 0.6, "brow_up": -0.2, "m_frown": 0.4},
    "angry": {"brow_ang": 1.0, "brow_up": -0.4, "squint": 0.4, "m_frown": 0.6, "m_wide": 0.2},
    "shout": {"brow_ang": 1.1, "brow_up": -0.3, "lid_u": -0.35, "m_open": 1.0, "m_wide": 0.5,
              "m_frown": 0.2, "squash": 0.06},
    "offended": {"brow_up": 0.5, "brow_ang": -0.2, "lid_u": 0.15, "m_frown": 0.5, "m_press": 0.2},
    "dramatic": {"brow_up": 0.7, "brow_ang": -0.6, "lid_u": 0.1, "m_frown": 0.5, "tilt": 0.12},
    "surprised": {"brow_up": 1.0, "lid_u": -0.35, "lid_l": 0.0, "m_open": 0.5, "m_round": 0.6},
    "sad": {"brow_up": 0.5, "brow_ang": -0.9, "lid_u": 0.25, "m_frown": 0.7, "gaze_y": -0.2},
    "touched": {"brow_up": 0.6, "brow_ang": -0.8, "lid_u": 0.15, "squint": 0.25, "m_smile": 0.35,
                "m_round": 0.25, "tilt": -0.12},
    "smug": {"lid_u": 0.3, "brow_up_L": 0.4, "m_smile": 0.6, "m_sneer": 0.3},
    "happy": {"brow_up": 0.4, "squint": 0.4, "m_smile": 1.0, "m_open": 0.2},
}
