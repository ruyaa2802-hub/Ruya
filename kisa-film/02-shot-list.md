# Shot list

**Global settings for every shot:** 9:16 vertical · 1080×1920 or higher · 24 fps · image-to-video from the master reference (or reference-to-video) · **model audio off** (all sound is added in the edit) · no on-screen text.

**Global style suffix (add to every prompt):**
```
High-end 3D CGI animated short film, Pixar-quality rendering, realistic natural cat movement and weight,
individually rendered fluffy fur with subsurface scattering, expressive emerald-green eyes with subtle blinks and
micro-expressions, soft cinematic lighting, shallow depth of field, gentle film grain, smooth slow camera motion,
vertical 9:16 framing, no text, no subtitles, no watermark.
```

**Global negative:**
```
text, subtitles, captions, watermark, logo, extra cats, second cat, extra people, extra limbs, deformed paws,
changing fur pattern, blue eyes, yellow eyes, black or grey cat, flicker, morphing, jerky motion, fast cuts,
2D, anime, slideshow, still image
```

`[CAT]` = the locked cat description from `01-character-bible.md`.

---

## Shot 1: EVERY MORNING · 7.0 s

- **Camera:** starts low at mattress level, then a slow dolly-in toward the owner's face on the pillow.
- **Light:** first warm sunrise, golden beams with floating dust.

```
[CAT] walks softly across cream linen bedding in a cozy bedroom at sunrise, toward a sleeping young adult with
short slightly messy dark-brown hair. The cat stops beside the pillow, looks at the sleeping face for a moment with
loving eyes, then slowly lifts one white front paw and gently taps the owner's nose, ears perking, and gives a
small soft meow. Golden morning light through sheer curtains, dust motes floating. Slow dolly-in at mattress height.
```

## Shot 2: OUR LITTLE ROUTINE · 7.0 s

- **Camera:** locked-off medium shot of the bed, then a gentle push in on the cat's face.

```
Same bedroom, same morning light. The sleepy owner groans softly and pulls the cream blanket over their head,
only a lump under the covers. [CAT] sits patiently beside them, tail curled around its white paws, slow blinking,
waiting. After a beat, a hand slides out from under the blanket; the cat leans in and gently nudges the hand with
its forehead, rubbing its cheek against the fingers. Adorable, natural, unhurried movements. Gentle push-in.
```

## Shot 3: THE LITTLE MOMENTS · 7.5 s

- **Camera:** low, cat's-eye-level tracking shot in the kitchen, then a slow move toward the front door.

```
Warm wooden kitchen in the morning. The owner, wearing an oatmeal-beige knit sweater (seen from the waist down
and hands only), pours coffee from a pour-over kettle, steam glowing in the sunlight. [CAT] weaves slowly in a
figure-eight around the owner's ankles, tail raised. The owner bends down and gently strokes the cat's head;
the cat closes its eyes and leans into the hand. Then the owner walks to the front door; the cat sits in the
hallway watching, and the door slowly closes, leaving a thin strip of light on the floor. Low tracking camera.
```

## Shot 4: TIME PASSES · 7.0 s

- **Camera:** time-lapse at the start (light and seasons outside the window change quickly, about 2 s), then real-time with a slow lateral dolly.
- **Transition in:** a soft dissolve through window light.

```
Time-lapse through the bedroom window: sunlight sweeps across the room, the plant on the sill grows taller,
seasons change outside from summer to autumn leaves to winter frost, then settles back into a calm sunrise.
[CAT] — the same cat years later: a few silver-grey hairs around the muzzle and eyebrows, slightly thinner,
fur a little less glossy, eyes still bright green but softer — walks slowly and carefully toward the bed,
pauses, climbs up with effort onto the blanket, and curls up close beside the sleeping owner's shoulder,
resting its chin on their arm with a slow, content blink. Tender, quiet. Slow lateral dolly.
```

## Shot 5: THE SILENT MORNING · 8.0 s

- **Camera:** wide shot of the bed, then a **slow, continuous push** past the empty spot to the framed photo on the bedside table, ending close on the frame.
- **Light:** paler, slightly cooler sunrise; very still; no dust motes moving at first, then one beam of light lands on the frame.
- **Rules:** no cat, no death imagery, no crying, no visible faces. Quiet and calm.

```
The same cozy bedroom at sunrise, quieter and slightly paler light. The owner is asleep on one side of the bed,
seen only as a still shape under the blanket and a resting hand. The small hollow in the blanket where the cat
always slept is empty and smooth. No cat anywhere. The camera moves slowly and continuously across the empty spot
toward the honey-wood bedside table, where a framed photograph stands beside a small lamp. A soft beam of morning
light gradually falls onto the frame. Peaceful, still, restrained emotion. Ends close on the photo frame.
```

## Shot 6: FINAL · THE PHOTOGRAPH · 6.5 s

- **Camera:** the photograph fills the frame, then a very slow zoom into the image (about 100% → 112%).
- **Light:** warm again; subtle light shift and glass reflection gliding across the frame for life.
- **On-screen text** is added in the edit by `assemble.sh`, **not** by the video model.

```
Extreme close-up of a framed photograph filling the vertical frame: a warm candid photo of the young adult
owner in an oatmeal-beige knit sweater laughing softly with [CAT] held against their chest, the cat's cheek
pressed to the owner's chin, both eyes half-closed in contentment, golden afternoon light, slight natural
photo grain. A soft reflection of window light glides slowly across the glass, tiny dust particles drift.
Very slow zoom into the photo. Warm, intimate, treasured memory. No text.
```

### Photograph prop (generate once as a still image and reuse it in Shots 5 and 6)

```
Candid lifestyle photograph, shot on 35mm film look, 3D CGI rendered to match the film:
the young adult owner with short slightly messy dark-brown hair in an oatmeal-beige knit sweater,
sitting on a sofa by a window, laughing softly with eyes closed, holding [CAT] against their chest;
the cat's cheek pressed to the owner's chin, green eyes half-closed, purring. Golden afternoon light,
warm tones, soft natural grain, slightly imperfect focus — feels like a real, treasured memory. 4:5 crop.
```

Then use this still as the reference for the photo inside the frame in Shot 5 and as the start frame for Shot 6.

---

## Transitions (applied by `assemble.sh`)

| Cut | Transition | Length |
|---|---|---|
| 1 → 2 | cross-dissolve | 0.6 s |
| 2 → 3 | cross-dissolve | 0.6 s |
| 3 → 4 | soft white-light dissolve (`fadewhite`) | 0.6 s |
| 4 → 5 | cross-dissolve | 0.6 s |
| 5 → 6 | cross-dissolve (match on the frame) | 0.6 s |
| end | fade to black + silence | 1.2 s |
