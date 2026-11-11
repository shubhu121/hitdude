# HITOFUDE 一筆 — "One Stroke"

A 50-second anime trailer for a game that does not exist, painted entirely in code: no image model, no video
model, no 3D, no audio samples.

A swordswoman whose blade is a calligraphy brush fights THE BLANK, a paper dragon that erases the painted world.
She paints a dragon in a single stroke, the two dragons become a yin-yang, and her last cut is the kanji 一 —
which is also the title.

**Watch:** [`renders/hitofude.mp4`](renders/hitofude.mp4) (1920x1080, 24 fps, 15 shots, 1,200 frames).

## Play it

**Live:** https://shubhu121.github.io/hitdude/play/

`play/` is the game the film is cut from: the same painting, drawn by the same brush engine (`src/`), with the
same beats. The range is brushed in, the white edge eats half of it, THE BLANK rises, the boss card slams, and
you fight it as Sumi. The Blank really erases the painting; your strokes really leave ink on it.

```bash
python -m http.server 5173
```

Then open `http://localhost:5173/play/`.

| Key | Action |
| --- | --- |
| A / D | move |
| W | jump (over the tail wipe; to reach the head) |
| S | block; a block made just before the blow lands is a parry |
| J | strike (press again to chain three) |
| K | heavy stroke; hold it to throw an ink wave; hold it when the Blank falls, for the one stroke |
| L | kick |
| Space | dash through an attack |

How the fight works:

- **Ink** pays for every move and comes back on its own. A parry, a clean jump over the wipe or a dash through
  the breath gives ink back.
- **Scars**: every stroke that lands stays on the Blank until it cleans itself. Four fresh scars at once and it
  is *inked*: it drops, open, and takes half as much again.
- **Its attacks**: a bite that leaves the head on the ground (your opening), a tail wipe along the ground, and
  below 60% a breath of blankness and falling paper shards. Below 25% it bites twice.
- **The end**: when it is beaten, hold K. Every drop of ink gathers on the brush, and the release is the film's
  ending: impact frames, 一 through its eye, colour.
- She is ink too: as she is hurt, bare paper shows through her.

### Recording a fight

The game can film itself. `tools/rec_server.py` serves the project and saves what the page posts; in the page,
`__P.record(seed, botSeed)` plays one fight with a player bot (`play/js/bot.js`) that presses the same keys a
person does, steps the game at a fixed 60 Hz, and posts every frame plus a soundtrack rendered offline from the
log of sounds the fight played. `__P.search(seeds, botSeeds)` plays fights without drawing, to pick one.

```bash
python tools/rec_server.py 5180 renders/rec
```

`game/` is an earlier 3D tabletop prototype (the painting on a desk, with an origami dragon).

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
