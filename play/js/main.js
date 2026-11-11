// HITOFUDE 一筆 — the fight. Ink is her resource and her weapon; blank paper is the enemy's.
import { Fighter, GROUND, POSE } from "./fighter.js";
import { K, W, H, GY, SC, HS, $, cv, g, mk, R, sound, toS, world, wg, wipe, wq, fg, colour, ichiC, cardC, paintWorld, bakeStatic, eraseAt, eraseRight, puff, getRs, setRs, reseed } from "./paint.js";
import { makeBot } from "./bot.js";
import { Sound } from "./audio.js";

// ------------------------------------------------------------------ small baked things
const SBW = 1100,
  SBH = 940,
  SBX = 550,
  SBY = 760; // Sumi's buffer: her x -> SBX, the ground -> SBY
const sb = mk(SBW, SBH),
  sbg = sb.getContext("2d");
const ghostC = [0, 1, 2, 3].map(() => mk(SBW, SBH));
// dry-brush streaks: as she loses ink, bare paper shows through her
const streak = mk(SBW, SBH);
{
  const q = streak.getContext("2d");
  q.lineCap = "round";
  for (let i = 0; i < 520; i++) {
    const y = K.hash(i, 1) * SBH,
      x = K.hash(i, 2) * SBW,
      l = 40 + K.hash(i, 3) * 260;
    q.strokeStyle = `rgba(0,0,0,${0.35 + K.hash(i, 4) * 0.65})`;
    q.lineWidth = 1 + K.hash(i, 5) * 4.5;
    q.beginPath();
    q.moveTo(x, y);
    q.lineTo(x + l, y + (K.hash(i, 6) - 0.5) * 14);
    q.stroke();
  }
}
// mist between the ranges, as in the film
const mist = mk(1024, 180);
{
  const q = mist.getContext("2d"),
    id = q.createImageData(1024, 180);
  for (let y = 0; y < 180; y++)
    for (let x = 0; x < 1024; x++) {
      const n = K.fbm2((x % 512) / 80, y / 30, 3, 4) * 0.6 + K.fbm2(((x + 512) % 1024) / 170, y / 46, 8, 3) * 0.6;
      const a = K.clamp((n - 0.44) * 2.3) * Math.sin((y / 180) * Math.PI);
      const i = (y * 1024 + x) * 4;
      id.data[i] = 236;
      id.data[i + 1] = 229;
      id.data[i + 2] = 212;
      id.data[i + 3] = a * 255;
    }
  q.putImageData(id, 0, 0);
}
const tallyC = mk(360, 70),
  tallyG = tallyC.getContext("2d");
// 正: the five-stroke tally mark. One stroke per hit
const SEI = [
  [[6, 9], [42, 8]],
  [[24, 9], [24, 44]],
  [[25, 26], [41, 25]],
  [[11, 23], [11, 44]],
  [[3, 45], [45, 44]],
];
function drawTally(n) {
  tallyG.clearRect(0, 0, 360, 70);
  for (let i = 0; i < Math.min(n, 25); i++) {
    const m = Math.floor(i / 5),
      st = SEI[i % 5];
    K.stroke(tallyG, st.map((p) => [8 + m * 66 + p[0], 8 + p[1]]), { w: 8, prof: K.prof.line, dry: 0.35, dryStart: 0.2, seed: i + 3, step: 3, edge: 0.3 });
  }
}

// ------------------------------------------------------------------ state
const F = new Fighter("sumi", -520, 1);
const B = {};
const G = {
  mode: "title", // title | paint | erase | rise | card | fight | stun | finish | won | lost
  t: 0,
  mt: 0,
  slow: 1,
  slowT: 0,
  hitstop: 0,
  shake: 0,
  punch: 0,
  invert: 0,
  keys: {},
  press: {},
  parts: [],
  texts: [],
  rings: [],
  waves: [],
  ghosts: [],
  ink: 100,
  inkWait: 0,
  kActive: false,
  kHold: 0,
  kCue: false,
  wavePend: -1,
  combo: 0,
  comboT: 0,
  lastSerial: 0,
  charge: 0,
  flood: -1,
  ft: 0,
  auto: true,
  reveal: 1,
  seen: {},
  hintT: 0,
  hintText: "",
  ended: false,
  beat: 0,
  beatN: 0,
  kf: {},
  rec: false,
  noRender: false,
  simT: 0,
  sndLog: [],
  stats: {},
};
const stat = (k) => (G.stats[k] = (G.stats[k] | 0) + 1);
// while recording, sounds are written down with their time instead of played
for (const n of ["drum", "blade", "pluck", "tear", "whoosh"]) {
  const orig = sound[n].bind(sound);
  sound[n] = (...a) => {
    if (G.rec || G.noRender) {
      if (G.rec) G.sndLog.push([n, a, G.simT]);
    } else orig(...a);
  };
}
const fx = {
  wind: 0,
  minX: -690,
  maxX: 470,
  dustCd: 0,
  dust(x, y, amt) {
    const s = toS([x, y]);
    for (let i = 0; i < 4 * amt; i++) G.parts.push({ k: "dust", x: s[0] + (R() - 0.5) * 40, y: s[1] - 6, vx: (R() - 0.5) * 200 * amt, vy: -30 - R() * 70, life: 0, max: 0.45 + R() * 0.4, s: 26 + R() * 36 * amt });
    for (let i = 0; i < 3 * amt; i++) G.parts.push({ k: "ink", x: s[0], y: s[1] - 8, vx: (R() - 0.5) * 420, vy: -120 - R() * 300, r: 1.5 + R() * 3.5, life: 0, max: 2 });
  },
  shake(a) {
    G.shake = Math.max(G.shake, a);
  },
  sound(n) {
    if (n === "swing") sound.whoosh(0.22, 0.16);
    else if (n === "heavy") sound.whoosh(0.4, 0.3);
    else if (n === "kick") sound.whoosh(0.2, 0.12);
    else if (n === "dash") sound.whoosh(0.18, 0.2);
    else if (n === "thud") sound.drum(0.5, 120, 0.4);
  },
};
function bossReset() {
  Object.assign(B, { hp: 100, state: "hidden", t: 0, clock: 0, hx: 1660, hy: 1380, jaw: 0.2, dir: [-0.95, 0.3], kx: 0, ky: 0, kvx: 0, kvy: 0, next: 1.8, wipeX: 2000, hitDone: false, gx: 0, g0: 0, g1: 0, P: null, alpha: 1, last: "", sep: 0, scars: [], sh: [], stagCd: 0, rx: 0, ry: 0, doubled: false, restFor: 1.2 });
}
bossReset();
function setMode(m) {
  G.mode = m;
  G.mt = 0;
}

// ------------------------------------------------------------------ input
const MAP = { KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "jump", ArrowUp: "jump", KeyS: "block", ArrowDown: "block", KeyJ: "light", KeyK: "heavy", KeyL: "kick", Space: "dash" };
window.addEventListener("keydown", (e) => {
  const k = MAP[e.code];
  if (k) {
    if (!G.keys[k]) G.press[k] = true;
    G.keys[k] = true;
    e.preventDefault();
  }
  if (e.code === "Enter" && (G.mode === "title" || G.mode === "won" || G.mode === "lost")) begin();
});
window.addEventListener("keyup", (e) => {
  const k = MAP[e.code];
  if (k) G.keys[k] = false;
});

// ------------------------------------------------------------------ feedback helpers
function say(s, x, y, red) {
  G.texts.push({ s, x, y, life: 0, red });
}
function hint(key, html) {
  if ((G.seen[key] | 0) >= 2) return;
  G.seen[key] = (G.seen[key] | 0) + 1;
  $("hint").innerHTML = html;
  $("hint").classList.add("on");
  G.hintT = 1.9;
  G.hintText = html.replace(/<[^>]+>/g, "").replace(/&mdash;/g, "\u2014").replace(/&middot;/g, "\u00b7");
}
function dry() {
  const el = $("inkbar");
  el.classList.remove("dry");
  void el.offsetWidth;
  el.classList.add("dry");
}
function inkBurst(x, y, n, dx = 0, sp = 1) {
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2,
      v = (120 + R() * 560) * sp;
    G.parts.push({ k: "ink", x, y, vx: Math.cos(a) * v + dx * 260, vy: Math.sin(a) * v - 180, r: 2 + R() * R() * 7, life: 0, max: 2.5 });
  }
}
/* torn paper flies off the Blank */
function scraps(x, y, n, dx = 0) {
  for (let i = 0; i < n; i++) G.parts.push({ k: "scrap", x: x + (R() - 0.5) * 60, y: y + (R() - 0.5) * 60, vx: dx * (120 + R() * 460) + (R() - 0.5) * 380, vy: -160 - R() * 560, rot: R() * 6, w: (R() - 0.5) * 20, s: 9 + R() * 17, life: 0, max: 1.5 + R() * 1.2, sd: Math.floor(R() * 99) });
}
function ring(x, y, r, ink = true) {
  G.rings.push({ x, y, r, life: 0, ink });
}
function slowFor(sec, rate) {
  G.slowT = sec;
  G.slow = rate;
}

// ------------------------------------------------------------------ the Blank
const sumiS = () => [960 + F.x * SC, GY - 170];
const headC = () => [B.hx + B.kx + B.dir[0] * HS * 0.42, B.hy + B.ky + B.dir[1] * HS * 0.42];
function goTo(x, y, rate, dt) {
  B.hx += (x - B.hx) * Math.min(1, dt * rate);
  B.hy += (y - B.hy) * Math.min(1, dt * rate);
}
function aim(tx, ty, rate, dt) {
  const dx = tx - B.hx,
    dy = ty - B.hy,
    l = Math.hypot(dx, dy) || 1;
  B.dir[0] += (dx / l - B.dir[0]) * Math.min(1, dt * rate);
  B.dir[1] += (dy / l - B.dir[1]) * Math.min(1, dt * rate);
  const n = Math.hypot(B.dir[0], B.dir[1]) || 1;
  B.dir[0] /= n;
  B.dir[1] /= n;
}
function hitSumi(act, srcX, kind) {
  if (F.inv > 0 || F.state === "ko" || G.mode !== "fight") return;
  const blocked = F.state === "block" && F.face === 1;
  const s = sumiS();
  if (blocked && kind !== "breath" && (F.blockAge || 0) < 0.24) {
    // a late block turns the blow: ink back, a breath of time, an opening
    G.ink = Math.min(100, G.ink + 45);
    F.hp = Math.min(100, F.hp + 5);
    slowFor(0.5, 0.22);
    G.punch = 1;
    ring(s[0] + 60, s[1], 60);
    ring(s[0] + 60, s[1], 20);
    inkBurst(s[0] + 70, s[1], 22, 1, 1.2);
    say("PARRY", s[0] + 30, s[1] - 250, true);
    stat("parry");
    sound.blade(0.85);
    sound.drum(0.8, 150, 0.3);
    fx.shake(0.6);
    F.impulse(0.25);
    F.inv = 0.5;
    if (kind === "bite") {
      B.t = -1.4;
      B.kvy -= 420;
      B.kvx += 260;
    }
    return;
  }
  G.kActive = false;
  F.override = null;
  const res = F.takeHit(act, { x: (srcX - 960) / SC, face: -1 }, false, blocked, fx);
  if (res === "block") {
    sound.blade(0.4);
    fx.shake(0.4);
    G.hitstop = 0.05;
    say("BLOCK", s[0], s[1] - 240);
    return;
  }
  G.combo = 0;
  stat("hurt");
  drawTally(0);
  inkBurst(s[0], s[1], 20, -1);
  fx.shake(0.9);
  G.hitstop = 0.09;
  sound.drum(0.7, 110, 0.6);
  sound.tear(0.5);
  if (res === "ko") lose();
}
function stagger() {
  const c = headC();
  inkBurst(c[0], c[1], 40, 0, 1.3);
  scraps(c[0], c[1], 16, 0);
  ring(c[0], c[1], 90);
  B.scars.length = 0;
  B.state = "rest";
  B.t = -1.7;
  B.restFor = 0.9;
  B.rx = K.clamp(B.hx - 60, 640, 1400);
  B.ry = GY - 100;
  B.stagCd = 7;
  B.sh.length = 0;
  say("INKED", c[0] - 120, c[1] - 160, true);
  stat("stagger");
  slowFor(0.4, 0.3);
  G.punch = 0.8;
  sound.drum(1, 76, 1.8);
  sound.tear(0.6);
  hint("stag", "It is <b>inked</b> &mdash; strike the head");
}
function bossUpdate(dt, t) {
  B.t += dt;
  B.clock += dt;
  B.stagCd -= dt;
  B.kvx += (-B.kx * 190 - B.kvx * 17) * dt;
  B.kx += B.kvx * dt;
  B.kvy += (-B.ky * 190 - B.kvy * 17) * dt;
  B.ky += B.kvy * dt;
  const ph = B.hp > 60 ? 1 : B.hp > 25 ? 2 : 3;
  const fast = ph === 1 ? 1 : ph === 2 ? 0.82 : 0.68;
  const s = sumiS();
  const jawTo = (v, r = 6) => (B.jaw += (v - B.jaw) * Math.min(1, dt * r));
  const hover = (next) => {
    B.state = "hover";
    B.t = 0;
    B.next = next;
    B.hitDone = false;
    B.doubled = false;
  };
  switch (B.state) {
    case "rise": {
      const k = K.ease.out3(K.clamp(B.t / 1.4));
      B.hx = K.lerp(1660, 1380, k);
      B.hy = K.lerp(1380, 400, k);
      aim(s[0], s[1], 3, dt);
      jawTo(0.2 + 0.6 * K.ss(0.9, 1.4, B.t));
      break;
    }
    case "hover": {
      goTo(1390 + 70 * Math.sin(t * 0.9), 400 + 46 * Math.sin(t * 1.4), 2.4, dt);
      aim(s[0], s[1], 4, dt);
      jawTo(0.24 + 0.1 * Math.sin(t * 3), 5);
      if (G.mode === "fight" && B.t > B.next) {
        const r = R();
        let pick = ph === 1 ? (r < 0.6 ? "bite" : "wipe") : r < 0.36 ? "bite" : r < 0.58 ? "wipe" : r < 0.79 ? "breath" : "shards";
        if (pick === B.last && pick !== "bite") pick = "bite";
        B.last = pick;
        B.t = 0;
        B.hitDone = false;
        const c = headC();
        if (pick === "bite") {
          B.state = "biteTell";
          B.sx = B.hx;
          B.sy = B.hy;
          B.tell = 0.62 * fast;
          hint("bite", "Block <b>late</b> to parry &mdash; <b>S</b>");
        } else if (pick === "wipe") {
          B.state = "wipeTell";
          sound.whoosh(0.3, 0.8);
          ring(c[0], c[1], 80, false);
          hint("wipe", "Jump the wipe &mdash; <b>W</b>");
        } else if (pick === "breath") {
          B.state = "breathTell";
          B.g0 = K.clamp(s[0] + 560, 300, 1380);
          B.g1 = s[0] - 480;
          hint("breath", "Dash through it &mdash; <b>Space</b>");
        } else {
          B.state = "shardTell";
          ring(c[0], c[1], 80, false);
          sound.whoosh(0.35, 0.6);
          hint("shards", "Watch the marks on the ground");
        }
      }
      break;
    }
    case "biteTell": {
      goTo(B.sx + 130, B.sy - 90, 6, dt);
      jawTo(1, 8);
      aim(s[0], GY - 60, 6, dt);
      if (B.t > B.tell) {
        B.state = "bite";
        B.t = 0;
        B.ox = B.hx;
        B.oy = B.hy;
        B.tx = K.clamp(s[0], 240, 1520);
        B.ty = GY - 40;
        const dx = B.tx - B.hx,
          dy = B.ty - B.hy,
          l = Math.hypot(dx, dy) || 1;
        B.dir = [dx / l, dy / l];
        B.ex = B.tx - B.dir[0] * HS * 0.86;
        B.ey = Math.min(GY - 74, B.ty - B.dir[1] * HS * 0.86);
        sound.whoosh(0.45, 0.2);
      }
      break;
    }
    case "bite": {
      const k = K.clamp(B.t / 0.15);
      B.hx = K.lerp(B.ox, B.ex, k * k);
      B.hy = K.lerp(B.oy, B.ey, k * k);
      if (k >= 1) {
        eraseAt(B.tx, GY - 120, 200);
        eraseAt(B.tx - 120, GY - 200, 130, 0.8);
        fx.shake(1.1);
        fx.dust((B.tx - 960) / SC, GROUND, 2);
        scraps(B.tx, GY - 30, 8, -0.3);
        sound.drum(1, 86, 1.4);
        sound.tear(0.5);
        B.jaw = 0.05;
        B.state = "rest";
        B.t = 0;
        B.rx = B.ex;
        B.ry = B.ey;
        B.restFor = ph === 1 ? 1.25 : ph === 2 ? 1.0 : 0.6;
        if (Math.abs(s[0] - B.tx) < 128 && F.y * SC > -170) hitSumi({ dmg: 16, power: 520, launch: true }, B.tx + 80, "bite");
      }
      break;
    }
    case "rest": {
      goTo(B.rx, B.ry, 12, dt);
      jawTo(B.t < 0 ? 0.6 + 0.1 * Math.sin(t * 20) : 0.14);
      if (B.t > B.restFor) {
        if (ph === 3 && !B.doubled && G.mode === "fight") {
          // cornered, it bites twice
          B.doubled = true;
          B.state = "biteTell";
          B.t = 0;
          B.sx = B.hx + 60;
          B.sy = B.hy - 200;
          B.tell = 0.36;
        } else hover((1.0 + R() * 1.0) * fast);
      }
      break;
    }
    case "wipeTell": {
      goTo(1560, 250, 5, dt);
      aim(1000, GY, 3, dt);
      jawTo(1, 7);
      if (B.t > 0.85 * fast + 0.1) {
        B.state = "wipe";
        B.t = 0;
        B.wipeX = 1990;
        sound.whoosh(0.6, 0.7);
        sound.tear(0.6);
      }
      break;
    }
    case "wipe": {
      B.wipeX = 1990 - 2160 * K.clamp(B.t / 0.9);
      eraseRight(B.wipeX, GY - 200, GY + 20, 13, 0.5);
      if (!B.hitDone && s[0] > B.wipeX - 20) {
        B.hitDone = true;
        if (F.y * SC > -112) hitSumi({ dmg: 13, power: 600, launch: true }, s[0] + 200, "wipe");
        else {
          say("CLEAN", s[0], s[1] - 300);
          stat("jumped");
          G.ink = Math.min(100, G.ink + 12);
        }
      }
      goTo(1500, 300, 3, dt);
      jawTo(0.5);
      if (B.t > 0.9) hover((0.8 + R()) * fast);
      break;
    }
    case "breathTell": {
      goTo(1240, 270, 5, dt);
      aim(B.g0, GY, 5, dt);
      jawTo(1, 8);
      if (B.t > 0.6 * fast + 0.08) {
        B.state = "breath";
        B.t = 0;
        sound.whoosh(0.5, 1.2);
      }
      break;
    }
    case "breath": {
      const k = K.clamp(B.t / 1.2);
      B.gx = K.lerp(B.g0, B.g1, k);
      aim(B.gx, GY, 12, dt);
      goTo(1240, 270, 3, dt);
      eraseAt(B.gx, GY - 70, 100, 0.6);
      if (R() < 0.5) scraps(B.gx, GY - 20, 1, 0);
      if (!B.hitDone && Math.abs(s[0] - B.gx) < 78) {
        if (F.inv > 0) {
          if (F.state === "dash") {
            B.hitDone = true;
            say("THROUGH", s[0], s[1] - 260);
            stat("through");
            G.ink = Math.min(100, G.ink + 12);
          }
        } else {
          B.hitDone = true;
          hitSumi({ dmg: 11, power: 420 }, B.gx + 120, "breath");
        }
      }
      if (k >= 1) hover((0.8 + R()) * fast);
      break;
    }
    case "shardTell": {
      goTo(1500, 230, 5, dt);
      aim(900, GY, 3, dt);
      jawTo(1, 8);
      if (B.t > 0.55) {
        B.state = "shards";
        B.t = 0;
        const n = ph === 3 ? 7 : 5,
          rev = R() < 0.5;
        B.sh = [];
        for (let i = 0; i < n; i++) B.sh.push({ x: K.clamp(s[0] + (i - (n - 1) / 2) * 185 + (R() - 0.5) * 70, 150, 1530), t0: B.clock + (rev ? n - 1 - i : i) * 0.2, done: false, tilt: (R() - 0.5) * 0.3 });
        B.shEnd = n * 0.2 + 1.0;
      }
      break;
    }
    case "shards": {
      goTo(1500, 250, 3, dt);
      aim(s[0], s[1], 3, dt);
      jawTo(0.6);
      if (B.t > B.shEnd) hover((0.7 + R()) * fast);
      break;
    }
    case "stun": {
      goTo(1150, GY - 104, 2.4, dt);
      aim(700, GY - 60, 2, dt);
      jawTo(0.7 + 0.1 * Math.sin(t * 3), 3);
      break;
    }
    case "last": {
      // while she gathers the ink it rears for one more lunge: the film's last frame before the cut
      goTo(1250, 602, 3.6, dt);
      aim(260, 590, 5, dt);
      jawTo(1, 5);
      break;
    }
  }
  // paper shards keep falling whatever the head is doing
  for (const sh of B.sh) {
    const tau = B.clock - sh.t0;
    if (!sh.done && tau >= 0.78) {
      sh.done = true;
      eraseAt(sh.x, GY - 70, 120);
      scraps(sh.x, GY - 16, 6, 0);
      fx.dust((sh.x - 960) / SC, GROUND, 1.2);
      fx.shake(0.45);
      sound.drum(0.5, 130, 0.35);
      if (Math.abs(s[0] - sh.x) < 74 && F.y * SC > -240) hitSumi({ dmg: 9, power: 380 }, sh.x + (s[0] < sh.x ? 80 : -80), "shard");
    }
  }
  B.sh = B.sh.filter((sh) => B.clock - sh.t0 < 2.4);
  if (B.state !== "hidden") B.P = K.path(bossSpine(t), 9);
}
function bossSpine(t) {
  const h = [B.hx + B.kx, B.hy + B.ky],
    d = B.dir,
    base = [1800, 1270];
  return [
    h,
    [h[0] - d[0] * 120, h[1] - d[1] * 120],
    [K.lerp(h[0], base[0], 0.42) + 60 + 60 * Math.sin(t * 1.1), K.lerp(h[1], base[1], 0.26) - 100 + 24 * Math.sin(t * 1.7)],
    [K.lerp(h[0], base[0], 0.74) + 100 + 30 * Math.sin(t * 0.9 + 1), K.lerp(h[1], base[1], 0.6)],
    [base[0] + 50, base[1] - 180],
    base,
  ];
}
/* which part of the Blank a segment a-b touches */
function touchBoss(a, b, pad = 0) {
  const dist = (c) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l2 = dx * dx + dy * dy || 1e-6;
    const u = K.clamp(((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / l2);
    return Math.hypot(c[0] - (a[0] + dx * u), c[1] - (a[1] + dy * u));
  };
  const hc = headC();
  if (dist(hc) < HS * 0.46 + pad) return { part: "head", at: hc };
  if (B.P)
    for (const u of [0.1, 0.17, 0.24, 0.31, 0.38, 0.45]) {
      const p = K.at(B.P, u);
      if (dist([p.x, p.y]) < 66 + pad) return { part: "neck", at: [p.x, p.y], u };
    }
  return null;
}
function damageBoss(dmg, hit, ang, heavy) {
  const open = B.state === "rest";
  const mult = (hit.part === "head" ? 1 : 0.5) * (open ? 1.5 : 1) * (B.scars.length >= 2 ? 1.15 : 1);
  B.hp = Math.max(0, B.hp - dmg * mult);
  B.kvx += heavy ? 520 : 300;
  B.kvy -= 120;
  const at = hit.at;
  // the stroke stays on it as a scar, until it cleans itself
  const sc = { ang, born: G.t, seed: Math.floor(R() * 999), len: heavy ? 190 : 120, w: heavy ? 40 : 26 };
  if (hit.part === "head") {
    const h = [B.hx + B.kx, B.hy + B.ky],
      d = B.dir,
      n = [-d[1], d[0]];
    sc.head = true;
    sc.fx = K.clamp(0.2 + R() * 0.5, 0.15, 0.8);
    sc.fy = (R() - 0.5) * 0.34;
    void h;
    void n;
  } else sc.u = hit.u;
  B.scars.push(sc);
  if (B.scars.length > 6) B.scars.shift();
  scraps(at[0], at[1], heavy ? 12 : 5, 0.6);
  K.spatter(wg, K.path([[at[0] - Math.cos(ang) * 80, at[1] - Math.sin(ang) * 80], at], 6), { n: heavy ? 34 : 16, reach: heavy ? 330 : 200, big: heavy ? 13 : 8, seed: Math.floor(G.t * 60), fwd: 0.5 });
  inkBurst(at[0], at[1], heavy ? 16 : 8, 1);
  G.hitstop = heavy ? 0.12 : 0.07;
  fx.shake(heavy ? 0.9 : 0.45);
  if (heavy) {
    G.invert = 0.07;
    G.punch = Math.max(G.punch, 0.6);
  }
  sound.drum(heavy ? 0.9 : 0.55, heavy ? 84 : 112, heavy ? 0.9 : 0.45);
  sound.blade(open ? 0.35 : 0.2);
  G.combo++;
  G.comboT = 2.4;
  drawTally(G.combo);
  G.ink = Math.min(100, G.ink + 3);
  if (open && hit.part === "head" && !G.texts.some((x) => x.s === "OPEN" && x.life < 0.7)) say("OPEN", at[0] - 60, at[1] - 150, true);
  if (B.hp <= 0) {
    B.state = "stun";
    B.t = 0;
    B.sh.length = 0;
    setMode("stun");
    $("prompt").classList.add("on");
    $("hint").classList.remove("on");
    sound.drum(1, 70, 2.2);
    sound.pluck(293.7, 0.4, 0.2);
    slowFor(0.6, 0.35);
    return;
  }
  const fresh = B.scars.filter((s) => G.t - s.born < 4.5).length;
  if (fresh >= 4 && B.stagCd <= 0 && B.state !== "rest") stagger();
}
/* her brush on its head or neck */
function resolvePlayer() {
  const act = F.active;
  if (!act || B.state === "hidden" || B.state === "rise" || (G.mode !== "fight" && G.mode !== "stun")) return;
  const J = F.J;
  const a = act.kick ? toS(J.kF) : toS([K.lerp(J.wBase[0], J.wTip[0], 0.3), K.lerp(J.wBase[1], J.wTip[1], 0.3)]),
    b = act.kick ? toS(J.fF) : toS(J.wTip);
  const hit = touchBoss(a, b);
  if (!hit) return;
  F.hitDone = true;
  if (G.mode === "stun") return; // only the one stroke ends it
  damageBoss(act.dmg * 0.44, hit, Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, act.dmg >= 18);
}
function stepWaves(dt) {
  for (let i = G.waves.length - 1; i >= 0; i--) {
    const w = G.waves[i];
    w.life += dt;
    const px = w.x,
      py = w.y;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    if (R() < 0.7) G.parts.push({ k: "ink", x: w.x, y: w.y + (R() - 0.5) * 120, vx: -w.vx * 0.2 + (R() - 0.5) * 200, vy: (R() - 0.5) * 300, r: 2 + R() * 4, life: 0, max: 1.5 });
    const hit = G.mode === "fight" && B.state !== "hidden" ? touchBoss([px, py], [w.x, w.y], 40) : null;
    if (hit) {
      damageBoss(10, hit, Math.atan2(w.vy, w.vx) + Math.PI / 2, true);
      stat("wave");
      G.waves.splice(i, 1);
    } else if (w.life > 1.1 || w.x > W + 200 || w.y < -200) G.waves.splice(i, 1);
  }
}

// ------------------------------------------------------------------ flow
function hud() {
  $("hp1").style.width = F.hp + "%";
  $("hp2").style.width = B.hp + "%";
  $("ink1").style.width = Math.max(0, G.ink) + "%";
}
function begin() {
  sound.start();
  $("title").classList.add("hide");
  $("prompt").classList.remove("on");
  $("bossHud").classList.remove("on");
  $("hint").classList.remove("on");
  paintWorld();
  F.reset();
  fx.maxX = 470;
  bossReset();
  Object.assign(G, { charge: 0, flood: -1, slow: 1, slowT: 0, reveal: 0, ended: false, ft: 0, ink: 100, combo: 0, kActive: false, wavePend: -1, punch: 0, lastSerial: F.serial || 0, beat: 0.4, beatN: 0, hitstop: 0, shake: 0, invert: 0, stats: {}, hintT: 0 });
  G.parts.length = G.texts.length = G.rings.length = G.waves.length = G.ghosts.length = 0;
  drawTally(0);
  setMode("paint");
  $("hud").classList.add("on");
  hud();
  sound.whoosh(0.3, 1.2);
}
function lose() {
  setMode("lost");
  $("prompt").classList.remove("on");
  $("hint").classList.remove("on");
  sound.drum(1, 70, 2.4);
}
function endCard(big, tag, btn) {
  if (G.rec || G.noRender) return;
  $("big").textContent = big;
  $("tag").textContent = tag;
  $("go").textContent = btn;
  $("how").style.display = "none";
  $("title").classList.remove("hide");
  $("hud").classList.remove("on");
}
function finish() {
  setMode("finish");
  G.ft = 0;
  F.override = null;
  $("prompt").classList.remove("on");
  $("hud").classList.remove("on");
  sound.blade(1);
  sound.drum(1.25, 68, 2.8);
}
$("go").addEventListener("click", begin);

function stepParticles(dt) {
  const P = G.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.life += dt;
    if (p.k === "petal") {
      const tau = p.life;
      if (tau < 0) continue;
      const e = (1 - Math.exp(-2.4 * tau)) / 2.4;
      p.x = p.ox + p.vx * e + 150 * tau * tau + 60 * tau;
      p.y = p.oy + p.vy * e - 90 * tau + 70 * tau * tau + 26 * Math.sin(tau * 4 + i);
      if (p.y > H + 60 || p.x > W + 200) P.splice(i, 1);
      continue;
    }
    if (p.life > p.max) {
      P.splice(i, 1);
      continue;
    }
    if (p.k === "ink") {
      p.vy += 2300 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > GY + 2) P.splice(i, 1);
    } else if (p.k === "dust") {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
    } else if (p.k === "scrap") {
      if (p.y < GY - 5 || p.vy < 0) {
        p.vy += 1500 * dt;
        p.vx *= Math.pow(0.3, dt);
        p.vx += fx.wind * 0.25 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.w * dt;
        if (p.y >= GY - 5) {
          p.y = GY - 5;
          p.vy = 0;
          p.rot = Math.round(p.rot / Math.PI) * Math.PI;
        }
      }
    }
  }
  for (const tx of G.texts) tx.life += dt;
  G.texts = G.texts.filter((x) => x.life < 1.1);
  for (const r of G.rings) r.life += dt;
  G.rings = G.rings.filter((x) => x.life < 0.5);
  for (const gh of G.ghosts) gh.life += dt;
  G.ghosts = G.ghosts.filter((x) => x.life < 0.32);
}

// ------------------------------------------------------------------ drawing
let rsNow = 1;
function base(shx = 0, shy = 0) {
  const z = 1.012 + G.punch * 0.045;
  const fx0 = 960 + (sumiS()[0] - 960) * 0.4,
    fy0 = 620;
  g.setTransform(z * rsNow, 0, 0, z * rsNow, (fx0 - fx0 * z + shx) * rsNow, (fy0 - fy0 * z + shy) * rsNow);
}
function drawBoss(t) {
  if (B.state === "hidden" || B.alpha <= 0.01) return;
  const spine = B.P || bossSpine(t);
  const opt = { w: 170, jaw: B.jaw, t: K.on2(t), headS: 1.55, whisk: Math.atan2(-B.dir[1], -B.dir[0]) + 0.5, shadow: [10, 14, 18, 0.34], a: B.alpha };
  if (B.state === "cut") {
    // the cut went through its eye: two halves slide apart
    const Lb = K.blank(g, spine, Object.assign({}, opt, { noPut: true }));
    for (const up of [true, false]) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.beginPath();
      if (up) g.rect(0, 0, W * rsNow, 546 * rsNow);
      else g.rect(0, 546 * rsNow, W * rsNow, H * rsNow);
      g.clip();
      g.globalAlpha = B.alpha;
      g.shadowColor = "rgba(46,32,16,0.34)";
      g.shadowOffsetX = 14 * rsNow;
      g.shadowOffsetY = 20 * rsNow;
      g.shadowBlur = 26 * rsNow;
      g.translate((up ? -B.sep * 0.9 : B.sep * 0.5) * rsNow, (up ? -B.sep * 1.15 : B.sep * 0.95) * rsNow);
      g.drawImage(Lb.canvas, 0, 0);
      g.restore();
    }
    return;
  }
  K.blank(g, spine, opt);
  // the strokes she has left on it
  const h = [B.hx + B.kx, B.hy + B.ky],
    d = B.dir,
    n = [-d[1], d[0]];
  for (let i = B.scars.length - 1; i >= 0; i--) {
    const s = B.scars[i],
      age = G.t - s.born;
    if (age > 5) {
      B.scars.splice(i, 1);
      continue;
    }
    let p;
    if (s.head) p = [h[0] + d[0] * HS * s.fx + n[0] * HS * s.fy, h[1] + d[1] * HS * s.fx + n[1] * HS * s.fy];
    else {
      const q = K.at(B.P, s.u);
      p = [q.x, q.y];
    }
    const c = Math.cos(s.ang),
      sn = Math.sin(s.ang),
      L = s.len;
    K.stroke(g, [[p[0] - c * L * 0.5 - sn * 16, p[1] - sn * L * 0.5 + c * 16], p, [p[0] + c * L * 0.5 - sn * 12, p[1] + sn * L * 0.5 + c * 12]], { w: s.w, prof: K.prof.slash, dry: 0.3 + (age / 5) * 1.5, dryStart: 0.1, seed: s.seed, alpha: K.clamp(1.25 - (age / 5) * 1.1), step: 5, streak: 120 });
  }
}
function drawSumiBuf(t) {
  const b = sbg;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = "source-over";
  b.globalAlpha = 1;
  b.clearRect(0, 0, SBW, SBH);
  b.setTransform(SC, 0, 0, SC, SBX - F.x * SC, SBY - GROUND * SC);
  F.boil = Math.floor(t * 10);
  F.draw(b, K.INK);
  // she is ink: hurt, she runs dry
  const miss = G.mode === "finish" || G.mode === "won" ? 0 : 1 - F.hp / 100; // the last stroke paints her back too
  if (miss > 0.2) {
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = "destination-out";
    b.globalAlpha = Math.min(0.55, (miss - 0.2) * 0.7);
    b.drawImage(streak, 0, ((F.boil * 37) % 60) - 30);
    b.globalAlpha = 1;
    b.globalCompositeOperation = "source-over";
  }
}
function render(t, shx, shy) {
  rsNow = getRs();
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  // impact frames of the last stroke: ink, vermilion, paper
  if (G.mode === "finish" && G.ft < 0.2) {
    g.setTransform(rsNow, 0, 0, rsNow, 0, 0);
    const k = G.ft < 0.066 ? 0 : G.ft < 0.133 ? 1 : 2;
    g.fillStyle = k === 0 ? K.INK : k === 1 ? K.RED : K.BLANK;
    g.fillRect(-20, -20, W + 40, H + 40);
    K.ichi(g, { color: k === 0 ? K.BLANK : K.INK, w: k === 1 ? 176 : 156, dry: 0.3 });
    return;
  }
  // paper never moves; the painting on it does
  g.setTransform(rsNow, 0, 0, rsNow, 0, 0);
  g.drawImage(K.paper, 0, 0);
  base(shx, shy);
  g.drawImage(wipe, 0, 0);
  g.globalCompositeOperation = "multiply";
  if (G.reveal < 1) {
    g.save();
    g.beginPath();
    g.rect(0, 0, W * G.reveal, H);
    g.clip();
    g.drawImage(world, 0, 0);
    g.restore();
  } else g.drawImage(world, 0, 0);
  g.globalCompositeOperation = "source-over";
  if (G.flood >= 0) {
    const rr = 2700 * Math.pow(K.clamp(G.flood / 3), 1.5);
    g.save();
    g.beginPath();
    for (let x = -40; x <= W + 40; x += 24) g.lineTo(x, 545 - rr * (0.35 + 1.1 * K.fbm1(x / 300, 5, 3)) - 26 * K.n1(x / 23, 9));
    for (let x = W + 40; x >= -40; x -= 24) g.lineTo(x, 545 + rr * (0.35 + 1.1 * K.fbm1(x / 280, 15, 3)) + 26 * K.n1(x / 23, 19));
    g.closePath();
    g.clip();
    g.drawImage(colour, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.drawImage(ichiC, 0, 0);
    g.restore();
    g.globalCompositeOperation = "source-over";
  }
  // birds, until the white reaches them
  if (G.mode === "title" || G.mode === "paint" || (G.mode === "erase" && G.mt < 0.5) || G.mode === "won") {
    const t2 = K.on2(t);
    for (let i = 0; i < 7; i++) K.bird(g, 1000 + i * 66 + (i % 2) * 24 + Math.sin(t * 0.3) * 40, 250 + ((i * 37) % 90) + Math.sin(t2 * 2 + i) * 5, 12 + (i % 3) * 2, t2 * 11 + i * 1.9);
  }
  // mist drifting between the ranges, flecks on the wind
  if (G.flood < 0) {
    g.globalAlpha = 0.6;
    const m1 = (t * 14) % 1024,
      m2 = (t * 30) % 1024;
    for (let x = -1024 + m1; x < W; x += 1024) g.drawImage(mist, x, 520, 1024, 170);
    for (let x = -m2; x < W; x += 1024) g.drawImage(mist, x, 660, 1024, 150);
    g.globalAlpha = 1;
  }
  g.fillStyle = K.ink(0.55);
  for (let i = 0; i < 16; i++) {
    const sp = 70 + K.hash(i, 3) * 120;
    const x = ((((K.hash(i, 1) * 2300 - t * sp) % 2300) + 2300) % 2300) - 150,
      y = 90 + K.hash(i, 2) * 620 + 24 * Math.sin(t * 1.3 + i);
    g.beginPath();
    g.ellipse(x, y, 2 + K.hash(i, 4) * 4, 1.2 + K.hash(i, 5) * 1.6, -0.3 + Math.sin(t * 2 + i) * 0.5, 0, 7);
    g.fill();
  }
  // attacks that are made of blankness
  if (B.state === "wipeTell") {
    g.fillStyle = `rgba(249,245,234,${0.2 + 0.16 * Math.sin(B.t * 24)})`;
    g.fillRect(-40, GY - 190, W + 80, 200);
    g.strokeStyle = "rgba(210,49,28,0.5)";
    g.lineWidth = 3;
    g.setLineDash([26, 18]);
    g.beginPath();
    g.moveTo(-40, GY - 190);
    g.lineTo(W + 40, GY - 190);
    g.stroke();
    g.setLineDash([]);
  }
  if (B.state === "breath" || B.state === "breathTell") {
    const mx = B.hx + B.dir[0] * HS * 0.8,
      my = B.hy + B.dir[1] * HS * 0.8;
    const gx = B.state === "breath" ? B.gx : B.g0,
      wd = B.state === "breath" ? 86 : 10 + B.t * 30;
    g.fillStyle = B.state === "breath" ? "rgba(249,245,234,0.94)" : "rgba(249,245,234,0.4)";
    g.beginPath();
    g.moveTo(mx, my - 14);
    for (let i = 0; i <= 10; i++) g.lineTo(gx - wd + (i / 10) * wd * 2, GY + 6 - 10 * K.hash(i, Math.floor(t * 12)));
    g.lineTo(mx, my + 14);
    g.fill();
  }
  // where shards will land
  for (const sh of B.sh) {
    const tau = B.clock - sh.t0;
    if (tau >= 0 && tau < 0.78) {
      const k = tau / 0.78;
      g.fillStyle = `rgba(249,245,234,${0.3 + 0.5 * k})`;
      g.beginPath();
      g.ellipse(sh.x, GY - 2, 74 * (1.3 - 0.3 * k), 13, 0, 0, 7);
      g.fill();
      g.strokeStyle = `rgba(210,49,28,${0.25 + 0.6 * k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(sh.x, GY - 2, 74 * (1.3 - 0.3 * k), 13, 0, 0, 7);
      g.stroke();
    }
  }
  drawBoss(t);
  base(shx, shy);
  if (B.state === "wipe") {
    // the tail: a wedge of paper travelling along the ground
    const x = B.wipeX;
    g.save();
    g.shadowColor = "rgba(46,32,16,0.4)";
    g.shadowBlur = 22;
    g.shadowOffsetX = -16;
    g.shadowOffsetY = 10;
    g.fillStyle = K.BLANK;
    g.beginPath();
    g.moveTo(x - 60, GY + 10);
    g.quadraticCurveTo(x + 40, GY - 150, x + 420, GY - 214);
    g.lineTo(x + 900, GY - 190);
    g.lineTo(x + 900, GY + 20);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(96,74,46,0.3)";
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(x + 60 + i * 90, GY + 12);
      g.lineTo(x + 130 + i * 90, GY - 150 - (i > 2 ? 50 : i * 18));
      g.stroke();
    }
  }
  // shards: long folded blades of paper
  for (const sh of B.sh) {
    const tau = B.clock - sh.t0;
    if (tau < 0.6) continue;
    const k = K.clamp((tau - 0.6) / 0.18);
    const tipY = K.lerp(-260, GY + 8, k * k);
    g.save();
    g.globalAlpha = K.clamp((2.4 - tau) / 0.5);
    g.translate(sh.x, tipY);
    g.rotate(sh.tilt);
    g.shadowColor = "rgba(46,32,16,0.38)";
    g.shadowBlur = 14;
    g.shadowOffsetX = 8;
    g.shadowOffsetY = 8;
    g.fillStyle = K.BLANK;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-34, -300);
    g.lineTo(8, -360);
    g.lineTo(38, -290);
    g.closePath();
    g.fill();
    g.shadowColor = "transparent";
    g.fillStyle = "rgba(96,74,46,0.12)";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(8, -360);
    g.lineTo(38, -290);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.globalCompositeOperation = "multiply";
  g.drawImage(fg, 0, 0);
  g.globalCompositeOperation = "source-over";
  // dust
  for (const p of G.parts)
    if (p.k === "dust") {
      const k = p.life / p.max;
      g.globalAlpha = 0.5 * (1 - k);
      const s = p.s * (1 + k * 2.2);
      g.drawImage(puff, p.x - s / 2, p.y - s / 2, s, s);
    }
  g.globalAlpha = 1;
  // gathering ink: a little for a wave, everything for the last stroke
  const gather = Math.max(G.charge, G.kActive ? K.clamp((G.kHold - 0.2) / 0.35) * 0.42 : 0);
  if (gather > 0.01) {
    const tip = toS(F.J.wTip);
    g.strokeStyle = K.INK;
    g.lineCap = "round";
    const N = G.charge > 0 ? 34 : 14;
    for (let i = 0; i < N; i++) {
      const a = K.hash(i, 1) * Math.PI * 2,
        d = (G.charge > 0 ? 700 : 260) + K.hash(i, 2) * (G.charge > 0 ? 900 : 260);
      const sx = tip[0] + Math.cos(a) * d,
        sy = tip[1] + Math.sin(a) * d * 0.7;
      const q = (t * 1.8 + K.hash(i, 7)) % 1,
        q0 = Math.max(0, q - 0.22);
      const bend = (K.hash(i, 5) - 0.5) * (G.charge > 0 ? 260 : 90);
      const pt = (u) => [K.lerp(sx, tip[0], u) + bend * Math.sin(u * Math.PI), K.lerp(sy, tip[1], u) + bend * 0.6 * Math.sin(u * Math.PI)];
      const p0 = pt(q0),
        p1 = pt(q);
      g.globalAlpha = 0.75 * Math.min(1, gather * 2.4);
      g.lineWidth = (2 + K.hash(i, 8) * 7) * (0.4 + q) * (G.charge > 0 ? 1 : 0.6);
      g.beginPath();
      g.moveTo(p0[0], p0[1]);
      g.lineTo(p1[0], p1[1]);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = K.INK;
    const r = 10 + 68 * gather,
      sd = Math.floor(t * 9);
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2,
        q = r * (0.86 + 0.28 * K.n1((i % 28) * 0.7, sd));
      g.lineTo(tip[0] + Math.cos(a) * q, tip[1] + Math.sin(a) * q);
    }
    g.fill();
  }
  // afterimages of a dash: thinner ink
  for (const gh of G.ghosts) {
    g.globalAlpha = 0.34 * (1 - gh.life / 0.32);
    g.drawImage(gh.c, gh.x, GY - SBY);
  }
  g.globalAlpha = 1;
  if (!(G.mode === "lost" && G.mt > 2.2)) g.drawImage(sb, 960 + F.x * SC - SBX, GY - SBY);
  // her strokes are ink: a crescent that follows the brush
  const T = F.trail;
  if (T.length >= 3) {
    const pts = T.map((e) => toS([e[2], e[3]]));
    K.stroke(g, pts, { w: 62, prof: K.prof.slash, dry: 0.5, dryStart: 0.15, seed: 7, alpha: K.clamp(T[T.length - 1][4] * 1.4), streak: 200, step: 6 });
  }
  // ink waves
  for (const w of G.waves) {
    const l = Math.hypot(w.vx, w.vy),
      d = [w.vx / l, w.vy / l],
      n = [-d[1], d[0]];
    const grow = 0.6 + Math.min(1, w.life * 4) * 0.6;
    K.stroke(g, [[w.x + n[0] * 150 * grow - d[0] * 70, w.y + n[1] * 150 * grow - d[1] * 70], [w.x + d[0] * 30, w.y + d[1] * 30], [w.x - n[0] * 150 * grow - d[0] * 70, w.y - n[1] * 150 * grow - d[1] * 70]], { w: 66, prof: K.prof.slash, dry: 0.45, dryStart: 0.1, seed: 12 + Math.floor(t * 8), streak: 160, step: 6 });
  }
  for (const p of G.parts) {
    if (p.k === "ink") {
      g.fillStyle = K.INK;
      g.beginPath();
      g.ellipse(p.x, p.y, p.r * 1.6, p.r, Math.atan2(p.vy, p.vx), 0, 7);
      g.fill();
    } else if (p.k === "petal") {
      if (p.life < 0) continue;
      const c = K.ss(0.15, 1.0, p.life);
      K.petal(g, p.x, p.y, p.s, p.rot + p.life * p.w, `rgb(${Math.round(K.lerp(249, 240, c))},${Math.round(K.lerp(245, 160, c))},${Math.round(K.lerp(234, 182, c))})`);
    } else if (p.k === "scrap") {
      g.save();
      g.globalAlpha = K.clamp((p.max - p.life) * 3);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      const s = p.s,
        a = 0.4 + K.hash(p.sd, 1) * 0.5;
      g.fillStyle = "rgba(46,32,16,0.22)";
      g.beginPath();
      g.moveTo(-s + 4, 5);
      g.lineTo(s * a + 4, -s * 0.6 + 5);
      g.lineTo(s * 0.7 + 4, s * 0.5 + 5);
      g.fill();
      g.fillStyle = K.BLANK;
      g.beginPath();
      g.moveTo(-s, 0);
      g.lineTo(s * a, -s * 0.6);
      g.lineTo(s * 0.7, s * 0.5);
      g.fill();
      g.strokeStyle = "rgba(96,74,46,0.3)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-s, 0);
      g.lineTo(s * 0.7, s * 0.5);
      g.stroke();
      g.restore();
    }
  }
  // rings: a struck drum of ink, or the Blank's roar
  for (const r of G.rings) {
    const k = r.life / 0.5;
    g.strokeStyle = r.ink ? K.ink(0.7 * (1 - k)) : `rgba(120,96,64,${0.5 * (1 - k)})`;
    g.lineWidth = (r.ink ? 12 : 6) * (1 - k) + 1;
    g.beginPath();
    g.arc(r.x, r.y, r.r + K.ease.out3(k) * 260, 0, 7);
    g.stroke();
  }
  // words
  g.textAlign = "center";
  g.font = '600 34px "EB Garamond", Georgia, serif';
  if ("letterSpacing" in g) g.letterSpacing = "10px";
  for (const tx of G.texts) {
    const k = tx.life / 1.1;
    g.globalAlpha = K.clamp(2.2 - k * 2.2);
    const y = tx.y - K.ease.out3(k) * 60;
    g.lineWidth = 7;
    g.strokeStyle = "rgba(235,227,208,0.9)";
    g.strokeText(tx.s, tx.x, y);
    g.fillStyle = tx.red ? K.RED : K.INK;
    g.fillText(tx.s, tx.x, y);
  }
  g.globalAlpha = 1;
  g.textAlign = "left";
  if ("letterSpacing" in g) g.letterSpacing = "0px";
  // boss card
  if (G.mode === "card") {
    const k = K.ease.out3(K.clamp(G.mt / 0.22)),
      out = K.clamp((G.mt - 1.85) / 0.25);
    g.save();
    g.beginPath();
    g.rect(W * out, 0, W * k - W * out, H);
    g.clip();
    g.drawImage(cardC, 0, 0);
    g.restore();
  }
  // the tally of this combo, in ink, under her name
  if (G.combo > 1 && (G.mode === "fight" || G.mode === "stun")) {
    g.setTransform(rsNow, 0, 0, rsNow, 0, 0);
    g.globalAlpha = K.clamp(G.comboT * 2);
    g.drawImage(tallyC, 64, 186);
    g.globalAlpha = 1;
  }
  if (G.invert > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "difference";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "source-over";
  }
}

// ------------------------------------------------------------------ the loop
let last = performance.now();
const perf = { acc: 0, n: 0 };
const COST = { light1: 5, light2: 5, light3: 6, heavy: 14, kick: 4 };
function frame(now) {
  const real = Math.max(0, Math.min(0.034, (now - last) / 1000));
  last = Math.max(last, now);
  G.hitstop = Math.max(0, G.hitstop - real);
  if (G.slowT > 0) {
    G.slowT -= real;
    if (G.slowT <= 0) G.slow = 1;
  }
  const dt = G.hitstop > 0 ? 0 : real * G.slow;
  G.t += real;
  G.mt += real;
  G.invert = Math.max(0, G.invert - real);
  G.punch = Math.max(0, G.punch - real * 3.5);
  const t = G.t;
  fx.wind = -420 + 260 * Math.sin(t * 0.5) + 140 * Math.sin(t * 1.7);
  fx.dustCd -= dt;
  const fight = G.mode === "fight";
  if (G.hintT > 0) {
    G.hintT -= real;
    if (G.hintT <= 0) $("hint").classList.remove("on");
  }

  // the film's opening beats, playable
  if (G.mode === "paint") {
    G.reveal = K.ease.io3(K.clamp(G.mt / 1.5));
    if (G.mt > 2.0) {
      setMode("erase");
      sound.tear(0.6);
    }
  } else if (G.mode === "erase") {
    const k = K.clamp(G.mt / 1.3);
    eraseRight(K.lerp(2260, 1130, k * (0.5 + 0.5 * k)), -20, H + 20, 3, 1);
    if (G.mt > 1.5) {
      setMode("rise");
      B.state = "rise";
      B.t = 0;
      sound.whoosh(0.4, 1.2);
    }
  } else if (G.mode === "rise" && G.mt > 1.5) {
    setMode("card");
    B.state = "hover";
    B.t = 0;
    B.next = 2.4;
    fx.shake(1.2);
    G.punch = 1;
    const c = headC();
    ring(c[0], c[1], 100, false);
    sound.drum(1.1, 78, 2.2);
    sound.drum(0.6, 110, 1);
  } else if (G.mode === "card" && G.mt > 2.1) {
    setMode("fight");
    $("bossHud").classList.add("on");
    hint("go", "Its head is the mark. <b>J</b> strike &middot; hold <b>K</b> for an ink wave");
  }

  if (dt > 0) {
    let inp = { move: 0 };
    const live = fight || G.mode === "stun";
    if (live) inp = { move: (G.keys.right ? 1 : 0) - (G.keys.left ? 1 : 0), block: !!G.keys.block, light: !!G.press.light, heavy: false, kick: !!G.press.kick, dash: !!G.press.dash, jump: !!G.press.jump };
    if (fight) {
      // ink pays for everything
      if (inp.light && G.ink < 5 && F.state !== "attack") {
        inp.light = false;
        dry();
      }
      if (inp.kick && G.ink < 4) inp.kick = false;
      if (inp.dash && G.ink < 9) {
        inp.dash = false;
        dry();
      }
      // heavy: a wind-up you can hold. Held long enough, the stroke leaves the brush as a wave
      if (G.press.heavy && !G.kActive) {
        if (G.ink < 14) dry();
        else if (F.state === "air") inp.heavy = true;
        else if (!F.busy) {
          G.kActive = true;
          G.kHold = 0;
          G.kCue = false;
        }
      }
      if (G.kActive) {
        if (F.busy) {
          G.kActive = false;
          F.override = null;
        } else {
          G.kHold += dt;
          F.override = POSE.h1a;
          F.overrideW = 22;
          inp = { move: 0 };
          if (G.kHold >= 0.55 && !G.kCue && G.ink >= 35) {
            G.kCue = true;
            const tip = toS(F.J.wTip);
            ring(tip[0], tip[1], 10);
            sound.pluck(440, 0.25);
          }
          if (!G.keys.heavy && G.kHold >= 0.2) {
            const wave = G.kHold >= 0.55 && G.ink >= 35;
            F.override = null;
            G.kActive = false;
            F.start("heavy");
            F.step = 1;
            F.stepT = 0;
            G.lastSerial = F.serial;
            G.ink -= wave ? 35 : 14;
            G.inkWait = 0.6;
            if (wave) G.wavePend = 0.06;
          }
        }
      }
    }
    // the last stroke: hold, gather, release
    if (G.mode === "stun") {
      if (G.keys.heavy && F.state !== "ko") {
        G.charge = Math.min(1, G.charge + dt / 1.35);
        F.override = POSE.h1a;
        F.overrideW = 12;
        F.face = 1;
        B.state = "last";
        inp = { move: 0 };
        if (G.charge >= 1) finish();
      } else {
        G.charge = Math.max(0, G.charge - dt * 1.5);
        F.override = null;
        B.state = "stun";
      }
    }
    for (const k in G.press) G.kf[k] = 0.16;
    G.press = {};
    const wasDash = F.state === "dash";
    const foe = B.state === "hidden" ? { x: 9999, state: "idle" } : { x: (B.hx - 960) / SC, state: "idle" };
    F.update(dt, inp, foe, fx);
    // charge ink for what she just did
    if ((F.serial || 0) !== G.lastSerial) {
      G.lastSerial = F.serial || 0;
      if (fight) {
        G.ink = Math.max(0, G.ink - (COST[F.moveName] || 5));
        G.inkWait = 0.5;
      }
    }
    if (F.state === "dash") {
      if (!wasDash && fight) {
        G.ink = Math.max(0, G.ink - 9);
        G.inkWait = 0.5;
      }
      if (Math.floor(F.st * 60) % 3 === 0 && G.ghosts.length < 4) {
        const c = ghostC.find((c) => !G.ghosts.some((gh) => gh.c === c));
        if (c) {
          const q = c.getContext("2d");
          q.clearRect(0, 0, SBW, SBH);
          q.drawImage(sb, 0, 0);
          G.ghosts.push({ c, x: 960 + F.x * SC - SBX, life: 0 });
        }
      }
    }
    G.inkWait -= dt;
    if (G.inkWait <= 0 && !G.kActive) G.ink = Math.min(100, G.ink + dt * (F.state === "block" ? 9 : 17));
    if (G.wavePend >= 0) {
      G.wavePend -= dt;
      if (G.wavePend < 0) {
        const tip = toS(F.J.wTip),
          c = B.state === "hidden" ? [tip[0] + 800, tip[1] - 80] : headC();
        const dx = c[0] - tip[0],
          dy = c[1] - tip[1],
          l = Math.hypot(dx, dy) || 1;
        G.waves.push({ x: tip[0], y: tip[1], vx: (dx / l) * 1750, vy: (dy / l) * 1750, life: 0 });
        sound.whoosh(0.5, 0.4);
        fx.shake(0.4);
      }
    }
    if (fight) {
      // a drum under the fight: slow at first, closing in as the Blank weakens
      G.beat -= dt;
      if (G.beat <= 0) {
        const ph = B.hp > 60 ? 0 : B.hp > 25 ? 1 : 2;
        G.beat += [0.52, 0.41, 0.31][ph];
        const n = G.beatN++;
        if (n % 4 === 2) sound.drum(0.16, 190, 0.14);
        else sound.drum(n % 4 === 0 ? 0.3 : 0.17, 58, 0.5);
        if (n % 8 === 5) sound.pluck([146.8, 155.6, 196, 220, 233.1, 293.7][(n * 7 + ph) % 6], 0.16);
      }
    }
    bossUpdate(dt, t);
    resolvePlayer();
    stepWaves(dt);
    stepParticles(dt);
    G.comboT -= dt;
    if (G.comboT <= 0 && G.combo) {
      G.combo = 0;
      drawTally(0);
    }
  }

  if (G.mode === "finish") {
    const b0 = G.ft;
    G.ft += real;
    const at = (x) => b0 < x && G.ft >= x;
    if (at(0.2)) {
      wg.drawImage(ichiC, 0, 0);
      B.state = "cut";
      B.sep = 8;
      B.scars.length = 0;
      G.charge = 0;
      fx.maxX = 720;
      F.x = (1806 - 960) / SC;
      F.y = -150;
      F.vy = -60;
      F.vx = 0;
      F.state = "air";
      F.face = 1;
      fx.shake(1.7);
      G.punch = 1;
      sound.tear(0.8);
      scraps(1150, 546, 30, 0.4);
    }
    if (G.ft > 0.2) B.sep = 8 + 70 * K.ease.out3(K.clamp((G.ft - 0.2) / 1.5));
    if (at(1.75)) {
      G.flood = 0;
      for (let i = 0; i < 300; i++) {
        const u = R(),
          a = R() * Math.PI * 2,
          v = 180 + R() * 640;
        G.parts.push({ k: "petal", ox: K.lerp(1000, 1800, u) + (R() - 0.5) * 240, oy: K.lerp(590, 480, u) + (R() - 0.5) * 380, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: -R() * 0.7, s: 8 + R() * 15, rot: R() * 6, w: 3 + R() * 6, x: -99, y: -99 });
      }
      [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3, 740].forEach((f, i) => sound.pluck(f, 0.42, i * 0.42));
    }
    if (G.ft > 1.75) B.alpha = Math.max(0, 1 - (G.ft - 1.75) / 0.7);
    if (G.flood >= 0) G.flood += real;
    if (at(5.6)) {
      setMode("won");
      endCard("HITOFUDE", "You painted the world back", "Paint again");
      sound.drum(0.5, 120, 0.4);
    }
  } else if (G.mode === "won" && G.flood >= 0) G.flood += real;
  if (G.mode === "lost") {
    if (G.mt > 1.0 && G.mt < 2.6) eraseRight(K.lerp(2200, -400, K.clamp((G.mt - 1.0) / 1.4)), -20, H + 20, 5, 1);
    if (G.mt > 2.9 && !G.ended) {
      G.ended = true;
      endCard("BLANK", "The page is empty", "Paint again");
    }
  }

  G.shake = Math.max(0, G.shake - real * 3.2);
  const sh = G.shake * G.shake * 18;
  for (const k in G.kf) G.kf[k] -= real;
  if (G.noRender) return;
  drawSumiBuf(t);
  render(t, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  if (G.rec) recHUD();
  hud();
  if (real > 0 && real < 0.12) {
    perf.acc += real;
    if (++perf.n >= 90) {
      const avg = perf.acc / perf.n;
      perf.acc = perf.n = 0;
      if (avg > 0.0225 && getRs() > 0.6) setRs(Math.max(0.6, getRs() - 0.13));
    }
  }
}
function tick(now) {
  requestAnimationFrame(tick);
  if (G.auto) frame(now);
}

// ------------------------------------------------------------------ start-up
const A = {}; // art the canvas HUD reuses
function strokeURL(color) {
  return strokeC(color).toDataURL();
}
function strokeC(color) {
  const c = mk(900, 90),
    q = c.getContext("2d");
  K.stroke(q, [[20, 46], [300, 42], [600, 47], [880, 44]], { w: 46, prof: (u) => K.lerp(0.7, 1, K.ss(0, 0.04, u)) * K.lerp(1, 0.5, K.ss(0.7, 1, u)), dry: 0.6, dryStart: 0.3, seed: 5, color, streak: 260, edge: 0.14 });
  return c;
}
function glyphURL(strokes, size, color, w) {
  const c = mk(size, size);
  K.kanji(c.getContext("2d"), strokes, size * 0.04, size * 0.04, size * 0.92, { color, w, dry: 0.3, seed: 8 });
  return c.toDataURL();
}
document.fonts
  .load('500 40px "EB Garamond"')
  .catch(() => {})
  .then(() => {
    paintWorld();
    bakeStatic();
    document.querySelectorAll(".bs").forEach((el) => (el.src = strokeURL(K.RED)));
    document.querySelectorAll(".br").forEach((el) => (el.src = strokeURL(K.INK)));
    $("shiro").src = glyphURL(K.GLYPH.shiro, 150, K.INK, 0.105);
    const lc = mk(1100, 220);
    K.stroke(lc.getContext("2d"), [[70, 120], [330, 100], [600, 96], [860, 106], [1040, 118]], { w: 86, prof: (u) => K.lerp(0.62, 1, K.ss(0, 0.05, u)) * K.lerp(1, 0.34, Math.pow(K.ss(0.5, 1, u), 1.3)), dry: 0.72, dryStart: 0.4, seed: 77, streak: 340, edge: 0.12 });
    K.splat(lc.getContext("2d"), 84, 120, 130, 5, 26, { size: 0.9 });
    $("logo").src = $("pimg").src = lc.toDataURL();
    A.logo = lc;
    A.red = strokeC(K.RED);
    A.ink = strokeC(K.INK);
    A.shiro = mk(150, 150);
    K.kanji(A.shiro.getContext("2d"), K.GLYPH.shiro, 6, 6, 138, { color: K.INK, w: 0.105, dry: 0.3, seed: 8 });
    const sc = mk(200, 200);
    K.seal(sc.getContext("2d"), 100, 100, 150, 0, 1);
    $("seal").src = sc.toDataURL();
    A.seal = sc;
    requestAnimationFrame(tick);
  });

function sim(sec, each) {
  let t = last;
  for (let i = 0; i < Math.round(sec * 60); i++) {
    t += 1000 / 60;
    if (each) each(i);
    frame(t);
  }
  last = performance.now();
}
// ------------------------------------------------------------------ recording
// The HUD is HTML when you play. For a recording it is painted into the canvas, with the keys being pressed.
const KEYS = [
  ["left", "A", 0],
  ["right", "D", 1],
  ["jump", "W", 2.4],
  ["block", "S", 3.4],
  ["light", "J", 4.8],
  ["heavy", "K", 5.8],
  ["kick", "L", 6.8],
  ["dash", "SPACE", 8.2],
];
function recHUD() {
  const rs = getRs();
  g.setTransform(rs, 0, 0, rs, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.textAlign = "left";
  const live = G.mode === "fight" || G.mode === "stun";
  const bar = (img, x, y, w, h, frac, flip) => {
    g.save();
    g.translate(flip ? x + w : x, y);
    if (flip) g.scale(-1, 1);
    g.globalAlpha = 0.16;
    g.drawImage(img, 0, 0, w, h);
    g.globalAlpha = 1;
    const f = K.clamp(frac);
    if (f > 0.005) g.drawImage(img, 0, 0, 900 * f, 90, 0, 0, w * f, h);
    g.restore();
  };
  if (G.mode !== "finish" && G.mode !== "won" && G.mode !== "title") {
    K.text(g, "SUMI", 66, 64, { size: 21, track: 0.42 });
    bar(A.red, 62, 76, 300, 30, F.hp / 100);
    bar(A.ink, 62, 112, 186, 15, G.ink / 100);
    K.text(g, "INK", 66, 150, { size: 13, track: 0.42, color: K.ink(0.6) });
  }
  if (live) {
    g.drawImage(A.shiro, 1812, 32, 44, 44);
    K.text(g, "THE BLANK", 1794, 64, { size: 21, track: 0.42, align: "right" });
    bar(A.ink, 1558, 76, 300, 30, B.hp / 100, true);
  }
  if (G.hintT > 0 && live) K.text(g, G.hintText.toUpperCase(), 960, 946, { size: 23, track: 0.3, align: "center", color: K.PAPER, alpha: K.clamp(G.hintT * 4) });
  if (G.mode === "stun" && G.charge < 0.98) {
    g.globalAlpha = K.clamp(G.mt * 3);
    g.drawImage(A.logo, 960 - 280, 150, 560, 112);
    g.globalAlpha = 1;
    K.text(g, "HOLD K \u2014 ONE STROKE", 960, 300, { size: 26, track: 0.42, align: "center", alpha: K.clamp(G.mt * 3) });
  }
  if (G.mode === "paint" || G.mode === "erase") K.text(g, "EVERY FRAME OF THIS GAME IS PAINTED IN CODE", 960, 96, { size: 25, track: 0.42, align: "center", color: K.ink(0.82), chars: G.mode === "paint" ? G.mt * 46 : 99 });
  // the keys, as they are pressed
  if (live || G.mode === "card") {
    g.font = '600 19px "EB Garamond", Georgia, serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const [k, label, col] of KEYS) {
      const w = label === "SPACE" ? 104 : 42,
        x = 66 + col * 48,
        y = 1000;
      const on = G.keys[k] || G.kf[k] > 0;
      g.fillStyle = on ? K.RED : "rgba(235,227,208,0.08)";
      g.fillRect(x, y, w, 42);
      g.strokeStyle = on ? K.RED : "rgba(235,227,208,0.55)";
      g.lineWidth = 1.5;
      g.strokeRect(x + 0.75, y + 0.75, w - 1.5, 40.5);
      g.fillStyle = on ? "#fff" : "rgba(235,227,208,0.8)";
      g.fillText(label, x + w / 2, y + 22);
    }
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
  }
  if (G.mode === "won") {
    const a = K.clamp(G.mt / 0.9);
    g.fillStyle = `rgba(235,227,208,${0.86 * a})`;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = a;
    g.drawImage(A.logo, 960 - 340, 250, 680, 136);
    g.drawImage(A.seal, 1270, 330, 120, 120);
    g.globalAlpha = 1;
    K.text(g, "HITOFUDE", 960, 560, { size: 104, track: 0.6, align: "center", chars: (G.mt - 0.3) * 12 });
    K.text(g, "PAINT THE WORLD BACK", 960, 628, { size: 25, track: 0.5, align: "center", color: K.ink(0.8), chars: (G.mt - 1.0) * 40 });
    K.text(g, "PLAY IT IN YOUR BROWSER", 960, 760, { size: 22, track: 0.42, align: "center", color: K.ink(0.7), alpha: K.clamp((G.mt - 1.6) * 2) });
    K.text(g, "SHUBHU121.GITHUB.IO/HITDUDE/PLAY", 960, 806, { size: 30, track: 0.2, align: "center", color: K.RED, alpha: K.clamp((G.mt - 1.6) * 2) });
  }
}
const bot = makeBot(G, F, B, K);
function startRun(seed, botSeed) {
  G.auto = false;
  reseed(seed);
  bot.reset(botSeed);
  for (const k in G.keys) G.keys[k] = false;
  G.press = {};
  G.simT = 0;
  G.sndLog = [];
  G.seen = { go: 2, bite: 0, wipe: 0, breath: 0, shards: 0, stag: 0 };
  begin();
}
function stepRun() {
  bot.step(1 / 60);
  frame(last + 1000 / 60);
  G.simT += 1 / 60;
}
/* play many fights quickly, without drawing, and say how each went */
function search(seeds, botSeeds) {
  const out = [];
  G.noRender = true;
  for (const seed of seeds)
    for (const bs of botSeeds) {
      startRun(seed, bs);
      let n = 0;
      while (G.mode !== "won" && !(G.mode === "lost" && G.mt > 1) && n < 60 * 150) {
        stepRun();
        n++;
      }
      out.push({ seed, bs, end: G.mode, sec: +(n / 60).toFixed(1), hp: Math.round(F.hp), ...G.stats });
    }
  G.noRender = false;
  last = performance.now();
  return out;
}
function wavBlob(buf) {
  const n = buf.length,
    ch = buf.numberOfChannels;
  const ab = new ArrayBuffer(44 + n * ch * 2),
    v = new DataView(ab);
  const ws = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ws(0, "RIFF");
  v.setUint32(4, 36 + n * ch * 2, true);
  ws(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  ws(36, "data");
  v.setUint32(40, n * ch * 2, true);
  const d = [];
  for (let c = 0; c < ch; c++) d.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      v.setInt16(o, Math.max(-1, Math.min(1, d[c][i])) * 32767, true);
      o += 2;
    }
  return new Blob([ab], { type: "audio/wav" });
}
/* the same Sound class, rendered offline from the log of what the fight played and when */
async function renderAudio(log, sec) {
  const off = new OfflineAudioContext(2, Math.ceil(48000 * sec), 48000);
  const s2 = new Sound();
  s2.start(off);
  for (const [name, args, at] of log) {
    s2.fixedT = at;
    s2[name](...args);
  }
  return wavBlob(await off.startRendering());
}
const REC = { n: 0, done: false, err: "", sec: 0 };
async function post(url, body) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { method: "POST", body });
      if (r.ok) return;
      throw new Error("HTTP " + r.status);
    } catch (e) {
      if (i >= 5) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}
/* many frames in one request: each is a 4-byte length, then the JPEG */
function sendBatch(first, frames) {
  const parts = [];
  for (const f of frames) {
    const h = new Uint8Array(4);
    new DataView(h.buffer).setUint32(0, f.length, true);
    parts.push(h, f);
  }
  return post("/__rec/batch/" + first, new Blob(parts));
}
/* one fight, every frame saved: the pictures to /__rec/frame/N, the sound to /__rec/audio */
async function record(seed, botSeed, endHold = 3.4) {
  REC.n = 0;
  REC.done = false;
  REC.err = "";
  try {
    setRs(1);
    document.body.classList.add("rec");
    G.rec = true;
    startRun(seed, botSeed);
    let hold = 0,
      batch = [];
    while (true) {
      stepRun();
      // synchronous grab, posts sent in batches: a page that is not being painted answers awaits slowly
      const url = cv.toDataURL("image/jpeg", 0.95);
      const bin = Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));
      batch.push(bin);
      REC.n++;
      if (batch.length >= 24) {
        await sendBatch(REC.n - batch.length, batch);
        batch = [];
      }
      if (G.mode === "won") {
        hold += 1 / 60;
        if (hold > endHold) break;
      }
      if ((G.mode === "lost" && G.mt > 3.5) || REC.n > 60 * 170) break;
    }
    if (batch.length) await sendBatch(REC.n - batch.length, batch);
    REC.sec = G.simT;
    REC.stats = Object.assign({ end: G.mode, hp: Math.round(F.hp) }, G.stats);
    const wav = await renderAudio(G.sndLog, G.simT + 0.4);
    await post("/__rec/audio", wav);
  } catch (e) {
    REC.err = String(e && e.stack ? e.stack : e);
  }
  G.rec = false;
  REC.done = true;
}
window.__P = { G, F, B, sim, begin, finish, search, record, REC, startRun, stepRun };
