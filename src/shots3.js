/* HITOFUDE — shots s11-s15: the coil and the yin-yang, the silence, 一, colour, the title. */
(function () {
  "use strict";
  const K = window.K,
    W = K.W,
    H = K.H;
  const { clamp, lerp, ss, inv, hash, n1 } = K;
  const E = K.ease;
  const shot = (id, t0, t1, fn) => K.SHOTS.push({ id, t0, t1, fn });
  const shake = K.shakeFn,
    blankGround = K.blankGround,
    flecks = K.flecks;
  const SH = "rgba(96,74,46,";

  // =========================================================== s11 — the coil, then the yin-yang
  const HK = 0.0074; // one full turn every ~850 px: few enough coils to read
  const NECK = 0.24;
  const helix = (sign, phi, headY) => {
    const pts = [];
    for (let i = 0; i <= 26; i++) {
      const y = headY + i * 54;
      const ph = y * HK - phi;
      const c = clamp(i / 6);
      // the necks peel apart and curl back in, so the two heads face each other
      const neck = 150 * (1 - c) + 215 * Math.sin(Math.PI * c);
      pts.push([960 + sign * (275 * Math.sin(ph) * K.smooth(clamp((i - 3.5) / 7)) + neck), y]);
    }
    return pts;
  };
  const frontRanges = (P, phi, sign) => {
    const out = [];
    let s = -1;
    for (let j = 0; j < P.n; j++) {
      const fr = sign * Math.cos(P.y[j] * HK - phi) > 0.05 || (sign > 0 && j / (P.n - 1) < NECK);
      if (fr && s < 0) s = j;
      if ((!fr || j === P.n - 1) && s >= 0) {
        if (j - s > 3) out.push([s / (P.n - 1), j / (P.n - 1)]);
        s = -1;
      }
    }
    return out;
  };
  const taiji = (g, cx, cy, R, rot, t, f) => {
    const b = K.boil(t);
    const B = K.layer("taiji");
    B.translate(cx, cy);
    B.rotate(rot);
    // the Blank: the whole disc, folded like a fan
    B.fillStyle = K.BLANK;
    for (let a = Math.PI + 0.5; a < K.TAU - 0.12; a += 0.17) {
      B.beginPath();
      B.moveTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
      B.lineTo(Math.cos(a - 0.07) * R * 1.085, Math.sin(a - 0.07) * R * 1.085);
      B.lineTo(Math.cos(a + 0.11) * R * 0.98, Math.sin(a + 0.11) * R * 0.98);
      B.fill();
    }
    B.beginPath();
    B.arc(0, 0, R, 0, K.TAU);
    B.fill();
    let q = 0;
    for (let a = 0; a < K.TAU; a += 0.196, q++) {
      if (q % 2 === 0) {
        B.fillStyle = SH + "0.08)";
        B.beginPath();
        B.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
        B.arc(0, 0, R, a, a + 0.196);
        B.closePath();
        B.fill();
      }
      B.strokeStyle = SH + "0.24)";
      B.lineWidth = 1.5;
      B.beginPath();
      B.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
      B.lineTo(Math.cos(a + 0.05) * R, Math.sin(a + 0.05) * R);
      B.stroke();
    }
    B.fillStyle = K.INK; // its eye: a punched hole
    B.beginPath();
    B.arc(R / 2, 0, R * 0.115, 0, K.TAU);
    B.fill();
    K.put(g, B, { shadow: [12, 16, 22, 0.34], f: "rgh" + b });
    // the ink dragon: one fish of the pair
    const I = K.layer("taijiInk");
    I.translate(cx, cy);
    I.rotate(rot);
    I.fillStyle = K.INK;
    for (let a = 0.5; a < Math.PI - 0.1; a += 0.17) {
      I.beginPath();
      I.moveTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
      I.lineTo(Math.cos(a - 0.08) * R * (1.07 + 0.05 * hash(Math.round(a * 10), 3)), Math.sin(a - 0.08) * R * (1.07 + 0.05 * hash(Math.round(a * 10), 3)));
      I.lineTo(Math.cos(a + 0.11) * R * 0.98, Math.sin(a + 0.11) * R * 0.98);
      I.fill();
    }
    const fish = () => {
      I.beginPath();
      I.arc(0, 0, R, 0, Math.PI, false);
      I.arc(-R / 2, 0, R / 2, Math.PI, K.TAU, false);
      I.arc(R / 2, 0, R / 2, Math.PI, 0, true);
      I.closePath();
    };
    fish();
    I.fill();
    I.save();
    fish();
    I.clip();
    I.globalCompositeOperation = "destination-out";
    I.lineCap = "round";
    for (let a = 0.3; a < 3.0; a += 0.1) {
      I.globalAlpha = 0.45 + 0.4 * hash(Math.round(a * 10), 5);
      I.lineWidth = 2 + 3 * hash(Math.round(a * 10), 6);
      I.beginPath();
      I.moveTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97);
      I.quadraticCurveTo(Math.cos(a - 0.14) * R * 0.7, Math.sin(a - 0.14) * R * 0.7, Math.cos(a + 0.06) * R * 0.42, Math.sin(a + 0.06) * R * 0.42);
      I.stroke();
    }
    for (let i = 0; i < 34; i++) {
      const r = R * (0.5 + 0.49 * hash(i, 7)),
        a0 = hash(i, 8) * 0.5 - 0.1,
        a1 = a0 + 0.25 + hash(i, 9) * 0.75;
      I.globalAlpha = 0.5 + 0.4 * hash(i, 10);
      I.lineWidth = 1.5 + hash(i, 11) * 5;
      I.beginPath();
      I.arc(0, 0, r, a0, a1);
      I.stroke();
    }
    I.globalAlpha = 1;
    I.beginPath(); // its eye: bare paper
    I.arc(-R / 2, 0, R * 0.115, 0, K.TAU);
    I.fill();
    I.restore();
    I.fillStyle = K.INK;
    I.beginPath();
    I.ellipse(-R / 2 + R * 0.01, 0, R * 0.03, R * 0.085, 0, 0, K.TAU);
    I.fill();
    K.put(g, I, { op: "multiply", f: "rgh" + b });
    // she is on its head: the scarf says so
    const hx = cx + Math.cos(rot + Math.PI) * R * 0.5,
      hy = cy + Math.sin(rot + Math.PI) * R * 0.5;
    const S = K.layer("hero");
    K.ribbon(S, hx + Math.cos(rot) * R * 0.2, hy + Math.sin(rot) * R * 0.2, rot + Math.PI / 2, R * 0.5, R * 0.05, R * 0.014, K.on2(t), { amp: R * 0.04, k: 1.4, speed: 14, color: K.RED, n: 14 });
    S.fillStyle = K.INK;
    S.beginPath();
    S.arc(hx + Math.cos(rot) * R * 0.2, hy + Math.sin(rot) * R * 0.2, R * 0.03, 0, K.TAU);
    S.fill();
    K.put(g, S, { op: "multiply", f: "rgh" + b });
  };
  shot("s11", 31.5, 35.0, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 31.5;
    blankGround(g);
    const b = K.boil(t);
    if (lt < 1.2) {
      const phi = 1.3 * l2 + 2.3 * l2 * l2 + 0.9;
      const hy = 340 - l2 * 40;
      const z = lerp(1.0, 1.08, lt / 1.2);
      g.save();
      g.setTransform(z, 0, 0, z, (W / 2) * (1 - z), (H / 2) * (1 - z));
      const PB = K.path(helix(-1, phi, hy), 9),
        PI2 = K.path(helix(1, phi, hy), 7);
      // depth, the way ink does it: what is behind is paler
      K.inkDragon(g, PI2, { w: 140, t: t2, noHead: true, a: 0.42 });
      K.blank(g, PB, { w: 150, jaw: 0.9, t: t2, headS: 1.35, f: "rgh" + b, whisk: Math.PI / 2 });
      for (const r of frontRanges(PI2, phi, 1)) K.inkDragon(g, PI2, { w: 140, t: t2, jaw: 0.8, u0: r[0], u1: r[1], noHead: r[0] > 0, f: "rgh" + b, whisk: Math.PI / 2 });
      for (const r of frontRanges(PB, phi, -1)) K.blank(g, PB, { w: 150, u0: Math.max(NECK, r[0]), u1: r[1], noHead: true, layer: "blank2" });
      // Sumi on the ink head
      const L = K.layer("hero");
      L.setTransform(g.getTransform());
      K.sumi(L, { x: PI2.x[0] + 70, y: PI2.y[0] - 150, s: 1.8, f: -1, pose: K.POSE.ride, t: t2, wind: Math.PI / 2 - 0.3, gust: 1 });
      K.put(g, L, { op: "multiply", f: "rgh" + b });
      g.restore();
      for (let i = 0; i < 16; i++) {
        const x = hash(i, 3, Math.floor(f / 3)) * W,
          y = hash(i, 4, Math.floor(f / 3)) * H;
        K.stroke(g, [[x, y], [x + 4, y + 240 + hash(i, 5) * 300]], { w: 3 + hash(i, 6) * 6, dry: 0.9, dryStart: 0, seed: i, alpha: 0.28, prof: K.prof.taper, step: 12 });
      }
      return {};
    }
    // from above
    const tau = lt - 1.2;
    const rot = 1.9 * tau + 3.4 * tau * tau - 0.5;
    const R = 400 * lerp(1.5, 1, E.out5(inv(0, 0.35, tau))) * lerp(1, 1.1, tau / 2.3);
    taiji(g, 960, 540, R, rot, t, f);
    // ink thrown off the spin
    const w = 1.9 + 6.8 * tau;
    g.save();
    g.strokeStyle = K.INK;
    g.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const fs = Math.floor(f / 2);
      const a = hash(i, 1, fs) * K.TAU,
        r = R * (1.14 + hash(i, 2, fs) * 0.75),
        len = (0.04 + 0.03 * w) * (0.4 + hash(i, 3));
      g.globalAlpha = 0.25 + 0.5 * hash(i, 4, fs);
      g.lineWidth = 2 + hash(i, 5) * 7;
      g.beginPath();
      g.arc(960, 540, r, a, a + len);
      g.stroke();
    }
    g.restore();
    return { shake: tau < 0.3 ? shake(tau, 14, f) : [(hash(f, 1) - 0.5) * tau * 3, (hash(f, 2) - 0.5) * tau * 3] };
  });

  // =========================================================== s12 — ma: all the ink there is
  const HEADSPINE = [
    [1230, 676],
    [1560, 664],
    [1860, 594],
    [2300, 544],
  ];
  const inkBall = (g, x, y, r, seed) => {
    g.save();
    g.fillStyle = K.INK;
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * K.TAU,
        q = r * (0.86 + 0.28 * n1(i * 0.7, seed) * (i === 28 ? 0 : 1) + (i === 28 ? 0.28 * n1(0, seed) : 0));
      g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.fill();
    for (let i = 0; i < 4; i++) {
      const dx = (hash(i, seed, 2) - 0.5) * r * 1.2,
        l = r * (0.5 + hash(i, 7) * 1.1);
      g.beginPath();
      g.moveTo(x + dx - r * 0.09, y + r * 0.6);
      g.lineTo(x + dx, y + r * 0.8 + l);
      g.lineTo(x + dx + r * 0.09, y + r * 0.6);
      g.fill();
      g.beginPath();
      g.arc(x + dx, y + r * 0.8 + l, r * 0.07, 0, K.TAU);
      g.fill();
    }
    g.restore();
  };
  shot("s12", 35.0, 37.5, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 35,
      b = K.boil(t);
    blankGround(g);
    const z = lerp(1.0, 1.09, lt / 2.5);
    const cam = { x: 0, y: 0, z };
    g.save();
    K.cam(g, cam, 0.85);
    K.blank(
      g,
      [
        [1330, 430],
        [1650, 400],
        [1930, 280],
        [2360, 240],
      ],
      { w: 430, jaw: lerp(0.3, 1, ss(0, 2.3, lt)), t: t2, headS: 1.5, whisk: Math.PI * 0.42, shadow: [16, 22, 30, 0.34] },
    );
    g.restore();
    const still = lt >= 1.3;
    const dis = inv(0.55, 1.3, lt);
    g.save();
    K.cam(g, cam, 1);
    if (dis < 1)
      K.inkDragon(
        g,
        [
          [600, 930],
          [300, 990],
          [-70, 1030],
          [-420, 1130],
        ],
        { w: 300, t: t2, jaw: 0.3, a: 1 - dis, f: "rgh" + b, whisk: Math.PI },
      );
    const pose = K.poseAt(
      [
        [0, K.POSE.ready],
        [0.5, K.POSE.raise, E.out5],
        [2.0, K.POSE.raise],
        [2.4, K.POSE.wind, E.io3],
      ],
      l2,
    );
    const L = K.layer("hero");
    L.setTransform(g.getTransform());
    const s = 3.5;
    const R = K.sumi(L, { x: 470, y: 792 - 45 * s, s, f: 1, pose, t: t2, wind: Math.PI + 0.1 * Math.sin(t2 * 2), gust: still ? 0.45 : 1 });
    const tip = R.tip;
    const r = 14 + 62 * E.out2(inv(0.1, 1.3, lt));
    L.setTransform(1, 0, 0, 1, 0, 0);
    // tip is in the layer's pre-camera space: draw the ball with the same camera
    L.setTransform(g.getTransform());
    inkBall(L, tip[0], tip[1] - r * 0.2, r, Math.floor(f / 3));
    // every drop of ink left in the world comes to her
    if (!still) {
      const amp = 1 - inv(1.05, 1.3, lt);
      for (let i = 0; i < 54; i++) {
        const fromDragon = i % 3 === 0;
        const a = hash(i, 1) * K.TAU;
        const sx = fromDragon ? 100 + hash(i, 2) * 560 : tip[0] + Math.cos(a) * (900 + hash(i, 3) * 900),
          sy = fromDragon ? 880 + hash(i, 3) * 160 : tip[1] + Math.sin(a) * (700 + hash(i, 4) * 700);
        const mx = lerp(sx, tip[0], 0.5) + (hash(i, 5) - 0.5) * 420,
          my = lerp(sy, tip[1], 0.5) + (hash(i, 6) - 0.5) * 420;
        const q = (lt * 1.5 + hash(i, 7)) % 1;
        K.stroke(L, [[sx, sy], [mx, my], [tip[0], tip[1]]], { w: (3 + hash(i, 8) * 9) * amp, prof: K.prof.taper, dry: 0.75, dryStart: 0, seed: i, from: Math.max(0, q - 0.3), prog: Math.min(1, q + 0.02), step: 8 });
      }
    }
    K.put(g, L, { op: "multiply", f: "rgh" + b });
    g.restore();
    if (still) flecks(g, t2, 12, 0, -40, 4, { r: 1.2, R: 4 });
    return {};
  });

  // =========================================================== s13 — 一
  const ICHI = [
    [150, 560],
    [560, 532],
    [1040, 524],
    [1480, 538],
    [1790, 556],
  ];
  const ichiProf = (u) => lerp(0.62, 1, ss(0, 0.05, u)) * lerp(1, 0.34, Math.pow(ss(0.5, 1, u), 1.3));
  K.ichi = (g, o = {}) => K.stroke(g, ICHI, Object.assign({ w: 132, prof: ichiProf, dry: 0.72, dryStart: 0.4, seed: 77, streak: 520, edge: 0.12 }, o));
  const cutHead = (g, t2, sep, a) => {
    const Lb = K.blank(g, HEADSPINE, { w: 420, jaw: 1, t: t2, headS: 1.5, noPut: true, whisk: Math.PI * 0.4 });
    const half = (up) => {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.beginPath();
      if (up) {
        g.moveTo(-50, -200);
        g.lineTo(W + 50, -200);
        g.lineTo(W + 50, 548);
        g.lineTo(-50, 540);
      } else {
        g.moveTo(-50, H + 200);
        g.lineTo(W + 50, H + 200);
        g.lineTo(W + 50, 548);
        g.lineTo(-50, 540);
      }
      g.closePath();
      g.clip();
      g.globalAlpha = a;
      g.shadowColor = "rgba(46,32,16,0.34)";
      g.shadowOffsetX = 14;
      g.shadowOffsetY = 20;
      g.shadowBlur = 28;
      g.translate(1000, 544);
      g.rotate((up ? -0.0012 : 0.0008) * sep);
      g.translate(-1000 + (up ? -sep * 0.9 : sep * 0.5), -544 + (up ? -sep * 1.15 : sep * 0.95));
      g.drawImage(Lb.canvas, 0, 0);
      g.restore();
    };
    half(true);
    half(false);
  };
  const drips = (g, amt) => {
    g.save();
    g.strokeStyle = K.INK;
    g.fillStyle = K.INK;
    g.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const x = 200 + hash(i, 31) * 900,
        l = (40 + hash(i, 32) * 170) * amt * (hash(i, 34) < 0.7 ? 1 : 0.3);
      const y0 = 560 + (x - 150) * -0.03 + 50;
      const w = 4 + hash(i, 33) * 6;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y0 + l);
      g.stroke();
      g.beginPath();
      g.arc(x, y0 + l, w * 0.85, 0, K.TAU);
      g.fill();
    }
    g.restore();
  };
  shot("s13", 37.5, 39.5, (g, lt, t, f) => {
    const k = f - K.frame(37.75),
      dt = lt - 0.25,
      t2 = K.on2(t),
      b = K.boil(t);
    if (k === 0) {
      g.fillStyle = K.INK;
      g.fillRect(0, 0, W, H);
      K.ichi(g, { color: K.BLANK, w: 150, dry: 0.3 });
      return {};
    }
    if (k === 1) {
      g.fillStyle = K.RED;
      g.fillRect(0, 0, W, H);
      K.ichi(g, { w: 176, dry: 0.3 });
      return { shake: [-20, 9] };
    }
    blankGround(g);
    if (k < 0) {
      K.blank(g, HEADSPINE, { w: 420, jaw: 1, t: t2, headS: 1.5, whisk: Math.PI * 0.4, shadow: [14, 20, 28, 0.34] });
      const q = inv(0, 0.25, lt);
      const L = K.layer("hero");
      const pose = Object.assign({}, K.POSE.wind, { hipY: 3 + 10 * q, lean: -16 - 8 * q });
      const R = K.sumi(L, { x: 232 - 26 * q, y: 566 - 45 * 2.4, s: 2.4, f: 1, pose, t: t2, wind: Math.PI, gust: 0.6 });
      inkBall(L, R.tip[0], R.tip[1], 44, Math.floor(f / 2));
      K.put(g, L, { op: "multiply", f: "rgh" + b });
      return {};
    }
    const sep = 10 + 66 * E.out3(inv(0, 1.75, dt));
    if (k > 2) cutHead(g, t2, sep, 1);
    const L = K.layer("ichi");
    K.ichi(L, k === 2 ? { w: 164, dry: 0.5 } : {});
    K.splat(L, 170, 560, 220, 5, 34, { size: 1.0 });
    K.splat(L, 1000, 536, 900, 6, 70, { dir: 0, spread: 0.3, size: 0.45, max: 9 });
    drips(L, E.out2(inv(0.15, 1.75, dt)));
    K.put(g, L, { op: "multiply", f: "rgh" + b });
    if (k === 2) {
      for (let i = 0; i < 46; i++) {
        const y = hash(i, 9) * H,
          x = hash(i, 10) * W;
        K.stroke(g, [[x - 300 - hash(i, 8) * 400, y], [x, y + 2]], { w: 3 + hash(i, 8) * 9, dry: 0.8, dryStart: 0, seed: i, prof: K.prof.taper, alpha: 0.7, step: 12 });
      }
    }
    const H1 = K.layer("hero");
    K.sumi(H1, { x: 1806, y: 548, s: 2.4, f: 1, pose: K.POSE.through, t: t2, wind: Math.PI + 0.1, gust: 1 - 0.5 * inv(0.3, 1.75, dt) });
    K.put(g, H1, { op: "multiply", f: "rgh" + b });
    return { shake: shake(dt - 0.08, 28, f) };
  });

  // =========================================================== s14 — colour comes back
  const colorWorld = (g, cam, sun) => {
    const C = K.layer("col");
    K.skyColor(C);
    K.put(g, C, { op: "multiply" });
    K.landscape(g, cam, { col: [[58, 86, 150], [52, 128, 104], [30, 84, 82]], ca: 0.78 });
    K.landscape(g, cam, { a: 0.5 });
    g.save();
    K.cam(g, cam, 0.15);
    K.sun(g, sun[0], sun[1], sun[2]);
    g.restore();
  };
  const PINK = (a) => `rgba(240,160,182,${a})`;
  const driftPetals = (g, t, n, seed, o = {}) => {
    const t2 = K.on2(t);
    for (let i = 0; i < n; i++) {
      const sp = 0.5 + hash(i, seed, 3);
      const x = ((hash(i, seed, 1) * 2500 + t2 * (150 + 160 * sp)) % 2500) - 280;
      const y = ((hash(i, seed, 2) * 1300 + t2 * (40 + 50 * sp) + 60 * Math.sin(t2 * 1.4 + i)) % 1300) - 110;
      const s = (o.s || 9) * (0.6 + hash(i, seed, 4) * 1.2);
      K.petal(g, x, y, s, t2 * (2 + sp * 3) + i, hash(i, seed, 5) < 0.3 ? "rgba(250,244,236,0.95)" : PINK(0.92));
    }
  };
  shot("s14", 39.5, 45.0, (g, lt, t, f) => {
    const t2 = K.on2(t),
      b = K.boil(t);
    if (lt < 2.0) {
      blankGround(g);
      // the colour world, let through a band that bleeds out of the stroke
      const R = K.layer("reveal");
      R.drawImage(K.paper, 0, 0);
      colorWorld(R, { x: 30, y: 0, z: 1.06 }, [1392, 262, 98]);
      const M = K.layer("mask");
      const rr = 2700 * Math.pow(inv(0, 1.9, lt), 1.5);
      M.fillStyle = "#000";
      M.beginPath();
      for (let x = -40; x <= W + 40; x += 20) M.lineTo(x, 545 - rr * (0.35 + 1.1 * K.fbm1(x / 300, 5, 3)) - 30 * n1(x / 23, 9) * Math.min(1, rr / 200));
      for (let x = W + 40; x >= -40; x -= 20) M.lineTo(x, 545 + rr * (0.35 + 1.1 * K.fbm1(x / 280, 15, 3)) + 30 * n1(x / 23, 19) * Math.min(1, rr / 200));
      M.closePath();
      M.fill();
      R.globalCompositeOperation = "destination-in";
      R.filter = "blur(14px)";
      R.drawImage(M.canvas, 0, 0);
      R.filter = "none";
      R.globalCompositeOperation = "source-over";
      K.put(g, R, {});
      // the Blank comes apart
      const ha = 1 - inv(0.1, 0.8, lt);
      if (ha > 0) cutHead(g, t2, 76 + lt * 90, ha);
      const L = K.layer("ichi");
      K.ichi(L, {});
      K.splat(L, 170, 560, 220, 5, 34, { size: 1.0 });
      K.splat(L, 1000, 536, 900, 6, 70, { dir: 0, spread: 0.3, size: 0.45, max: 9 });
      drips(L, 1);
      K.put(g, L, { op: "multiply", f: "rgh" + b });
      // petals: every scrap of it
      const l2 = t2 - 39.5;
      for (let i = 0; i < 300; i++) {
        const ts = 0.1 + hash(i, 1) * 0.75;
        const tau = l2 - ts;
        if (tau < 0) continue;
        const u = hash(i, 2);
        const ox = lerp(640, 1760, u) + (hash(i, 3) - 0.5) * 240,
          oy = lerp(545, 470, u) + (hash(i, 4) - 0.5) * 360;
        const a = hash(i, 5) * K.TAU,
          v = 180 + hash(i, 6) * 640;
        const e = (1 - Math.exp(-2.4 * tau)) / 2.4;
        const x = ox + Math.cos(a) * v * e + 150 * tau * tau + 60 * tau,
          y = oy + Math.sin(a) * v * e - 90 * tau + 60 * tau * tau + 26 * Math.sin(tau * 4 + i);
        const c = ss(0.15, 1.0, tau);
        const col = `rgb(${Math.round(lerp(249, 240, c))},${Math.round(lerp(245, 160, c))},${Math.round(lerp(234, 182, c))})`;
        g.save();
        g.shadowColor = "rgba(46,32,16,0.25)";
        g.shadowBlur = 6;
        g.shadowOffsetY = 4;
        K.petal(g, x, y, 8 + hash(i, 7) * 15, hash(i, 8) * 6 + tau * (3 + hash(i, 9) * 6), col);
        g.restore();
      }
      const H1 = K.layer("hero");
      const pose = K.poseAt(
        [
          [0, K.POSE.through],
          [0.7, K.POSE.through],
          [1.3, K.POSE.rest, E.io3],
        ],
        l2,
      );
      K.sumi(H1, { x: 1806, y: 548, s: 2.4, f: lt > 1.0 ? -1 : 1, pose, t: t2, wind: lt > 1.0 ? 0.2 : Math.PI, gust: 0.5 });
      K.put(g, H1, { op: "multiply", f: "rgh" + b });
      return {};
    }
    // the wide: the world as it was, in colour
    const l = lt - 2.0;
    const cam = { x: lerp(-10, 36, l / 3.5), y: lerp(-40, -14, l / 3.5), z: lerp(1.14, 1.0, E.out2(l / 3.5)) };
    colorWorld(g, { x: cam.x + 260, y: cam.y + 90, z: cam.z }, [1500, 300, 104]);
    g.save();
    K.cam(g, cam, 0.3);
    for (let i = 0; i < 7; i++) K.bird(g, 760 + i * 74 + (i % 2) * 20 + l * 50, 240 + ((i * 37) % 90) - l * 10 + Math.sin(t2 * 2 + i) * 5, 11 + (i % 3) * 2, t2 * 11 + i * 1.9);
    g.restore();
    // green on the cliff top
    g.save();
    K.cam(g, cam, 1);
    const gr = g.createLinearGradient(0, 690, 0, 860);
    gr.addColorStop(0, "rgba(60,120,80,0)");
    gr.addColorStop(0.3, "rgba(60,120,80,0.5)");
    gr.addColorStop(1, "rgba(47,107,90,0)");
    g.globalCompositeOperation = "multiply";
    g.fillStyle = gr;
    g.fillRect(-300, 690, 1320, 170);
    g.restore();
    K.cliffSet(g, cam, t, { redTorii: true });
    const L = K.layer("hero");
    K.cam(L, cam, 1);
    K.sumi(L, { x: 868, y: 708 - 46 * 2.7, s: 2.7, f: 1, pose: K.POSE.rest, t: t2, wind: Math.PI + 0.1 * Math.sin(t2 * 2.2), gust: 0.5 });
    K.put(g, L, { op: "multiply", f: "rgh" + b });
    g.save();
    g.shadowColor = "rgba(46,32,16,0.2)";
    g.shadowBlur = 5;
    g.shadowOffsetY = 3;
    driftPetals(g, t, 80, 3, { s: 10 });
    g.restore();
    return {};
  });

  // =========================================================== s15 — the title
  const seal = (K.seal = (g, x, y, size, rot, sc) => {
    const L = K.layer("seal");
    L.translate(x, y);
    L.rotate(rot);
    L.scale(sc, sc);
    const h = size / 2;
    L.fillStyle = K.RED;
    L.beginPath();
    for (let i = 0; i <= 80; i++) {
      const u = i / 80,
        s4 = u * 4,
        e = Math.floor(s4) % 4,
        v = (s4 % 1) * 2 - 1;
      const wob = (n1(i * 0.5, 3) - 0.5) * 5;
      const p = e === 0 ? [v * h, -h + wob] : e === 1 ? [h + wob, v * h] : e === 2 ? [-v * h, h + wob] : [-h + wob, -v * h];
      L.lineTo(p[0], p[1]);
    }
    L.closePath();
    L.fill();
    const flat = () => 1;
    K.kanji(L, K.GLYPH.ichi, -h * 0.62, -h * 1.2, size * 0.62, { color: K.BLANK, w: 0.13, dry: 0, prof: flat, edge: 0.04 });
    K.kanji(L, K.GLYPH.fude, -h * 0.62, -h * 0.36, size * 0.62, { color: K.BLANK, w: 0.085, dry: 0, prof: flat, edge: 0.04 });
    L.globalCompositeOperation = "destination-out";
    const R = K.rng(5);
    for (let i = 0; i < 110; i++) {
      L.globalAlpha = 0.2 + R() * 0.6;
      L.beginPath();
      L.ellipse((R() - 0.5) * size, (R() - 0.5) * size, 0.6 + R() * 3, 0.5 + R() * 1.6, R() * 3, 0, K.TAU);
      L.fill();
    }
    K.put(g, L, { op: "multiply", f: "rgh1" });
  });
  shot("s15", 45.0, 50.0, (g, lt, t, f) => {
    blankGround(g, 0.5);
    const L = K.layer("ichi");
    const z = 0.64;
    L.setTransform(z, 0, 0, z, 960 - 960 * z, 420 - 540 * z);
    const p = E.out3(inv(0.08, 0.46, lt));
    K.ichi(L, { prog: p });
    if (lt > 0.1) K.splat(L, 170, 560, 200, 5, 30, { size: 0.9 });
    K.put(g, L, { op: "multiply", f: "rgh0" });
    K.text(g, "HITOFUDE", 960, 672, { size: 96, track: 0.62, align: "center", chars: (lt - 0.75) * 10 });
    if (lt >= 2.0) seal(g, 1496, 524, 152, -0.07, lerp(1.3, 1, E.out3(inv(2.0, 2.09, lt))));
    K.text(g, "PAINT THE WORLD BACK", 960, 748, { size: 34, track: 0.5, align: "center", color: K.ink(0.82), chars: (lt - 2.55) * 38 });
    K.text(g, "A GAME THAT DOES NOT EXIST  ·  EVERY FRAME PAINTED IN CODE", 960, 962, { size: 28, track: 0.26, align: "center", color: K.ink(0.6), chars: (lt - 3.2) * 80 });
    g.save();
    g.shadowColor = "rgba(46,32,16,0.2)";
    g.shadowBlur = 5;
    g.shadowOffsetY = 3;
    driftPetals(g, t, 11, 9, { s: 10 });
    g.restore();
    return { shake: shake(lt - 2.02, 7, f) };
  });
})();
