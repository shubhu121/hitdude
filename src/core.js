/* HITOFUDE — core: math, seeded noise, layers, paper, the brush engine.
   Everything is a pure function of its arguments: no Math.random, no clocks. */
(function () {
  "use strict";
  const K = (window.K = {});
  const W = (K.W = 1920),
    H = (K.H = 1080);
  K.FPS = 24;
  K.INK = "#15110e";
  K.RED = "#d2311c";
  K.PAPER = "#ebe3d0";
  K.BLANK = "#f9f5ea";
  K.ink = (a) => `rgba(21,17,14,${a})`;
  K.red = (a) => `rgba(210,49,28,${a})`;
  K.pap = (a) => `rgba(235,227,208,${a})`;

  // ---------- math
  const clamp = (K.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x));
  const lerp = (K.lerp = (a, b, t) => a + (b - a) * t);
  const inv = (K.inv = (a, b, x) => clamp((x - a) / (b - a)));
  const smooth = (K.smooth = (x) => x * x * (3 - 2 * x));
  K.ss = (a, b, x) => smooth(inv(a, b, x));
  K.TAU = Math.PI * 2;
  K.rad = (d) => (d * Math.PI) / 180;
  K.ease = {
    lin: (x) => x,
    in2: (x) => x * x,
    in3: (x) => x * x * x,
    in5: (x) => x * x * x * x * x,
    out2: (x) => 1 - (1 - x) * (1 - x),
    out3: (x) => 1 - Math.pow(1 - x, 3),
    out5: (x) => 1 - Math.pow(1 - x, 5),
    io3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: (x) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
    },
  };
  function h32(a) {
    a |= 0;
    a = Math.imul(a ^ (a >>> 16), 0x45d9f3b);
    a = Math.imul(a ^ (a >>> 16), 0x45d9f3b);
    a ^= a >>> 16;
    return (a >>> 0) / 4294967296;
  }
  const hash = (K.hash = (i, j = 0, k = 0) =>
    h32(Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 1274126177) ^ 0x9e3779b9));
  K.rng = (seed) => {
    let a = (seed * 2654435761) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const n1 = (K.n1 = (x, seed = 0) => {
    const i = Math.floor(x),
      f = x - i,
      u = f * f * (3 - 2 * f);
    return lerp(hash(i, seed), hash(i + 1, seed), u);
  });
  const n2 = (K.n2 = (x, y, seed = 0) => {
    const i = Math.floor(x),
      j = Math.floor(y),
      fx = x - i,
      fy = y - j;
    const u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(i, j, seed), hash(i + 1, j, seed), u), lerp(hash(i, j + 1, seed), hash(i + 1, j + 1, seed), u), v);
  });
  K.fbm1 = (x, seed = 0, oct = 4) => {
    let s = 0,
      a = 0.5,
      t = 0;
    for (let o = 0; o < oct; o++) {
      s += n1(x, seed + o * 31) * a;
      t += a;
      a *= 0.5;
      x *= 2.03;
    }
    return s / t;
  };
  K.fbm2 = (x, y, seed = 0, oct = 4) => {
    let s = 0,
      a = 0.5,
      t = 0;
    for (let o = 0; o < oct; o++) {
      s += n2(x, y, seed + o * 31) * a;
      t += a;
      a *= 0.5;
      x *= 2.03;
      y *= 2.03;
    }
    return s / t;
  };

  // ---------- film time
  K.frame = (t) => Math.floor(t * K.FPS + 1e-4);
  K.on2 = (t) => (Math.floor(K.frame(t) / 2) * 2) / K.FPS; // characters: 12 drawings a second
  K.on3 = (t) => (Math.floor(K.frame(t) / 3) * 3) / K.FPS; // fx: 8 drawings a second
  K.boil = (t) => Math.floor(K.frame(t) / 3) % 4;

  // ---------- layers
  const pool = {};
  K.layer = (name, w = W, h = H) => {
    let c = pool[name];
    if (!c) {
      c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.g = c.getContext("2d");
      pool[name] = c;
    }
    const g = c.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.filter = "none";
    g.shadowColor = "transparent";
    g.shadowBlur = 0;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.clearRect(0, 0, w, h);
    return g;
  };
  /* Put a layer onto g. o.f = svg filter id (edges), o.op = composite op, o.a = alpha, o.shadow = [dx,dy,blur,alpha] */
  K.put = (g, src, o = {}) => {
    const c = src.canvas || src;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = o.a == null ? 1 : o.a;
    g.globalCompositeOperation = o.op || "source-over";
    if (o.shadow) {
      g.shadowColor = `rgba(46,32,16,${o.shadow[3]})`;
      g.shadowOffsetX = o.shadow[0];
      g.shadowOffsetY = o.shadow[1];
      g.shadowBlur = o.shadow[2];
    }
    g.filter = o.f ? `url(#${o.f})` : "none";
    g.drawImage(c, o.x || 0, o.y || 0);
    g.restore();
  };

  // ---------- paper
  K.buildPaper = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    // low-frequency mottling at 1/6 size, then upscaled
    const lw = 320,
      lh = 180;
    const lc = document.createElement("canvas");
    lc.width = lw;
    lc.height = lh;
    const lg = lc.getContext("2d");
    const lid = lg.createImageData(lw, lh);
    for (let y = 0; y < lh; y++)
      for (let x = 0; x < lw; x++) {
        const v = (K.fbm2(x / 46, y / 46, 11, 4) - 0.5) * 22 + (n2(x / 9, y / 9, 5) - 0.5) * 6;
        const i = (y * lw + x) * 4;
        lid.data[i] = 235 + v;
        lid.data[i + 1] = 227 + v;
        lid.data[i + 2] = 208 + v * 1.15;
        lid.data[i + 3] = 255;
      }
    lg.putImageData(lid, 0, 0);
    g.imageSmoothingQuality = "high";
    g.drawImage(lc, 0, 0, W, H);
    // tooth: fine grain
    const id = g.getImageData(0, 0, W, H),
      d = id.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = (hash(x, y, 3) - 0.5) * 11 + (hash(x >> 1, y >> 1, 8) - 0.5) * 6;
        const i = (y * W + x) * 4;
        d[i] += v;
        d[i + 1] += v;
        d[i + 2] += v;
      }
    g.putImageData(id, 0, 0);
    // fibres
    const R = K.rng(77);
    g.lineCap = "round";
    for (let i = 0; i < 2600; i++) {
      const x = R() * W,
        y = R() * H,
        a = R() * K.TAU,
        l = 14 + R() * 70,
        b = (R() - 0.5) * 0.9;
      g.strokeStyle = R() < 0.6 ? `rgba(255,250,236,${0.1 + R() * 0.16})` : `rgba(110,88,58,${0.04 + R() * 0.07})`;
      g.lineWidth = 0.6 + R() * 1.1;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + b) * l * 0.5, y + Math.sin(a + b) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // aged edges
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.08);
    vg.addColorStop(0, "rgba(120,92,50,0)");
    vg.addColorStop(1, "rgba(120,92,50,0.16)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    K.paper = c;
  };

  // ---------- paths
  /* Catmull-Rom through pts, resampled every `step` px. Returns arrays + normals. */
  K.path = (pts, step = 5) => {
    const D = [];
    const n = pts.length;
    if (n === 2) D.push(pts[0], pts[1]);
    else {
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)],
          p1 = pts[i],
          p2 = pts[i + 1],
          p3 = pts[Math.min(n - 1, i + 2)];
        const segs = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 8));
        for (let j = 0; j < segs; j++) {
          const t = j / segs,
            t2 = t * t,
            t3 = t2 * t;
          D.push([
            0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
            0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
          ]);
        }
      }
      D.push(pts[n - 1]);
    }
    const cum = [0];
    for (let i = 1; i < D.length; i++) cum.push(cum[i - 1] + Math.hypot(D[i][0] - D[i - 1][0], D[i][1] - D[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    const m = Math.max(2, Math.round(L / step) + 1);
    const X = new Float32Array(m),
      Y = new Float32Array(m),
      NX = new Float32Array(m),
      NY = new Float32Array(m);
    let k = 0;
    for (let i = 0; i < m; i++) {
      const d = (i / (m - 1)) * L;
      while (k < cum.length - 2 && cum[k + 1] < d) k++;
      const sl = cum[k + 1] - cum[k] || 1,
        f = (d - cum[k]) / sl;
      X[i] = lerp(D[k][0], D[k + 1][0], f);
      Y[i] = lerp(D[k][1], D[k + 1][1], f);
    }
    for (let i = 0; i < m; i++) {
      const a = Math.max(0, i - 1),
        b = Math.min(m - 1, i + 1);
      let tx = X[b] - X[a],
        ty = Y[b] - Y[a];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      NX[i] = -ty;
      NY[i] = tx;
    }
    return { x: X, y: Y, nx: NX, ny: NY, len: L, n: m };
  };
  K.at = (P, u) => {
    const f = clamp(u) * (P.n - 1),
      i = Math.min(P.n - 2, Math.floor(f)),
      r = f - i;
    return {
      x: lerp(P.x[i], P.x[i + 1], r),
      y: lerp(P.y[i], P.y[i + 1], r),
      nx: P.nx[i],
      ny: P.ny[i],
      ang: Math.atan2(P.nx[i] * -1, P.ny[i]) /* tangent angle */,
    };
  };

  // ---------- the brush
  K.prof = {
    brush: (u) => lerp(0.55, 1, K.ss(0, 0.06, u)) * lerp(1, 0.3, Math.pow(K.ss(0.55, 1, u), 1.4)),
    taper: (u) => Math.pow(Math.sin(Math.PI * clamp(u, 0.001, 0.999)), 0.7),
    flat: () => 1,
    tail: (u) => lerp(0.7, 1, K.ss(0, 0.08, u)) * (1 - 0.94 * Math.pow(u, 1.6)),
    slash: (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0.001, 0.999), 0.62)), 1.1),
    line: (u) => 0.75 + 0.25 * Math.sin(Math.PI * u),
  };
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = H;
  const sg = scratch.getContext("2d");
  /* One brush stroke along pts (points or a K.path).
     o: w, prof, color, alpha, dry (0..1 bare-paper streaks), dryStart, prog (0..1 write-on), from, seed, streak (px), edge */
  K.stroke = (g, pts, o = {}) => {
    const P = pts.x ? pts : K.path(pts, o.step || 5);
    const n = P.n;
    const w = o.w || 30,
      seed = o.seed || 1;
    const prog = o.prog == null ? 1 : clamp(o.prog),
      from = clamp(o.from || 0);
    const prof = o.prof || K.prof.brush;
    const dry = o.dry == null ? 0.5 : o.dry;
    const i0 = Math.floor(from * (n - 1)),
      i1 = Math.ceil(prog * (n - 1));
    if (i1 - i0 < 1 || prog <= 0) return;
    const m = g.getTransform();
    const sc = Math.hypot(m.a, m.b);
    const edge = o.edge == null ? 0.26 : o.edge;
    const hw = new Float32Array(n);
    let x0 = 1e9,
      y0 = 1e9,
      x1 = -1e9,
      y1 = -1e9;
    for (let i = i0; i <= i1; i++) {
      const u = i / (n - 1);
      hw[i] = 0.5 * w * prof(u);
      const dx = m.a * P.x[i] + m.c * P.y[i] + m.e,
        dy = m.b * P.x[i] + m.d * P.y[i] + m.f;
      if (dx < x0) x0 = dx;
      if (dx > x1) x1 = dx;
      if (dy < y0) y0 = dy;
      if (dy > y1) y1 = dy;
    }
    const pad = w * sc * 0.75 + 6;
    x0 = Math.max(0, Math.floor(x0 - pad));
    y0 = Math.max(0, Math.floor(y0 - pad));
    x1 = Math.min(W, Math.ceil(x1 + pad));
    y1 = Math.min(H, Math.ceil(y1 + pad));
    if (x1 <= x0 || y1 <= y0) return;
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = "source-over";
    sg.globalAlpha = 1;
    sg.clearRect(x0, y0, x1 - x0, y1 - y0);
    sg.setTransform(m);
    // body
    const nf = P.len / Math.max(8, w * 0.9);
    sg.beginPath();
    for (let i = i0; i <= i1; i++) {
      const u = i / (n - 1);
      const h = hw[i] * (1 + (n1(u * nf, seed) - 0.5) * 2 * edge);
      const x = P.x[i] + P.nx[i] * h,
        y = P.y[i] + P.ny[i] * h;
      if (i === i0) sg.moveTo(x, y);
      else sg.lineTo(x, y);
    }
    // round, loaded tip while the stroke is still being written
    for (let i = i1; i >= i0; i--) {
      const u = i / (n - 1);
      const h = hw[i] * (1 + (n1(u * nf, seed + 50) - 0.5) * 2 * edge);
      sg.lineTo(P.x[i] - P.nx[i] * h, P.y[i] - P.ny[i] * h);
    }
    sg.closePath();
    sg.fillStyle = o.color || K.INK;
    sg.fill();
    if (prog < 1 && hw[i1] > 1) {
      sg.beginPath();
      sg.arc(P.x[i1], P.y[i1], hw[i1] * 1.02, 0, K.TAU);
      sg.fill();
    }
    // kasure: bristles that ran out of ink
    if (dry > 0) {
      sg.globalCompositeOperation = "destination-out";
      sg.lineCap = "round";
      const B = clamp(Math.round((w * Math.max(1, sc * 0.9)) / 3.4), 4, 80);
      const streak = o.streak || Math.max(60, w * 2.2);
      const ds = o.dryStart == null ? 0.3 : o.dryStart;
      for (let b = 0; b < B; b++) {
        const v = ((b + 0.2 + hash(b, seed, 4) * 0.6) / B) * 2 - 1;
        const bias = hash(b, seed, 9);
        const lw = (w / B) * (0.55 + hash(b, seed, 7) * 1.0);
        const ev = Math.abs(v);
        sg.lineWidth = lw;
        sg.globalAlpha = 0.55 + bias * 0.45;
        let run = false;
        for (let i = i0; i <= i1; i++) {
          const u = i / (n - 1);
          const D = dry * (0.07 + 0.93 * K.ss(ds, 1, u)) * (0.45 + 1.0 * bias) * (0.75 + 0.5 * ev);
          const nv = n1((u * P.len) / streak + b * 17.31, seed + b * 3);
          const on = nv < D;
          if (on) {
            const x = P.x[i] + P.nx[i] * v * hw[i] * 0.97,
              y = P.y[i] + P.ny[i] * v * hw[i] * 0.97;
            if (!run) {
              sg.beginPath();
              sg.moveTo(x, y);
              run = true;
            } else sg.lineTo(x, y);
          } else if (run) {
            sg.stroke();
            run = false;
          }
        }
        if (run) sg.stroke();
      }
      sg.globalCompositeOperation = "source-over";
      sg.globalAlpha = 1;
    }
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.drawImage(scratch, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    g.restore();
  };

  /* ink flecks thrown from a point */
  K.splat = (g, x, y, r, seed, n = 14, o = {}) => {
    const R = K.rng(seed);
    g.save();
    g.fillStyle = o.color || K.INK;
    for (let i = 0; i < n; i++) {
      const a = o.dir != null ? o.dir + (R() - 0.5) * (o.spread || 1.2) : R() * K.TAU;
      const d = r * (0.15 + 0.85 * Math.pow(R(), 0.7)) * (o.dist || 1);
      const s = Math.min(o.max || 22, r * (0.008 + Math.pow(R(), 3) * 0.075) * (o.size || 1));
      g.save();
      g.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, s * (1 + R() * 1.8), s, 0, 0, K.TAU);
      g.fill();
      if (R() < 0.35) {
        g.beginPath();
        g.moveTo(0, -s * 0.6);
        g.lineTo(-s * (3 + R() * 6), 0);
        g.lineTo(0, s * 0.6);
        g.fill();
      }
      g.restore();
    }
    if (o.core) {
      g.beginPath();
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * K.TAU,
          rr = r * o.core * (0.75 + n1(i * 0.9, seed) * 0.5);
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    }
    g.restore();
  };

  /* ink thrown off a moving brush: teardrops that point back at where they came from, with satellites.
     P: the path of the stroke. o: n, reach (px), grow (0..1: how far they have flown), big (px), seed, color, u0/u1 */
  K.spatter = (g, P, o = {}) => {
    const R = K.rng(o.seed || 1),
      n = o.n || 80,
      reach = o.reach || 400,
      grow = o.grow == null ? 1 : o.grow,
      big = o.big || 14;
    g.save();
    g.fillStyle = o.color || K.INK;
    for (let i = 0; i < n; i++) {
      const u = lerp(o.u0 == null ? 0.2 : o.u0, o.u1 == null ? 1 : o.u1, Math.pow(R(), 0.75));
      const p = K.at(P, u);
      const tx = p.ny,
        ty = -p.nx;
      const side = R() < 0.5 ? -1 : 1;
      const fwd = (o.fwd == null ? 0.25 : o.fwd) + R() * 0.9,
        lat = side * (0.25 + R());
      let dx = tx * fwd + p.nx * lat,
        dy = ty * fwd + p.ny * lat;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const far = Math.pow(R(), 1.8);
      const d = (18 + reach * far) * grow;
      const r = Math.max(1.1, big * Math.pow(R(), 3.2) * (1 - 0.55 * far));
      const tail = r > 3 ? r * (2.2 + R() * 4.5) : 0;
      const qs = [R(), R(), R()];
      g.save();
      g.translate(p.x + dx * d, p.y + dy * d);
      g.rotate(Math.atan2(dy, dx));
      g.beginPath();
      if (tail) {
        g.moveTo(-tail, 0);
        g.quadraticCurveTo(-r * 0.9, -r * 0.95, 0, -r);
        g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
        g.quadraticCurveTo(-r * 0.9, r * 0.95, -tail, 0);
      } else g.arc(0, 0, r, 0, K.TAU);
      g.fill();
      if (r > 5) {
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.arc(r * (1.7 + qs[k] * 3.6), (qs[(k + 1) % 3] - 0.5) * r * 1.7, r * (0.12 + qs[(k + 2) % 3] * 0.2), 0, K.TAU);
          g.fill();
        }
      }
      g.restore();
    }
    g.restore();
  };

  /* a ribbon that trails: scarf, ponytail, whisker */
  K.ribbon = (g, x, y, ang, len, w0, w1, t, o = {}) => {
    const n = o.n || 16,
      amp = o.amp == null ? len * 0.09 : o.amp,
      k = o.k || 1.6,
      sp = o.speed || 9,
      ph = o.phase || 0,
      droop = o.droop || 0;
    const cx = Math.cos(ang),
      cy = Math.sin(ang);
    const L = [],
      Rt = [];
    let px = x,
      py = y;
    const seg = len / n;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const d = i / n;
      const wv = amp * Math.pow(d, 0.85) * Math.sin(d * k * K.TAU - t * sp + ph) + (o.curl || 0) * len * d * d;
      pts.push([x + cx * seg * i - cy * wv, y + cy * seg * i + cx * wv + droop * d * d]);
    }
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(n, i + 1)];
      let tx = b[0] - a[0],
        ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const d = i / n;
      const hw = 0.5 * lerp(w0, w1, d) * (1 + 0.25 * Math.sin(d * k * K.TAU * 1.7 - t * sp * 1.3 + ph));
      L.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]);
      Rt.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
    g.closePath();
    g.fillStyle = o.color || K.INK;
    g.fill();
    return pts;
  };

  /* kanji painted stroke by stroke. strokes are point lists in a 100 box. */
  K.kanji = (g, strokes, x, y, size, o = {}) => {
    const N = strokes.length,
      prog = o.prog == null ? 1 : o.prog;
    for (let i = 0; i < N; i++) {
      const p = clamp(prog * N - i);
      if (p <= 0) break;
      const pts = strokes[i].map((q) => [x + (q[0] / 100) * size, y + (q[1] / 100) * size]);
      K.stroke(g, pts, {
        w: (o.w || 0.1) * size,
        prog: p,
        dry: o.dry == null ? 0.35 : o.dry,
        seed: (o.seed || 5) + i * 7,
        color: o.color,
        prof: o.prof || K.prof.brush,
        step: 3,
        streak: size * 0.5,
        edge: o.edge,
      });
    }
  };
  K.GLYPH = {
    ichi: [[[8, 50], [50, 47], [92, 50]]],
    shiro: [
      [[54, 4], [50, 14], [42, 24]],
      [[25, 27], [26, 60], [25, 93]],
      [[25, 28], [50, 26], [75, 26], [77, 28], [77, 60], [76, 93]],
      [[28, 58], [50, 57], [74, 58]],
      [[27, 91], [50, 90], [75, 91]],
    ],
    fude: [
      [[24, 5], [18, 14], [9, 22]],
      [[17, 13], [30, 12], [44, 13]],
      [[28, 17], [31, 23], [34, 29]],
      [[66, 5], [60, 14], [52, 22]],
      [[60, 13], [75, 12], [91, 13]],
      [[72, 17], [75, 23], [78, 29]],
      [[24, 42], [50, 41], [75, 42], [76, 43], [76, 52], [76, 62]],
      [[8, 52], [50, 51], [92, 52]],
      [[24, 62], [50, 61], [76, 62]],
      [[20, 74], [50, 73], [80, 74]],
      [[8, 86], [50, 85], [92, 86]],
      [[50, 33], [50, 66], [50, 99]],
    ],
  };

  /* tracked caps */
  K.text = (g, str, x, y, o = {}) => {
    const size = o.size || 40,
      track = (o.track == null ? 0.42 : o.track) * size;
    g.save();
    g.font = `${o.weight || 500} ${size}px "EB Garamond", serif`;
    g.textBaseline = "alphabetic";
    g.fillStyle = o.color || K.INK;
    let wsum = 0;
    const ws = [];
    for (const ch of str) {
      const w = g.measureText(ch).width;
      ws.push(w);
      wsum += w + track;
    }
    wsum -= track;
    let cx = o.align === "center" ? x - wsum / 2 : o.align === "right" ? x - wsum : x;
    const chars = o.chars == null ? str.length : o.chars;
    let i = 0;
    for (const ch of str) {
      if (i < chars) {
        g.globalAlpha = (o.alpha == null ? 1 : o.alpha) * clamp(chars - i);
        g.fillText(ch, cx, y);
      }
      cx += ws[i] + track;
      i++;
    }
    g.restore();
    return wsum;
  };

  /* soft band of mist: removes ink so the paper shows */
  K.mist = (g, y, h, s) => {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-out";
    const gr = g.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.5, `rgba(0,0,0,${s})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, y - h, W, h * 2);
    g.restore();
  };

  /* camera for a layer at parallax depth p (0 = infinitely far, 1 = subject plane) */
  K.cam = (g, cam, p = 1) => {
    const z = 1 + ((cam.z || 1) - 1) * (0.25 + 0.75 * p);
    g.setTransform(z, 0, 0, z, W / 2 - (W / 2 + (cam.x || 0) * p) * z, H / 2 - (H / 2 + (cam.y || 0) * p) * z);
  };

  K.buildPaper();
})();
