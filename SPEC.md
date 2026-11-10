# HITOFUDE 一筆 — spec

GOAL:    The viewer wants to play a game that does not exist, and remembers one image: the last cut is the
         kanji 一, and it is the stroke that paints the world back.
OUTPUT:  HyperFrames, 1920 x 1080, 24 fps (render with --fps 24). One canvas, drawn in 2D from film time.
TIME:    50.0 s x 24 = 1200 frames. No BPM: the score is free-time (odaiko, wind, silence), cues below.

LOOK:    Medium: sumi ink on washi. Five parts and nothing else.
         - paper: #EBE3D0, fibre noise +-5 levels, mottling +-6, static (it is a painting, it does not flicker)
         - ink: #15110E. Every line and every mass. Washes are the same ink diluted (alpha 0.08-0.6)
         - dry brush (kasure): every stroke loses ink toward its end; streaks of bare paper, never a clean vector edge
         - vermilion: #D2311C. Only her scarf, the sun and the seal. One focus per frame
         - the Blank: paper lighter than the ground (#F9F5EA) with a cut-paper shadow (offset 10/14 px, blur 16 px, 30%)
         Full colour (shin-hanga bokashi: indigo #24406E, viridian #2F6B5A, ochre #D9A441, sakura #F2B8C6) exists
         only from 39.5 s. Ink edges boil on threes (8 drawings a second) through a displacement of 5 px.
         Type: EB Garamond 500, caps, tracking 0.42 em, 30-54 px. Kanji are painted with the brush engine, not set in a font.
OBJECTS: - Sumi: silhouette, 1/7 head, high ponytail, hakama, a brush taller than she is, a vermilion scarf that
           always trails the motion. All her acting is the pose and the scarf
         - THE BLANK: a serpent of folded paper, fold creases across the body, horns, whiskers of paper strip,
           eyes that are punched holes (perfect black discs)
         - the one-stroke dragon: a single wide dry-brush stroke with scale ripples, a head of five strokes
         - the world: three ranges of mountains in mist, a cliff, one pine, a torii, a stamped red sun, birds as ticks
MOTION:  Characters on twos (12 a second), FX and line boil on threes, camera on ones. No smooth software easing
         on characters: anticipation 3-5 f, action 2-4 f, settle 6-10 f. Camera: slow linear drifts or exp-out pushes.
         Impact frames: 1 f inverted, 1 f vermilion, 1 f white. Shake: 14 px decaying over 10 f.
SHOTS:   s01   0.0- 3.5  the range is brushed in left to right, wash spreads, red sun stamps        | brush swish, wind
         s02   3.5- 6.5  cliff, pine, torii; Sumi stands at the edge, scarf in wind; birds cross     | wind, a low drone
         s03   6.5- 9.5  the birds are erased one by one; a white edge eats the far range; she turns | paper tear, drone dips
         s04   9.5-13.5  half the painting is blank; the Blank rises out of it; boss card 白 at 11.3  | odaiko at 11.3
         s05  13.5-16.0  close: her eye above the scarf, hair in wind, a drop of ink falls            | heartbeat drum x2, drip
         s06  16.0-19.0  she runs the ridge, the world wiped white behind her heels                  | fast taiko pattern, steps
         s07  19.0-21.5  the leap, tiny against the opening maw                                      | whoosh up, held breath
         s08  21.5-23.5  first cut: a black crescent across the paper body, impact frames at 22.0     | blade + odaiko at 22.0
         s09  23.5-27.0  the tail wipes the frame to bare paper; she falls through white, alone       | wipe, then near silence
         s10  27.0-31.5  one stroke under her feet becomes a dragon, she rides it up                  | long brush swish 27.3, drums build
         s11  31.5-35.0  the two dragons coil, then from above they are a yin-yang, spinning faster   | accelerating drum roll
         s12  35.0-37.5  she raises the brush; all remaining ink drains to it; silence from 36.3      | roll cuts dead at 36.3
         s13  37.5-39.5  一: one horizontal cut across the whole frame at 37.75, impact frames, hold   | blade + biggest odaiko 37.75
         s14  39.5-45.0  colour bleeds out of the stroke; the Blank bursts into petals; the range in colour | koto phrase, pad
         s15  45.0-50.0  the stroke stays as the logo 一; HITOFUDE; seal stamps at 47.0; hold          | seal thunk 47.0, last koto note
BANNED:  3D or anything that reads as a model; a mascot; flat vector fills without ink texture; glow, bloom, lens
         flares, neon; particles as decoration (every fleck is ink, paper or a petal with a cause); smooth easing
         on a character; fades between shots (cuts, wipes by ink or by paper only); a font for the kanji;
         HUD chrome beyond the one boss card; a dark void.
QA:      0.0 thumbnail reads as an ink painting in progress; 5.0 girl + scarf separate from the pine; 11.5 boss
         card legible at 360 px; 14.5 eye reads as an eye; 22.0-22.2 impact frames; 26.0 a nearly blank frame that
         still reads (figure + scarf); 30.5 dragon reads as a dragon; 34.0 yin-yang reads; 37.8 一; 43.0 colour;
         48.5 title lockup inside title-safe.
