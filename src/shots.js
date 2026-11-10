/* HITOFUDE — the shots. Each is fn(g, lt, t, f): g = scene (paper already down), lt = seconds into the shot. */
(function () {
  "use strict";
  const K = window.K,
    W = K.W,
    H = K.H;
  const { clamp, lerp, ss, inv, hash, n1 } = K;
  const E = K.ease;
  K.SHOTS = [];
  const shot = (id, t0, t1, fn) => K.SHOTS.push({ id, t0, t1, fn });
  /* decaying camera shake, new offset every frame */
  const shake = (dt, amp, f) => {
    if (dt < 0) return null;
    const d = amp * Math.exp(-dt * 7);
    if (d < 0.6) return null;
    return [(hash(f, 1) * 2 - 1) * d, (hash(f, 2) * 2 - 1) * d];
  };
  K.shakeFn = shake;
  K.CLIFF = null;

  // =========================================================== s01 — the range is brushed in
  shot("s01", 0, 3.5, (g, lt, t, f) => {
    const cam = { x: lerp(-36, 30, lt / 3.5), y: 0, z: lerp(1.0, 1.06, lt / 3.5) };
    const p0 = lerp(0.93, 1, E.out2(inv(0, 0.6, lt)));
    const p1 = lerp(0.6, 1, E.io3(inv(0, 2.0, lt)));
    const p2 = lerp(0.3, 1, E.io3(inv(0.1, 2.7, lt)));
    g.save();
    K.cam(g, cam, 0.15);
    K.sun(g, 1392, 262, 98);
    g.restore();
    K.landscape(g, cam, { prog: [p0, p1, p2] });
    // the painter signs it: a seal, bottom right
    if (lt >= 3.0) K.seal(g, 1690, 880, 96, 0.05, lerp(1.3, 1, E.out3(inv(3.0, 3.12, lt))));
    return { shake: shake(lt - 3.04, 5, f) };
  });

  // the cliff, the pine, the torii, Sumi — shared by s02 and s03
  const CLIFF = [
    [-260, 748],
    [60, 734],
    [300, 724],
    [540, 716],
    [760, 712],
    [905, 708],
    [990, 716],
    [1016, 770],
    [992, 880],
    [1044, 1010],
    [1020, 1260],
  ];
  K.cliffSet = (g, cam, t, o = {}) => cliffSet(g, cam, t, o);
  const cliffSet = (g, cam, t, o = {}) => {
    const t2 = K.on2(t);
    g.save();
    K.cam(g, cam, 1);
    const P = K.rock(g, CLIFF, 1320, 5, {});
    const L = K.layer("fg");
    L.setTransform(g.getTransform());
    K.grass(L, P, 0.02, 0.56, 120, t2, 3, { h: 30 });
    K.pine(L, 236, 728, 1.22, 9, Math.sin(t2 * 1.6) * 0.5 + 0.3 * Math.sin(t2 * 3.1));
    if (!o.redTorii) K.torii(L, 566, 718, 1.2);
    K.put(g, L, { op: "multiply", f: "rgh0" });
    if (o.redTorii) {
      const L3 = K.layer("torii");
      L3.setTransform(g.getTransform());
      K.torii(L3, 566, 718, 1.2, K.RED);
      K.put(g, L3, { op: "multiply", f: "rgh0" });
    }
    g.restore();
  };
  K.CLIFFPTS = CLIFF;

  // =========================================================== s02 — the cliff; she waits
  const FLOCK = [
    [0, 0, 15],
    [70, -34, 12],
    [130, 20, 13],
    [210, -60, 11],
    [270, -6, 14],
    [350, -44, 10],
    [420, 30, 12],
  ];
  const drawFlock = (g, cam, t, erased) => {
    const t2 = K.on2(t);
    g.save();
    K.cam(g, cam, 0.3);
    for (let i = 0; i < FLOCK.length; i++) {
      const b = FLOCK[i];
      const x = 1010 + b[0] + (t - 3.5) * 46,
        y = 250 + b[1] - (t - 3.5) * 9 + Math.sin(t2 * 2 + i) * 5;
      const e = erased ? erased[i] : null;
      if (e != null && t >= e) {
        // wiped: a clean streak where the bird was
        const k = E.out3(inv(e, e + 0.14, t));
        const bx = 1010 + b[0] + (e - 3.5) * 46,
          by = 250 + b[1] - (e - 3.5) * 9;
        K.stroke(g, [[bx + 60, by - 12], [bx, by], [bx - 70, by + 14]], { w: 46, color: K.BLANK, dry: 0.5, dryStart: 0.3, seed: 40 + i, prog: k, alpha: 0.95, prof: K.prof.brush });
        continue;
      }
      K.bird(g, x, y, b[2], t2 * 11 + i * 1.9);
    }
    g.restore();
  };
  shot("s02", 3.5, 6.5, (g, lt, t, f) => {
    const cam = { x: lerp(40, -10, lt / 3), y: lerp(-16, -40, lt / 3), z: lerp(1.0, 1.13, E.out2(lt / 3)) };
    K.landscape(g, { x: cam.x + 260, y: cam.y + 90, z: cam.z }, { a: 0.78 });
    g.save();
    K.cam(g, cam, 0.15);
    K.sun(g, 1500, 300, 104);
    g.restore();
    drawFlock(g, cam, t);
    cliffSet(g, cam, t);
    const t2 = K.on2(t);
    const L = K.layer("hero");
    K.cam(L, cam, 1);
    K.sumi(L, { x: 868, y: 708 - 46 * 2.7, s: 2.7, f: 1, pose: K.POSE.stand, t: t2, wind: Math.PI + 0.12 * Math.sin(t2 * 2.2), gust: 0.75 });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    return {};
  });

  // =========================================================== s03 — the birds are erased
  shot("s03", 6.5, 9.5, (g, lt, t, f) => {
    const cam = { x: lerp(120, 190, E.out2(lt / 3)), y: -70, z: 1.0 };
    K.landscape(g, { x: cam.x + 260, y: cam.y + 90, z: cam.z }, { a: 0.78 });
    g.save();
    K.cam(g, cam, 0.15);
    K.sun(g, 1500, 300, 104);
    g.restore();
    drawFlock(g, cam, t, [9.1, 8.0, 7.5, 8.45, 6.9, 8.75, 8.2]);
    // the white edge comes in from the right
    if (lt > 1.7) {
      const k = inv(1.6, 3.0, lt);
      const base = lerp(2200, 1300, k * (0.6 + 0.4 * k));
      const fs = Math.floor(f / 3);
      K.erase(g, (y) => K.frontX(base, y, 3, 1) + (hash(fs, Math.floor(y / 60)) - 0.5) * 16, 1);
    }
    cliffSet(g, cam, t);
    const t2 = K.on2(t);
    const pose = K.poseAt(
      [
        [0, K.POSE.stand],
        [1.9, K.POSE.stand],
        [2.15, K.mix(K.POSE.stand, K.POSE.alert, 0.5)],
        [2.55, K.POSE.alert, E.out5],
      ],
      K.on2(t) - 6.5,
    );
    const L = K.layer("hero");
    K.cam(L, cam, 1);
    K.sumi(L, { x: 868, y: 708 - 46 * 2.7, s: 2.7, f: 1, pose, t: t2, wind: Math.PI + 0.12 * Math.sin(t2 * 2.2), gust: lerp(0.75, 1, inv(1.7, 3, lt)) });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    return {};
  });

  // =========================================================== s04 — THE BLANK
  const blankRise = (tau) => {
    const th = tau * 2.0;
    return [1570 - 470 * (1 - Math.cos(th)) * 0.75, 1260 - 910 * Math.sin(th)];
  };
  shot("s04", 9.5, 13.5, (g, lt, t, f) => {
    const cam = { x: lerp(-30, 10, lt / 4), y: 0, z: lerp(1.0, 1.05, lt / 4) };
    const t2 = K.on2(t),
      t3 = K.on3(t);
    K.landscape(g, { x: cam.x - 120, y: cam.y + 30, z: cam.z });
    const base = lerp(1120, 1040, lt / 4);
    const fs = Math.floor(f / 3);
    K.erase(g, (y) => K.frontX(base, y, 3, 1) + (hash(fs, Math.floor(y / 60)) - 0.5) * 14, 1);
    // the cliff, small, bottom left
    g.save();
    K.cam(g, cam, 1);
    g.translate(-150, 436);
    g.scale(0.46, 0.46);
    const P = K.rock(g, CLIFF, 1320, 5, {});
    const L = K.layer("fg");
    L.setTransform(g.getTransform());
    K.pine(L, 236, 728, 1.22, 9, Math.sin(t2 * 1.6) * 0.5);
    K.torii(L, 566, 718, 1.2);
    const pose = K.poseAt(
      [
        [0, K.POSE.alert],
        [1.2, K.POSE.alert],
        [1.5, K.POSE.ready, E.out5],
      ],
      t2 - 9.5,
    );
    K.sumi(L, { x: 868, y: 708 - 46 * 2.7, s: 2.7, f: 1, pose, t: t2, wind: Math.PI + 0.2, gust: 1 });
    K.put(g, L, { op: "multiply", f: "rgh" + K.boil(t) });
    g.restore();
    // the Blank rises out of the bare paper
    const tau = 1.16 * E.out3(inv(0.15, 2.1, lt)) + 0.012 * lt;
    g.save();
    K.cam(g, cam, 1);
    const spine = K.snake(blankRise, tau, 26, 0.05, 20, 0.55, t2, 2.4);
    K.blank(g, spine, { w: 176, jaw: 0.15 + 0.4 * E.out3(inv(1.55, 1.9, lt)), t: t2, headS: 1.62, whisk: Math.PI * 0.42 });
    g.restore();
    // boss card
    const ct = lt - 1.8;
    if (ct >= 0) {
      const L2 = K.layer("card");
      K.stroke(L2, [[-80, 916], [640, 910], [1400, 918], [2010, 912]], { w: 214, prof: (u) => 0.92 + 0.08 * Math.sin(u * 9), dry: 0.6, dryStart: 0.5, seed: 61, prog: E.out3(inv(0, 0.21, ct)), streak: 520, edge: 0.07 });
      K.put(g, L2, { op: "multiply" });
      const kp = inv(0.08, 0.5, ct);
      K.kanji(g, K.GLYPH.shiro, 150, 824, 178, { prog: kp, color: K.BLANK, w: 0.105, dry: 0.3, seed: 8 });
      const chars = (ct - 0.3) * 30;
      K.text(g, "THE BLANK", 420, 926, { size: 84, color: K.BLANK, track: 0.36, chars });
      K.text(g, "EATER OF PAINTINGS", 426, 978, { size: 31, color: "rgba(249,245,234,0.86)", track: 0.5, chars: (ct - 0.55) * 44 });
    }
    return { shake: shake(ct, 16, f) };
  });
})();
