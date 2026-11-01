"""ElevenLabs 3D sürümü montajı: AI klipler + yerel kamera hareketli görseller + ses/müzik/altyazı.

Kullanım: python3 assemble.py  ->  out/Katlanmayanlarin_Isyani_3D.mp4
"""
import os, sys, math, subprocess, json, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'src'))
import audio as AU                     # enstrüman ve efekt sentezleyicileri (önceki bölümden)
from style import font, F_SANS_B, F_SERIF_BI, ease, ease_io, ease_out

W, H, FPS, SR = 1080, 1920, 30, 44100
IMG, VID, SES = (os.path.join(HERE, d) for d in ('img', 'vid', 'ses'))
TMP = os.path.join(HERE, 'tmp'); os.makedirs(TMP, exist_ok=True)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)

NAMES = {'gomlek': ('GÖMLEK BEY', '&H00FFFFFF&'), 'tisort': ('TİŞÖRT', '&H0050C8FF&'), 'havlu': ('HAVLU ABİ', '&H00E1DC82&'),
         'corapA': ('KIRMIZI ÇORAP', '&H008278FF&'), 'corapB': ('MAVİ ÇORAP', '&H00FFB478&'), 'pantolon': ('PANTOLON', '&H00F0AA96&'),
         'sepet': ('ÇAMAŞIR SEPETİ', '&H0078BEF0&'), 'hepsi': ('HEPSİ', '&H00FFFFFF&')}
LINE = {  # kod: (konuşan, altyazı)
    'g1': ('gomlek', 'Gitti mi? Gitti! Ya üç gündür buradayım! Ben bir gömleğim, halı değilim!'),
    't1': ('tisort', 'Bağırma abi ya... En azından sen koltuktasın. Ben yerdeyim! Üstüme çorap bile atmışlar!'),
    'h1': ('havlu', 'Gördünüz mü ama? Sevgilisi geldi diye bizi apar topar koltuğa yığdı.'),
    'cA1': ('corapA', 'Ay! Sevgilisinden de utanmıyor! Ev ne halde, ne halde!'),
    'cB1': ('corapB', 'Annesini mi çağıralım, ne yapalım yahu?'),
    'p1': ('pantolon', 'Annesi görse var ya... kulağından tutar, hepimizi tek tek katlatır!'),
    'cA2': ('corapA', 'Dur bir dakika... Benim eşim nerede?'),
    'cB2': ('corapB', 'Kesin yine çamaşır makinesinde başka biriyle dönüyordur!'),
    'cA3': ('corapA', 'Ne demek o?! Gel buraya sen!'),
    'cB3': ('corapB', 'Bildiğin gibi, canım! Yakala da göreyim!'),
    'p2': ('pantolon', 'Ben katlanmam ama! Ben askıya asılırım!'),
    'h2': ('havlu', 'Sen önce haddini bil! Ben üç gündür yerde bekliyorum!'),
    'p3': ('pantolon', 'Bırak paçamı! Ütüm bozulacak!'),
    'h3': ('havlu', 'Bırakmıyorum! Hepiniz nem kokuyorsunuz!'),
    'g2': ('gomlek', 'Asıl benim kırışıklarım!'),
    't2': ('tisort', 'Kimse seni dinlemiyor!'),
    's1': ('sepet', 'YETER! Hepiniz susun! İnsanlar bizi yıkadı, kuruttu... Şimdi de katlamaya üşeniyorlar. Biz burada tekstil enkazına döndük!'),
    't3': ('tisort', 'Bir de sevgilisine "evim hep böyle tertemiz" diyor...'),
    'h5': ('havlu', 'Susun! Geliyor!'),
    'all1': ('hepsi', 'SONUNDA! BİZİ KATLAYACAK!'),
    'g3': ('gomlek', 'Şaka mı bu lan?'),
}


def dur_of(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                capture_output=True, text=True).stdout.strip())


def ses(code):
    return os.path.join(SES, code + '.mp3')


# ------------------------------------------------------------------ SAHNE AKIŞI
# kind: 'vid' (AI klip) | 'kb' (görsel + yerel kamera hareketi) | 'card'
SEG = [
    dict(kind='kb', img='master_A.png', dur=3.4, z=(1.0, 1.1), c=(0.5, 0.55), title=True, sfx=[('keys', 0.0), ('door', 0.45)]),
    dict(kind='vid', vid='V01.mp4', lines=[('g1', 0.0)]),
    dict(kind='vid', vid='V02.mp4', lines=[('t1', 0.0)]),
    dict(kind='kb', img='K3_havlu.png', lines=[('h1', 0.05)], z=(1.0, 1.2), c=(0.5, 0.42), sway=1.0),   # AI klip bozuldu -> yerel
    dict(kind='vid', vid='V04.mp4', lines=[('cA1', 0.0)]),
    dict(kind='vid', vid='V05.mp4', lines=[('cB1', 0.0)]),
    dict(kind='vid', vid='V06.mp4', lines=[('p1', 0.0)]),
    dict(kind='kb', img='K4_kirmizi.png', lines=[('cA2', 0.1)], z=(1.05, 1.22), c=(0.5, 0.33), tail=0.2),
    dict(kind='kb', img='K5_mavi.png', lines=[('cB2', 0.05)], z=(1.0, 1.15), c=(0.55, 0.35), sway=1.0),
    dict(kind='kb', img='K4_kirmizi.png', lines=[('cA3', 0.0)], z=(1.25, 1.45), c=(0.5, 0.3), shake=14, sfx=[('pop', 0.0)]),
    dict(kind='vid', vid='V09.mp4', lines=[('cB3', 0.0)], sfx=[('whoosh', 0.0)]),
    dict(kind='kb', img='K6_pantolon.png', lines=[('p2', 0.05)], z=(1.0, 1.18), c=(0.45, 0.35)),
    dict(kind='kb', img='K3_havlu.png', lines=[('h2', 0.0)], z=(1.15, 1.35), c=(0.5, 0.35), shake=10, sfx=[('whip', 0.0)]),
    dict(kind='vid', vid='V11.mp4', audio='kavga_p3_h3.mp3', lines=[('p3', 0.0), ('h3', 2.58)], sfx=[('chaos', 0.0)]),
    dict(kind='kb', img='master_A.png', lines=[('g2', 0.0), ('t2', 1.15)], z=(1.12, 1.2), c=(0.5, 0.45), shake=16, dur=3.5,
         sfx=[('chaos', 0.0)]),
    dict(kind='vid', vid='V13.mp4', lines=[('s1', 0.0)], sfx=[('scratch', -0.25), ('stomp', 0.05)], freeze_music=True),
    dict(kind='kb', img='K2_tisort.png', lines=[('t3', 0.1)], z=(1.05, 1.2), c=(0.5, 0.6)),
    dict(kind='kb', img='master_A.png', lines=[('h5', 1.2)], z=(1.0, 1.06), c=(0.5, 0.55), dur=3.0, dark=0.45,
         sfx=[('step', 0.0), ('step', 0.55), ('step', 1.1), ('step', 1.65), ('step', 2.2)]),
    dict(kind='kb', img='master_A.png', lines=[('all1', 0.05), ('all2', 0.1), ('all3', 0.15)], z=(1.0, 1.12), c=(0.5, 0.55),
         dur=3.2, bounce=1.0, sfx=[('fanfare', 0.0)], sub=('all1', 0.05)),
    dict(kind='vid', vid='V15.mp4', dur=6.0, sfx=[('rustle', 0.3), ('whoosh', 1.6), ('thud', 4.2), ('step', 5.2), ('step', 5.8)]),
    dict(kind='kb', img='K12_yigin_obur_uc.png', dur=2.8, z=(1.0, 1.05), c=(0.5, 0.5), sfx=[('door2', 0.0), ('cricket', 0.3)], cricket=True),
    dict(kind='vid', vid='V16.mp4', lines=[('g3', 0.0)], tail=0.6, sfx=[('zoom', -0.2)]),
    dict(kind='card', dur=3.4, sfx=[('rimshot', 0.0), ('trombone', 0.35)]),
]


def kb_frames(seg, n):
    im = Image.open(os.path.join(IMG, seg['img'])).convert('RGB')
    iw, ih = im.size
    base = max(W / iw, H / ih)
    big = im.resize((int(iw * base * 1.6), int(ih * base * 1.6)), Image.LANCZOS)
    bw, bh = big.size
    z0, z1 = seg.get('z', (1.0, 1.08))
    cx, cy = seg.get('c', (0.5, 0.5))
    for i in range(n):
        u = i / max(1, n - 1)
        z = z0 + (z1 - z0) * ease_io(u)
        if seg.get('bounce'):
            z *= 1 + 0.04 * abs(math.sin(i / FPS * 2 * math.pi * 2.2))
        sw, sh = W / z * 1.6, H / z * 1.6
        x = cx * bw - sw / 2; y = cy * bh - sh / 2
        if seg.get('sway'):
            x += 18 * math.sin(i / FPS * 1.7); y += 10 * math.sin(i / FPS * 1.1)
        if seg.get('shake'):
            k = seg['shake'] * (0.4 + 0.6 * (1 - u))
            x += k * math.sin(i * 1.9) * 1.6; y += k * math.sin(i * 2.7 + 1) * 1.6
        x = min(max(0, x), bw - sw); y = min(max(0, y), bh - sh)
        fr = big.resize((W, H), Image.BICUBIC, box=(x, y, x + sw, y + sh))
        if seg.get('dark'):
            k = seg['dark'] * ease(u * 1.5)
            arr = np.asarray(fr, np.float32)
            xr = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
            arr *= 1 - k * np.clip(xr * 1.5 - 0.2, 0, 1)
            fr = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
        if seg.get('title'):
            fr = title_overlay(fr, i / FPS, seg['dur'])
        yield fr


def title_overlay(fr, t, dur):
    a = ease(min(1, t / 0.5)) * (1 - ease((t - (dur - 0.6)) / 0.5))
    if a <= 0:
        return fr
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    al = int(255 * a)
    d.rounded_rectangle((90, 230, W - 90, 500), radius=40, fill=(20, 14, 30, int(170 * a)))
    d.text((W / 2, 320), 'İNSANLAR GİDİNCE', font=font(F_SANS_B, 76), fill=(255, 210, 80, al), anchor='mm',
           stroke_width=5, stroke_fill=(60, 30, 10, al))
    d.text((W / 2, 425), 'Katlanmayanların İsyanı', font=font(F_SERIF_BI, 54), fill=(255, 255, 255, al), anchor='mm',
           stroke_width=3, stroke_fill=(30, 20, 40, al))
    out = fr.convert('RGBA'); out.alpha_composite(lay)
    return out.convert('RGB')


def card_frames(n):
    for i in range(n):
        t = i / FPS
        fr = Image.new('RGB', (W, H), (14, 10, 20))
        d = ImageDraw.Draw(fr)
        k = ease_out(min(1, t / 0.4))
        c = tuple(int(v * k) for v in (255, 210, 80))
        d.text((W / 2, 830), 'İNSANLAR GİDİNCE', font=font(F_SANS_B, int(78 * (0.8 + 0.2 * k))), fill=c, anchor='mm')
        d.text((W / 2, 940), 'Katlanmayanların İsyanı', font=font(F_SERIF_BI, 52), fill=tuple(int(255 * k) for _ in range(3)), anchor='mm')
        if t > 1.0:
            k2 = ease((t - 1.0) / 0.5)
            d.text((W / 2, 1080), 'Kıyafetler katlanmadı. İsyan sürüyor…', font=font('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 36),
                   fill=tuple(int(v * k2) for v in (200, 200, 220)), anchor='mm')
        yield fr


def encode_frames(frames, path, n):
    p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
                          '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', path],
                         stdin=subprocess.PIPE)
    for fr in frames:
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait()


def seg_duration(seg):
    if 'dur' in seg:
        return seg['dur']
    if seg['kind'] == 'vid':
        a = seg.get('audio') or (LINE_FILE(seg['lines'][0][0]))
        return dur_of(os.path.join(SES, a) if not os.path.isabs(a) else a) + seg.get('tail', 0.15)
    last = max(off + dur_of(ses(c)) for c, off in seg['lines'])
    return last + seg.get('tail', 0.25)


def LINE_FILE(code):
    return code + '.mp3'


def build_video():
    parts = []
    t = 0.0
    for k, seg in enumerate(SEG):
        d = seg_duration(seg)
        seg['t0'] = t; seg['d'] = d
        n = int(round(d * FPS))
        out = os.path.join(TMP, f'seg{k:02d}.mp4')
        if seg['kind'] == 'vid':
            src = os.path.join(VID, seg['vid'])
            sd = dur_of(src)
            vf = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}'
            if sd < d:   # klip kısa kalırsa son kareyi uzat
                vf += f',tpad=stop_mode=clone:stop_duration={d - sd + 0.1:.2f}'
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vf', vf, '-t', f'{n / FPS:.3f}', '-an', '-c:v', 'libx264',
                            '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], check=True)
        elif seg['kind'] == 'kb':
            encode_frames(kb_frames(seg, n), out, n)
        else:
            encode_frames(card_frames(n), out, n)
        parts.append(out)
        t += n / FPS
        print(f'{k:02d} {seg["kind"]:4s} t0={seg["t0"]:6.2f} d={n / FPS:5.2f}', flush=True)
    with open(os.path.join(TMP, 'list.txt'), 'w') as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(TMP, 'list.txt'), '-c', 'copy',
                    os.path.join(TMP, 'video.mp4')], check=True)
    return t


# ------------------------------------------------------------------ SES
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def build_audio(total):
    N = int((total + 1) * SR)
    vo, mu, fx = (np.zeros(N, np.float32) for _ in range(3))

    def put(buf, x, t, g=1.0):
        i = int(t * SR)
        if i < 0:
            x = x[-i:]; i = 0
        n = min(len(x), N - i)
        if n > 0:
            buf[i:i + n] += x[:n] * g
    subs = []
    for seg in SEG:
        t0 = seg['t0']
        if seg.get('audio'):
            x = load(os.path.join(SES, seg['audio']))
            put(vo, x / (np.abs(x).max() + 1e-6) * 0.7, t0)
        for code, off in seg.get('lines', []):
            if seg.get('audio'):
                pass
            else:
                x = load(ses(code))
                g = 0.55 if code.startswith('all') else 1.0
                put(vo, x / (np.abs(x).max() + 1e-6) * 0.7 * g, t0 + off)
            if code in LINE and not code.startswith('all') or code == 'all1':
                who, txt = LINE[code]
                d = dur_of(ses(code)) if not seg.get('audio') else (2.5 if code == 'p3' else 3.7)
                subs.append((t0 + off, t0 + off + d + 0.2, who, txt))
        for name, off in seg.get('sfx', []):
            if name in ('fanfare', 'rimshot', 'trombone'):
                continue
            y, _ = AU.sfx(name)
            put(fx, y.astype(np.float32), t0 + off, 0.9)
    # ---- müzik: komik marş (tuba + marimba + klarnet), "YETER"de kesilir
    s_idx = next(i for i, s in enumerate(SEG) if s.get('freeze_music'))
    t_stop = SEG[s_idx]['t0'] - 0.25
    prog = [('C2', ['C4', 'E4', 'G4']), ('G1', ['B3', 'D4', 'G4']), ('A1', ['C4', 'E4', 'A4']), ('F1', ['C4', 'F4', 'A4'])]
    mel = ['G4', 'E4', 'C4', 'E4', 'G4', 'Ab4', 'G4', 'E4', 'F4', 'D4', 'B3', 'D4', 'F4', 'E4', 'D4', 'G3']
    t = SEG[1]['t0']; bar = 0; B = 0.5
    while t < t_stop - 0.1:
        root, ch = prog[bar % 4]
        for b in range(4):
            tb = t + b * B
            if tb >= t_stop:
                break
            if b % 2 == 0:
                put(mu, AU.tuba(AU.nf(root), 0.32, 0.55), tb)
            else:
                for n in ch:
                    put(mu, AU.marimba(AU.nf(n), 0.18), tb)
        if bar % 2 == 0:
            for k in range(8):
                tn = t + k * B / 2
                if tn < t_stop and k % 3 != 2:
                    put(mu, AU.clarinet(AU.nf(mel[(bar * 4 + k) % len(mel)]), 0.2, 0.16), tn)
        t += 4 * B; bar += 1
    # kovalamaca/kavga bölümünde trampet hızlanması
    chase_t = SEG[10]['t0']
    tt = chase_t
    while tt < t_stop - 0.1:
        put(mu, AU.snare(0.12), tt); tt += 0.25
    # Sepet monoloğu: sahte-dramatik yaylılar
    s0 = SEG[s_idx]['t0']
    put(mu, AU.drone(AU.nf('C2'), SEG[s_idx]['d'], 0.2, att=1.0, rel=1.0), s0 + 1.5)
    for k, chn in enumerate((['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['G2', 'B2', 'D3', 'F3'])):
        put(mu, AU.strings([AU.nf(x) for x in chn], 2.8, att=0.6, rel=0.8, vol=0.24), s0 + 1.6 + k * 2.8)
    # ayak sesleri gerilimi + fanfar
    fan = next(s for s in SEG if any(n == 'fanfare' for n, _ in s.get('sfx', [])))
    put(mu, AU.brass([AU.nf('C4'), AU.nf('E4'), AU.nf('G4'), AU.nf('C5')], 0.3, 0.5), fan['t0'])
    put(mu, AU.brass([AU.nf('C4'), AU.nf('E4'), AU.nf('G4'), AU.nf('C5')], 1.3, 0.55), fan['t0'] + 0.35)
    put(mu, AU.cymbal(0.3, 2.0), fan['t0'] + 0.35)
    hands = SEG[19]['t0']
    for i, n in enumerate(['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4']):
        put(mu, AU.bass_pluck(AU.nf(n), 0.18, 0.35), hands + 0.3 + i * 0.3)
    put(mu, AU.slide(300, 1200, 0.7, 0.14), hands + 0.4)
    put(mu, AU.slide(1200, 250, 0.3, 0.14), hands + 4.0)
    end = SEG[-1]['t0']
    put(mu, AU.snare(0.45), end); put(mu, AU.snare(0.35), end + 0.13); put(mu, AU.cymbal(0.35, 1.2), end + 0.27); put(mu, AU.kick(0.5), end + 0.27)
    for i, (n, d, v) in enumerate((('Bb3', 0.42, 0.0), ('A3', 0.42, 0.0), ('Ab3', 0.42, 0.0), ('G3', 1.4, 0.03))):
        put(mu, AU.brass([AU.nf(n)], d, 0.55, glide=-0.02 if i == 3 else 0.0, vib=v), end + 0.45 + i * 0.5)
    # seviye ve ducking
    seg_ = mu[int(SEG[1]['t0'] * SR):int(t_stop * SR)]
    mu *= 0.045 / (np.sqrt(np.mean(seg_ ** 2)) + 1e-9)
    env = np.abs(vo)
    k = int(0.02 * SR)
    env = np.convolve(env, np.ones(k) / k, mode='same')
    env = np.maximum.accumulate(env[::-1])[::-1] * 0 + env
    sm = np.convolve(env, np.ones(int(0.3 * SR)) / int(0.3 * SR), mode='same')
    sm = sm / (np.percentile(sm[sm > 0.01], 85) + 1e-6)
    duck = 10 ** (-10 * np.clip(sm, 0, 1) / 20)
    mix = vo * 1.0 + mu * duck + fx * 0.8
    mix += np.random.RandomState(1).randn(N).astype(np.float32) * 0.0006
    mix = np.tanh(mix * 1.1) / 1.1
    mix = mix[:int(total * SR)]
    mix *= 10 ** (-1.5 / 20) / (np.abs(mix).max() + 1e-9)
    p = os.path.join(TMP, 'mix.wav')
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    return p, subs


def ass_time(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def write_ass(subs, cricket_t):
    p = os.path.join(TMP, 'subs.ass')
    with open(p, 'w', encoding='utf-8') as f:
        f.write('[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n\n')
        f.write('[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, '
                'Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n')
        f.write('Style: Sub,DejaVu Sans,52,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0101018,1,0,0,0,100,100,0,0,3,14,0,8,90,90,210,1\n')
        f.write('Style: Note,DejaVu Serif,46,&H00FFE6DC,&H00FFFFFF,&H00000000,&H00000000,0,1,0,0,100,100,0,0,1,3,0,8,90,90,330,1\n\n')
        f.write('[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n')
        for a, b, who, txt in subs:
            name, col = NAMES[who]
            f.write(f'Dialogue: 0,{ass_time(a)},{ass_time(b)},Sub,,0,0,0,,{{\\fs30\\c{col}}}{name}{{\\fs52\\c&H00FFFFFF&}}\\N{txt}\n')
        f.write(f'Dialogue: 0,{ass_time(cricket_t)},{ass_time(cricket_t + 2.2)},Note,,0,0,0,,( cırcır böceği )\n')
    return p


if __name__ == '__main__':
    total = build_video()
    mixp, subs = build_audio(total)
    cr = next(s for s in SEG if s.get('cricket'))['t0'] + 0.2
    assp = write_ass(subs, cr)
    outp = os.path.join(OUT, 'Insanlar_Gidince_Katlanmayanlarin_Isyani_3D.mp4')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(TMP, 'video.mp4'), '-i', mixp,
                    '-vf', f"ass={assp}", '-af', 'loudnorm=I=-15:TP=-1.5:LRA=9', '-ar', '48000',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '10M', '-bufsize', '20M', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', outp], check=True)
    print('OK', outp, round(total, 2))
