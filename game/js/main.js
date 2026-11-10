// HITOFUDE — the game. One sheet of paper on a desk; one boss; one stroke.
import * as THREE from "three";
import { buildDesk, PW, PH } from "./desk.js";
import { Paper } from "./paper.js";
import { Sumi } from "./sumi.js";
import { Blank } from "./blank.js";
import { makeLens, Petals } from "./fx.js";
import { Sound } from "./audio.js";

const K = window.K;
const $ = (id) => document.getElementById(id);
const canvas = $("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
let renderScale = Math.min(window.devicePixelRatio || 1, 1.25);
renderer.setPixelRatio(renderScale);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 20);
const refs = buildDesk(scene, renderer);
const paper = new Paper(scene);
const sumi = new Sumi(scene);
const boss = new Blank(scene);
const petals = new Petals(scene);
const lens = makeLens(renderer, scene, camera);
const sound = new Sound();

// ---------- HUD art: kanji painted by the same brush engine
function glyph(strokes, size, color, w) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  K.kanji(c.getContext("2d"), strokes, size * 0.04, size * 0.04, size * 0.92, { color, w, dry: 0.3, seed: 8 });
  return c.toDataURL();
}
$("shiro").src = glyph(K.GLYPH.shiro, 160, "#efe8d6", 0.105);
const ichiURL = (() => {
  const c = document.createElement("canvas");
  c.width = 1100;
  c.height = 220;
  const g = c.getContext("2d");
  K.stroke(g, [[70, 120], [330, 100], [600, 96], [860, 106], [1040, 118]], {
    w: 86,
    prof: (u) => K.lerp(0.62, 1, K.ss(0, 0.05, u)) * K.lerp(1, 0.34, Math.pow(K.ss(0.5, 1, u), 1.3)),
    dry: 0.72,
    dryStart: 0.4,
    seed: 77,
    streak: 340,
    edge: 0.12,
  });
  K.splat(g, 84, 120, 130, 5, 26, { size: 0.9 });
  return c.toDataURL();
})();
$("logo").src = ichiURL;
$("msgimg").src = ichiURL;
$("msgimg").style.filter = "invert(1) brightness(1.6) drop-shadow(0 4px 18px rgba(0,0,0,.7))";

// ---------- state
const G = {
  mode: "title", // title | fight | finish | won | lost
  t: 0,
  frame: 0,
  shake: 0,
  segs: [],
  painting: false,
  hitCd: 0,
  cur: { len: 0, near: 9 },
  ft: 0,
  camT: 0,
  pointer: new THREE.Vector2(0, 0),
  hasPointer: false,
  target: new THREE.Vector3(-0.45, 0, 0.18),
  keys: {},
  down: false,
  regenWait: 0,
  slow: 1,
};
const CAM = {
  title: { p: new THREE.Vector3(-0.95, 0.34, 1.0), l: new THREE.Vector3(0.05, 0.03, -0.05) },
  play: { p: new THREE.Vector3(0, 1.36, 1.2), l: new THREE.Vector3(0, 0, 0.07) },
  end: { p: new THREE.Vector3(0, 1.62, 0.5), l: new THREE.Vector3(0, 0, 0.0) },
};
const camP = CAM.title.p.clone(),
  camL = CAM.title.l.clone();
let camFrom = null,
  camTo = null,
  camDur = 1;
function glide(to, dur) {
  camFrom = { p: camP.clone(), l: camL.clone() };
  camTo = to;
  camDur = dur;
  G.camT = 0;
}

function show(id, on) {
  $(id).style.opacity = on ? 1 : 0;
}
function message(text, withStroke) {
  $("msgtxt").textContent = text || "";
  $("msgimg").style.display = withStroke ? "block" : "none";
  show("msg", !!text);
}
function flash(seq) {
  const el = $("flash");
  let i = 0;
  const step = () => {
    if (i >= seq.length) {
      el.style.opacity = 0;
      return;
    }
    el.style.background = seq[i][0];
    el.style.opacity = 1;
    setTimeout(step, seq[i][1]);
    i++;
  };
  step();
}

function start() {
  sound.start();
  if (!paper.clean) paper.paintWorld();
  sumi.reset();
  boss.reset();
  petals.clear();
  G.segs.length = 0;
  G.mode = "fight";
  G.t = 0;
  G.shake = 0;
  G.slow = 1;
  G.target.set(sumi.x, 0, sumi.z);
  $("title").classList.add("hide");
  show("boss", 1);
  show("me", 1);
  show("hint", 1);
  message("");
  setTimeout(() => show("hint", 0), 9000);
  glide(CAM.play, 1.8);
  sound.drum(0.9, 80, 2);
  sound.pluck(146.8, 0.4, 0.5);
  sound.pluck(155.6, 0.35, 1.1);
}
$("go").addEventListener("click", start);

// ---------- input
const ray = new THREE.Raycaster(),
  ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hitP = new THREE.Vector3();
function setPointer(e) {
  G.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  G.hasPointer = true;
}
canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerdown", (e) => {
  setPointer(e);
  if (e.button === 0) G.down = true;
  if (e.button === 2) G.keys.dash = true;
});
window.addEventListener("pointerup", (e) => {
  if (e.button === 0) G.down = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  G.keys[e.code] = true;
  if (e.code === "Space") {
    G.keys.dash = true;
    e.preventDefault();
  }
  if (e.code === "Enter" && (G.mode === "title" || G.mode === "won" || G.mode === "lost")) start();
});
window.addEventListener("keyup", (e) => (G.keys[e.code] = false));
window.addEventListener("resize", () => {
  resize();
});
function resize() {
  renderer.setPixelRatio(renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  lens.setSize(s.x, s.y);
}
// hold the frame rate: trade resolution for speed on slow GPUs
const perf = { acc: 0, n: 0, cool: 0 };
function adapt(real) {
  if (real > 0.12) return; // a hidden or throttled tab says nothing about the GPU
  perf.acc += real;
  perf.n++;
  if (perf.n < 40) return;
  const avg = perf.acc / perf.n;
  perf.acc = perf.n = 0;
  const max = Math.min(window.devicePixelRatio || 1, 1.25);
  let s = renderScale;
  if (avg > 0.0215) s = Math.max(0.5, s * (avg > 0.034 ? 0.8 : 0.9));
  else if (avg < 0.0172 && perf.cool-- <= 0) s = Math.min(max, s * 1.06);
  if (Math.abs(s - renderScale) > 0.004) {
    if (s < renderScale) perf.cool = 6;
    renderScale = s;
    resize();
  }
}

// ---------- helpers
function distSeg(px, pz, s) {
  const dx = s.x1 - s.x0,
    dz = s.z1 - s.z0;
  const l2 = dx * dx + dz * dz || 1e-9;
  const u = K.clamp(((px - s.x0) * dx + (pz - s.z0) * dz) / l2);
  return Math.hypot(px - (s.x0 + dx * u), pz - (s.z0 + dz * u));
}
function hurtPlayer(fromX, fromZ) {
  if (sumi.inv > 0 || G.mode !== "fight") return;
  sumi.hp--;
  sumi.inv = 1.2;
  sumi.hurtT = 0.4;
  sumi.fade = 0.3 + 0.7 * (sumi.hp / 5);
  const a = Math.atan2(sumi.z - fromZ, sumi.x - fromX);
  sumi.x += Math.cos(a) * 0.09;
  sumi.z += Math.sin(a) * 0.09;
  G.target.set(sumi.x, 0, sumi.z);
  G.shake = Math.max(G.shake, 0.7);
  sound.drum(0.6, 130, 0.5);
  sound.tear(0.5);
  [...$("life").children].forEach((el, i) => el.classList.toggle("off", i >= sumi.hp));
  if (sumi.hp <= 0) lose();
}
function lose() {
  G.mode = "lost";
  sound.setBrush(0);
  $("title").querySelector("h1").textContent = "BLANK";
  $("tag").textContent = "The page is empty";
  $("go").textContent = "Paint again";
  $("how").style.display = "none";
  setTimeout(() => $("title").classList.remove("hide"), 900);
  show("boss", 0);
  show("me", 0);
  message("");
}
function finish() {
  G.mode = "finish";
  G.ft = 0;
  G.slow = 0.25;
  sound.setBrush(0);
  sound.blade(1);
  sound.drum(1.2, 70, 2.6);
  flash([
    ["#0b0907", 70],
    ["#d2311c", 70],
    ["#f6f1e4", 70],
  ]);
  message("");
  show("boss", 0);
  show("me", 0);
  G.shake = 1.6;
}

// ---------- the player
const tmp = new THREE.Vector3();
function updatePlayer(dt) {
  const s = sumi;
  s.inv = Math.max(0, s.inv - dt);
  s.hurtT = Math.max(0, s.hurtT - dt);
  s.dashCd = Math.max(0, s.dashCd - dt);
  // where she wants to go
  let mx = 0,
    mz = 0;
  if (G.keys.KeyW || G.keys.ArrowUp) mz -= 1;
  if (G.keys.KeyS || G.keys.ArrowDown) mz += 1;
  if (G.keys.KeyA || G.keys.ArrowLeft) mx -= 1;
  if (G.keys.KeyD || G.keys.ArrowRight) mx += 1;
  const keyMove = mx || mz;
  if (keyMove) {
    const l = Math.hypot(mx, mz);
    G.target.set(s.x + (mx / l) * 0.3, 0, s.z + (mz / l) * 0.3);
    G.hasPointer = false;
  } else if (G.hasPointer) {
    ray.setFromCamera(G.pointer, camera);
    if (ray.ray.intersectPlane(ground, hitP)) G.target.copy(hitP);
  }
  G.target.x = K.clamp(G.target.x, -PW / 2 + 0.03, PW / 2 - 0.03);
  G.target.z = K.clamp(G.target.z, -PH / 2 + 0.05, PH / 2 - 0.02);
  const dx = G.target.x - s.x,
    dz = G.target.z - s.z,
    d = Math.hypot(dx, dz);
  // paint?
  const wantPaint = (G.down || G.keys.KeyJ || G.keys.ShiftLeft) && s.hurtT <= 0;
  if (wantPaint && !G.painting && s.ink > 0.08) {
    G.painting = true;
    G.cur = { len: 0, near: 9 };
    paper.splat(s.x, s.z, 0.03, G.frame, 7);
  }
  if (G.painting && (!wantPaint || s.ink <= 0)) G.painting = false;
  // dash
  if (G.keys.dash && s.dashCd <= 0 && d > 0.02 && s.hurtT <= 0) {
    s.dashT = 0.16;
    s.dashCd = 0.75;
    s.inv = Math.max(s.inv, 0.32);
    s.dvx = dx / d;
    s.dvz = dz / d;
    sound.whoosh(0.3, 0.22);
  }
  G.keys.dash = false;
  let speed = G.painting ? 0.82 : 0.52;
  const ox = s.x,
    oz = s.z;
  if (s.dashT > 0) {
    s.dashT -= dt;
    s.x += s.dvx * 2.3 * dt;
    s.z += s.dvz * 2.3 * dt;
  } else if (d > 0.012 && s.hurtT <= 0) {
    const st = Math.min(d, speed * dt);
    s.x += (dx / d) * st;
    s.z += (dz / d) * st;
  }
  s.x = K.clamp(s.x, -PW / 2 + 0.03, PW / 2 - 0.03);
  s.z = K.clamp(s.z, -PH / 2 + 0.05, PH / 2 - 0.02);
  const moved = Math.hypot(s.x - ox, s.z - oz);
  if (Math.abs(s.x - ox) > 0.0008) s.face = s.x > ox ? 1 : -1;
  s.phase += moved * 46;
  s.moving = moved > 0.0004;
  // ink
  if (G.painting) {
    if (moved > 0) {
      paper.strokeSeg(ox, oz, s.x, s.z, 0.03, K.clamp(s.ink * 1.6));
      G.segs.push({ x0: ox, z0: oz, x1: s.x, z1: s.z, t: G.t, hit: false });
      G.cur.len += moved;
    }
    s.ink = Math.max(0, s.ink - dt * 0.3);
    G.regenWait = 0.45;
  } else {
    G.regenWait -= dt;
    if (G.regenWait <= 0) s.ink = Math.min(1, s.ink + dt * 0.55);
  }
  sound.setBrush(G.painting && s.moving ? 1 : 0);
  $("inkfill").style.width = (s.ink * 100).toFixed(1) + "%";
}

function fight(dt) {
  const ev = [];
  boss.update(dt, G.t, sumi, ev);
  for (const e of ev) {
    if (e.type === "slam") {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2,
          r = 0.1 + 0.05 * K.hash(i, G.frame);
        paper.erase(e.x + Math.cos(a) * r, e.z + Math.sin(a) * r * 0.9, 0.085, 0.9);
      }
      paper.erase(e.x, e.z, 0.13, 1);
      G.shake = Math.max(G.shake, 1.1);
      sound.drum(1, 86, 1.6);
      sound.tear(0.5);
      if (Math.hypot(sumi.x - e.x, sumi.z - e.z) < 0.17) hurtPlayer(e.x, e.z);
    } else if (e.type === "telegraph") {
      for (let x = -PW / 2; x <= PW / 2; x += 0.035) paper.erase(x, e.z + 0.006 * Math.sin(x * 40), 0.028, 0.28);
      sound.whoosh(0.35, 0.9);
    } else if (e.type === "charge") sound.whoosh(0.5, 0.5);
    else if (e.type === "rise") sound.whoosh(0.25, 0.6);
  }
  // its body un-paints what it touches
  const R = boss.rings;
  for (let i = 0; i < R.length; i += 3) {
    const r = R[i];
    if (r.y < 0.075 && r.a > 0.006) paper.erase(r.x, r.z, r.a * 1.5, 0.34);
  }
  if (boss.hy < 0.09) paper.erase(boss.hx, boss.hz, 0.07, 0.4);
  // wet ink bites it
  G.hitCd -= dt;
  const stunned = boss.state === "stun";
  for (let n = G.segs.length - 1; n >= 0; n--) {
    const s = G.segs[n];
    if (G.t - s.t > 2.3) {
      G.segs.splice(n, 1);
      continue;
    }
    if (s.hit) continue;
    const hd = distSeg(boss.hx, boss.hz, s);
    if (stunned) {
      if (G.painting && n === G.segs.length - 1) G.cur.near = Math.min(G.cur.near, hd);
      continue;
    }
    if (boss.vulnerable && hd < 0.066) {
      s.hit = true;
      if (G.hitCd <= 0) {
        boss.hurt(boss.state === "stuck" ? 8.5 : 6);
        G.hitCd = 0.09;
        paper.splat(boss.hx, boss.hz, 0.09, G.frame, 12);
        G.shake = Math.max(G.shake, 0.35);
        sound.blade(0.35);
        if (boss.state === "stun") onStun();
      }
      continue;
    }
    for (let i = 6; i < R.length; i += 4) {
      const r = R[i];
      if (r.y < 0.075 && distSeg(r.x, r.z, s) < r.a + 0.012) {
        s.hit = true;
        boss.hurt(0.8);
        if (boss.state === "stun") onStun();
        break;
      }
    }
  }
  $("bossfill").style.width = boss.hp + "%";
  // it hurts her
  if (!stunned && sumi.inv <= 0) {
    if (boss.hy < 0.09 && boss.state !== "stuck" && Math.hypot(sumi.x - boss.hx, sumi.z - boss.hz) < 0.075) hurtPlayer(boss.hx, boss.hz);
    else
      for (let i = 2; i < R.length; i += 2) {
        const r = R[i];
        if (r.y < 0.08 && r.a > 0.01 && Math.hypot(sumi.x - r.x, sumi.z - r.z) < r.a * 0.85 + 0.016) {
          hurtPlayer(r.x, r.z);
          break;
        }
      }
  }
  // the last stroke
  if (stunned && G.painting && G.cur.len > 0.3 && G.cur.near < 0.09) finish();
}
function onStun() {
  message("One stroke. Cut across it.", true);
  sound.drum(1, 70, 2.2);
  sound.pluck(293.7, 0.4, 0.2);
  G.slow = 0.5;
  setTimeout(() => (G.slow = 1), 700);
}

function finishSeq(dt) {
  const before = G.ft;
  G.ft += dt / Math.max(G.slow, 0.001); // real time
  const at = (x) => before < x && G.ft >= x;
  if (at(0.22)) {
    paper.paintIchi();
    boss.explode(petals);
    G.shake = 1.4;
    sound.tear(0.8);
    sumi.x = PW / 2 - 0.12;
    sumi.z = 0.02;
    sumi.face = 1;
    sumi.fade = 1;
  }
  if (at(0.5)) G.slow = 1;
  if (at(1.1)) {
    paper.startFlood();
    glide(CAM.end, 5.5);
    [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3, 740].forEach((f, i) => sound.pluck(f, 0.42, i * 0.42));
  }
  if (at(5.2)) {
    G.mode = "won";
    $("title").querySelector("h1").textContent = "HITOFUDE";
    $("tag").textContent = "You painted the world back";
    $("go").textContent = "Paint again";
    $("how").style.display = "none";
    $("title").classList.remove("hide");
    sound.drum(0.5, 120, 0.4);
    sound.pluck(146.8, 0.5, 0.3);
  }
}

// ---------- the loop
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  if (G.auto !== false) frame(now);
}
function frame(now) {
  const real = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = Math.max(last, now);
  const dt = real * G.slow;
  G.t += dt;
  G.frame++;

  if (G.mode === "fight") {
    updatePlayer(dt);
    fight(dt);
  } else if (G.mode === "finish") finishSeq(dt);
  else sound.setBrush(0);

  // Sumi's drawing, on twos
  const f12 = Math.floor(G.t * 12);
  if (f12 !== sumi.lastDraw) {
    sumi.lastDraw = f12;
    let pose,
      gust = 0.55,
      wind = sumi.face > 0 ? Math.PI : 0;
    if (G.mode === "finish" || G.mode === "won") pose = G.ft < 1.6 ? K.POSE.through : K.POSE.rest;
    else if (sumi.hurtT > 0) pose = Object.assign({}, K.POSE.fall, { rot: -30 });
    else if (sumi.dashT > 0) pose = K.POSE.cut;
    else if (sumi.moving) {
      pose = K.runPose(sumi.phase);
      if (G.painting) pose = Object.assign({}, pose, { br: 140, aF: [20, 30] });
      gust = 1;
    } else pose = G.mode === "fight" ? K.POSE.ready : K.POSE.stand;
    const blink = sumi.inv > 0 && G.mode === "fight" && f12 % 2 === 0;
    sumi.mesh.visible = !blink && !(G.mode === "lost");
    sumi.draw(pose, f12 / 12, wind + 0.1 * Math.sin(G.t * 2), gust);
  }
  sumi.place();
  petals.update(real, now / 1000);
  paper.update(real, G.frame);

  // camera
  if (camTo) {
    G.camT += real / camDur;
    const k = K.ease.io3(K.clamp(G.camT));
    camP.lerpVectors(camFrom.p, camTo.p, k);
    camL.lerpVectors(camFrom.l, camTo.l, k);
    if (G.camT >= 1) camTo = null;
  } else if (G.mode === "title") {
    const a = now / 9000;
    camP.set(-0.95 + 0.12 * Math.sin(a), 0.34 + 0.03 * Math.sin(a * 1.7), 1.0 + 0.08 * Math.cos(a));
  }
  G.shake = Math.max(0, G.shake - real * 2.6);
  const sh = G.shake * G.shake * 0.02;
  camera.position.copy(camP).add(tmp.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
  const follow = G.mode === "fight" ? 0.12 : 0;
  camera.lookAt(camL.x + sumi.x * follow, camL.y, camL.z + sumi.z * follow);
  // keep the whole sheet in frame on narrow windows
  const aspect = window.innerWidth / window.innerHeight;
  const fov = Math.max(34, (2 * Math.atan(Math.tan((62 * Math.PI) / 360) / aspect) * 180) / Math.PI);
  if (Math.abs(camera.fov - fov) > 0.01 || camera.aspect !== aspect) {
    camera.fov = fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  // focus: on her while she fights, on the sheet otherwise
  const fp = G.mode === "fight" ? tmp.set(sumi.x, 0.04, sumi.z) : tmp.set(camL.x, 0, camL.z);
  const fd = camera.position.distanceTo(fp);
  lens.uniforms.focus.value += (fd - lens.uniforms.focus.value) * Math.min(1, real * 5);
  lens.uniforms.aperture.value = G.mode === "title" ? 0.05 : G.mode === "won" ? 0.014 : 0.026;
  lens.uniforms.time.value = now / 1000;
  refs.glow.emissiveIntensity = 2.6 + 0.2 * Math.sin(now / 130) + 0.12 * Math.sin(now / 47);
  lens.render();
  adapt(real);
}

sumi.draw(K.POSE.stand, 0, Math.PI, 0.5);
sumi.place();
requestAnimationFrame(tick);
// test hook: run the game forward on a fake 60 Hz clock
function sim(sec, each) {
  let t = last;
  for (let i = 0; i < Math.round(sec * 60); i++) {
    t += 1000 / 60;
    if (each) each(i);
    frame(t);
  }
  last = performance.now();
}
window.__G = { G, sumi, boss, paper, camera, start, finish, hurtPlayer, lens, renderer, scene, refs, sim, get scale() { return renderScale; } };
