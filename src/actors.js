/* HITOFUDE — actors: Sumi (the swordswoman), her brush, THE BLANK (paper dragon), the one-stroke ink dragon. */
(function () {
  "use strict";
  const K = window.K;
  const { clamp, lerp, hash, n1, ss } = K;
  const D = Math.PI / 180;

  // ---------- Sumi
  /* angles in degrees. 0 = straight down, + = toward where she faces.
     lean/head: torso and head tilt. aF/aB: [shoulder, elbow]. lF/lB: [hip, knee bend]. br: brush angle (0 = forward, - = up) */
  K.POSE = {
    stand: { lean: 3, head: -2, aF: [12, 16], aB: [-10, 10], lF: [15, 6], lB: [-13, 4], hipY: 1, rot: 0, br: -118, hold: 0 },
    alert: { lean: 10, head: -6, aF: [-150, -70], aB: [-20, 30], lF: [24, 20], lB: [-20, 10], hipY: 2, rot: 0, br: -118, hold: 0 },
    ready: { lean: 22, head: -14, aF: [35, 45], aB: [-30, 60], lF: [40, 45], lB: [-30, 18], hipY: 5, rot: 0, br: 160, hold: 1 },
    leapUp: { lean: 24, head: -24, aF: [-150, -20], aB: [72, 28], lF: [80, 100], lB: [-46, 18], hipY: 0, rot: -16, br: -140, hold: 1 },
    coil: { lean: -8, head: 8, aF: [-165, -40], aB: [-150, -45], lF: [60, 95], lB: [-10, 70], hipY: 0, rot: -24, br: -165, hold: 1 },
    cut: { lean: 34, head: -24, aF: [70, 8], aB: [48, 20], lF: [58, 34], lB: [-50, 14], hipY: 0, rot: 6, br: 36, hold: 1 },
    fall: { lean: -24, head: 16, aF: [-118, -30], aB: [-64, -24], lF: [48, 40], lB: [6, 70], hipY: 0, rot: -60, br: -40, hold: 1 },
    land: { lean: 30, head: -22, aF: [38, 12], aB: [-70, -30], lF: [84, 86], lB: [-34, 26], hipY: 19, rot: 0, br: 196, hold: 1 },
    ride: { lean: 18, head: -12, aF: [-52, -28], aB: [50, 30], lF: [50, 64], lB: [-36, 16], hipY: 10, rot: 0, br: 205, hold: 1 },
    raise: { lean: -5, head: 6, aF: [-168, -12], aB: [-174, -10], lF: [14, 10], lB: [-14, 6], hipY: 0, rot: 0, br: -86, hold: 1 },
    wind: { lean: -16, head: 10, aF: [-190, -40], aB: [-200, -44], lF: [26, 22], lB: [-22, 12], hipY: 3, rot: 0, br: -178, hold: 1 },
    through: { lean: 40, head: -22, aF: [70, 6], aB: [58, 12], lF: [58, 62], lB: [-48, 14], hipY: 8, rot: 0, br: 12, hold: 1 },
    spring: { lean: 28, head: -18, aF: [-158, -10], aB: [-146, -14], lF: [14, 5], lB: [-30, 8], hipY: 0, rot: -12, br: -150, hold: 1 },
    rest: { lean: 4, head: 0, aF: [14, 10], aB: [-10, 8], lF: [8, 6], lB: [-8, 4], hipY: 0, rot: 0, br: 84, hold: 1 },
  };
  K.mix = (a, b, t) => {
    const o = {};
    for (const k in a) {
      const va = a[k],
        vb = b[k] == null ? va : b[k];
      o[k] = Array.isArray(va) ? [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)] : k === "hold" ? (t < 0.5 ? va : vb) : lerp(va, vb, t);
    }
    return o;
  };
  /* keys: [[time, pose, ease?], ...] — eases INTO each key */
  K.poseAt = (keys, t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const e = keys[i][2] || K.ease.out3;
        return K.mix(keys[i - 1][1], keys[i][1], e(K.inv(keys[i - 1][0], keys[i][0], t)));
      }
    }
    return keys[keys.length - 1][1];
  };
  K.runPose = (ph) => {
    const leg = (p) => [10 + 54 * Math.sin(p), 16 + 78 * Math.pow(0.5 + 0.5 * Math.cos(p - 0.7), 2)];
    return {
      lean: 40 + 3 * Math.sin(ph * 2),
      head: -30,
      aF: [-64 + 8 * Math.sin(ph), -18],
      aB: [-84 - 8 * Math.sin(ph), -12],
      lF: leg(ph),
      lB: leg(ph + Math.PI),
      hipY: -3.5 * Math.abs(Math.cos(ph)),
      rot: 0,
      br: 166 + 4 * Math.sin(ph * 2),
      hold: 1,
    };
  };

  function limb(g, x0, y0, x1, y1, w0, w1) {
    const a = Math.atan2(y1 - y0, x1 - x0),
      nx = -Math.sin(a),
      ny = Math.cos(a);
    g.beginPath();
    g.moveTo(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2);
    g.lineTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
    g.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
    g.lineTo(x0 - (nx * w0) / 2, y0 - (ny * w0) / 2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(x0, y0, w0 / 2, 0, K.TAU);
    g.arc(x1, y1, w1 / 2, 0, K.TAU);
    g.fill();
  }
  const dir = (a) => [Math.sin(a * D), Math.cos(a * D)];

  /* the brush-sword, in the current transform. (gx,gy) = grip, ang deg (0 = +x, negative = up). returns tip + ferrule */
  K.fude = (g, gx, gy, ang, o = {}) => {
    const c = Math.cos(ang * D),
      s = Math.sin(ang * D);
    const back = o.back == null ? 16 : o.back,
      fwd = o.fwd == null ? 46 : o.fwd,
      head = o.head == null ? 21 : o.head;
    const bx = gx - c * back,
      by = gy - s * back,
      fx = gx + c * fwd,
      fy = gy + s * fwd;
    g.save();
    g.fillStyle = K.INK;
    g.strokeStyle = K.INK;
    g.lineCap = "round";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(fx, fy);
    g.stroke();
    // tassel at the butt
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx - c * 3 + 1.5, by - s * 3 + 6);
    g.stroke();
    // ferrule + bristle head: a loaded bulb coming to a point
    const nx = -s,
      ny = c;
    g.beginPath();
    g.moveTo(fx + nx * 2.4, fy + ny * 2.4);
    g.quadraticCurveTo(fx + c * head * 0.42 + nx * 6.4, fy + s * head * 0.42 + ny * 6.4, fx + c * head, fy + s * head);
    g.quadraticCurveTo(fx + c * head * 0.42 - nx * 6.4, fy + s * head * 0.42 - ny * 6.4, fx - nx * 2.4, fy - ny * 2.4);
    g.closePath();
    g.fill();
    g.strokeStyle = K.PAPER;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(fx + nx * 2.6, fy + ny * 2.6);
    g.lineTo(fx - nx * 2.6, fy - ny * 2.6);
    g.stroke();
    g.restore();
    return [fx + c * head, fy + s * head];
  };

  /* Draw Sumi. o: x,y (hips), s (px per unit; she is ~88 units tall), f (+1 right, -1 left), pose, t (ribbon time),
     wind (screen angle the ribbons trail toward, rad), gust (0..1). Returns world positions {tip, head, neck, hand}. */
  K.sumi = (g, o) => {
    const p = o.pose,
      s = o.s,
      f = o.f || 1,
      t = o.t || 0;
    const rot = (p.rot || 0) * D * f;
    const cr = Math.cos(rot),
      sr = Math.sin(rot);
    const toW = (lx, ly) => {
      const x = lx * s * f,
        y = ly * s;
      return [o.x + x * cr - y * sr, o.y + x * sr + y * cr];
    };
    const hip = [0, p.hipY || 0];
    const td = [Math.sin(p.lean * D), -Math.cos(p.lean * D)]; // up the spine
    const tn = [-td[1], td[0]]; // toward her front
    const along = (d, k = 0) => [hip[0] + td[0] * d + tn[0] * k, hip[1] + td[1] * d + tn[1] * k];
    const neck = along(25.5),
      sh = along(22.5);
    const hd = [Math.sin((p.lean + p.head) * D), -Math.cos((p.lean + p.head) * D)];
    const hn = [-hd[1], hd[0]];
    const head = [neck[0] + hd[0] * 8.2, neck[1] + hd[1] * 8.2];
    const hp = (a, b) => [head[0] + hn[0] * a + hd[0] * -b, head[1] + hn[1] * a + hd[1] * -b]; // a: forward, b: down
    const arm = (a) => {
      const d1 = dir(a[0]),
        e = [sh[0] + d1[0] * 13, sh[1] + d1[1] * 13],
        d2 = dir(a[0] + a[1]);
      return [e, [e[0] + d2[0] * 12.5, e[1] + d2[1] * 12.5]];
    };
    const leg = (a) => {
      const d1 = dir(a[0]),
        k = [hip[0] + d1[0] * 22, hip[1] + d1[1] * 22],
        d2 = dir(a[0] - a[1]);
      return [k, [k[0] + d2[0] * 24, k[1] + d2[1] * 24], d1, d2];
    };
    const AF = arm(p.aF),
      AB = arm(p.aB),
      LF = leg(p.lF),
      LB = leg(p.lB);
    const wind = o.wind == null ? Math.PI : o.wind,
      gust = o.gust == null ? 0.6 : o.gust;
    // where cloth trails, in her own frame
    const twx = Math.cos(wind),
      twy = Math.sin(wind);
    const tr = [(twx * cr + twy * sr) * f, -twx * sr + twy * cr];
    const flut = Math.sin(t * 13) * 0.5;
    const nW = toW(neck[0] - td[0] * 1.2, neck[1] - td[1] * 1.2);
    const col = o.color || K.INK;

    // scarf first, so the body sits on it
    if (!o.noScarf) {
      const rc = o.scarf || K.RED;
      K.ribbon(g, nW[0], nW[1], wind + 0.1, 70 * s, 7.5 * s, 2.2 * s, t, { amp: (5 + 9 * gust) * s, k: 1.5, speed: 9 + gust * 5, phase: 0.4, droop: (1 - gust) * 30 * s, color: rc, n: 18 });
      K.ribbon(g, nW[0], nW[1], wind - 0.16, 46 * s, 6 * s, 1.6 * s, t, { amp: (4 + 7 * gust) * s, k: 1.3, speed: 10 + gust * 5, phase: 2.4, droop: (1 - gust) * 22 * s, color: rc, n: 14 });
    }
    // ponytail behind the head
    const ptl = hp(-4.6, -4.2);
    const pt = toW(ptl[0], ptl[1]);
    K.ribbon(g, pt[0], pt[1], wind - 0.05 + 0.25 * (1 - gust), 46 * s, 5.8 * s, 0.7 * s, t, { amp: (2.5 + 5 * gust) * s, k: 1.1, speed: 11, phase: 1.1, droop: (1 - gust) * 26 * s, color: col, n: 12 });

    g.save();
    g.translate(o.x, o.y);
    g.rotate(rot);
    g.scale(s * f, s);
    g.fillStyle = col;
    g.lineJoin = "round";
    /* a piece of the silhouette. front pieces cut a hairline of bare paper into what is under them */
    const piece = (pts, front) => {
      g.beginPath();
      for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
      g.closePath();
      if (front) {
        g.save();
        g.globalCompositeOperation = "destination-out";
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      }
      g.fill();
    };
    const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
    const hakama = (L, front) => {
      const d1 = L[2],
        d2 = L[3];
      const n1 = [d1[1], -d1[0]],
        n2 = [d2[1], -d2[0]];
      const K1 = L[0],
        A = L[1];
      const hemB = add(add(A, n2, -10.5), tr, 5 + flut * 1.5);
      piece([add(hip, n1, 5), add(K1, n1, 6.6), add(add(A, n2, 7.6), d2, 1.5), add(add(A, n2, 1), d2, 3.2), hemB, add(add(K1, n1, -7.4), tr, 1.5), add(hip, n1, -5.2)], front);
      // the foot, under the hem
      piece([add(A, d2, 2), add(add(A, d2, 5.6), n2, 7.4), add(add(A, d2, 6.4), n2, 0.5), add(add(A, d2, 5), n2, -2.4)], false);
    };
    const sleeve = (A, front) => {
      const e = A[0],
        h = A[1];
      const w = [lerp(e[0], h[0], 0.82), lerp(e[1], h[1], 0.82)];
      let dv = [tr[0] * 0.95, tr[1] * 0.95 + 0.6];
      const dl = Math.hypot(dv[0], dv[1]) || 1;
      dv = [dv[0] / dl, dv[1] / dl];
      const ax = h[0] - e[0],
        ay = h[1] - e[1],
        al = Math.hypot(ax, ay) || 1;
      const an = [-ay / al, ax / al];
      limb(g, sh[0], sh[1], e[0], e[1], 4.4, 3.8);
      limb(g, e[0], e[1], h[0], h[1], 3.4, 2.4);
      g.beginPath();
      g.arc(h[0], h[1], 1.8, 0, K.TAU);
      g.fill();
      piece([add(sh, an, 2.6), add(e, an, 2.4), add(w, an, 1.8), add(w, dv, 15 + flut * 2), add(add(e, dv, 8.5), tr, 2), add(sh, an, -3.4)], front);
    };
    let tip = null;
    const drawBrush = () => {
      if (p.hold >= 0.5) {
        const h = AF[1];
        return K.fude(g, h[0], h[1], p.br, o.brush);
      }
      const m = along(14, -5.6);
      return K.fude(g, m[0], m[1], p.br + p.lean * 0.6, { back: 30, fwd: 36, head: 21 });
    };
    if (p.hold < 0.5) tip = drawBrush();
    sleeve(AB, false);
    hakama(LB, false);
    // torso: shoulders, a narrow waist
    piece([along(0, -5.2), along(8, -3.3), along(21.5, -5.6), along(25.5, -1.8), along(25.5, 1.8), along(21.5, 5.4), along(8, 3.6), along(0, 5)], false);
    piece([along(6.5, -4.4), along(11.5, -4.3), along(11.5, 4.5), along(6.5, 4.6)], false); // obi
    piece([along(9, -4), along(13.5, -9.5), along(9.6, -7.2), along(5, -10), along(7.5, -4)], false); // the knot
    hakama(LF, true);
    // neck, head, hair
    limb(g, neck[0], neck[1], head[0], head[1], 3.2, 3.2);
    g.beginPath();
    g.arc(head[0], head[1], 5.9, 0, K.TAU);
    g.fill();
    piece([hp(1.5, 5.9), hp(4.9, 3.9), hp(6.0, 2.0), hp(7.3, 1.2), hp(5.6, -1.4), hp(3, -4)], false); // brow, nose, chin
    g.beginPath();
    const hc = hp(-1.2, -1.3);
    g.arc(hc[0], hc[1], 6.6, 0, K.TAU);
    g.fill();
    piece([hp(0, -7.6), hp(7.6, -1.6), hp(5.0, -1.2), hp(6.6, 0.9), hp(2.4, -1)], false); // fringe
    piece([hp(-3, -6.5), hp(-7.6, -6.6), hp(-6.2, -2.4)], false); // where the tail is tied
    sleeve(AF, true);
    if (p.hold >= 0.5) tip = drawBrush();
    g.restore();
    // scarf wrap at the neck
    if (!o.noScarf) {
      g.save();
      g.translate(nW[0], nW[1]);
      g.rotate(rot + p.lean * D * f * 0.6);
      g.fillStyle = o.scarf || K.RED;
      g.beginPath();
      g.ellipse(0.4 * s * f, 0.6 * s, 5.4 * s, 3.3 * s, 0, 0, K.TAU);
      g.fill();
      g.restore();
    }
    return { tip: tip ? toW(tip[0], tip[1]) : null, head: toW(head[0], head[1]), neck: nW, hand: toW(AF[1][0], AF[1][1]) };
  };

  // ---------- THE BLANK: a dragon of folded paper
  const blankHead = (g, x, y, ang, S, o) => {
    const jaw = (o.jaw || 0) * 34 * D;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    if (Math.cos(ang) < 0) g.scale(1, -1);
    const sh = "rgba(96,74,46,";
    // horns
    g.fillStyle = K.BLANK;
    const horn = (bx, by, tx, ty, w) => {
      g.beginPath();
      g.moveTo(bx - w, by);
      g.lineTo(tx, ty);
      g.lineTo(bx + w, by + w * 0.4);
      g.closePath();
      g.fill();
      g.strokeStyle = sh + "0.3)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(tx, ty);
      g.stroke();
    };
    horn(0.06 * S, -0.36 * S, -0.92 * S, -0.9 * S, 0.1 * S);
    horn(0.2 * S, -0.38 * S, -0.55 * S, -1.08 * S, 0.075 * S);
    // frill
    g.beginPath();
    g.moveTo(-0.08 * S, -0.4 * S);
    for (let i = 0; i < 5; i++) {
      const yy = lerp(-0.4, 0.26, i / 4) * S;
      g.lineTo(-(0.42 + 0.12 * (i % 2)) * S, yy - 0.06 * S);
      g.lineTo(-0.12 * S, yy + 0.1 * S);
    }
    g.closePath();
    g.fill();
    // mouth cavity
    g.fillStyle = "rgba(38,27,16,0.9)";
    g.beginPath();
    g.moveTo(0.02 * S, 0.0);
    g.lineTo(0.98 * S, -0.02 * S);
    g.lineTo(0.05 * S + Math.cos(jaw) * 0.86 * S, 0.06 * S + Math.sin(jaw) * 0.86 * S + 0.06 * S);
    g.closePath();
    g.fill();
    // lower jaw
    g.save();
    g.translate(0.03 * S, 0.06 * S);
    g.rotate(jaw);
    g.fillStyle = K.BLANK;
    g.beginPath();
    g.moveTo(-0.16 * S, -0.02 * S);
    g.lineTo(0.84 * S, 0.02 * S);
    g.lineTo(0.9 * S, 0.07 * S);
    g.lineTo(0.62 * S, 0.2 * S);
    g.lineTo(-0.06 * S, 0.3 * S);
    g.lineTo(-0.2 * S, 0.16 * S);
    g.closePath();
    g.fill();
    g.fillStyle = sh + "0.1)";
    g.beginPath();
    g.moveTo(-0.06 * S, 0.3 * S);
    g.lineTo(0.62 * S, 0.2 * S);
    g.lineTo(0.2 * S, 0.1 * S);
    g.closePath();
    g.fill();
    g.fillStyle = K.BLANK;
    for (let i = 0; i < 6; i++) {
      const tx = (0.2 + i * 0.11) * S;
      g.beginPath();
      g.moveTo(tx, 0.03 * S);
      g.lineTo(tx + 0.035 * S, -0.075 * S);
      g.lineTo(tx + 0.07 * S, 0.03 * S);
      g.fill();
    }
    g.restore();
    // skull
    g.fillStyle = K.BLANK;
    g.beginPath();
    g.moveTo(-0.16 * S, -0.42 * S);
    g.lineTo(0.3 * S, -0.44 * S);
    g.lineTo(0.5 * S, -0.3 * S);
    g.lineTo(0.9 * S, -0.24 * S);
    g.lineTo(1.04 * S, -0.1 * S);
    g.lineTo(1.0 * S, 0.0);
    g.lineTo(0.02 * S, 0.02 * S);
    g.lineTo(-0.2 * S, 0.1 * S);
    g.closePath();
    g.fill();
    for (let i = 0; i < 6; i++) {
      const tx = (0.26 + i * 0.12) * S;
      g.beginPath();
      g.moveTo(tx, -0.01 * S);
      g.lineTo(tx + 0.035 * S, 0.09 * S);
      g.lineTo(tx + 0.07 * S, -0.01 * S);
      g.fill();
    }
    // folds: facets of shadow
    g.fillStyle = sh + "0.11)";
    g.beginPath();
    g.moveTo(0.5 * S, -0.3 * S);
    g.lineTo(1.04 * S, -0.1 * S);
    g.lineTo(1.0 * S, 0);
    g.lineTo(0.4 * S, -0.08 * S);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-0.16 * S, -0.42 * S);
    g.lineTo(0.3 * S, -0.44 * S);
    g.lineTo(0.12 * S, -0.2 * S);
    g.closePath();
    g.fill();
    g.strokeStyle = sh + "0.34)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0.3 * S, -0.44 * S);
    g.lineTo(0.12 * S, -0.2 * S);
    g.lineTo(0.4 * S, -0.08 * S);
    g.lineTo(0.5 * S, -0.3 * S);
    g.moveTo(0.12 * S, -0.2 * S);
    g.lineTo(-0.2 * S, 0.1 * S);
    g.stroke();
    // the eye: a punched hole
    const ey = [0.33 * S, -0.21 * S],
      er = 0.085 * S * (o.eye == null ? 1 : o.eye);
    g.fillStyle = K.INK;
    g.beginPath();
    g.arc(ey[0], ey[1], er, 0, K.TAU);
    g.fill();
    g.strokeStyle = sh + "0.4)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(ey[0], ey[1], er + 4, 0.2, 2.4);
    g.stroke();
    g.restore();
  };
  /* spine: points from head to tail. o: w, jaw, t, f (edge filter), shadow, u0/u1 (draw part of the body), noHead */
  K.blank = (g, spine, o = {}) => {
    const P = spine.x ? spine : K.path(spine, 9);
    const L = K.layer(o.layer || "blank");
    L.setTransform(g.getTransform());
    const w = o.w || 150;
    const prof = o.prof || ((u) => (0.6 + 0.4 * ss(0, 0.1, u)) * (1 - 0.97 * Math.pow(ss(0.3, 1, u), 1.25)));
    const u0 = o.u0 || 0,
      u1 = o.u1 == null ? 1 : o.u1;
    const i0 = Math.floor(u0 * (P.n - 1)),
      i1 = Math.ceil(u1 * (P.n - 1));
    const hw = (i) => 0.5 * w * prof(i / (P.n - 1));
    const sh = "rgba(96,74,46,";
    // dorsal fins
    L.fillStyle = K.BLANK;
    const segN = Math.max(3, Math.round((w * 0.4) / 9));
    for (let i = i0 + segN; i < i1 - 2; i += segN) {
      const h = hw(i);
      if (h < 6) continue;
      const j = Math.min(P.n - 1, i + segN);
      L.beginPath();
      L.moveTo(P.x[i] - P.nx[i] * h * 0.9, P.y[i] - P.ny[i] * h * 0.9);
      L.lineTo(P.x[j] - P.nx[j] * (hw(j) + h * 0.55), P.y[j] - P.ny[j] * (hw(j) + h * 0.55));
      L.lineTo(P.x[j] - P.nx[j] * hw(j) * 0.9, P.y[j] - P.ny[j] * hw(j) * 0.9);
      L.closePath();
      L.fill();
    }
    // body
    L.beginPath();
    for (let i = i0; i <= i1; i++) {
      const h = hw(i);
      L.lineTo(P.x[i] + P.nx[i] * h, P.y[i] + P.ny[i] * h);
    }
    for (let i = i1; i >= i0; i--) {
      const h = hw(i);
      L.lineTo(P.x[i] - P.nx[i] * h, P.y[i] - P.ny[i] * h);
    }
    L.closePath();
    L.fill();
    // accordion folds
    let k = 0;
    for (let i = i0; i < i1 - 1; i += segN, k++) {
      const j = Math.min(i1, i + segN),
        m = Math.min(i1, i + Math.floor(segN / 2));
      const h = hw(i),
        h2 = hw(j);
      if (k % 2 === 0) {
        L.fillStyle = sh + "0.085)";
        L.beginPath();
        L.moveTo(P.x[i] + P.nx[i] * h, P.y[i] + P.ny[i] * h);
        L.lineTo(P.x[j] + P.nx[j] * h2, P.y[j] + P.ny[j] * h2);
        L.lineTo(P.x[j] - P.nx[j] * h2, P.y[j] - P.ny[j] * h2);
        L.lineTo(P.x[i] - P.nx[i] * h, P.y[i] - P.ny[i] * h);
        L.closePath();
        L.fill();
      }
      L.strokeStyle = sh + "0.26)";
      L.lineWidth = 1.4;
      L.beginPath();
      L.moveTo(P.x[i] + P.nx[i] * h, P.y[i] + P.ny[i] * h);
      L.lineTo(P.x[m], P.y[m]);
      L.lineTo(P.x[i] - P.nx[i] * h, P.y[i] - P.ny[i] * h);
      L.stroke();
    }
    // belly shade along one edge
    L.strokeStyle = sh + "0.1)";
    L.lineWidth = w * 0.16;
    L.beginPath();
    for (let i = i0 + 2; i <= i1; i++) {
      const h = hw(i) * 0.74;
      L.lineTo(P.x[i] + P.nx[i] * h, P.y[i] + P.ny[i] * h);
    }
    L.stroke();
    if (!o.noHead && u0 === 0) {
      const ang = Math.atan2(P.y[0] - P.y[3], P.x[0] - P.x[3]);
      const S = w * (o.headS || 1.25);
      // whiskers: strips of paper
      const t = o.t || 0;
      const wx = P.x[0] + Math.cos(ang) * S * 0.75,
        wy = P.y[0] + Math.sin(ang) * S * 0.75;
      const wa = o.whisk == null ? ang + Math.PI : o.whisk;
      K.ribbon(L, wx, wy, wa + 0.5, S * 1.5, S * 0.07, S * 0.02, t, { amp: S * 0.12, k: 1.4, speed: 5, phase: 0, color: K.BLANK, n: 14 });
      K.ribbon(L, wx, wy, wa - 0.45, S * 1.7, S * 0.07, S * 0.02, t, { amp: S * 0.13, k: 1.2, speed: 5, phase: 2, color: K.BLANK, n: 14 });
      blankHead(L, P.x[0] - Math.cos(ang) * S * 0.12, P.y[0] - Math.sin(ang) * S * 0.12, ang, S, o);
    }
    if (o.noPut) return L;
    K.put(g, L, { shadow: o.shadow === false ? null : o.shadow || [10, 14, 18, 0.34], f: o.f, a: o.a });
    return P;
  };

  // ---------- the one-stroke dragon (hitofude-ryu)
  const inkHead = (g, x, y, ang, S, o) => {
    const t = o.t || 0;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const flip = Math.cos(ang) < 0;
    if (flip) g.scale(1, -1);
    g.fillStyle = K.INK;
    // mane: flames swept back
    for (let i = 0; i < 7; i++) {
      const a = lerp(-2.5, -3.9, i / 6),
        l = S * (0.62 + 0.3 * hash(i, 4)) * (1 + 0.08 * Math.sin(t * 9 + i * 1.7));
      const bx = -0.05 * S + Math.cos(a) * S * 0.12,
        by = -0.05 * S + Math.sin(a) * S * 0.3;
      g.beginPath();
      g.moveTo(bx, by - S * 0.1);
      g.quadraticCurveTo(bx + Math.cos(a) * l * 0.5, by + Math.sin(a) * l * 0.5 - S * 0.14, bx + Math.cos(a) * l, by + Math.sin(a) * l);
      g.quadraticCurveTo(bx + Math.cos(a) * l * 0.4, by + Math.sin(a) * l * 0.4 + S * 0.1, bx, by + S * 0.12);
      g.fill();
    }
    const jaw = (o.jaw == null ? 0.5 : o.jaw) * 30 * D;
    // lower jaw
    g.save();
    g.translate(0.02 * S, 0.1 * S);
    g.rotate(jaw);
    g.beginPath();
    g.moveTo(-0.2 * S, -0.04 * S);
    g.lineTo(0.72 * S, 0.0);
    g.quadraticCurveTo(0.86 * S, 0.02 * S, 0.84 * S, -0.08 * S);
    g.lineTo(0.9 * S, 0.06 * S);
    g.quadraticCurveTo(0.5 * S, 0.24 * S, -0.1 * S, 0.26 * S);
    g.closePath();
    g.fill();
    // beard
    g.beginPath();
    g.moveTo(0.3 * S, 0.14 * S);
    g.quadraticCurveTo(0.1 * S, 0.5 * S, -0.3 * S, 0.56 * S);
    g.quadraticCurveTo(0.0, 0.36 * S, 0.06 * S, 0.18 * S);
    g.fill();
    g.fillStyle = K.PAPER;
    for (let i = 0; i < 4; i++) {
      const tx = (0.3 + i * 0.13) * S;
      g.beginPath();
      g.moveTo(tx, 0.005 * S);
      g.lineTo(tx + 0.03 * S, -0.09 * S);
      g.lineTo(tx + 0.065 * S, 0.005 * S);
      g.fill();
    }
    g.restore();
    // skull + snout
    g.fillStyle = K.INK;
    g.beginPath();
    g.moveTo(-0.24 * S, -0.34 * S);
    g.quadraticCurveTo(0.1 * S, -0.52 * S, 0.34 * S, -0.34 * S);
    g.quadraticCurveTo(0.6 * S, -0.22 * S, 0.84 * S, -0.3 * S);
    g.quadraticCurveTo(1.04 * S, -0.3 * S, 1.02 * S, -0.1 * S);
    g.quadraticCurveTo(0.98 * S, 0.02 * S, 0.8 * S, 0.02 * S);
    g.lineTo(0.02 * S, 0.06 * S);
    g.lineTo(-0.26 * S, 0.2 * S);
    g.closePath();
    g.fill();
    // upper fangs
    g.fillStyle = K.PAPER;
    for (let i = 0; i < 4; i++) {
      const tx = (0.36 + i * 0.13) * S;
      g.beginPath();
      g.moveTo(tx, 0.03 * S);
      g.lineTo(tx + 0.032 * S, 0.14 * S);
      g.lineTo(tx + 0.066 * S, 0.03 * S);
      g.fill();
    }
    // eye: bare paper with a slit
    g.beginPath();
    g.moveTo(0.2 * S, -0.2 * S);
    g.quadraticCurveTo(0.34 * S, -0.34 * S, 0.5 * S, -0.2 * S);
    g.quadraticCurveTo(0.36 * S, -0.13 * S, 0.2 * S, -0.2 * S);
    g.fill();
    g.fillStyle = K.INK;
    g.beginPath();
    g.ellipse(0.36 * S, -0.215 * S, 0.022 * S, 0.06 * S, 0.2, 0, K.TAU);
    g.fill();
    // nostril curl
    g.strokeStyle = K.PAPER;
    g.lineWidth = Math.max(1.5, S * 0.018);
    g.lineCap = "round";
    g.beginPath();
    g.arc(0.9 * S, -0.16 * S, 0.035 * S, 0.5, 4.2);
    g.stroke();
    // horns
    g.strokeStyle = K.INK;
    g.lineWidth = S * 0.07;
    g.beginPath();
    g.moveTo(0.1 * S, -0.4 * S);
    g.quadraticCurveTo(-0.3 * S, -0.7 * S, -0.7 * S, -0.72 * S);
    g.moveTo(-0.26 * S, -0.63 * S);
    g.quadraticCurveTo(-0.34 * S, -0.84 * S, -0.56 * S, -0.94 * S);
    g.stroke();
    g.lineWidth = S * 0.05;
    g.beginPath();
    g.moveTo(0.26 * S, -0.4 * S);
    g.quadraticCurveTo(0.02 * S, -0.82 * S, -0.34 * S, -1.0 * S);
    g.stroke();
    g.restore();
    // whiskers
    const wx = x + Math.cos(ang) * S * 0.88 - Math.sin(ang) * S * (flip ? 0.12 : -0.12),
      wy = y + Math.sin(ang) * S * 0.88 + Math.cos(ang) * S * (flip ? 0.12 : -0.12);
    const wa = o.whisk == null ? ang + Math.PI : o.whisk;
    K.ribbon(g, wx, wy, wa + 0.55, S * 1.7, S * 0.05, S * 0.012, t, { amp: S * 0.14, k: 1.3, speed: 8, phase: 0.5, n: 16 });
    K.ribbon(g, wx, wy, wa - 0.5, S * 1.5, S * 0.05, S * 0.012, t, { amp: S * 0.13, k: 1.5, speed: 8, phase: 2.7, n: 16 });
  };
  /* spine: head to tail. o: w, prog (0..1, written from the tail end toward the head), t, u0/u1, noHead, f */
  K.inkDragon = (g, spine, o = {}) => {
    const P = spine.x ? spine : K.path(spine, 7);
    const L = K.layer(o.layer || "inkd");
    L.setTransform(g.getTransform());
    const w = o.w || 120,
      seed = o.seed || 31;
    const prof = o.prof || ((u) => (0.55 + 0.45 * ss(0, 0.12, u)) * (1 - 0.96 * Math.pow(ss(0.2, 1, u), 1.15)));
    const u0 = o.u0 || 0,
      u1 = o.u1 == null ? 1 : o.u1;
    // the body is one stroke: reversed so it starts wet at the head and dries out to the tail
    K.stroke(L, P, { w, prof, dry: 0.75, dryStart: 0.42, seed, from: u0, prog: u1, streak: w * 3, edge: 0.14 });
    const i0 = Math.floor(u0 * (P.n - 1)),
      i1 = Math.ceil(u1 * (P.n - 1));
    const hw = (i) => 0.5 * w * prof(i / (P.n - 1));
    // back spikes
    L.fillStyle = K.INK;
    const sp = Math.max(3, Math.round((w * 0.5) / 7));
    for (let i = i0 + sp; i < i1 - 3; i += sp) {
      const h = hw(i);
      if (h < 5) continue;
      const j = Math.min(P.n - 1, i + Math.round(sp * 1.1));
      const big = 0.5 + 0.35 * hash(i, seed);
      L.beginPath();
      L.moveTo(P.x[i] + P.nx[i] * h * 0.9, P.y[i] + P.ny[i] * h * 0.9);
      L.quadraticCurveTo(
        P.x[i] + P.nx[i] * h * (1.3 + big),
        P.y[i] + P.ny[i] * h * (1.3 + big),
        P.x[j] + P.nx[j] * (hw(j) + h * big * 1.1),
        P.y[j] + P.ny[j] * (hw(j) + h * big * 1.1),
      );
      L.lineTo(P.x[Math.max(i0, i - 2)] + P.nx[i] * h * 0.85, P.y[Math.max(i0, i - 2)] + P.ny[i] * h * 0.85);
      L.closePath();
      L.fill();
    }
    // scale ripples: the brush wiggled as it travelled
    L.globalCompositeOperation = "destination-out";
    L.lineCap = "round";
    const st = Math.max(2, Math.round((w * 0.3) / 7));
    for (let i = i0 + st; i < i1 - 2; i += st) {
      const h = hw(i);
      if (h < 7) continue;
      const j = Math.min(P.n - 1, i + st);
      L.globalAlpha = 0.5 + 0.4 * hash(i, seed, 2);
      L.lineWidth = Math.max(1.2, w * 0.022) * (0.7 + 0.7 * hash(i, seed, 3));
      L.beginPath();
      L.moveTo(P.x[i] - P.nx[i] * h * 0.86, P.y[i] - P.ny[i] * h * 0.86);
      L.quadraticCurveTo(P.x[j], P.y[j], P.x[i] + P.nx[i] * h * 0.62, P.y[i] + P.ny[i] * h * 0.62);
      L.stroke();
    }
    // pale belly
    L.globalAlpha = 0.34;
    L.lineWidth = w * 0.13;
    L.beginPath();
    for (let i = i0 + 3; i <= i1; i++) {
      const h = hw(i) * 0.78;
      L.lineTo(P.x[i] - P.nx[i] * h, P.y[i] - P.ny[i] * h);
    }
    L.stroke();
    L.globalAlpha = 1;
    L.globalCompositeOperation = "source-over";
    if (!o.noHead && u0 === 0) {
      const ang = Math.atan2(P.y[0] - P.y[4], P.x[0] - P.x[4]);
      inkHead(L, P.x[0] - Math.cos(ang) * w * 0.2, P.y[0] - Math.sin(ang) * w * 0.2, ang, w * (o.headS || 1.15), o);
    }
    K.put(g, L, { op: "multiply", f: o.f, a: o.a });
    return P;
  };

  /* a body following a head path: headFn(tau) -> [x,y]; points every `gap` of tau behind the head, with a travelling wave */
  K.snake = (headFn, tau, n, gap, wave = 0, k = 0.5, t = 0, sp = 6) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = headFn(tau - i * gap),
        b = headFn(tau - i * gap - 0.01);
      let tx = a[0] - b[0],
        ty = a[1] - b[1];
      const l = Math.hypot(tx, ty) || 1;
      const wv = wave * Math.min(1, i / 3) * Math.sin(i * k - t * sp);
      pts.push([a[0] - (ty / l) * wv, a[1] + (tx / l) * wv]);
    }
    return pts;
  };
})();
