# ONE DAY, YOU WON'T HEAR MY VOICE ANYMORE
### *Bir Gün Sesimi Duymayacaksın*: production package

A 40-second vertical (9:16) 3D CGI short film. The cat narrates in Turkish and speaks directly to its owner. There is no outside narrator.

This folder has everything you need to make the film in any AI video tool (Kling 3 Pro, Veo 3.1, Seedance, Runway and others), and a script that puts the final cut together.

| File | What it is |
|---|---|
| [`01-character-bible.md`](01-character-bible.md) | Fixed design for the cat and the owner, plus the prompt for the **master reference image** that every shot is generated from |
| [`02-shot-list.md`](02-shot-list.md) | Six shots, each with its exact length, camera move, video prompt and negative prompt |
| [`03-voice-and-music.md`](03-voice-and-music.md) | The Turkish narration exactly as written, voice direction, line timing, the music cue sheet and mix levels |
| [`final-text.txt`](final-text.txt) | The closing sentence, saved as UTF-8 so the Turkish letters come out right |
| [`assemble.sh`](assemble.sh) | ffmpeg script: 6 clips + narration + music → `ONE_DAY_9x16.mp4` |

---

## Timeline (exactly 40.0 s)

Each clip overlaps the next by a 0.6 s cross-dissolve. Clip lengths add up to 43 s, minus 5 overlaps of 0.6 s each, which gives 40 s.

| # | Scene | Clip length | On screen | Narration |
|---|---|---|---|---|
| 1 | Every morning | 7.0 s | 0.0 – 7.0 | "Her sabah senden önce uyanıyorum…" |
| 2 | Our little routine | 7.0 s | 6.4 – 13.4 | "Bazen umursamıyorsun…" |
| 3 | The little moments | 7.5 s | 12.8 – 20.3 | "Sen kahveni hazırlarken…" |
| 4 | Time passes | 7.0 s | 19.7 – 26.7 | "Büyüdüm…" |
| 5 | The silent morning | 8.0 s | 26.1 – 34.1 | "Bir sabah uyandığında…" *(pause)* "İşte o zaman…" |
| 6 | Final: the photograph | 6.5 s | 33.5 – 40.0 | music swells → on-screen text → silence |

> **Pacing note:** the narration is about 85 words, so it needs a slow but steady delivery of about 2.5 words per second to fit in 40 s. This is the tightest constraint in the film. Record the voice **first**, then fine-tune the clip lengths in `assemble.sh` (`DURS=`) to match it.

---

## Production order

1. **Master reference.** Generate the cat and owner reference image from `01-character-bible.md`. Do not move on until the cat looks right, because everything else is built on this image.
2. **Photograph prop.** Generate the "treasured photo" still from the same reference (prompt in `02-shot-list.md`, Shot 5/6). It is used both on the bedside table and in the final shot.
3. **Voice.** Record or generate the Turkish narration as **one continuous take** (`03-voice-and-music.md`). Export it as `audio/vo.wav`.
4. **Shots.** Generate shots 1–6 as image-to-video or reference-to-video from the master reference, at 9:16 and 1080×1920 or higher. Turn off the video model's own audio and music. Save them as `clips/s1.mp4` … `clips/s6.mp4`.
5. **Music.** Compose, license or generate the piano + strings cue to the cue sheet. It must be **exactly 40 s**, with the swell at 34–38 s and silence at 40 s. Export it as `audio/music.wav`.
6. **Assemble.**
   ```bash
   cd kisa-film
   ./assemble.sh            # writes ONE_DAY_9x16.mp4
   ```
   The script scales and crops every clip to 1080×1920, adds the cross-dissolves, writes the closing sentence centred with a soft fade-in, lowers the music under the voice, normalises loudness to −14 LUFS (the target for social platforms) and fades to silence.

### Check before release
- [ ] The cat has the same white blaze, white chest, white paws, orange tabby back and **green** eyes in every shot
- [ ] Shot 4: the cat is visibly older (greyer muzzle, thinner, slower) but still clearly the same cat
- [ ] Shot 5: the cat's spot on the bed is empty, with no body, no crying and no dramatic staging
- [ ] No on-screen text before Shot 6
- [ ] The closing sentence is spelled exactly: **Bazı seslerin kıymetini, sustuklarında anlarız.**
- [ ] No hum, drones or noise beds; only piano + strings under the voice
- [ ] The narration is always clearly above the music
