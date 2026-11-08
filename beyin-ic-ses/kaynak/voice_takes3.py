# Akici anlatim: her cumle TEK PARCA (dogal tonlama), cok sayida cekim; Whisper ile dogru anlasilanlar arasindan
# tonlamasi en hareketli (perde dagilimi genis, hiz dogal) olan secilir.
import wave, io, json, re, numpy as np, sherpa_onnx, pyworld as pw, os
from scipy.signal import resample_poly
from piper import PiperVoice, SynthesisConfig
HERE = os.path.dirname(os.path.abspath(__file__)); MD = os.environ.get('MODEL_DIR', HERE + '/modeller') + '/'
v = 'tr_TR-fahrettin-medium'; pv = PiperVoice.load(f'{MD}vits-piper-{v}/{v}.onnx')
A = MD + 'sherpa-onnx-whisper-small/'
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=A + 'small-encoder.int8.onnx', decoder=A + 'small-decoder.int8.onnx', tokens=A + 'small-tokens.txt', language='tr', task='transcribe', num_threads=4)
def norm(s): s = s.replace('İ', 'i').replace('I', 'ı').lower(); return re.sub(r'[^a-zçğıöşü]', '', s)
def cer(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p = d[:]; d[0] = i
        for j, cb in enumerate(b, 1): d[j] = min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (ca != cb))
    return d[-1] / max(1, len(b))
S = {
 'hk': 'Bir dakika, şu an kiminle konuşuyorsun?',
 's1': 'Aslında bu, beyninin düşüncelerini kelimelere dönüştüren iç konuşma mekanizması.',
 's2': 'Kelimeleri sesli söylemeden de zihninde konuşabiliyorsun.',
 'f1': 'Üstelik, herkesin iç sesi aynı şekilde çalışmaz.',
 'f2': 'Bazıları kelimelerle düşünür, bazıları görüntülerle.',
 'f3': 'Peki, senin zihnindeki ses hiç susuyor mu?',
}
os.makedirs(HERE + '/takes3', exist_ok=True); res = {}
for k, s in S.items():
    for i in range(16):
        ls = [0.92, 0.97, 1.02, 1.07][i % 4]; ns = [0.7, 0.8, 0.9, 1.0][i // 4]; nw = 1.0
        b = io.BytesIO()
        with wave.open(b, 'wb') as w: pv.synthesize_wav(s, w, syn_config=SynthesisConfig(length_scale=ls, noise_scale=ns, noise_w_scale=nw))
        b.seek(0)
        with wave.open(b) as w: x = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.0; sr = w.getframerate()
        y = resample_poly(x, 16000, sr); st_ = rec.create_stream(); st_.accept_waveform(16000, y.astype(np.float32)); rec.decode_stream(st_); txt = st_.result.text.strip()
        f0, _ = pw.harvest(x.astype(np.float64), sr, f0_floor=60, f0_ceil=300, frame_period=5); vf = f0[f0 > 0]
        stv = 12 * np.log2(vf / np.median(vf)); spread = float(np.percentile(stv, 85) - np.percentile(stv, 15))
        jumps = float(np.mean(np.abs(np.diff(stv)) > 3))      # perde hatasi / takilma orani
        n = f'{k}_{i}'
        with wave.open(f'{HERE}/takes3/{n}.wav', 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x * 32767).astype(np.int16).tobytes())
        res[n] = dict(cer=round(cer(norm(txt), norm(s)), 3), dur=round(len(x) / sr, 2), spread=round(spread, 2), jumps=round(jumps, 3), ls=ls, ns=ns, asr=txt)
    c = [(n, r) for n, r in res.items() if n.startswith(k + '_')]
    ok = [x for x in c if x[1]['cer'] == min(r['cer'] for _, r in c)]
    best = max(ok, key=lambda x: x[1]['spread'] - 20 * x[1]['jumps'])
    print(k, best[0], best[1])
json.dump(res, open(HERE + '/takes3/stats.json', 'w'), ensure_ascii=False, indent=0)
