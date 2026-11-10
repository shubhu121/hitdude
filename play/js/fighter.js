// Fighters: a spring-driven skeleton, cloth on verlet chains, and a ragdoll for the knockout.
const K = window.K;
const D = Math.PI / 180;
export const GROUND = 706;
const S = 1.14; // overall size
const LEN = { thigh: 62 * S, shin: 66 * S, torso: 80 * S, neck: 11 * S, head: 19 * S, uarm: 40 * S, farm: 38 * S };
const GRAV = 2700;

/* Poses, in degrees. 0 = straight down, + = toward the opponent.
   aF/aB = [shoulder, elbow], lF/lB = [hip, knee bend], wp = weapon angle (0 forward, -90 up), rot = whole body */
const P = (lean, head, aF, aB, lF, lB, wp, rot = 0) => ({ lean, head, aF0: aF[0], aF1: aF[1], aB0: aB[0], aB1: aB[1], lF0: lF[0], lF1: lF[1], lB0: lB[0], lB1: lB[1], wp, rot });
export const POSE = {
  guard: P(8, -4, [34, 72], [-8, 96], [28, 24], [-22, 20], -56),
  l1a: P(-2, 2, [-152, -28], [22, 92], [30, 26], [-26, 22], -152),
  l1b: P(27, -8, [70, 8], [36, 60], [46, 36], [-42, 10], 30),
  l2a: P(16, 4, [22, 30], [4, 80], [34, 30], [-30, 18], 142),
  l2b: P(-6, -6, [-112, -8], [-20, 70], [36, 24], [-32, 14], -68),
  l3a: P(4, 0, [-34, 124], [10, 100], [18, 32], [-30, 28], -6),
  l3b: P(31, -10, [82, 4], [50, 30], [58, 42], [-50, 6], -3),
  h1a: P(-16, 6, [-172, -18], [-160, -30], [16, 32], [-30, 32], -206),
  h1b: P(42, -14, [50, 6], [42, 20], [62, 54], [-52, 14], 64),
  kicka: P(-8, 0, [20, 82], [-30, 72], [82, 104], [-6, 14], -72),
  kickb: P(-24, 4, [10, 70], [-50, 50], [88, 4], [-10, 22], -84),
  block: P(-3, 0, [52, 102], [42, 112], [24, 32], [-26, 28], -97),
  hurtHi: P(-24, -22, [-30, 40], [-62, 30], [14, 22], [-32, 30], -22),
  hurtLo: P(36, 22, [30, 60], [10, 72], [30, 42], [-20, 38], 30),
  fall: P(-64, -12, [-100, -20], [-140, -10], [62, 30], [22, 52], -124, -30),
  down: P(-86, 6, [-96, -12], [-120, -8], [84, 16], [72, 30], 172),
  getup: P(42, -16, [44, 40], [20, 60], [82, 122], [42, 112], 40),
  jump: P(12, -6, [-40, 82], [-20, 80], [72, 92], [22, 84], -122),
  dash: P(32, -14, [-30, 62], [-50, 40], [52, 32], [-52, 22], 152),
  win: P(-4, -6, [-162, -8], [12, 22], [10, 8], [-10, 6], -90),
};
const KEYS = Object.keys(POSE.guard);

/* moves: steps of {p: pose, t: seconds, w: spring speed, act: the hit this step can land, lunge: forward push} */
export const MOVES = {
  light1: { next: "light2", steps: [{ p: "l1a", t: 0.1, w: 30 }, { p: "l1b", t: 0.11, w: 46, act: { dmg: 8, power: 250 }, lunge: 300, sfx: "swing" }, { p: "l1b", t: 0.13, w: 18 }] },
  light2: { next: "light3", steps: [{ p: "l2a", t: 0.09, w: 30 }, { p: "l2b", t: 0.11, w: 46, act: { dmg: 9, power: 300 }, lunge: 260, sfx: "swing" }, { p: "l2b", t: 0.14, w: 18 }] },
  light3: { steps: [{ p: "l3a", t: 0.12, w: 30 }, { p: "l3b", t: 0.11, w: 50, act: { dmg: 12, power: 560 }, lunge: 460, sfx: "swing" }, { p: "l3b", t: 0.22, w: 16 }] },
  heavy: { steps: [{ p: "h1a", t: 0.27, w: 17 }, { p: "h1b", t: 0.12, w: 50, act: { dmg: 20, power: 640, launch: true }, lunge: 340, sfx: "heavy" }, { p: "h1b", t: 0.34, w: 13 }] },
  kick: { steps: [{ p: "kicka", t: 0.09, w: 34 }, { p: "kickb", t: 0.1, w: 50, act: { dmg: 6, power: 560, kick: true }, lunge: 200, sfx: "kick" }, { p: "kickb", t: 0.12, w: 20 }] },
};

const dir = (a) => [Math.sin(a * D), Math.cos(a * D)];

/* a ribbon of cloth: verlet points, pinned at one end */
class Chain {
  constructor(n, seg, o = {}) {
    this.n = n;
    this.seg = seg;
    this.o = o;
    this.p = [];
    for (let i = 0; i < n; i++) this.p.push({ x: 0, y: 0, vx: 0, vy: 0, ox: 0, oy: 0 });
    this.init = false;
  }
  update(ax, ay, dt, wind) {
    const p = this.p;
    if (!this.init) {
      for (let i = 0; i < this.n; i++) {
        p[i].x = ax - i * 2;
        p[i].y = ay + i * this.seg;
        p[i].vx = p[i].vy = 0;
      }
      this.init = true;
    }
    if (dt <= 0) return;
    const n = Math.max(1, Math.ceil(dt * 120)),
      h = dt / n;
    const g = this.o.grav || 1500,
      damp = Math.exp(-(this.o.damp || 2.6) * h);
    const sx = (ax - p[0].x) / n,
      sy = (ay - p[0].y) / n;
    for (let s = 0; s < n; s++) {
      for (let i = 1; i < this.n; i++) {
        const q = p[i];
        q.vx = (q.vx + wind * 1.5 * h * (0.6 + 0.4 * Math.sin(i * 1.3 + ax * 0.01))) * damp;
        q.vy = (q.vy + g * h) * damp;
        q.ox = q.x;
        q.oy = q.y;
        q.x += q.vx * h;
        q.y += q.vy * h;
      }
      p[0].x += sx;
      p[0].y += sy;
      for (let it = 0; it < 4; it++)
        for (let i = 1; i < this.n; i++) {
          const a = p[i - 1],
            b = p[i];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-6,
            f = (d - this.seg) / d;
          if (i === 1) {
            b.x -= dx * f;
            b.y -= dy * f;
          } else {
            a.x += dx * f * 0.5;
            a.y += dy * f * 0.5;
            b.x -= dx * f * 0.5;
            b.y -= dy * f * 0.5;
          }
          if (b.y > GROUND - 2) b.y = GROUND - 2;
        }
      for (let i = 1; i < this.n; i++) {
        const q = p[i];
        q.vx = (q.x - q.ox) / h;
        q.vy = (q.y - q.oy) / h;
        if (q.y >= GROUND - 2.5) q.vx *= Math.exp(-8 * h);
      }
    }
  }
  draw(g, w0, w1, color) {
    const p = this.p,
      n = this.n;
    const L = [],
      R = [];
    for (let i = 0; i < n; i++) {
      const a = p[Math.max(0, i - 1)],
        b = p[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x,
        ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      const hw = 0.5 * K.lerp(w0, w1, i / (n - 1));
      L.push([p[i].x - (ty / l) * hw, p[i].y + (tx / l) * hw]);
      R.push([p[i].x + (ty / l) * hw, p[i].y - (tx / l) * hw]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }
}

/* the knockout: every joint a point mass, bones as distance constraints */
const RAG = ["head", "neck", "hip", "eF", "hF", "eB", "hB", "kF", "fF", "kB", "fB"];
const BONES = [
  ["head", "neck"],
  ["neck", "hip"],
  ["neck", "eF"],
  ["eF", "hF"],
  ["neck", "eB"],
  ["eB", "hB"],
  ["hip", "kF"],
  ["kF", "fF"],
  ["hip", "kB"],
  ["kB", "fB"],
];
const SOFT = [
  ["head", "hip", 0.9],
  ["kF", "kB", 0.25],
  ["eF", "hip", 0.3],
  ["eB", "hip", 0.3],
  ["fF", "neck", 0.12],
  ["fB", "neck", 0.12],
];
class Ragdoll {
  /* vx, vy in px/s; spin in rad/s about the hips */
  constructor(J, vx, vy, spin) {
    this.pt = {};
    const cx = J.hip[0],
      cy = J.hip[1];
    for (const k of RAG) {
      const x = J[k][0],
        y = J[k][1];
      this.pt[k] = { x, y, vx: vx - (y - cy) * spin, vy: vy + (x - cx) * spin, r: k === "head" ? LEN.head : k === "hip" || k === "neck" ? 13 * S : 7 * S };
    }
    this.bones = BONES.map(([a, b]) => [a, b, Math.hypot(J[a][0] - J[b][0], J[a][1] - J[b][1]), 1]);
    for (const [a, b, st] of SOFT) this.bones.push([a, b, Math.hypot(J[a][0] - J[b][0], J[a][1] - J[b][1]), st]);
    this.rest = 0;
  }
  step(dt) {
    if (dt <= 0) return;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    let fastest = 0;
    for (let s = 0; s < n; s++) {
      for (const k of RAG) {
        const q = this.pt[k];
        q.vy += GRAV * h;
        q.ox = q.x;
        q.oy = q.y;
        q.x += q.vx * h;
        q.y += q.vy * h;
        q.hit = false;
      }
      for (let it = 0; it < 6; it++) {
        for (const [a, b, len, st] of this.bones) {
          const A = this.pt[a],
            B = this.pt[b];
          const dx = B.x - A.x,
            dy = B.y - A.y,
            d = Math.hypot(dx, dy) || 1e-6;
          if (st < 1 && d > len * 0.55 && d < len * 1.25) continue; // soft limits only act at the extremes
          const f = ((d - len) / d) * 0.5 * st;
          A.x += dx * f;
          A.y += dy * f;
          B.x -= dx * f;
          B.y -= dy * f;
        }
        for (const k of RAG) {
          const q = this.pt[k];
          if (q.y > GROUND - q.r) {
            q.y = GROUND - q.r;
            q.hit = true;
          }
          if (q.x > 740) q.x = 740; // the courtyard has walls
          else if (q.x < -740) q.x = -740;
        }
      }
      for (const k of RAG) {
        const q = this.pt[k];
        const vyIn = q.vy;
        q.vx = (q.x - q.ox) / h;
        q.vy = (q.y - q.oy) / h;
        if (q.hit) {
          q.vx *= Math.exp(-7 * h); // the stone drags at it
          if (vyIn > 260) q.vy = -vyIn * 0.2; // and gives a little back
        }
        q.vx *= Math.exp(-0.35 * h);
        fastest = Math.max(fastest, Math.abs(q.vx) + Math.abs(q.vy));
      }
    }
    if (fastest < 40) this.rest += dt;
    else this.rest = 0;
  }
  joints(J) {
    for (const k of RAG) J[k] = [this.pt[k].x, this.pt[k].y];
    J.sh = [K.lerp(J.neck[0], J.hip[0], 0.1), K.lerp(J.neck[1], J.hip[1], 0.1)];
  }
}

export class Fighter {
  constructor(kind, x, face) {
    this.kind = kind; // "sumi" | "shiro"
    this.name = kind === "sumi" ? "SUMI" : "SHIRO";
    this.wlen = (kind === "sumi" ? 150 : 128) * S;
    this.grip = (kind === "sumi" ? 46 : 20) * S;
    this.x0 = x;
    this.f0 = face;
    this.J = {};
    this.chains =
      kind === "sumi"
        ? [
            { c: new Chain(11, 13 * S, { grav: 1300, damp: 2.2 }), at: "neck", w: [15 * S, 5 * S], col: "#c62c18", dx: -4, dy: 2 },
            { c: new Chain(8, 12 * S, { grav: 1300, damp: 2.6 }), at: "neck", w: [12 * S, 4 * S], col: "#a82414", dx: -6, dy: 5 },
            { c: new Chain(9, 10 * S, { grav: 1700, damp: 3.2 }), at: "headTop", w: [11 * S, 1.5 * S], col: null, dx: 0, dy: 0 },
          ]
        : [
            { c: new Chain(10, 12 * S, { grav: 1200, damp: 2.2 }), at: "headTop", w: [13 * S, 3 * S], col: "#e8e2d2", dx: 0, dy: 0 },
            { c: new Chain(8, 12 * S, { grav: 1200, damp: 2.6 }), at: "headTop", w: [10 * S, 2 * S], col: "#cfc8b6", dx: -3, dy: 4 },
            { c: new Chain(7, 12 * S, { grav: 1700, damp: 3.2 }), at: "hipBack", w: [12 * S, 5 * S], col: null, dx: 0, dy: 0 },
          ];
    this.reset();
  }
  reset() {
    this.x = this.x0;
    this.y = 0; // height above the ground (negative = in the air)
    this.vx = 0;
    this.vy = 0;
    this.face = this.f0;
    this.hp = 100;
    this.shown = 100;
    this.state = "idle";
    this.st = 0;
    this.move = null;
    this.step = 0;
    this.stepT = 0;
    this.queued = null;
    this.hitDone = false;
    this.walkPh = 0;
    this.inv = 0;
    this.blockT = 0;
    this.rag = null;
    this.weaponFree = null;
    this.stun = 0;
    this.override = null;
    this.q = {};
    this.qv = {};
    for (const k of KEYS) {
      this.q[k] = POSE.guard[k];
      this.qv[k] = 0;
    }
    this.target = POSE.guard;
    this.w = 14;
    this.tip = null;
    this.trail = [];
    for (const ch of this.chains) ch.c.init = false;
    this.solve();
  }
  get busy() {
    return this.state === "attack" || this.state === "hurt" || this.state === "knock" || this.state === "down" || this.state === "getup" || this.state === "ko" || this.state === "dash";
  }
  get grounded() {
    return this.y >= 0;
  }
  get active() {
    if (this.state !== "attack" || !this.move) return null;
    const s = this.move.steps[this.step];
    return s && s.act && !this.hitDone ? s.act : null;
  }
  start(name) {
    this.serial = (this.serial || 0) + 1;
    this.state = "attack";
    this.moveName = name;
    this.move = MOVES[name];
    this.step = 0;
    this.stepT = 0;
    this.hitDone = false;
    this.queued = null;
    this.trail.length = 0;
  }
  /* what the fighter wants this frame: {move:-1..1, light, heavy, kick, block, dash, jump} */
  update(dt, inp, foe, fx) {
    this.inv = Math.max(0, this.inv - dt);
    this.st += dt;
    if (this.state === "ko") {
      this.rag.step(dt);
      if (this.weaponFree) {
        const w = this.weaponFree;
        w.vy += GRAV * dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.a += w.va * dt;
        if (w.y > GROUND - 6) {
          w.y = GROUND - 6;
          w.vy *= -0.3;
          w.vx *= 0.6;
          w.va *= 0.5;
          if (Math.abs(w.vy) < 60) {
            w.vy = 0;
            w.va *= 0.8;
            const flat = Math.round(w.a / Math.PI) * Math.PI;
            w.a += (flat - w.a) * Math.min(1, dt * 10);
          }
        }
      }
      this.rag.joints(this.J);
      this.updateChains(dt, fx.wind);
      return;
    }
    const grounded = this.grounded;
    const canAct = !this.busy && this.state !== "air";
    if (canAct && grounded && foe && foe.state !== "ko") this.face = foe.x >= this.x ? 1 : -1;
    let tgt = POSE.guard,
      w = 13;
    if (this.override) {
      this.state = "idle";
      this.vx *= Math.pow(0.001, dt);
    }
    switch (this.override ? "override" : this.state) {
      case "override": {
        tgt = this.override;
        w = this.overrideW || 14;
        break;
      }
      case "idle":
      case "walk":
      case "block": {
        if (inp.block && grounded) {
          this.blockAge = this.state === "block" ? (this.blockAge || 0) + dt : 0;
          this.state = "block";
          tgt = POSE.block;
          w = 30;
          this.vx *= Math.pow(0.0005, dt);
        } else {
          const mv = inp.move || 0;
          if (mv) {
            this.state = "walk";
            const fwd = mv * this.face > 0;
            const sp = fwd ? 300 : 220;
            this.vx += (mv * sp - this.vx) * Math.min(1, dt * 14);
            this.walkPh += dt * (fwd ? 11 : -9);
            const s = Math.sin(this.walkPh),
              c = Math.cos(this.walkPh);
            tgt = Object.assign({}, POSE.guard, { lF0: 26 + 26 * s, lF1: 22 + 26 * Math.max(0, c), lB0: -20 - 26 * s, lB1: 20 + 26 * Math.max(0, -c), lean: POSE.guard.lean + (fwd ? 5 : -4) });
            w = 22;
            if (Math.abs(s) > 0.98 && fx.dustCd <= 0) {
              fx.dust(this.x - this.face * 20, GROUND, 0.5);
              fx.dustCd = 0.2;
            }
          } else {
            this.state = "idle";
            this.vx *= Math.pow(0.0002, dt);
            const b = Math.sin(this.st * 2.4);
            tgt = Object.assign({}, POSE.guard, { lean: POSE.guard.lean + b * 1.6, aF1: POSE.guard.aF1 + b * 3, wp: POSE.guard.wp + b * 2.5, lF1: POSE.guard.lF1 + b * 2, lB1: POSE.guard.lB1 + b * 2 });
          }
          if (inp.light) this.start("light1");
          else if (inp.heavy) this.start("heavy");
          else if (inp.kick) this.start("kick");
          else if (inp.dash && grounded) {
            this.state = "dash";
            this.st = 0;
            this.dashDir = inp.move ? Math.sign(inp.move) : -this.face;
            this.inv = 0.26;
            fx.dust(this.x, GROUND, 1);
            fx.sound("dash");
          } else if (inp.jump && grounded) {
            this.vy = -980;
            this.y = -1;
            this.state = "air";
            fx.dust(this.x, GROUND, 0.8);
          }
        }
        break;
      }
      case "air": {
        tgt = POSE.jump;
        w = 20;
        if (inp.move) this.vx += (inp.move * 260 - this.vx) * Math.min(1, dt * 4);
        if (inp.light || inp.heavy) this.start(inp.heavy ? "heavy" : "light1");
        break;
      }
      case "dash": {
        tgt = this.dashDir * this.face > 0 ? POSE.dash : Object.assign({}, POSE.dash, { lean: -18 });
        w = 34;
        this.vx = this.dashDir * 900 * (1 - this.st / 0.2);
        if (this.st > 0.2) this.state = "idle";
        break;
      }
      case "attack": {
        const s = this.move.steps[this.step];
        tgt = POSE[s.p];
        w = s.w;
        if (this.stepT === 0) {
          if (s.lunge && grounded) this.vx = this.face * s.lunge;
          if (s.sfx) fx.sound(s.sfx);
        }
        this.stepT += dt;
        if (grounded) this.vx *= Math.pow(0.004, dt);
        if (inp.light && this.move.next) this.queued = this.move.next;
        if (inp.heavy && this.move.next) this.queued = "heavy";
        if (this.stepT >= s.t) {
          this.step++;
          this.stepT = 0;
          this.hitDone = this.hitDone && this.step < this.move.steps.length && !this.move.steps[this.step].act ? this.hitDone : false;
          if (this.step >= this.move.steps.length) {
            if (this.queued) this.start(this.queued);
            else {
              this.state = grounded ? "idle" : "air";
              this.move = null;
            }
          } else if (this.step === this.move.steps.length - 1 && this.queued) this.start(this.queued);
        }
        break;
      }
      case "hurt": {
        tgt = this.hurtPose;
        w = 26;
        this.vx *= Math.pow(0.01, dt);
        if (this.st > this.stun) this.state = "idle";
        break;
      }
      case "knock": {
        tgt = POSE.fall;
        w = 16;
        if (grounded && this.st > 0.12) {
          this.state = "down";
          this.st = 0;
          fx.dust(this.x, GROUND, 1.6);
          fx.shake(0.5);
          fx.sound("thud");
        }
        break;
      }
      case "down": {
        tgt = POSE.down;
        w = 20;
        this.vx *= Math.pow(0.002, dt);
        this.inv = 0.3;
        if (this.st > 0.7) {
          this.state = "getup";
          this.st = 0;
        }
        break;
      }
      case "getup": {
        tgt = this.st < 0.22 ? POSE.getup : POSE.guard;
        w = 18;
        this.inv = 0.2;
        if (this.st > 0.46) this.state = "idle";
        break;
      }
      case "win": {
        tgt = POSE.win;
        w = 8;
        this.vx *= Math.pow(0.001, dt);
        break;
      }
    }
    // body
    if (!grounded || this.vy < 0) {
      this.vy += GRAV * dt;
      this.y += this.vy * dt;
      if (this.y >= 0) {
        this.y = 0;
        this.vy = 0;
        if (this.state === "air") {
          this.state = "idle";
          fx.dust(this.x, GROUND, 0.9);
        }
        this.qv.lF1 += 520;
        this.qv.lB1 += 520;
        this.qv.lean += 160;
      }
    }
    this.x += this.vx * dt;
    this.x = K.clamp(this.x, fx.minX == null ? -fx.bound : fx.minX, fx.maxX == null ? fx.bound : fx.maxX);
    // springs pull the joints toward the pose
    const z = 0.78;
    for (const k of KEYS) {
      const a = (tgt[k] - this.q[k]) * w * w - 2 * z * w * this.qv[k];
      this.qv[k] += a * dt;
      this.q[k] += this.qv[k] * dt;
    }
    this.solve();
    // weapon trail while a strike is live
    const s = this.state === "attack" && this.move ? this.move.steps[this.step] : null;
    if (s && s.act && !s.act.kick) {
      this.trail.push([this.J.wBase[0], this.J.wBase[1], this.J.wTip[0], this.J.wTip[1], 1]);
      if (this.trail.length > 9) this.trail.shift();
    }
    for (const t of this.trail) t[4] -= dt * 5;
    while (this.trail.length && this.trail[0][4] <= 0) this.trail.shift();
    this.updateChains(dt, fx.wind);
  }
  /* a flinch is physics too: kick the springs, do not just swap the pose */
  impulse(amt) {
    this.qv.lean -= amt * 420;
    this.qv.head -= amt * 600;
    this.qv.aF0 -= amt * 500;
    this.qv.aB0 -= amt * 400;
  }
  takeHit(act, from, head, blocked, fx) {
    const dirX = Math.sign(this.x - from.x) || from.face;
    if (blocked) {
      this.hp = Math.max(0, this.hp - act.dmg * 0.12);
      this.vx = dirX * act.power * 0.45;
      this.impulse(0.25);
      return "block";
    }
    const dmg = act.dmg * (head ? 1.45 : 1);
    this.hp = Math.max(0, this.hp - dmg);
    this.trail.length = 0;
    this.move = null;
    this.st = 0;
    if (this.hp <= 0) {
      this.ko(dirX * (act.power * 0.5 + 190), -430 - act.power * 0.4, dirX * (head ? -5.5 : 4), fx);
      return "ko";
    }
    if (act.launch || !this.grounded) {
      this.state = "knock";
      this.vx = dirX * act.power * 0.62;
      this.vy = -760;
      this.y = Math.min(this.y, -1);
      this.impulse(1);
    } else {
      this.state = "hurt";
      this.hurtPose = head ? POSE.hurtHi : act.kick ? POSE.hurtLo : this.hp % 2 > 1 ? POSE.hurtHi : POSE.hurtLo;
      this.stun = 0.24 + act.dmg * 0.012;
      this.vx = dirX * act.power;
      this.impulse(dirX * this.face < 0 ? 0.8 : -0.8);
    }
    return head ? "head" : "hit";
  }
  ko(vx, vy, spin, fx) {
    this.state = "ko";
    this.rag = new Ragdoll(this.J, vx, vy, spin);
    const J = this.J;
    this.weaponFree = { x: (J.wBase[0] + J.wTip[0]) / 2, y: (J.wBase[1] + J.wTip[1]) / 2, a: Math.atan2(J.wTip[1] - J.wBase[1], J.wTip[0] - J.wBase[0]), vx: vx * 0.6, vy: -760, va: (vx > 0 ? 1 : -1) * 12 };
  }
  /* forward kinematics, then stand the result on the ground */
  solve() {
    const q = this.q,
      f = this.face,
      J = this.J;
    const hip = [0, 0];
    const td = [Math.sin(q.lean * D), -Math.cos(q.lean * D)];
    const neck = [td[0] * LEN.torso, td[1] * LEN.torso];
    const sh = [td[0] * (LEN.torso - 9 * S), td[1] * (LEN.torso - 9 * S)];
    const hd = [Math.sin((q.lean + q.head) * D), -Math.cos((q.lean + q.head) * D)];
    const head = [neck[0] + hd[0] * (LEN.neck + LEN.head * 0.75), neck[1] + hd[1] * (LEN.neck + LEN.head * 0.75)];
    const arm = (a0, a1) => {
      const d1 = dir(a0),
        e = [sh[0] + d1[0] * LEN.uarm, sh[1] + d1[1] * LEN.uarm],
        d2 = dir(a0 + a1);
      return [e, [e[0] + d2[0] * LEN.farm, e[1] + d2[1] * LEN.farm]];
    };
    const leg = (a0, a1) => {
      const d1 = dir(a0),
        k = [d1[0] * LEN.thigh, d1[1] * LEN.thigh],
        d2 = dir(a0 - a1);
      return [k, [k[0] + d2[0] * LEN.shin, k[1] + d2[1] * LEN.shin]];
    };
    const AF = arm(q.aF0, q.aF1),
      AB = arm(q.aB0, q.aB1),
      LF = leg(q.lF0, q.lF1),
      LB = leg(q.lB0, q.lB1);
    const wd = [Math.cos(q.wp * D), Math.sin(q.wp * D)];
    const L = { hip, neck, sh, head, eF: AF[0], hF: AF[1], eB: AB[0], hB: AB[1], kF: LF[0], fF: LF[1], kB: LB[0], fB: LB[1] };
    L.wBase = [AF[1][0] - wd[0] * this.grip, AF[1][1] - wd[1] * this.grip];
    L.wTip = [AF[1][0] + wd[0] * this.wlen, AF[1][1] + wd[1] * this.wlen];
    const cr = Math.cos(q.rot * D),
      sr = Math.sin(q.rot * D);
    let low = -1e9;
    for (const k in L) {
      const p = L[k];
      const x = p[0] * cr - p[1] * sr,
        y = p[0] * sr + p[1] * cr;
      L[k] = [x, y];
    }
    for (const k of ["fF", "fB", "kF", "kB", "hip", "neck", "head"]) low = Math.max(low, L[k][1] + (k[0] === "f" ? 9 * S : k === "head" ? LEN.head : 12 * S));
    const hy = GROUND - low + this.y;
    for (const k in L) J[k] = [this.x + L[k][0] * f, hy + L[k][1]];
    J.f = f;
  }
  updateChains(dt, wind) {
    const J = this.J;
    const hd = [J.head[0] - J.neck[0], J.head[1] - J.neck[1]];
    const hl = Math.hypot(hd[0], hd[1]) || 1;
    const top = [J.head[0] + (hd[0] / hl) * LEN.head * 0.5 - this.face * LEN.head * 0.75, J.head[1] + (hd[1] / hl) * LEN.head * 0.5];
    const hipB = [J.hip[0] - this.face * 13 * S, J.hip[1] - 14 * S];
    for (const ch of this.chains) {
      const a = ch.at === "neck" ? J.neck : ch.at === "headTop" ? top : hipB;
      ch.c.update(a[0] + ch.dx * this.face, a[1] + ch.dy, dt, wind);
    }
  }
  /* capsules that can be hit */
  hurtBoxes() {
    const J = this.J;
    return [
      { a: J.head, b: J.head, r: LEN.head * 1.05, head: true },
      { a: J.hip, b: J.neck, r: 24 * S },
      { a: J.hip, b: J.kF, r: 15 * S },
      { a: J.kF, b: J.fF, r: 13 * S },
      { a: J.hip, b: J.kB, r: 15 * S },
    ];
  }

  // ------------------------------------------------------------------ drawing
  draw(g, col) {
    const J = this.J,
      f = this.face;
    const kind = this.kind;
    const bo = this.boil | 0;
    let pc = 0;
    const poly = (pts) => {
      g.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = pts[i][0] + (K.hash(pc, i, bo) - 0.5) * 2.2,
          y = pts[i][1] + (K.hash(pc, i + 40, bo) - 0.5) * 2.2;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      pc++;
      g.closePath();
      g.fill();
    };
    const limb = (a, b, w0, w1) => {
      const an = Math.atan2(b[1] - a[1], b[0] - a[0]),
        nx = -Math.sin(an),
        ny = Math.cos(an);
      poly([
        [a[0] + (nx * w0) / 2, a[1] + (ny * w0) / 2],
        [b[0] + (nx * w1) / 2, b[1] + (ny * w1) / 2],
        [b[0] - (nx * w1) / 2, b[1] - (ny * w1) / 2],
        [a[0] - (nx * w0) / 2, a[1] - (ny * w0) / 2],
      ]);
      g.beginPath();
      g.arc(a[0], a[1], w0 / 2, 0, 7);
      g.arc(b[0], b[1], w1 / 2, 0, 7);
      g.fill();
    };
    const un = (a, b) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    };
    const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
    const td = un(J.hip, J.neck);
    let fr = [-td[1], td[0]]; // the front of the torso
    if (fr[0] * f < 0) fr = [-fr[0], -fr[1]];
    const along = (d, k) => [J.hip[0] + td[0] * d + fr[0] * k, J.hip[1] + td[1] * d + fr[1] * k];
    const hd = un(J.neck, J.head);
    let hn = [-hd[1], hd[0]];
    if (hn[0] * f < 0) hn = [-hn[0], -hn[1]];
    const hp = (a, b) => [J.head[0] + hn[0] * a * S - hd[0] * b * S, J.head[1] + hn[1] * a * S - hd[1] * b * S];
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineCap = "round";
    g.lineJoin = "round";
    // cloth behind the body
    for (const ch of this.chains) ch.c.draw(g, ch.w[0], ch.w[1], ch.col && !this.mono ? ch.col : col);
    g.fillStyle = col;
    const weapon = () => {
      let b = J.wBase,
        t = J.wTip;
      if (this.weaponFree) {
        const w = this.weaponFree,
          h = (this.wlen + this.grip) / 2;
        b = [w.x - Math.cos(w.a) * h, w.y - Math.sin(w.a) * h];
        t = [w.x + Math.cos(w.a) * h, w.y + Math.sin(w.a) * h];
      }
      const d = un(b, t),
        n = [-d[1], d[0]];
      if (kind === "sumi") {
        g.lineWidth = 5 * S;
        g.beginPath();
        g.moveTo(b[0], b[1]);
        const fe = add(t, d, -34 * S);
        g.lineTo(fe[0], fe[1]);
        g.stroke();
        g.beginPath(); // the loaded brush head
        g.moveTo(fe[0] + n[0] * 5 * S, fe[1] + n[1] * 5 * S);
        g.quadraticCurveTo(fe[0] + d[0] * 13 * S + n[0] * 12 * S, fe[1] + d[1] * 13 * S + n[1] * 12 * S, t[0], t[1]);
        g.quadraticCurveTo(fe[0] + d[0] * 13 * S - n[0] * 12 * S, fe[1] + d[1] * 13 * S - n[1] * 12 * S, fe[0] - n[0] * 5 * S, fe[1] - n[1] * 5 * S);
        g.fill();
      } else {
        // katana: a long shallow curve, a guard, a wrapped grip
        const gd = add(b, d, this.grip);
        g.lineWidth = 6.5 * S;
        g.beginPath();
        g.moveTo(b[0], b[1]);
        g.lineTo(gd[0], gd[1]);
        g.stroke();
        poly([add(add(gd, n, 9 * S), d, -2), add(add(gd, n, 9 * S), d, 3), add(add(gd, n, -9 * S), d, 3), add(add(gd, n, -9 * S), d, -2)]);
        const mid = add(add(gd, d, this.wlen * 0.5), n, -7 * S * f);
        g.beginPath();
        g.moveTo(gd[0] + n[0] * 3.4 * S, gd[1] + n[1] * 3.4 * S);
        g.quadraticCurveTo(mid[0] + n[0] * 3 * S, mid[1] + n[1] * 3 * S, t[0], t[1]);
        g.quadraticCurveTo(mid[0] - n[0] * 3 * S, mid[1] - n[1] * 3 * S, gd[0] - n[0] * 3.4 * S, gd[1] - n[1] * 3.4 * S);
        g.fill();
      }
    };
    const hakama = (kn, ft) => {
      const d1 = un(J.hip, kn),
        d2 = un(kn, ft);
      let n1 = [-d1[1], d1[0]],
        n2 = [-d2[1], d2[0]];
      if (n1[0] * f < 0) n1 = [-n1[0], -n1[1]];
      if (n2[0] * f < 0) n2 = [-n2[0], -n2[1]];
      poly([add(J.hip, n1, 11 * S), add(kn, n1, 15 * S), add(add(ft, n2, 17 * S), d2, 3), add(add(ft, n2, 2), d2, 8 * S), add(ft, n2, -24 * S), add(kn, n1, -17 * S), add(J.hip, n1, -12 * S)]);
      poly([add(ft, d2, 4 * S), add(add(ft, d2, 12 * S), n2, 17 * S), add(add(ft, d2, 14 * S), n2, 1), add(add(ft, d2, 11 * S), n2, -6 * S)]);
    };
    const armored = (kn, ft) => {
      limb(J.hip, kn, 26 * S, 20 * S);
      limb(kn, ft, 19 * S, 13 * S);
      const d2 = un(kn, ft);
      let n2 = [-d2[1], d2[0]];
      if (n2[0] * f < 0) n2 = [-n2[0], -n2[1]];
      poly([add(kn, n2, 13 * S), add(add(kn, d2, 16 * S), n2, 15 * S), add(add(kn, d2, 30 * S), n2, 10 * S), add(kn, n2, -4 * S)]); // knee guard
      poly([add(ft, d2, 2 * S), add(add(ft, d2, 11 * S), n2, 20 * S), add(add(ft, d2, 13 * S), n2, 0), add(add(ft, d2, 10 * S), n2, -8 * S)]);
    };
    const arm = (e, h, frontArm) => {
      if (kind === "sumi") {
        limb(J.sh, e, 10 * S, 8.5 * S);
        limb(e, h, 7.5 * S, 5.5 * S);
        g.beginPath();
        g.arc(h[0], h[1], 4.2 * S, 0, 7);
        g.fill();
        const d = un(e, h);
        const n = [-d[1], d[0]];
        const drop = [-(this.vx || 0) * 0.0006 - f * 0.25, 1];
        const dl = Math.hypot(drop[0], drop[1]);
        const dv = [drop[0] / dl, drop[1] / dl];
        const w = [K.lerp(e[0], h[0], 0.8), K.lerp(e[1], h[1], 0.8)];
        poly([add(J.sh, n, 6 * S), add(e, n, 5.5 * S), add(w, n, 4 * S), add(w, dv, 34 * S), add(e, dv, 20 * S), add(J.sh, n, -8 * S)]);
      } else {
        limb(J.sh, e, 15 * S, 12 * S);
        limb(e, h, 12 * S, 8 * S);
        g.beginPath();
        g.arc(h[0], h[1], 5.5 * S, 0, 7);
        g.fill();
        // shoulder plate
        const d = un(J.sh, e);
        const n = [-d[1], d[0]];
        poly([add(add(J.sh, n, 17 * S), d, -6 * S), add(add(J.sh, n, 18 * S), d, 30 * S), add(add(J.sh, n, -18 * S), d, 30 * S), add(add(J.sh, n, -17 * S), d, -6 * S)]);
      }
    };
    if (this.weaponFree) weapon();
    arm(J.eB, J.hB, false);
    if (kind === "sumi") hakama(J.kB, J.fB);
    else armored(J.kB, J.fB);
    // torso
    const T = LEN.torso;
    if (kind === "sumi") {
      poly([along(0, -12 * S), along(T * 0.3, -8 * S), along(T * 0.84, -13 * S), along(T, -4 * S), along(T, 4 * S), along(T * 0.84, 12 * S), along(T * 0.3, 8.5 * S), along(0, 11 * S)]);
      poly([along(T * 0.24, -10 * S), along(T * 0.44, -10 * S), along(T * 0.44, 10.5 * S), along(T * 0.24, 10.5 * S)]);
      poly([along(T * 0.34, -9 * S), along(T * 0.52, -23 * S), along(T * 0.36, -17 * S), along(T * 0.18, -24 * S), along(T * 0.28, -9 * S)]);
    } else {
      poly([along(0, -17 * S), along(T * 0.3, -16 * S), along(T * 0.86, -20 * S), along(T, -7 * S), along(T, 7 * S), along(T * 0.86, 19 * S), along(T * 0.3, 16 * S), along(0, 16 * S)]);
      // skirt plates hang from the waist
      for (const k of [-15, -2, 11]) poly([along(4 * S, (k - 9) * S), along(4 * S, (k + 9) * S), along(-34 * S, (k + 12) * S), along(-34 * S, (k - 12) * S)]);
    }
    if (kind === "sumi") hakama(J.kF, J.fF);
    else armored(J.kF, J.fF);
    // head
    limb(J.neck, J.head, 8 * S, 8 * S);
    if (kind === "sumi") {
      g.beginPath();
      g.arc(J.head[0], J.head[1], LEN.head * 0.78, 0, 7);
      g.fill();
      poly([hp(4, 15), hp(12.5, 10), hp(15.5, 5), hp(18.6, 3), hp(14.4, -3.5), hp(8, -10)]);
      const hc = hp(-3, -3.2);
      g.beginPath();
      g.arc(hc[0], hc[1], LEN.head * 0.87, 0, 7);
      g.fill();
      poly([hp(0, -19.5), hp(19.5, -4), hp(13, -3), hp(17, 2.4), hp(6, -2.5)]);
      poly([hp(-8, -17), hp(-19.5, -17), hp(-16, -6)]);
    } else {
      g.beginPath();
      g.arc(J.head[0], J.head[1], LEN.head * 0.8, 0, 7);
      g.fill();
      // kabuto: bowl, brim, neck guard, horns
      const hc = hp(-1, -5);
      g.beginPath();
      g.arc(hc[0], hc[1], LEN.head * 1.02, 0, 7);
      g.fill();
      poly([hp(6, -9), hp(27, -3), hp(24, 1.5), hp(8, -1)]);
      poly([hp(-6, -12), hp(-30, 2), hp(-32, 17), hp(-18, 21), hp(-9, 6)]);
      poly([hp(2, 6), hp(15, 9), hp(13, 18), hp(4, 20)]); // mask
      for (const s of [1, -0.55]) {
        g.beginPath();
        const b = hp(8, -20),
          m = hp(8 + 20 * s, -40),
          t = hp(8 + 6 * s, -62);
        g.moveTo(b[0], b[1]);
        g.quadraticCurveTo(m[0], m[1], t[0], t[1]);
        const m2 = hp(8 + 11 * s, -40),
          b2 = hp(1, -22);
        g.quadraticCurveTo(m2[0], m2[1], b2[0], b2[1]);
        g.fill();
      }
    }
    arm(J.eF, J.hF, true);
    if (!this.weaponFree) weapon();
  }
}
