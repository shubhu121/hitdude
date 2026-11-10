/* HITOFUDE — the painted world: ranges, sun, pine, torii, cliff, birds, erasure, colour. */
(function () {
  "use strict";
  const K = window.K,
    W = K.W,
    H = K.H;
  const { clamp, lerp, hash, n1, ss } = K;

  // ---------- mountain ranges
  K.ridge = (x, o) => {
    let s = 0,
      a = 1,
      tot = 0,
      fr = 1 / o.wl;
    for (let k = 0; k < 5; k++) {
      const n = n1(x * fr, o.seed + k * 13);
      const r = 1 - Math.abs(2 * n - 1);
      s += r * r * a;
      tot += a;
      a *= 0.5;
      fr *= 2.1;
    }
    s /= tot;
    const env = 0.4 + 0.6 * n1(x / (o.wl * 2.6), o.seed + 99);
    let pk = 0;
    if (o.peak) {
      const d = (x - o.peak[0]) / o.peak[1];
      pk = o.peak[2] * Math.exp(-d * d);
    }
    return o.base - o.amp * s * env * 1.7 - pk;
  };
  K.RANGES = {
    far: { base: 610, amp: 250, wl: 560, seed: 21, a: 0.2, depth: 190, lw: 5, tex: 18, peak: [1250, 300, 120] },
    mid: { base: 720, amp: 300, wl: 430, seed: 47, a: 0.4, depth: 210, lw: 8, tex: 44, peak: [560, 250, 230] },
    near: { base: 880, amp: 230, wl: 300, seed: 83, a: 0.72, depth: 240, lw: 11, tex: 60, peak: [1560, 240, 110] },
  };
  /* one range. o.prog: 0..1 painted left to right. o.col: [r,g,b] paints the colour wash instead of ink. */
  K.mountain = (g, o) => {
    const x0 = o.x0 == null ? -300 : o.x0,
      x1 = o.x1 == null ? W + 420 : o.x1;
    const prog = o.prog == null ? 1 : clamp(o.prog);
    if (prog <= 0) return;
    const xp = lerp(x0, x1, prog);
    const bottom = o.base + o.depth;
    const pts = [];
    for (let x = x0; x <= xp + 0.01; x += 12) pts.push([x, K.ridge(x, o)]);
    if (pts.length < 2) return;
    const top = o.base - o.amp * 1.15 - (o.peak ? o.peak[2] : 0);
    g.save();
    g.beginPath();
    g.moveTo(x0, bottom);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(pts[pts.length - 1][0], bottom);
    g.closePath();
    const gr = g.createLinearGradient(0, top, 0, bottom);
    if (o.col) {
      const c = o.col,
        ca = o.ca == null ? 0.9 : o.ca;
      gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${ca})`);
      gr.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},${ca * 0.7})`);
      gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = gr;
      g.fill();
      g.restore();
      return;
    }
    gr.addColorStop(0, K.ink(o.a));
    gr.addColorStop(0.45, K.ink(o.a * 0.62));
    gr.addColorStop(0.8, K.ink(o.a * 0.2));
    gr.addColorStop(1, K.ink(0));
    g.fillStyle = gr;
    g.fill();
    g.restore();
    // wet front: the wash thins where the brush has only just been
    if (prog < 1) {
      g.save();
      g.globalCompositeOperation = "destination-out";
      const fr = g.createLinearGradient(xp - 200, 0, xp, 0);
      fr.addColorStop(0, "rgba(0,0,0,0)");
      fr.addColorStop(1, "rgba(0,0,0,0.95)");
      g.fillStyle = fr;
      g.fillRect(xp - 200, top - 80, 204, bottom - top + 160);
      g.restore();
    }
    // texture strokes down the slopes
    for (let k = 0; k < o.tex; k++) {
      const xk = x0 + hash(k, o.seed, 1) * (x1 - x0);
      if (xk > xp - 30) continue;
      const yk = K.ridge(xk, o) + 4 + hash(k, o.seed, 2) * o.amp * 0.22;
      const slope = K.ridge(xk + 46, o) - K.ridge(xk - 46, o);
      const dir = slope > 0 ? 1 : -1;
      const steep = clamp(Math.abs(slope) / 70, 0.25, 1);
      const len = (40 + hash(k, o.seed, 3) * 80) * (0.6 + 0.6 * steep);
      K.stroke(
        g,
        [
          [xk, yk],
          [xk + dir * len * 0.3 * steep, yk + len * 0.5],
          [xk + dir * len * 0.52 * steep, yk + len * 1.05],
        ],
        { w: 4 + hash(k, o.seed, 5) * 8, alpha: Math.min(1, o.a * (0.45 + 0.8 * hash(k, o.seed, 6))), dry: 0.85, dryStart: 0.05, seed: k + o.seed, prof: K.prof.tail, step: 6 },
      );
    }
    // the ridge line itself
    const rp = [];
    for (let i = 0; i < pts.length; i += 2) rp.push(pts[i]);
    if (rp[rp.length - 1] !== pts[pts.length - 1]) rp.push(pts[pts.length - 1]);
    K.stroke(g, rp, { w: o.lw, prof: K.prof.line, dry: 0.5, dryStart: 0, seed: o.seed, alpha: Math.min(1, o.a * 1.7 + 0.12), step: 6, streak: 160, edge: 0.45 });
  };

  /* The whole background painting: three ranges in mist + sun. cam = {x,y,z}. prog = [far,mid,near] */
  K.landscape = (g, cam, o = {}) => {
    const pr = o.prog || [1, 1, 1];
    const names = ["far", "mid", "near"],
      depth = [0.25, 0.45, 0.7];
    const col = o.col;
    for (let i = 0; i < 3; i++) {
      if (o.skip && o.skip[i]) continue;
      const L = K.layer("range" + i);
      K.cam(L, cam, depth[i]);
      const R = Object.assign({}, K.RANGES[names[i]], { prog: pr[i] });
      if (col) K.mountain(L, Object.assign({}, R, { col: col[i], ca: o.ca }));
      else K.mountain(L, R);
      if (!col) K.mist(L, (K.RANGES[names[i]].base + 70 - (cam.y || 0) * depth[i]) * 1, 90, 0.5);
      K.put(g, L, { op: "multiply", a: o.a == null ? 1 : o.a });
    }
  };

  // ---------- sun: a stamped vermilion disc
  K.sun = (g, x, y, r, o = {}) => {
    const L = K.layer("sun", 512, 512);
    const s = 256;
    const rr = Math.min(r, 230);
    L.fillStyle = o.color || K.RED;
    L.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * K.TAU,
        q = rr * (1 + (n1(i * 0.6, 5) - 0.5) * 0.035);
      L.lineTo(s + Math.cos(a) * q, s + Math.sin(a) * q);
    }
    L.fill();
    // the stamp did not take everywhere
    L.globalCompositeOperation = "destination-out";
    const R = K.rng(o.seed || 12);
    for (let i = 0; i < 150; i++) {
      const a = R() * K.TAU,
        d = Math.pow(R(), 0.45) * rr;
      L.globalAlpha = 0.15 + R() * 0.5;
      L.beginPath();
      L.ellipse(s + Math.cos(a) * d, s + Math.sin(a) * d, 1 + R() * 5, 0.8 + R() * 2.2, R() * 3, 0, K.TAU);
      L.fill();
    }
    g.save();
    g.globalAlpha *= o.a == null ? 1 : o.a;
    g.globalCompositeOperation = "multiply";
    const k = o.scale || 1;
    g.drawImage(L.canvas, x - s * k, y - s * k, 512 * k, 512 * k);
    g.restore();
  };

  // ---------- birds: two ticks of the brush
  K.bird = (g, x, y, s, flap) => {
    const up = Math.sin(flap) * 0.55;
    g.save();
    g.strokeStyle = K.INK;
    g.lineCap = "round";
    g.lineWidth = Math.max(1.6, s * 0.14);
    g.beginPath();
    g.moveTo(x - s, y - s * up);
    g.quadraticCurveTo(x - s * 0.45, y - s * (0.35 + up * 0.3), x, y);
    g.quadraticCurveTo(x + s * 0.5, y - s * (0.4 + up * 0.3), x + s * 1.05, y - s * up * 1.1);
    g.stroke();
    g.restore();
  };

  // ---------- pine
  K.needles = (g, cx, cy, r, seed) => {
    g.save();
    g.strokeStyle = K.INK;
    g.fillStyle = K.INK;
    g.lineCap = "round";
    g.lineWidth = Math.max(1.3, r * 0.055);
    g.beginPath();
    for (let j = 0; j < 19; j++) {
      const a = -Math.PI * (0.04 + (0.92 * (j + hash(j, seed, 1) * 0.8)) / 19);
      const l = r * (0.72 + 0.4 * hash(j, seed, 2));
      g.moveTo(cx + Math.cos(a) * r * 0.12, cy + Math.sin(a) * r * 0.05);
      g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.72);
    }
    g.stroke();
    g.beginPath();
    g.ellipse(cx, cy + r * 0.04, r * 0.7, r * 0.16, 0, 0, K.TAU);
    g.fill();
    g.restore();
  };
  K.pine = (g, x, y, s, seed, sway = 0) => {
    const T = [
      [x - 6 * s, y + 10 * s],
      [x + 14 * s, y - 80 * s],
      [x - 22 * s, y - 170 * s],
      [x + 26 * s + sway * 5, y - 260 * s],
      [x + 80 * s + sway * 10, y - 330 * s],
      [x + 150 * s + sway * 16, y - 372 * s],
    ];
    const P = K.path(T, 6);
    K.stroke(g, P, { w: 34 * s, prof: (u) => 1 - 0.74 * u, dry: 0.5, dryStart: 0, seed, streak: 70 * s, edge: 0.3 });
    const br = [
      [0.42, -1, 150, -8],
      [0.56, 1, 170, -30],
      [0.7, -1, 120, -36],
      [0.82, 1, 150, -4],
      [0.93, -1, 90, -50],
      [1.0, 1, 70, -20],
    ];
    for (let b = 0; b < br.length; b++) {
      const [u, side, len, rise] = br[b];
      const p = K.at(P, u);
      const sw = sway * (6 + b * 3);
      const ex = p.x + side * len * s + sw,
        ey = p.y + rise * s + Math.abs(sw) * 0.2;
      K.stroke(g, [[p.x, p.y], [lerp(p.x, ex, 0.5), lerp(p.y, ey, 0.5) - 14 * s], [ex, ey]], { w: 9 * s, prof: K.prof.tail, dry: 0.3, seed: seed + b, step: 4 });
      for (let c = 0; c < 3; c++) {
        const f = 0.45 + c * 0.3;
        K.needles(g, lerp(p.x, ex, f) + sw * f * 0.4, lerp(p.y, ey, f) - (c === 1 ? 20 : 8) * s, (58 - b * 3 - c * 4) * s, seed + b * 9 + c);
      }
    }
  };

  // ---------- torii
  K.torii = (g, x, y, s, color) => {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = color || K.INK;
    const pil = (px, lean) => {
      g.beginPath();
      g.moveTo(px - 7, 0);
      g.lineTo(px + 7, 0);
      g.lineTo(px + 5 + lean, -132);
      g.lineTo(px - 5 + lean, -132);
      g.closePath();
      g.fill();
    };
    pil(-52, 5);
    pil(52, -5);
    g.fillRect(-64, -104, 128, 9); // nuki
    g.fillRect(-4, -132, 8, 30); // gakuzuka
    g.beginPath(); // shimaki
    g.moveTo(-70, -132);
    g.lineTo(70, -132);
    g.lineTo(72, -142);
    g.lineTo(-72, -142);
    g.closePath();
    g.fill();
    g.beginPath(); // kasagi, ends swept up
    g.moveTo(-88, -146);
    g.quadraticCurveTo(0, -136, 88, -146);
    g.lineTo(96, -164);
    g.quadraticCurveTo(0, -150, -96, -164);
    g.closePath();
    g.fill();
    g.restore();
  };

  // ---------- rock / cliff mass: top edge points, filled to `bottom`
  K.rock = (g, top, bottom, seed, o = {}) => {
    const L = K.layer(o.layer || "rock");
    L.setTransform(g.getTransform());
    const P = K.path(top, 8);
    L.beginPath();
    L.moveTo(P.x[0], bottom);
    for (let i = 0; i < P.n; i++) L.lineTo(P.x[i], P.y[i] + (n1(i * 0.21, seed) - 0.5) * 7);
    L.lineTo(P.x[P.n - 1], bottom);
    L.closePath();
    L.fillStyle = K.ink(o.a == null ? 0.93 : o.a);
    L.fill();
    // dry drags of the brush let paper through
    L.globalCompositeOperation = "destination-out";
    L.lineCap = "round";
    const R = K.rng(seed);
    const n = o.drags == null ? 70 : o.drags;
    for (let i = 0; i < n; i++) {
      const u = R(),
        p = K.at(P, u);
      const dy = 14 + Math.pow(R(), 1.6) * (bottom - p.y) * 0.9;
      const l = 30 + R() * 190;
      const sl = (R() - 0.3) * 0.5;
      L.globalAlpha = 0.1 + R() * 0.3;
      L.lineWidth = 1 + R() * 4;
      L.beginPath();
      L.moveTo(p.x - l / 2, p.y + dy - sl * l * 0.5);
      L.lineTo(p.x + l / 2, p.y + dy + sl * l * 0.5);
      L.stroke();
    }
    L.globalCompositeOperation = "source-over";
    L.globalAlpha = 1;
    K.stroke(L, P, { w: o.lw || 16, prof: K.prof.line, dry: 0.35, dryStart: 0, seed: seed + 3, step: 8, edge: 0.5 });
    K.put(g, L, { op: "multiply", f: o.f });
    return P;
  };
  K.grass = (g, P, u0, u1, n, t, seed, o = {}) => {
    g.save();
    g.strokeStyle = K.INK;
    g.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const u = lerp(u0, u1, hash(i, seed, 1));
      const p = K.at(P, u);
      const h = (o.h || 26) * (0.5 + hash(i, seed, 2));
      const wind = (o.wind == null ? -1 : o.wind) * (0.45 + 0.4 * Math.sin(t * 5 + p.x * 0.013 + hash(i, seed, 3) * 2));
      g.lineWidth = 1.4 + hash(i, seed, 4) * 2.2;
      g.beginPath();
      g.moveTo(p.x, p.y + 3);
      g.quadraticCurveTo(p.x + wind * h * 0.2, p.y - h * 0.6, p.x + wind * h * 0.85, p.y - h);
      g.stroke();
    }
    g.restore();
  };

  // ---------- erasure: the painting is wiped back to clean paper
  /* front(y) -> x. Everything on `side` (+1 = right of the front, -1 = left) is wiped. */
  K.erase = (g, front, side, o = {}) => {
    g.save();
    g.beginPath();
    const edge = side > 0 ? W + 300 : -300;
    g.moveTo(edge, -40);
    for (let y = -40; y <= H + 40; y += 5) g.lineTo(front(y), y);
    g.lineTo(edge, H + 40);
    g.closePath();
    g.clip();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(K.paper, 0, 0);
    g.fillStyle = o.tint || "rgba(249,245,234,0.78)";
    g.fillRect(0, 0, W, H);
    g.restore();
  };
  /* a ragged eraser front: slow wander + thin fingers where the wipe ran ahead */
  K.frontX = (base, y, seed, amp = 1) =>
    base + (K.fbm1(y / 150, seed, 3) - 0.5) * 190 * amp - Math.pow(n1(y / 9, seed + 7), 5) * 240 * amp - Math.pow(n1(y / 3.1, seed + 9), 3) * 26 * amp;

  // ---------- colour (only after the stroke)
  K.COL = {
    indigo: [36, 64, 110],
    viridian: [47, 107, 90],
    deep: [28, 70, 74],
    ochre: [217, 164, 65],
    peach: [240, 150, 96],
    sakura: [242, 184, 198],
    sky: [84, 140, 190],
  };
  K.skyColor = (g) => {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, 820);
    gr.addColorStop(0, "rgba(40,78,140,0.92)");
    gr.addColorStop(0.32, "rgba(96,150,196,0.75)");
    gr.addColorStop(0.58, "rgba(244,196,150,0.62)");
    gr.addColorStop(0.8, "rgba(240,150,96,0.5)");
    gr.addColorStop(1, "rgba(240,150,96,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, 820);
    g.restore();
  };
  K.petal = (g, x, y, s, rot, color) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-s, 0);
    g.bezierCurveTo(-s * 0.5, -s * 0.75, s * 0.6, -s * 0.6, s, -s * 0.08);
    g.lineTo(s * 0.72, 0);
    g.lineTo(s, s * 0.1);
    g.bezierCurveTo(s * 0.6, s * 0.6, -s * 0.5, s * 0.7, -s, 0);
    g.fill();
    g.restore();
  };
})();
