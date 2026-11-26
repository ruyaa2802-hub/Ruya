"""Tek dosyadaki seslendirmeyi repliklere böler, replik içi uzun duraklamaları kısaltır."""
import subprocess, sys, wave, numpy as np
SR = 48000
src = sys.argv[1]
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
# replik sınırları (sn) – transkripsiyondan
bounds = [0, 4.4, 14.8, 17.7, 23.0, 27.2, 34.45, len(x) / SR]
names = ['01_kanca', '02_gece', '03_gun47', '04_gun183', '05_gun301', '06_dogumgunu', '07_yarin']
# replik içi azami duraklama (sn)
caps = {'01_kanca': .55, '02_gece': .5, '03_gun47': .5, '04_gun183': .4, '05_gun301': .7, '06_dogumgunu': .45, '07_yarin': .45}
hop = SR // 100
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'same'))[::hop]
thr = rms.max() * 0.02
for n, a, b in zip(names, bounds[:-1], bounds[1:]):
    seg = x[int(a * SR):int(b * SR)]
    act = rms[int(a * 100):int(b * 100)] > thr
    idx = np.where(act)[0]
    s0, s1 = idx[0], idx[-1]
    # sessiz bölgeleri bul ve kısalt
    out = []; i = s0; cap = int(caps[n] * 100)
    while i <= s1:
        j = i
        if act[i]:
            while j <= s1 and act[j]: j += 1
            out.append(seg[i * hop: j * hop])
        else:
            while j <= s1 and not act[j]: j += 1
            g = j - i
            keep = min(g, cap)
            mid = i + g // 2
            out.append(seg[(mid - keep // 2) * hop:(mid - keep // 2 + keep) * hop])
        i = j
    y = np.concatenate([seg[max(0, s0 * hop - SR // 20): s0 * hop]] + out + [seg[(s1 + 1) * hop:(s1 + 1) * hop + SR // 8]])
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(f'ses/{n}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(f'{n}: {len(y)/SR:.2f} sn  (orijinal {(s1-s0)/100:.2f})')
