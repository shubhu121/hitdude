/* HITOFUDE — shots s05-s10: the eye, the run, the leap, the first cut, the void, the one-stroke dragon. */
(function () {
  "use strict";
  const K = window.K,
    W = K.W,
    H = K.H;
  const { clamp, lerp, ss, inv, hash, n1 } = K;
  const E = K.ease;
  const shot = (id, t0, t1, fn) => K.SHOTS.push({ id, t0, t1, fn });
  const shake = K.shakeFn;
  /* the erased world: clean, brighter paper */
  const blankGround = (K.blankGround = (g, a = 0.78) => {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = `rgba(249,245,234,${a})`;
    g.fillRect(0, 0, W, H);
    g.restore();
  });
  /* ink flecks drifting through the void: (vx,vy) px/s */
  const flecks = (K.flecks = (g, t, n, vx, vy, seed, o = {}) => {
    g.save();
    g.fillStyle = o.color || K.INK;
    for (let i = 0; i < n; i++) {
      const sp = 0.5 + hash(i, seed, 3);
      const x = (((hash(i, seed, 1) * (W + 400) + vx * sp * t) % (W + 400)) + (W + 400)) % (W + 400) - 200;
      const y = (((hash(i, seed, 2) * (H + 400) + vy * sp * t) % (H + 400)) + (H + 400)) % (H + 400) - 200;
      const r = (o.r || 2) + Math.pow(hash(i, seed, 4), 3) * (o.R || 9);
      const a = Math.atan2(vy, vx);
      g.beginPath();
      g.ellipse(x, y, r * (1.2 + sp), r * 0.8, a, 0, K.TAU);
      g.fill();
    }
    g.restore();
  });

  // =========================================================== s05 — her eye
  shot("s05", 13.5, 16.0, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 13.5;
    // backdrop: the white is already behind her
    K.erase(g, (y) => K.frontX(1560, y, 3, 0.8), 1);
    const z = lerp(1.0, 1.07, lt / 2.5);
    const open = l2 < 0.4 ? 0.62 : l2 < 1.2 ? lerp(0.62, 1.2, E.outBack(inv(0.4, 0.56, l2))) : lerp(1.2, 0.7, E.out3(inv(1.2, 1.38, l2)));
    const bd = E.out3(inv(1.2, 1.4, l2)); // brow comes down
    const lk = E.out3(inv(0.4, 0.56, l2));
    const lx = lerp(-16, 20, lk),
      ly = lerp(16, -6, lk);
    const sw = Math.sin(t2 * 7) * 10;
    const L = K.layer("face");
    L.setTransform(z, 0, 0, z, 960 * (1 - z), 470 * (1 - z));
    L.fillStyle = K.INK;
    // hair mass
    L.beginPath();
    L.moveTo(-80, -80);
    L.lineTo(1190, -80);
    L.quadraticCurveTo(1180, 30, 1090, 70);
    L.quadraticCurveTo(820, 80, 640, 250);
    L.quadraticCurveTo(570, 420, 596, 560);
    L.quadraticCurveTo(540, 700, 430, 1160);
    L.lineTo(-80, 1160);
    L.closePath();
    L.fill();
    // fringe: blades of hair over the brow
    const bang = (x0, w, tx, ty) => {
      L.beginPath();
      L.moveTo(x0, 20);
      L.quadraticCurveTo(x0 + w * 0.2, ty * 0.55, tx + sw * 0.6, ty);
      L.quadraticCurveTo(x0 + w * 0.9, ty * 0.5, x0 + w, 20);
      L.closePath();
      L.fill();
    };
    bang(660, 150, 690, 318);
    bang(770, 150, 800, 350);
    bang(880, 140, 890, 300);
    bang(980, 130, 968, 338);
    bang(1070, 110, 1100, 282);
    bang(1120, 90, 1215, 250);
    // side lock
    K.ribbon(L, 640, 240, Math.PI * 0.5 - 0.12, 560, 74, 8, t2, { amp: 26, k: 0.8, speed: 7, phase: 1, n: 16 });
    // near eye
    const ey = 458;
    const topY = ey - 66 * open;
    const upper = [
      [1092, ey + 22],
      [1010, topY + 14],
      [900, topY],
      [800, ey - 22 - 10 * open],
      [728, ey - 46 - 8 * open],
    ];
    const lowY = ey + 40 * Math.min(1, open);
    // iris, clipped to the opening
    L.save();
    L.beginPath();
    L.moveTo(1092, ey + 22);
    L.quadraticCurveTo(1010, topY + 6, 900, topY);
    L.quadraticCurveTo(800, topY + 10, 760, ey - 14);
    L.quadraticCurveTo(900, lowY + 16, 1092, ey + 22);
    L.closePath();
    L.clip();
    L.fillStyle = K.ink(0.86);
    L.beginPath();
    L.arc(940 + lx, ey - 4 + ly, 70, 0, K.TAU);
    L.fill();
    L.fillStyle = K.INK;
    L.beginPath();
    L.arc(940 + lx, ey - 4 + ly, 30, 0, K.TAU);
    L.fill();
    L.globalCompositeOperation = "destination-out";
    L.beginPath();
    L.arc(918 + lx, ey - 30 + ly, 14, 0, K.TAU);
    L.fill();
    // what she is looking at, in the iris: a white coil
    L.lineWidth = 7;
    L.lineCap = "round";
    L.globalAlpha = 0.9 * lk;
    L.beginPath();
    L.moveTo(990 + lx, ey + 30 + ly);
    L.quadraticCurveTo(1000 + lx, ey - 24 + ly, 962 + lx, ey - 36 + ly);
    L.stroke();
    L.globalAlpha = 1;
    L.globalCompositeOperation = "source-over";
    L.restore();
    K.stroke(L, upper, { w: 30, prof: (u) => 0.35 + 0.65 * Math.sin(Math.PI * Math.pow(u, 0.8)), dry: 0.05, seed: 3, step: 3, edge: 0.1 });
    K.stroke(L, [[790, ey - 6], [900, lowY + 8], [1010, lowY + 6], [1088, ey + 26]], { w: 8, prof: K.prof.taper, dry: 0.3, seed: 4, alpha: 0.85, step: 3 });
    // brow
    K.stroke(L, [[742, 362 + 8 * bd], [900, 318 + 22 * bd], [1104, 346 + 52 * bd]], { w: 34, prof: (u) => 0.3 + 0.7 * Math.sin(Math.PI * Math.pow(u, 1.5)), dry: 0.35, dryStart: 0, seed: 6, step: 3 });
    // nose bridge, far eye, far cheek
    K.stroke(L, [[1150, 400], [1196, 520], [1228, 640]], { w: 7, prof: K.prof.taper, dry: 0.4, seed: 9, alpha: 0.7, step: 4 });
    K.stroke(L, [[1228, ey + 14], [1262, ey - 40 * open + 12], [1318, ey + 2]], { w: 17, prof: K.prof.taper, dry: 0.05, seed: 11, step: 3 });
    L.fillStyle = K.ink(0.9);
    L.beginPath();
    L.ellipse(1270 + lx * 0.3, ey + 2 + ly * 0.4, 21, 27 * Math.min(1, open), 0, 0, K.TAU);
    L.fill();
    K.stroke(L, [[1222, 366 + 44 * bd], [1280, 338 + 20 * bd], [1336, 344]], { w: 22, prof: K.prof.taper, dry: 0.3, seed: 12, step: 3 });
    K.stroke(L, [[1352, 300], [1372, 470], [1330, 640]], { w: 8, prof: K.prof.line, dry: 0.4, seed: 13, alpha: 0.75, step: 4 });
    // loose strands across the face
    K.stroke(L, [[620, 300], [840, 250 + sw], [1120, 300 + sw * 1.4], [1380, 250 + sw * 2]], { w: 6, prof: K.prof.tail, dry: 0.4, seed: 14, step: 4 });
    K.stroke(L, [[610, 380], [800, 560 + sw], [1000, 600 + sw], [1200, 566 + sw * 1.6]], { w: 5, prof: K.prof.tail, dry: 0.4, seed: 15, step: 4 });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    // the scarf covers her mouth
    const S = K.layer("scarf");
    S.setTransform(z, 0, 0, z, 960 * (1 - z), 470 * (1 - z));
    const top = (x) => 688 - (x - 400) * 0.1 + 16 * Math.sin(x * 0.009 - t2 * 6) + (x > 1300 ? (x - 1300) * 0.55 : 0);
    S.fillStyle = K.RED;
    S.beginPath();
    S.moveTo(-80, 1160);
    S.lineTo(-80, top(-80) + 60);
    for (let x = -80; x <= 1470; x += 30) S.lineTo(x, top(x));
    S.quadraticCurveTo(1520, 900, 1380, 1160);
    S.closePath();
    S.fill();
    for (let i = 0; i < 6; i++) {
      const x0 = 300 + i * 190;
      K.stroke(S, [[x0, top(x0) + 30], [x0 + 110, top(x0) + 150 + 10 * Math.sin(t2 * 6 + i)], [x0 + 80, top(x0) + 420]], { w: 16 + (i % 3) * 8, color: "#96200f", prof: K.prof.taper, dry: 0.5, seed: 20 + i, step: 5, alpha: 0.75 });
    }
    K.put(g, S, { op: "multiply", f: "rgh" + K.boil(t) });
    // a drop of ink leaves the brush
    const dl = lt - 1.25;
    if (dl > 0) {
      const y = 60 + 1500 * dl * dl + 120 * dl,
        st = 1 + dl * 3.2;
      g.save();
      g.fillStyle = K.INK;
      g.beginPath();
      g.moveTo(1640, y - 30 * st);
      g.quadraticCurveTo(1668, y + 6, 1640, y + 20);
      g.quadraticCurveTo(1612, y + 6, 1640, y - 30 * st);
      g.fill();
      g.restore();
    }
    return {};
  });

  // =========================================================== s06 — the run
  const groundY = (X) => 822 + 64 * (K.fbm1(X / 520, 7, 3) - 0.5);
  shot("s06", 16.0, 19.0, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 16,
      t3 = K.on3(t);
    const speed = 1500,
      wx = lt * speed;
    const ph = l2 * Math.PI * 4;
    const cam = { x: 0, y: 0, z: lerp(1.0, 1.08, lt / 3) };
    K.landscape(g, { x: wx * 0.13 - 190, y: 50, z: 1 }, { a: 0.72 });
    // ahead of her the white is already waiting, with the Blank inside it
    K.erase(g, (y) => K.frontX(lerp(1700, 1420, lt / 3), y, 3, 0.9), 1);
    g.save();
    K.cam(g, cam, 0.5);
    const bx = lerp(1900, 1690, lt / 3);
    K.blank(g, [[bx - 70, 380], [bx + 30, 500], [bx + 10, 680], [bx + 150, 900], [bx + 320, 1200]], { w: 210, jaw: 0.35, t: t2, headS: 1.5, whisk: Math.PI * 0.5 });
    g.restore();
    // ground, in world space
    const G = K.layer("ground");
    K.cam(G, cam, 1);
    G.fillStyle = K.ink(0.94);
    G.beginPath();
    G.moveTo(-200, 1300);
    for (let sx = -200; sx <= 2140; sx += 30) G.lineTo(sx, groundY(sx + wx));
    G.lineTo(2140, 1300);
    G.closePath();
    G.fill();
    G.globalCompositeOperation = "destination-out";
    G.lineCap = "round";
    for (let i = 0; i < 90; i++) {
      const X = hash(i, 51) * 2600;
      const sx = ((((X - wx) % 2600) + 2600) % 2600) - 300;
      const y = groundY(sx + wx) + 14 + Math.pow(hash(i, 52), 1.5) * 240;
      G.globalAlpha = 0.12 + hash(i, 53) * 0.3;
      G.lineWidth = 1 + hash(i, 54) * 4;
      G.beginPath();
      G.moveTo(sx, y);
      G.lineTo(sx + 60 + hash(i, 55) * 240, y + (hash(i, 56) - 0.5) * 16);
      G.stroke();
    }
    G.globalCompositeOperation = "source-over";
    G.globalAlpha = 1;
    // grass tufts whipping past
    G.strokeStyle = K.INK;
    for (let i = 0; i < 70; i++) {
      const X = hash(i, 61) * 2600;
      const sx = ((((X - wx) % 2600) + 2600) % 2600) - 300;
      const y = groundY(sx + wx);
      const h = 14 + hash(i, 62) * 30;
      G.lineWidth = 1.5 + hash(i, 63) * 2;
      G.beginPath();
      G.moveTo(sx, y + 2);
      G.quadraticCurveTo(sx - h * 0.3, y - h * 0.6, sx - h * 1.1, y - h * 0.8);
      G.stroke();
    }
    K.put(g, G, { op: "multiply" });
    // she drags her brush: one line along the ground, all the way back
    const s = 3.9,
      hx = 1130;
    const pose = K.runPose(ph);
    const hy = groundY(hx + wx) - 45 * s + pose.hipY * s;
    const H1 = K.layer("hero");
    K.cam(H1, cam, 1);
    const R = K.sumi(H1, { x: hx, y: hy, s, f: 1, pose, t: t2, wind: Math.PI + 0.06 * Math.sin(t2 * 20), gust: 1 });
    g.save();
    K.cam(g, cam, 1);
    const tipX = 880;
    const line = [];
    for (let sx = tipX; sx >= -160; sx -= 80) line.push([sx, groundY(sx + wx) - 5 + (sx === tipX ? -6 : 0)]);
    const LN = K.layer("line");
    LN.setTransform(g.getTransform());
    K.stroke(LN, line, { w: 20, prof: (u) => 0.5 + 0.5 * Math.sin(u * 30 + wx * 0.02) * 0.4 + 0.3, dry: 0.7, dryStart: 0.0, seed: 3 + Math.floor(f / 3), streak: 200, step: 8 });
    // footfalls throw ink
    for (let i = 0; i < 14; i++) {
      const tc = i * 0.25 + 0.06;
      const age = lt - tc;
      if (age < 0 || age > 0.7) continue;
      const sx = hx + 60 - age * speed;
      K.splat(LN, sx, groundY(sx + wx) - 4, 30 + age * 110, 100 + i, 9, { dir: -2.6, spread: 1.3 });
    }
    K.put(g, LN, { op: "multiply" });
    g.restore();
    // behind her, the wipe
    const fb = lerp(-420, 640, E.in2(lt / 3));
    const fs = Math.floor(f / 3);
    K.erase(g, (y) => fb - (K.frontX(0, y, 5, 1.3) + (hash(fs, Math.floor(y / 50)) - 0.5) * 20), -1);
    K.put(g, H1, { op: "multiply", f: "rgh" + K.boil(t) });
    // air streaks
    g.save();
    for (let i = 0; i < 12; i++) {
      const X = hash(i, 71, Math.floor(f / 3)) * 2300 - 200,
        y = 120 + hash(i, 72, Math.floor(f / 3)) * 640;
      const l = 160 + hash(i, 73) * 380;
      K.stroke(g, [[X + l, y], [X, y + 3]], { w: 3 + hash(i, 74) * 5, dry: 0.9, dryStart: 0, seed: i, alpha: 0.3, prof: K.prof.taper, step: 10 });
    }
    g.restore();
    return { shake: [0, Math.abs(Math.cos(ph)) * 3] };
  });

  // =========================================================== s07 — the leap
  const LEDGE = [
    [-260, 772],
    [120, 762],
    [380, 752],
    [505, 756],
    [540, 800],
    [512, 930],
    [560, 1300],
  ];
  const leapPos = (q) => {
    const a = [520, 742],
      c = [690, 40],
      b = [1050, 310],
      u = 1 - q;
    return [u * u * a[0] + 2 * u * q * c[0] + q * q * b[0], u * u * a[1] + 2 * u * q * c[1] + q * q * b[1]];
  };
  shot("s07", 19.0, 21.5, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 19;
    const cam = { x: lerp(0, 40, lt / 2.5), y: lerp(0, -30, lt / 2.5), z: lerp(1.0, 1.06, lt / 2.5) };
    K.landscape(g, { x: cam.x - 280, y: cam.y + 60, z: cam.z }, { a: 0.8 });
    const fs = Math.floor(f / 3);
    K.erase(g, (y) => K.frontX(690, y, 3, 1) + (hash(fs, Math.floor(y / 60)) - 0.5) * 14, 1);
    g.save();
    K.cam(g, cam, 1);
    K.rock(g, LEDGE, 1340, 15, {});
    g.restore();
    // the maw
    g.save();
    K.cam(g, cam, 0.9);
    const lunge = E.io3(inv(1.2, 2.5, lt)) * 70;
    const jaw = lerp(0.15, 1, E.out3(inv(0.35, 1.5, lt)));
    K.blank(
      g,
      [
        [1500 - lunge, 520],
        [1760 - lunge * 0.8, 500],
        [2000 - lunge * 0.5, 340],
        [2300, 300],
      ],
      { w: 400, jaw, t: t2, headS: 1.5, whisk: Math.PI * 0.42, shadow: [16, 22, 30, 0.34] },
    );
    g.restore();
    // Sumi
    const s = 2.35;
    let x, y, pose, wind, rot0 = 0;
    if (l2 < 0.25) {
      x = lerp(330, 490, l2 / 0.25);
      y = 754 - 45 * s;
      pose = K.runPose(l2 * Math.PI * 4 + 1);
      wind = Math.PI;
    } else if (l2 < 0.4) {
      x = 505;
      y = 754 - 45 * s + 2;
      pose = K.POSE.land;
      wind = Math.PI;
    } else {
      const q = E.out3(inv(0.4, 2.5, l2));
      const p = leapPos(q),
        p2 = leapPos(Math.min(1, q + 0.02));
      x = p[0];
      y = p[1];
      pose = K.poseAt(
        [
          [0.4, K.POSE.spring],
          [0.5, K.POSE.spring],
          [0.82, K.POSE.leapUp, E.out3],
          [1.25, K.POSE.leapUp],
          [1.8, K.POSE.coil, E.io3],
        ],
        l2,
      );
      wind = Math.atan2(p[1] - p2[1], p[0] - p2[0]) + 0.5 * inv(1.2, 2.2, l2);
      // the path she took: a dry trail
      const tr = [];
      for (let i = 0; i <= 10; i++) tr.push(leapPos((q * i) / 10));
      g.save();
      K.cam(g, cam, 1);
      K.stroke(g, tr, { w: 26, prof: (u) => 0.2 + 0.8 * u, dry: 1.1, dryStart: 0, seed: 5, alpha: 0.5 * (1 - inv(1.6, 2.5, l2)), from: Math.max(0, 1 - 1.4 * (1 - inv(1.2, 2.4, l2))), streak: 240 });
      K.splat(g, 520, 748, 60, 9, 12, { dir: -2.2, spread: 1.6 });
      g.restore();
    }
    const L = K.layer("hero");
    K.cam(L, cam, 1);
    K.sumi(L, { x, y, s, f: 1, pose, t: t2, wind, gust: 1 });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    return {};
  });

  // =========================================================== s08 — the first cut
  const SL = [
    [330, 60],
    [760, 300],
    [1120, 620],
    [1320, 1040],
  ];
  const PSL = K.path(SL, 5);
  /* threads of ink flung off the end of the cut */
  const flung = (g, grow, color) => {
    for (let i = 0; i < 9; i++) {
      const p = K.at(PSL, 0.45 + hash(i, 41) * 0.55);
      const a = Math.atan2(-p.nx, p.ny) + (hash(i, 42) - 0.5) * 1.5;
      const l = (160 + hash(i, 43) * 420) * grow;
      const c = (hash(i, 44) - 0.5) * 0.5;
      K.stroke(g, [[p.x, p.y], [p.x + Math.cos(a + c) * l * 0.5, p.y + Math.sin(a + c) * l * 0.5], [p.x + Math.cos(a) * l, p.y + Math.sin(a) * l]], { w: 3 + hash(i, 45) * 7, prof: K.prof.tail, dry: 0.7, dryStart: 0.1, seed: 50 + i, color, step: 6 });
    }
  };
  shot("s08", 21.5, 23.5, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 21.5;
    const k = f - K.frame(22.0);
    const dt = lt - 0.5;
    const body = (o = {}) => {
      const rec = k >= 0 ? 36 * Math.exp(-Math.max(0, dt) * 5) : 0;
      K.blank(
        g,
        [
          [1560 + rec, -260],
          [1300 + rec, 220],
          [1060 + rec, 600],
          [1010 + rec, 1000],
          [1120 + rec, 1460],
        ],
        Object.assign({ w: 470, noHead: true, t: t2, shadow: [18, 26, 34, 0.34], prof: (u) => 0.9 + 0.1 * Math.sin(u * 5) }, o),
      );
    };
    if (k === 0) {
      g.fillStyle = K.INK;
      g.fillRect(0, 0, W, H);
      K.stroke(g, SL, { w: 250, color: K.BLANK, prof: K.prof.slash, dry: 0.5, dryStart: 0.2, seed: 9, streak: 500 });
      K.spatter(g, PSL, { n: 70, reach: 420, grow: 0.5, big: 30, seed: 4, color: K.BLANK });
      flung(g, 0.5, K.BLANK);
      return {};
    }
    if (k === 1) {
      g.fillStyle = K.RED;
      g.fillRect(0, 0, W, H);
      K.stroke(g, SL, { w: 230, prof: K.prof.slash, dry: 0.4, dryStart: 0.2, seed: 9, streak: 500 });
      K.spatter(g, PSL, { n: 90, reach: 520, grow: 0.72, big: 28, seed: 4 });
      flung(g, 0.75);
      return { shake: [14, -10] };
    }
    blankGround(g);
    body();
    if (k < 0) {
      // she comes down out of the white, coiled
      const q = E.in2(inv(0, 0.5, lt));
      const x = lerp(330, 600, q),
        y = lerp(330, 540, q);
      const L = K.layer("hero");
      K.sumi(L, { x, y, s: 4.6, f: 1, pose: K.mix(K.POSE.coil, K.POSE.cut, 0.12 * q), t: t2, wind: -2.3, gust: 1 });
      K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
      for (let i = 0; i < 7; i++) {
        const o = hash(i, 5, Math.floor(f / 2));
        K.stroke(g, [[x - 300 - o * 300, y - 260 - o * 200 + i * 30], [x - 110 + i * 20, y - 110 + i * 26]], { w: 4 + o * 5, dry: 0.9, dryStart: 0, alpha: 0.4, seed: i, prof: K.prof.taper });
      }
      return {};
    }
    // the scar
    const wipe = inv(1.0, 1.5, dt);
    const SC = K.layer("scar");
    K.stroke(SC, SL, { w: k === 2 ? 240 : 190, prof: K.prof.slash, dry: 0.55 + wipe * 1.4, dryStart: 0.25 - wipe * 0.25, seed: 9, streak: 500 });
    const gr = 0.85 + 0.15 * E.out3(Math.min(1, dt * 3));
    K.spatter(SC, PSL, { n: 130, reach: 560, grow: gr, big: 22, seed: 4 });
    flung(SC, gr);
    K.put(g, SC, { op: "multiply", a: 1 - wipe * 0.55, f: "rgh" + K.boil(t) });
    if (k === 2) {
      for (let i = 0; i < 40; i++) {
        const o = hash(i, 8),
          y0 = hash(i, 9) * H,
          x0 = hash(i, 10) * W;
        K.stroke(g, [[x0 - 220 * (0.4 + o), y0 - 250 * (0.4 + o)], [x0, y0]], { w: 3 + o * 9, dry: 0.8, dryStart: 0, seed: i, prof: K.prof.taper, alpha: 0.7 });
      }
    }
    // she has already gone through
    const L = K.layer("hero");
    const x = 1400 + dt * 150,
      y = 860 + dt * 330;
    K.sumi(L, { x, y, s: 4.6, f: 1, pose: K.POSE.cut, t: t2, wind: -2.2, gust: 1 });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    return { shake: shake(dt - 0.08, 22, f) };
  });

  // =========================================================== s09 — wiped; the void
  shot("s09", 23.5, 27.0, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 23.5;
    const X = lerp(2500, -700, E.io3(inv(0.1, 1.05, lt)));
    const hit = 0.52;
    if (lt < 1.1) {
      // what is left of the world, about to go
      K.landscape(g, { x: 60, y: 40, z: 1 }, { a: 0.75 });
      K.erase(g, (y) => K.frontX(1250, y, 3, 1), 1);
    } else blankGround(g);
    // falling flecks: all that remains of the ink
    if (lt >= 1.0) {
      g.save();
      g.globalAlpha = inv(1.0, 1.4, lt);
      flecks(g, t2, 46, -30, -430, 5, { r: 1.5, R: 8 });
      g.restore();
      // the coils move behind the paper: only their shadow says so
      const ph = t2 * 0.5;
      K.blank(
        g,
        [
          [1500 + 60 * Math.sin(ph), -200],
          [1420 + 90 * Math.sin(ph + 1), 280],
          [1560 + 80 * Math.sin(ph + 2), 700],
          [1400 + 60 * Math.sin(ph + 3), 1300],
        ],
        { w: 330, noHead: true, shadow: [12, 16, 30, 0.2], a: inv(1.2, 2.0, lt), prof: () => 1, layer: "blank2" },
      );
    }
    // Sumi
    let x, y, rot, pose;
    if (lt < hit) {
      x = lerp(700, 760, lt / hit);
      y = lerp(380, 470, lt / hit);
      pose = K.mix(K.POSE.cut, K.POSE.fall, 0.4);
      rot = 10;
    } else {
      const q = inv(hit, 3.5, l2);
      x = lerp(760, 860, E.out3(q)) - 240 * Math.sin(Math.PI * E.out5(inv(hit, 1.3, l2))) * 0.6;
      y = lerp(470, 520, q);
      pose = K.poseAt(
        [
          [hit, K.POSE.fall],
          [2.9, K.POSE.fall],
          [3.3, K.POSE.coil, E.io3],
        ],
        l2,
      );
      rot = lerp(-40, -96, q) + (l2 > 2.9 ? 70 * E.io3(inv(2.9, 3.4, l2)) : 0);
    }
    const P2 = Object.assign({}, pose, { rot });
    const drawHero = () => {
      const L = K.layer("hero");
      K.sumi(L, { x, y, s: 2.5, f: 1, pose: P2, t: t2, wind: -Math.PI / 2 + 0.25 * Math.sin(t2 * 3), gust: 0.9 });
      K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    };
    if (lt < hit) drawHero();
    // the tail: one sweep takes everything
    if (lt < 1.2) {
      const front = (y) => X + 0.00028 * (y - 540) * (y - 540) - 60;
      K.erase(g, front, 1, { tint: "rgba(249,245,234,0.78)" });
      K.blank(
        g,
        [
          [X + 260, -360],
          [X + 40, 160],
          [X - 40, 540],
          [X + 60, 920],
          [X + 330, 1440],
        ],
        { w: 520, noHead: true, shadow: [-22, 18, 36, 0.4], prof: (u) => 0.5 + 0.5 * Math.sin(Math.PI * u) },
      );
      for (let i = 0; i < 16; i++) {
        const y0 = hash(i, 3) * H;
        K.stroke(g, [[X + 300 + hash(i, 4) * 500, y0], [X + 1000 + hash(i, 5) * 700, y0 + 6]], { w: 3 + hash(i, 6) * 8, color: "rgba(150,128,96,0.5)", dry: 0.9, dryStart: 0, seed: i, prof: K.prof.taper, step: 12 });
      }
    }
    if (lt >= hit) drawHero();
    return { shake: shake(lt - hit, 18, f) };
  });

  // =========================================================== s10 — one stroke becomes a dragon
  const SA = [220, 806],
    SB = [1640, 776],
    LG = 1420.3;
  const dPath = (s) => {
    if (s <= LG) {
      const u = Math.max(-0.2, s / LG);
      return [lerp(SA[0], SB[0], u), lerp(SA[1], SB[1], u)];
    }
    const R = 400,
      am = 0.92,
      s2 = s - LG;
    if (s2 <= R * am) {
      const a = s2 / R;
      return [SB[0] + R * Math.sin(a), SB[1] - R * (1 - Math.cos(a))];
    }
    const s3 = s2 - R * am;
    return [SB[0] + R * Math.sin(am) + Math.cos(am) * s3, SB[1] - R * (1 - Math.cos(am)) - Math.sin(am) * s3];
  };
  K.dPath = dPath;
  const dragonSpine = (sh, wave, tt) => {
    const pts = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const s = sh - (i / n) * LG;
      const a = dPath(s),
        b = dPath(s - 6);
      let tx = a[0] - b[0],
        ty = a[1] - b[1];
      const l = Math.hypot(tx, ty) || 1;
      const wv = wave * Math.min(1, i / 4) * Math.sin(i * 0.62 - tt * 7);
      pts.push([a[0] - (ty / l) * wv, a[1] + (tx / l) * wv]);
    }
    return pts;
  };
  K.dragonSpine = dragonSpine;
  const dProf = (u) => (0.55 + 0.45 * ss(0, 0.12, u)) * (1 - 0.96 * Math.pow(ss(0.2, 1, u), 1.15));
  shot("s10", 27.0, 31.5, (g, lt, t, f) => {
    const t2 = K.on2(t),
      l2 = t2 - 27;
    blankGround(g);
    const WAKE = 1.6;
    const p = E.io3(inv(0.3, WAKE, lt)); // the stroke, written left to right
    const fly = lt > WAKE ? 2050 * Math.pow(inv(1.85, 4.5, lt), 1.7) : 0;
    const sh = LG + fly;
    const wave = 40 * ss(WAKE, 2.5, lt);
    const head = dPath(sh);
    // camera: holds for the stroke, then follows the head
    const fol = ss(1.9, 2.8, lt);
    const z = lerp(1.0, 0.78, ss(1.9, 4.5, lt));
    const cam = { x: (head[0] - W / 2 - (1180 - W / 2) / z) * fol, y: (head[1] - H / 2 - (470 - H / 2) / z) * fol, z };
    // shadows of the coils in the paper, and flecks
    g.save();
    K.cam(g, cam, 0.35);
    K.blank(g, [[700, -500], [560, 100], [760, 640], [520, 1500]], { w: 300, noHead: true, shadow: [12, 16, 30, 0.18], prof: () => 1, layer: "blank2" });
    g.restore();
    flecks(g, t2, 30, -60 - 300 * fol, -200 + 500 * fol, 8, { r: 1.5, R: 7 });
    g.save();
    K.cam(g, cam, 1);
    // the Blank waits above
    K.blank(g, [[3260, -960], [3560, -1130], [3900, -1000], [4300, -1300]], { w: 330, jaw: 0.6, t: t2, headS: 1.5, whisk: 0.9 });
    const spine = dragonSpine(sh, wave, t2);
    if (lt < WAKE) {
      const P = K.path(spine, 7);
      const L = K.layer("inkd");
      L.setTransform(g.getTransform());
      K.stroke(L, P, { w: 156, prof: dProf, dry: 0.75, dryStart: 0.42, seed: 31, from: 1 - p, streak: 470, edge: 0.14 });
      // wet front + spray where the brush is
      if (p > 0 && p < 1) {
        const tp = K.at(P, 1 - p);
        K.splat(L, tp.x + 20, tp.y, 90, Math.floor(f / 2), 10, { dir: -0.5, spread: 1.6 });
      }
      K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    } else {
      const born = inv(WAKE, WAKE + 0.2, lt);
      K.inkDragon(g, spine, { w: 156, t: t2, jaw: lerp(0.1, 0.7, ss(WAKE, 2.2, lt)), headS: 1.15 * lerp(0.6, 1, E.outBack(born)), f: "rgh" + K.boil(t), whisk: Math.atan2(dPath(sh - 40)[1] - head[1], dPath(sh - 40)[0] - head[0]) });
      if (lt < WAKE + 0.5) K.splat(g, SB[0], SB[1] - 20, 200 + (lt - WAKE) * 500, 7, 40, { dir: -1.4, spread: 2.6, size: 1.5, max: 26 });
    }
    // Sumi
    let x, y, pose, wind = Math.PI, rot = 0, s = 2.5;
    if (l2 < 0.3) {
      const q = E.in2(l2 / 0.3);
      x = lerp(150, 236, q);
      y = lerp(120, SA[1] - 20 - 45 * s, q);
      pose = K.mix(K.POSE.coil, K.POSE.land, q);
      wind = -Math.PI / 2;
    } else if (lt < WAKE) {
      const pp = E.io3(inv(0.3, WAKE, l2));
      const tp = dPath(pp * LG);
      x = tp[0] + 70;
      y = tp[1] - 20 - 45 * s;
      pose = pp > 0.96 ? K.POSE.land : Object.assign({}, K.runPose(l2 * Math.PI * 4), { br: 150 });
      if (pp > 0.96) y += 2;
    } else {
      const a = dPath(sh - 30),
        b = dPath(sh - 110);
      const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
      x = a[0] - Math.cos(ang) * 60 + Math.sin(ang) * 186;
      y = a[1] - Math.sin(ang) * 60 - Math.cos(ang) * 186;
      rot = (ang * 180) / Math.PI;
      pose = Object.assign({}, K.POSE.ride, { rot: rot * 0.8 });
      wind = ang + Math.PI;
    }
    const L = K.layer("hero");
    L.setTransform(g.getTransform());
    K.sumi(L, { x, y, s, f: 1, pose, t: t2, wind, gust: 1 });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    g.restore();
    return { shake: shake(lt - WAKE, 18, f) };
  });
})();
