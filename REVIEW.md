# HITOFUDE 一筆 — review

50.0 s, 1920x1080, 24 fps, 15 shots, one canvas drawn in 2D from film time. Rendered file: `renders/hitofude.mp4`.

## Creative calls

- No 3D. The two reference films (MEGA CLAWD, RYU) are three.js scenes behind a paint filter and still read as
  low-poly models. This film is one medium with rules: sumi ink on washi, drawn stroke by stroke by a brush engine
  (dry-brush streaks, write-on, ink that boils on threes).
- The idea carries the design: the heroine's sword is a brush, the enemy is blank paper that un-paints the world,
  her dragon is a single stroke (hitofude-ryu), the two dragons resolve into a yin-yang, and the last cut is the
  kanji 一 — which is the logo, and the only moment colour enters the film.
- Trailer grammar from games, not a mascot short: a boss card, impact frames (ink / vermilion / white), a held
  silence before the stroke, an earned title.
- One accent: vermilion on her scarf, the sun and the seal. The painter's seal that signs the opening painting is
  the seal that stamps the title.
- Storylines not built: LAST TRAIN TO ORBIT (a mecha interception cut on the beat) and MARGIN (a notebook doodle,
  endless zoom). Both are in STORYLINES.md.

## Measured, looked at, not checked

- Measured: `hyperframes check` passes (lint, runtime, layout, craft, audio; 0 errors). The one layout warning
  (canvas art touches the frame edge) is intended and now marked full-bleed.
- Looked at: about 90 stills across all 15 shots, including the frames either side of both impact cuts and a pose
  sheet for the heroine rig.
- Sound: synthesized in `tools/make-audio.mjs` (no samples). Measured, not heard: -15.2 LUFS, -2.0 dBTP, hits
  within 0.3 ms after their cues (11.30, 22.00, 37.75, 47.00), the two silences 30 and 37 dB under the drum roll.
  Nobody has listened to it.
- Not checked: the film played at speed. Motion was judged from stills only.

## Polish pass (second render)

- s11 (the coil): fewer, wider coils; the two necks peel apart so the heads face each other; whatever passes
  behind is drawn paler, the way ink shows distance; the twist starts slower.
- s08 (first cut): the scatter of ovals is replaced by `K.spatter` — teardrops thrown along the direction of the
  cut, each pointing back at the stroke, with satellites and nine flung threads of ink.
- Heroine: the landing is now a low lunge, the ride is a wide surfing stance with the brush trailing, and the
  leap has a stretch pose before the tuck. She stands on top of the dragon's head instead of sinking into it.

## Weakest shots now, and what more time would buy

- s11 still has one frame or two where a loop of the ink body overlaps itself as the coil tightens.
- s14 colour: one palette (dusk). A second pass could push it further from the ink value range.
- The heroine has no face outside the close-up; a second close-up after the cut would give the ending a person.

## Kept on purpose

- s09 (24.6-27.0) is almost an empty frame for two seconds, with near silence. That is the breath before the
  dragon; the check's dead-stretch rule did not fire because the flecks and the figure keep moving.
