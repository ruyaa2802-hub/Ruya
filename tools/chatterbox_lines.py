"""Voice episode lines offline with Chatterbox Multilingual (MIT licence, free, runs on CPU).

Chatterbox clones the timbre of a short reference clip and can act more than Piper
(the `exaggeration` knob pushes emotion). It needs torch, so it lives in its own
Python 3.11 venv outside the repo:

    uv venv -p 3.11 ~/tts-venv
    VIRTUAL_ENV=~/tts-venv uv pip install --index-url https://download.pytorch.org/whl/cpu torch==2.6.0 torchaudio==2.6.0
    VIRTUAL_ENV=~/tts-venv uv pip install chatterbox-tts

Usage (a JSON job list; each job: out, text, ref or null, exaggeration, cfg, temperature, seed):
    ~/tts-venv/bin/python tools/chatterbox_lines.py jobs.json
"""
import copy
import json
import os
import sys

import torch
import torchaudio


def main(job_file):
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    torch.set_num_threads(os.cpu_count() or 4)
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    default = copy.deepcopy(model.conds)                 # the built-in voice, used when a job has no ref
    with open(job_file) as f:
        jobs = json.load(f)
    for job in jobs:
        torch.manual_seed(job.get("seed", 1))
        if not job.get("ref"):
            model.conds = copy.deepcopy(default)
        wav = model.generate(job["text"], language_id="tr", audio_prompt_path=job.get("ref"),
                             exaggeration=job.get("exaggeration", 0.5), cfg_weight=job.get("cfg", 0.5),
                             temperature=job.get("temperature", 0.8))
        os.makedirs(os.path.dirname(job["out"]) or ".", exist_ok=True)
        torchaudio.save(job["out"], wav, model.sr)
        print("[voice]", job["out"], f"{wav.shape[-1] / model.sr:.2f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
