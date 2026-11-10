# HITOFUDE 一筆 — "One Stroke"

A 50-second anime trailer for a game that does not exist, painted entirely in code: no image model, no video
model, no 3D, no audio samples.

A swordswoman whose blade is a calligraphy brush fights THE BLANK, a paper dragon that erases the painted world.
She paints a dragon in a single stroke, the two dragons become a yin-yang, and her last cut is the kanji 一 —
which is also the title.

**Watch:** [`renders/hitofude.mp4`](renders/hitofude.mp4) (1920x1080, 24 fps, 15 shots, 1,200 frames).

## How it is made

- One `<canvas>`, drawn in 2D from film time alone, so any frame renders in any order.
- A small brush engine (`src/core.js`): strokes with dry-brush streaks, write-on, ink spatter, kanji painted
  stroke by stroke rather than set in a font.
- The world, the heroine rig and both dragons are in `src/world.js` and `src/actors.js`; the 15 shots are in
  `src/shots*.js`.
- The soundtrack is synthesized offline by `tools/make-audio.mjs` (drums, koto, wind; no samples).
- Rendered with [HyperFrames](https://hyperframes.heygen.com).

## Run it

```bash
npx hyperframes preview
```

```bash
npx hyperframes render --fps 24 --quality delivery --output renders/hitofude.mp4
```

```bash
node tools/make-audio.mjs
```

`SPEC.md` is the director's brief, `STORYLINES.md` has the storylines that were not built, and `REVIEW.md` says
what was checked and what was not.
