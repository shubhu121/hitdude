// HITOFUDE 一筆 — the game the film came from.
// The arena is the film's own painting, drawn by the film's own brush engine; the Blank erases it for real.
import { Fighter, GROUND, POSE } from "./fighter.js";
import { Sound } from "./audio.js";

const K = window.K;
const W = 1920,
  H = 1080,
  GY = 892, // the ground line on screen
  SC = 1.25, // fighter units -> screen
  HS = 170 * 1.55; // the Blank's head length
const $ = (id) => document.getElementById(id);
const cv = $("view"),
  g = cv.getContext("2d", { alpha: false });
const mk = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
let rs = 1;
function fit() {
  cv.width = Math.round(W * rs);
  cv.height = Math.round(H * rs);
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  for (const el of [cv, $("frame")]) {
    el.style.width = W * s + "px";
    el.style.height = H * s + "px";
  }
  $("frame").style.fontSize = 19 * s + "px";
}
window.addEventListener("resize", fit);
fit();
let dice = K.rng(4242);
const R = () => dice();
const sound = new Sound();
const toS = (p) => [960 + p[0] * SC, GY + (p[1] - GROUND) * SC];

// ------------------------------------------------------------------ the painting
const world = mk(W, H),
  wg = world.getContext("2d"); // ink: mountains, sun, pine, gate. The Blank erases this
const wipe = mk(W, H),
  wq = wipe.getContext("2d"); // where it has been: cleaner, brighter paper
const fg = mk(W, H),
  colour = mk(W, H),
  ichiC = mk(W, H),
  cardC = mk(W, H);
function paintWorld() {
  wg.setTransform(1, 0, 0, 1, 0, 0);
  wg.globalAlpha = 1;
  wg.globalCompositeOperation = "source-over";
  wg.clearRect(0, 0, W, H);
  wq.clearRect(0, 0, W, H);
  K.sun(wg, 1392, 262, 98);
  K.landscape(wg, { x: -120, y: 30, z: 1 }, {});
  const M = K.layer("fg");
  K.pine(M, 150, GY + 8, 1.3, 9, 0.3);
  K.torii(M, 520, GY + 2, 1.55);
  K.put(wg, M, { f: "rgh0", a: 0.5 });
  K.seal(wg, 118, 330, 84, -0.05, 1);
}
function bakeStatic() {
  // the ground: one heavy brush mass, grass along its edge
  const fgg = fg.getContext("2d");
  const P = K.rock(fgg, [[-200, GY + 8], [260, GY - 2], [640, GY + 5], [1040, GY - 3], [1460, GY + 6], [2120, GY]], 1320, 5, {});
  const L = K.layer("fg");
  K.grass(L, P, 0.02, 0.98, 190, 0, 3, { h: 26 });
  K.put(fgg, L, { op: "multiply", f: "rgh0" });
  // the same world in colour, for the ending
  const c = colour.getContext("2d");
  c.drawImage(K.paper, 0, 0);
  const sky = K.layer("col");
  K.skyColor(sky);
  K.put(c, sky, { op: "multiply" });
  const cam = { x: -120, y: 30, z: 1 };
  K.landscape(c, cam, { col: [[58, 86, 150], [52, 128, 104], [30, 84, 82]], ca: 0.78 });
  K.landscape(c, cam, { a: 0.5 });
  K.sun(c, 1392, 262, 98);
  const M = K.layer("fg");
  K.pine(M, 150, GY + 8, 1.3, 9, 0.3);
  K.put(c, M, { op: "multiply", f: "rgh0", a: 0.6 });
  const T = K.layer("torii");
  K.torii(T, 520, GY + 2, 1.55, K.RED);
  K.put(c, T, { op: "multiply", f: "rgh0" });
  // the last stroke, kept on its own so colour can rise under it
  const ig = ichiC.getContext("2d");
  K.ichi(ig, {});
  K.splat(ig, 170, 560, 220, 5, 34, { size: 1.0 });
  K.splat(ig, 1000, 536, 900, 6, 70, { dir: 0, spread: 0.3, size: 0.45, max: 9 });
  // boss card, as in the film
  const cg = cardC.getContext("2d");
  K.stroke(cg, [[-80, 916], [640, 910], [1400, 918], [2010, 912]], { w: 214, prof: (u) => 0.92 + 0.08 * Math.sin(u * 9), dry: 0.6, dryStart: 0.5, seed: 61, streak: 520, edge: 0.07 });
  K.kanji(cg, K.GLYPH.shiro, 150, 824, 178, { color: K.BLANK, w: 0.105, dry: 0.3, seed: 8 });
  K.text(cg, "THE BLANK", 420, 926, { size: 84, color: K.BLANK, track: 0.36 });
  K.text(cg, "EATER OF PAINTINGS", 426, 978, { size: 31, color: "rgba(249,245,234,0.86)", track: 0.5 });
}
// eraser stamps: ragged, like a torn edge
const stA = mk(256, 256),
  stT = mk(256, 256);
{
  for (const [c, col] of [
    [stA, "0,0,0"],
    [stT, "249,245,234"],
  ]) {
    const q = c.getContext("2d");
    const gr = q.createRadialGradient(128, 128, 30, 128, 128, 126);
    gr.addColorStop(0, `rgba(${col},1)`);
    gr.addColorStop(0.7, `rgba(${col},0.95)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    q.fillStyle = gr;
    q.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2,
        r = 88 + 34 * K.n1(i * 0.5, 3) + 14 * Math.pow(K.n1(i * 2.3, 9), 3);
      q.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    q.fill();
  }
}
function eraseAt(x, y, r, a = 1) {
  wg.globalCompositeOperation = "destination-out";
  wg.globalAlpha = a;
  wg.drawImage(stA, x - r, y - r, r * 2, r * 2);
  wg.globalAlpha = 1;
  wg.globalCompositeOperation = "source-over";
  wq.globalAlpha = a * 0.8;
  wq.drawImage(stT, x - r, y - r, r * 2, r * 2);
  wq.globalAlpha = 1;
}
/* everything right of a ragged front, between y0 and y1 */
function eraseRight(base, y0, y1, seed, amp = 1) {
  for (const c of [wg, wq]) {
    c.beginPath();
    c.moveTo(W + 60, y0);
    for (let y = y0; y <= y1; y += 6) c.lineTo(K.frontX(base, y, seed, amp), y);
    c.lineTo(W + 60, y1);
    c.closePath();
  }
  wg.globalCompositeOperation = "destination-out";
  wg.fill();
  wg.globalCompositeOperation = "source-over";
  wq.fillStyle = "rgba(249,245,234,0.8)";
  wq.fill();
}
const puff = mk(96, 96);
{
  const q = puff.getContext("2d");
  const gr = q.createRadialGradient(48, 48, 2, 48, 48, 46);
  gr.addColorStop(0, "rgba(21,17,14,0.5)");
  gr.addColorStop(1, "rgba(21,17,14,0)");
  q.fillStyle = gr;
  q.fillRect(0, 0, 96, 96);
}

export const getRs = () => rs;
export function reseed(n) {
  dice = K.rng(n);
}
export function setRs(v) {
  rs = v;
  fit();
}
export { K, W, H, GY, SC, HS, $, cv, g, mk, R, sound, toS, world, wg, wipe, wq, fg, colour, ichiC, cardC, paintWorld, bakeStatic, eraseAt, eraseRight, puff };
