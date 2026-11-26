#!/usr/bin/env python3
"""Dinlendi – müzik + ses efektleri sentezi ve seslendirme miksajı.

Tamamen ücretsiz: yalnızca Python + numpy + ffmpeg.

Kullanım:
    python3 audio.py            # müzik/efekt üretir, ses/ klasöründe kayıt varsa onları da yerleştirir
    python3 audio.py --mux      # ayrıca build/video_sessiz.mp4 ile birleştirip build/dinlendi.mp4 üretir

Seslendirme dosyaları (ses/ klasörü, uzantı farketmez: wav/mp3/m4a/ogg...):
    01_kanca     "Hepsini dinliyorsun… neden hiç cevap vermiyorsun?"        (fısıltı)
    02_gece      "Bugün yine o kafeye gittim. … İyi geceler."
    03_gun47     "Annem seni sordu yine…"
    04_gun183    "Kar yağdı, sen hep ilk karda dışarı çıkardın…"
    05_gun301    "Bugün iyiyim. Galiba."
    06_dogumgunu "Bugün senin doğum günün. Bir kere… sadece bir kere cevap ver. Lütfen."
    07_yarin     "Yarın… size gelebilir miyim?"
"""
import glob, os, subprocess, sys
import numpy as np

SR = 48000
DUR = 74.0
N = int(SR * DUR)
HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, 'build')
rng = np.random.default_rng(3)

# (dosya, başlangıç sn, azami süre sn)
VO_SLOTS = [
    ('01_kanca', 0.15, 3.7),
    ('02_gece', 3.6, 7.5),
    ('03_gun47', 13.4, 3.0),
    ('04_gun183', 16.45, 3.5),
    ('05_gun301', 20.0, 2.9),
    ('06_dogumgunu', 25.0, 6.0),
    ('07_yarin', 64.2, 3.1),
]
HEADPHONE_REUSE = ('06_dogumgunu', 41.2, 5.0)  # Sevim Hanım kulaklıktan dinliyor


def T(sec):
    return int(round(sec * SR))


def env_points(points):
    """[(sn, değer), ...] -> tüm süre boyunca doğrusal zarf."""
    xs, ys = zip(*points)
    return np.interp(np.arange(N) / SR, xs, ys).astype(np.float32)


def fft_filter(x, lo=None, hi=None, tilt=0.0):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if tilt:
        g *= (np.maximum(f, 20) / 1000) ** tilt
    return np.fft.irfft(X * g, n).astype(np.float32)


def add(buf, sig, t0, gain=1.0):
    i = T(t0)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------- enstrümanlar ----------------
def piano(m, vel=0.6, dur=5.0):
    f0 = midi(m)
    t = np.arange(int(SR * dur)) / SR
    out = np.zeros_like(t)
    B = 0.0004
    for n in range(1, 10):
        fn = f0 * n * np.sqrt(1 + B * n * n)
        if fn > 16000:
            break
        amp = (1 / n ** 1.25) * (0.6 + 0.4 * vel)
        dec = 1.1 + n * 0.55 + f0 / 900
        out += amp * np.sin(2 * np.pi * fn * t + rng.random() * 6.28) * np.exp(-t * dec)
    out += 0.3 * np.sin(2 * np.pi * f0 * 1.003 * t) * np.exp(-t * 0.8)   # hafif koro
    atk = np.minimum(1, t / 0.004)
    hammer = rng.standard_normal(len(t)) * np.exp(-t * 90) * 0.05
    rel = np.minimum(1, (dur - t) / 0.4)
    return ((out * atk + hammer) * rel * vel * 0.22).astype(np.float32)


def strings(m, dur, vel=0.5, atk=1.6):
    f0 = midi(m)
    t = np.arange(int(SR * dur)) / SR
    out = np.zeros_like(t)
    for det in (-0.004, 0.0, 0.0045):
        vib = 1 + 0.003 * np.sin(2 * np.pi * (5.2 + det * 100) * t + rng.random() * 6)
        ph = 2 * np.pi * np.cumsum(f0 * (1 + det) * vib) / SR
        for n in range(1, 14):
            if f0 * n > 9000:
                break
            out += (1 / n ** 1.6) * np.sin(n * ph)
    e = np.minimum(1, t / atk) * np.minimum(1, (dur - t) / 0.6)
    return (out * e * vel * 0.05).astype(np.float32)


def ding(gain=1.0):
    t = np.arange(int(SR * 0.9)) / SR
    a = np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 18) * (t < 0.14)
    b = np.zeros_like(t)
    k = t >= 0.11
    tb = t[k] - 0.11
    b[k] = (np.sin(2 * np.pi * 1760 * tb) + 0.25 * np.sin(2 * np.pi * 3520 * tb)) * np.exp(-tb * 6)
    s = (0.5 * a + 0.6 * b) * np.minimum(1, t / 0.003)
    return (s * 0.35 * gain).astype(np.float32)


def soft_tick(gain=1.0):
    t = np.arange(int(SR * 0.25)) / SR
    s = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 45) + 0.6 * np.sin(2 * np.pi * 3200 * (t - 0.06)) * np.exp(-np.maximum(t - 0.06, 0) * 45) * (t > 0.06)
    return (s * 0.15 * gain).astype(np.float32)


def whoosh(dur=0.35, gain=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n).astype(np.float32), 800, 5000)
    return (x * np.sin(np.pi * t / dur) ** 2 * 0.08 * gain).astype(np.float32)


def blow():
    n = int(SR * 0.7)
    t = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n).astype(np.float32), 300, 2500)
    e = np.minimum(1, t / 0.05) * np.exp(-t * 4)
    return (x * e * 0.35).astype(np.float32)


def tap():
    t = np.arange(int(SR * 0.04)) / SR
    return (np.sin(2 * np.pi * 900 * t) * np.exp(-t * 200) * 0.06 + rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.02).astype(np.float32)


def reverb(x, secs=2.6, wet=0.3):
    n = int(SR * secs)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-t * 6.9 / secs)
    ir = fft_filter(ir, 120, 7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return (x * (1 - wet) + y.astype(np.float32) * wet * 2.2).astype(np.float32)


# ---------------- müzik ----------------
def build_music():
    mus = np.zeros(N, np.float32)
    # Tek tek basılan piyano (Sahne 0–3)
    notes = [
        (0.6, 69, .45), (2.1, 76, .35),
        (3.5, 57, .45), (3.5, 72, .4), (5.1, 71, .38), (6.7, 67, .35), (8.3, 69, .4), (9.9, 64, .33), (11.4, 72, .38), (12.6, 71, .3),
        (13.1, 57, .4), (13.1, 69, .4), (13.9, 72, .35), (14.7, 76, .35), (15.5, 74, .33),
        (16.4, 53, .4), (16.4, 69, .38), (17.2, 72, .33), (18.0, 77, .35), (18.8, 76, .3),
        (19.7, 48, .4), (19.7, 67, .38), (20.5, 72, .33), (21.3, 76, .35), (22.1, 74, .3),
        (23.4, 57, .45), (23.4, 64, .35), (25.0, 72, .36), (26.6, 71, .34), (28.2, 69, .34), (29.8, 68, .38), (30.6, 45, .3),
    ]
    for t0, m, v in notes:
        add(mus, piano(m, v, 4.5), t0)
    # mum söndüğünde piyano kesilsin
    mus *= env_points([(0, 1), (31.0, 1), (31.6, 0), (DUR, 0)])
    # Yaylılar (Sahne 5)
    chords = [
        (40.0, 3.4, [45, 52, 57, 60, 64], .5),
        (43.2, 3.4, [41, 48, 53, 57, 60], .6),
        (46.4, 3.2, [48, 55, 60, 64, 67], .75),
        (49.4, 2.8, [43, 50, 55, 59, 62, 74], .95),
    ]
    st = np.zeros(N, np.float32)
    for t0, d, ms, v in chords:
        for m in ms:
            add(st, strings(m, d + 0.8, v, atk=1.2 if t0 > 40 else 2.0), t0)
    st *= env_points([(0, 0), (40, 0), (41, .6), (49, 1.0), (51.9, 1.2), (52.0, 0), (DUR, 0)])
    mus += st
    # Final yumuşak piyano (Sahne 7)
    fin = [
        (62.5, 45, .3), (62.5, 69, .3), (63.4, 76, .25), (64.3, 72, .25), (65.2, 71, .22),
        (66.4, 41, .3), (66.4, 69, .3), (67.3, 72, .27), (68.2, 77, .3), (69.1, 76, .27),
        (70.0, 48, .3), (70.0, 67, .3), (70.9, 72, .27), (71.8, 76, .28),
        (72.6, 45, .3), (72.6, 69, .32), (72.6, 81, .2),
    ]
    for t0, m, v in fin:
        add(mus, piano(m, v, 3.5 if t0 < 72 else 2.0), t0)
    mus = reverb(mus, 2.8, 0.38)
    mus *= env_points([(0, 1), (51.95, 1), (52.0, 0), (62.3, 0), (62.4, 1), (73.0, 1), (74, 0)])
    return mus


# ---------------- efektler ----------------
def build_sfx():
    sfx = np.zeros(N, np.float32)
    # yağmur
    r = fft_filter(rng.standard_normal(N).astype(np.float32), 250, 7000, tilt=-0.35)
    r /= np.max(np.abs(r))
    drips = np.zeros(N, np.float32)
    for t0 in rng.uniform(0, DUR, 900):
        f = rng.uniform(1800, 4200)
        tt = np.arange(int(SR * 0.05)) / SR
        add(drips, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 120) * rng.uniform(.01, .04), t0)
    rain = (r * 0.12 + drips)
    rain_env = env_points([
        (0, .25), (3, .35), (5.5, .5), (12.8, .5), (13, .25), (23, .25), (24, .4), (31, .45), (33, .55),
        (34, .8), (40, .7), (46.4, .5), (48, .55), (52.0, .4), (52.6, 0.0), (62.0, 0), (62.6, .45),
        (67.5, .4), (71, .1), (74, 0)])
    sfx += rain * rain_env
    # bildirim / tik motifleri
    add(sfx, ding(0.55), 0.15)
    add(sfx, whoosh(), 10.85)
    add(sfx, soft_tick(1.0), 11.4)
    for t0 in (15.55, 18.9, 22.25):
        add(sfx, soft_tick(0.8), t0)
    add(sfx, blow(), 31.0)
    add(sfx, ding(1.0), 34.5)           # Sevim Hanım'ın odasında aynı ses
    # kulaklıktan sızan cızırtı
    cr = fft_filter(rng.standard_normal(T(5.4)).astype(np.float32), 1500, 6000) * 0.012
    for t0 in rng.uniform(0, 5.3, 70):
        i = T(t0)
        cr[i:i + 40] += rng.uniform(-.06, .06)
    add(sfx, cr, 41.0)
    # klavye dokunuşları
    for t0 in np.concatenate([np.arange(48.3, 49.0, .12), np.arange(50.1, 50.9, .11), np.arange(52.05, 53.9, .13)]):
        add(sfx, tap(), t0 + rng.uniform(-.02, .02))
    add(sfx, whoosh(gain=.8), 66.6)
    add(sfx, ding(0.8), 66.85)          # Zeynep'in mesajı Sevim Hanım'a ulaşıyor
    add(sfx, soft_tick(1.0), 67.05)
    return sfx


# ---------------- seslendirme ----------------
def load_audio(path):
    out = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(out, np.float32).copy()
    # baş/son sessizliği kırp
    a = np.abs(x)
    thr = max(1e-4, a.max() * 0.03)
    idx = np.where(a > thr)[0]
    if len(idx):
        x = x[max(0, idx[0] - T(.05)): idx[-1] + T(.15)]
    # yumuşak fade
    f = min(len(x) // 4, T(.02))
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def fit(x, maxdur):
    d = len(x) / SR
    if d <= maxdur:
        return x, 1.0
    tempo = min(1.25, d / maxdur)
    raw = x.astype(np.float32).tobytes()
    out = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                          '-af', f'atempo={tempo:.4f}', '-f', 'f32le', '-'], input=raw, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy(), tempo


def find_vo(name):
    hits = [p for p in glob.glob(os.path.join(HERE, 'ses', name + '.*'))]
    return hits[0] if hits else None


def build_vo():
    vo = np.zeros(N, np.float32)
    report = []
    cache = {}
    for name, t0, maxd in VO_SLOTS:
        p = find_vo(name)
        if not p:
            report.append(f'  - {name}: YOK (sessiz bırakıldı)')
            continue
        x = load_audio(p)
        x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.09      # seviye eşitle
        x = np.clip(x, -0.95, 0.95)
        cache[name] = x
        y, tempo = fit(x, maxd)
        add(vo, y, t0)
        report.append(f'  - {name}: {len(x)/SR:.2f} sn' + (f' -> %{(tempo-1)*100:.0f} hızlandırıldı' if tempo > 1 else ''))
    name, t0, maxd = HEADPHONE_REUSE
    if name in cache:
        x = cache[name][: T(maxd)]
        x = fft_filter(x, 500, 3200) * 0.55
        x *= np.minimum(1, (len(x) - np.arange(len(x))) / T(.6))
        add(vo, x, t0)
    return vo, report


def main():
    os.makedirs(BUILD, exist_ok=True)
    mus = build_music()
    sfx = build_sfx()
    vo, report = build_vo()
    # konuşma sırasında müziği kıs (ducking)
    act = np.abs(vo)
    k = T(.25)
    act = np.convolve(act, np.ones(k) / k, mode='same')
    duck = 1 - 0.45 * np.clip(act / 0.02, 0, 1)
    mix = mus * 0.9 * duck + sfx * (0.6 + 0.4 * duck) + vo
    # stereo genişlik: müzik ve yağmura hafif gecikme
    left = mix
    right = mix.copy()
    d = T(0.011)
    right[d:] = (mus * 0.9 * duck + sfx * (0.6 + 0.4 * duck))[:-d] + vo[d:]
    st = np.stack([left, right], 1)
    st /= max(1.0, np.max(np.abs(st)) / 0.89)
    out = os.path.join(BUILD, 'ses_miks.wav')
    pcm = (st * 32767).astype('<i2')
    import wave
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('Ses miksi:', out)
    print('Seslendirme durumu:')
    print('\n'.join(report))
    if '--mux' in sys.argv:
        vid = os.path.join(BUILD, 'video_sessiz.mp4')
        final = os.path.join(BUILD, 'dinlendi.mp4')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', vid, '-i', out, '-c:v', 'copy',
                        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
                        '-shortest', '-movflags', '+faststart', final], check=True)
        print('Final video:', final)


if __name__ == '__main__':
    main()
