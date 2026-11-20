# Voice & music

## 1. Turkish narration (exact text, do not change)

Record it as **one continuous take** so the emotion carries from line to line. The pause marks (`…`) and the breaks between blocks are breaths, not words.

```
[S1]  Her sabah senden önce uyanıyorum. Önce yüzüne bakıyorum… Sonra burnuna küçük bir pati dokunduruyorum. Uyan diye.

[S2]  Bazen umursamıyorsun. Yorganı başına çekiyorsun. Bazen de uykulu gözlerle bana kızıyorsun. Ama ben yine de her sabah geliyorum.

[S3]  Sen kahveni hazırlarken ayaklarının arasında dolaşıyorum. Evden çıkarken arkandan bakıyorum. Ben de kapının kapanmasını izliyorum.

[S4]  Büyüdüm. Eskisi kadar hızlı koşamıyorum. Sabahları yanına gelmem biraz daha uzun sürüyor. Ama seni uyandırmayı hiç bırakmadım.

[S5a] Bir sabah uyandığında beni göremeyeceksin. Burnuna dokunan küçük patilerim olmayacak. Belki ilk kez alarm çalmadan uyanacaksın.

      (pause ~0.8 s)

[S5b] İşte o zaman… Her sabah şikâyet ettiğin o küçük sesimi özleyeceksin.
```

### Target timing (where each line starts in the 40 s film)

| Line | Starts | Ends at the latest | Words |
|---|---|---|---|
| S1 | 0.5 s | 6.6 s | 15 |
| S2 | 6.9 s | 13.0 s | 18 |
| S3 | 13.3 s | 19.8 s | 15 |
| S4 | 20.0 s | 26.2 s | 18 |
| S5a | 26.5 s | 31.6 s | 15 |
| *pause* | 31.6 | 32.4 | — |
| S5b | 32.4 s | 36.0 s | 10 |
| *(music swells, text appears at 35.0 s, silence at 40.0 s)* | | | |

If the take runs long, keep the narration as it is and **lengthen the clips instead** (change `DURS` in `assemble.sh`; the film can run to 42–44 s without any problem). Never speed the voice up by more than 5%.

### Voice direction

- **Who:** the cat itself, in its own voice, remembering its whole life with its owner. Intimate, as if speaking a few centimetres from the owner's ear.
- **Voice:** warm, soft, slightly breathy, gender-neutral to gently feminine, young-adult tone. Natural Istanbul Turkish pronunciation. **Not** a cartoon or squeaky "cute animal" voice.
- **Arc:**
  - S1–S2: tender with a faint smile; playful on "Uyan diye." and "bana kızıyorsun".
  - S3: quieter, a little lonely on "kapının kapanmasını izliyorum".
  - S4: slower, slightly tired but proud on "hiç bırakmadım".
  - S5a: very calm and hushed, no tears in the voice.
  - S5b: the most fragile line. A small catch on "İşte o zaman…", then the last phrase almost whispered.
- **Pronunciation checks:** *şikâyet* (long â), *dokunduruyorum*, *göremeyeceksin*, *özleyeceksin*, *kıymetini*.
- **Recording:** 48 kHz / 24-bit, a dry room, a pop filter and no reverb baked in (the script adds none). Light de-ess only.

**ElevenLabs settings (if you use it):** model `eleven_v3` or `eleven_multilingual_v2`, language Turkish, stability about 0.45, similarity about 0.8, style about 0.35. Design the voice with a prompt such as *"Gentle, intimate, soft-spoken young Turkish voice, warm and sincere, slightly breathy, speaking tenderly to someone they love, natural Istanbul accent."* Generate the whole script in one request so the tone stays the same throughout.

---

## 2. Music: "Patiler" (original cue, 40.0 s)

**Instrumentation:** solo felt/upright piano (lead) · string quartet with a small chamber string section (pads and counter-melody) · a single sustained cello line in the climax. **No** synth pads, drones, hum, ambient noise, risers or sound effects.

- **Tempo:** 66 BPM (rubato allowed) · **Key:** D♭ major, leaning toward B♭ minor
- **Core progression:** D♭ – A♭/C – B♭m – G♭ (I – V⁶ – vi – IV), with the climax lifting to G♭ – A♭ – D♭/F – B♭m and resolving onto a suspended A♭sus4 → D♭ on the final chord.

| Time | Section | What happens |
|---|---|---|
| 0.0 – 6.5 | Intro | Solo piano, a simple four-note motif in the right hand (F – A♭ – G♭ – E♭), sparse left hand. Very soft (pp). |
| 6.5 – 13.0 | A | The motif repeats, a light rhythmic figure appears (morning playfulness), and soft viola sustains enter under it. |
| 13.0 – 20.0 | A′ | The violins add a slow counter-melody; the piano moves into the middle register. Slightly fuller (mp). |
| 20.0 – 26.5 | B: time passes | The harmony turns to B♭m – G♭, the piano slows into gentle arpeggios and the cello enters. Nostalgic. |
| 26.5 – 33.5 | Bare | **The strings drop out.** Solo piano, single notes with long sustain: the silent morning. Leave space for the voice. |
| 33.5 – 38.0 | Climax | On the cut to the photograph, the full strings come back with the main motif an octave higher on violin over the cello line, rising to mf–f at about 36 s. This is the emotional peak. |
| 38.0 – 40.0 | Release | Everything thins out to one last piano note (D♭) that rings and fades **to complete silence** by 40.0 s. |

**If you generate the music** (ElevenLabs Music, Suno or Udio), use this prompt and then trim and fade it to the cue sheet:
```
Instrumental only, no vocals. Emotional cinematic score, 66 BPM, D-flat major. Delicate solo felt piano
playing a simple tender four-note motif, joined by warm chamber strings and a soft cello line. Starts very
softly with piano alone, gentle playful build, nostalgic middle section, then strings drop out leaving lonely
sparse piano, then a heartfelt swell with full strings and the motif on high violin, ending on a single
lingering piano note fading to silence. Melancholic, warm, beautiful, film-soundtrack quality.
No synths, no drones, no ambient noise, no percussion, no sound effects. Duration 40 seconds.
```
If you use library music instead, look for a "felt piano + strings, tender, 60–70 BPM" track whose climax can be lined up to land at 34–36 s, and check the licence covers social media use.

---

## 3. Mix

| Element | Level | Notes |
|---|---|---|
| Narration | about −16 LUFS short-term, always on top | High-pass at 80 Hz, a light 2:1 compressor, no reverb or only a very short room reverb |
| Music under the voice | about −28 LUFS (the script ducks it 6–8 dB when the voice is present) | Clearly audible, never competing with the voice |
| Music without the voice (34–40 s) | rises to about −18 LUFS | The climax should be the loudest music moment in the film |
| Final master | −14 LUFS integrated, −1 dBTP | `assemble.sh` does this automatically |

The **only** sound effect allowed is the cat's soft meow in Shot 1, and only if it is gentle and recorded or generated cleanly. Put it at about 4.5 s, ‑20 dB. It is optional (`audio/meow.wav`).
