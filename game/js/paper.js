// The sheet: a living ink painting. One canvas is its colour, another is how wet the ink still is
// (wet ink is glossy under the lamp and dries to matte).
import * as THREE from "three";
import { canvasTex, fibreNormal } from "./textures.js";
import { PW, PH } from "./desk.js";
const K = window.K;
const CW = 1920,
  CH = 1080;
const DRY = "rgb(0,236,0)"; // roughness lives in the green channel

const ICHI = [
  [150, 560],
  [560, 532],
  [1040, 524],
  [1480, 538],
  [1790, 556],
];
const ichiProf = (u) => K.lerp(0.62, 1, K.ss(0, 0.05, u)) * K.lerp(1, 0.34, Math.pow(K.ss(0.5, 1, u), 1.3));

export class Paper {
  constructor(scene) {
    const mk = (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };
    this.c = mk(CW, CH);
    this.g = this.c.getContext("2d");
    this.cw = mk(CW / 2, CH / 2);
    this.w = this.cw.getContext("2d");
    this.colour = mk(CW, CH);
    this.dist = 0;
    this.dirty = true;
    this.flood = -1;
    this.paintWorld();
    this.tex = canvasTex(this.c, { aniso: 16 });
    this.wtex = canvasTex(this.cw, { srgb: false, aniso: 4 });
    // eraser: a soft, ragged dab of clean paper
    const s = (this.stamp = mk(128, 128));
    const sg = s.getContext("2d");
    const gr = sg.createRadialGradient(64, 64, 8, 64, 64, 62);
    gr.addColorStop(0, "rgba(244,239,226,1)");
    gr.addColorStop(0.62, "rgba(244,239,226,0.85)");
    gr.addColorStop(1, "rgba(244,239,226,0)");
    sg.fillStyle = gr;
    sg.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2,
        r = 46 + 16 * K.n1(i * 0.8, 3);
      sg.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    sg.fill();

    const geo = new THREE.PlaneGeometry(PW, PH, 128, 72);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      let y = 0.0011 * Math.sin(x * 8 + 1) * Math.sin(z * 6.5) + 0.0006 * Math.sin(x * 23 + z * 17);
      const c1 = Math.hypot(x - PW / 2, z - PH / 2),
        c2 = Math.hypot(x + PW / 2, z - PH / 2);
      y += 0.02 * Math.pow(K.clamp(1 - c1 / 0.26), 2) + 0.011 * Math.pow(K.clamp(1 - c2 / 0.2), 2);
      p.setY(i, y + 0.0012);
    }
    geo.computeVertexNormals();
    this.mat = new THREE.MeshStandardMaterial({
      map: this.tex,
      roughnessMap: this.wtex,
      roughness: 1,
      metalness: 0,
      normalMap: canvasTex(fibreNormal(), { srgb: false, repeat: [8, 4.5] }),
      normalScale: new THREE.Vector2(0.42, 0.42),
      envMapIntensity: 0.35,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.renderOrder = -3;
    scene.add(this.mesh);
  }
  toPx(x, z) {
    return [(x / PW + 0.5) * CW, (z / PH + 0.5) * CH];
  }
  /* the painting the fight happens on, and its coloured twin for the ending */
  paintWorld() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.drawImage(K.paper, 0, 0);
    g.save();
    K.sun(g, 1392, 262, 98);
    g.restore();
    K.landscape(g, { x: 0, y: 0, z: 1 }, {});
    this.w.fillStyle = DRY;
    this.w.fillRect(0, 0, CW / 2, CH / 2);
    const c = this.colour.getContext("2d");
    c.drawImage(K.paper, 0, 0);
    const sky = K.layer("col");
    K.skyColor(sky);
    K.put(c, sky, { op: "multiply" });
    K.landscape(c, { x: 0, y: 0, z: 1 }, { col: [[58, 86, 150], [52, 128, 104], [30, 84, 82]], ca: 0.78 });
    K.landscape(c, { x: 0, y: 0, z: 1 }, { a: 0.5 });
    c.save();
    K.sun(c, 1392, 262, 98);
    c.restore();
    this.dirty = true;
    this.flood = -1;
    this.dist = 0;
    this.ichi = null;
    this.clean = true;
  }
  /* one step of a brush stroke, in world space. load: 0..1 how much ink is on the brush */
  strokeSeg(x0, z0, x1, z1, width, load) {
    const a = this.toPx(x0, z0),
      b = this.toPx(x1, z1);
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      L = Math.hypot(dx, dy);
    if (L < 0.4) return;
    const nx = -dy / L,
      ny = dx / L,
      w = (width / PW) * CW;
    const g = this.g;
    g.lineCap = "round";
    g.strokeStyle = K.ink(0.55 + 0.45 * load);
    g.lineWidth = w * (0.5 + 0.42 * load);
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
    const B = 11;
    for (let i = 0; i < B; i++) {
      const v = (i / (B - 1) - 0.5) * w * 1.08;
      const n = K.n1(this.dist / (70 + i * 9) + i * 13.1, i);
      if (n < 0.2 + (1 - load) * 0.62) continue;
      g.strokeStyle = K.ink(0.35 + 0.6 * n);
      g.lineWidth = (w / B) * 1.7;
      g.beginPath();
      g.moveTo(a[0] + nx * v, a[1] + ny * v);
      g.lineTo(b[0] + nx * v, b[1] + ny * v);
      g.stroke();
    }
    this.dist += L;
    this.clean = false;
    const q = this.w;
    q.lineCap = "round";
    q.strokeStyle = "rgb(0,58,0)";
    q.lineWidth = w * 0.5 * (0.6 + 0.4 * load);
    q.beginPath();
    q.moveTo(a[0] / 2, a[1] / 2);
    q.lineTo(b[0] / 2, b[1] / 2);
    q.stroke();
    this.dirty = true;
  }
  splat(x, z, r, seed, n = 10) {
    const p = this.toPx(x, z);
    K.splat(this.g, p[0], p[1], (r / PW) * CW, seed, n, { size: 0.9, max: 9 });
    this.dirty = true;
  }
  /* the Blank passes: ink goes back to bare paper */
  erase(x, z, r, strength = 0.5) {
    const p = this.toPx(x, z),
      R = (r / PW) * CW;
    const g = this.g;
    this.clean = false;
    g.globalAlpha = strength;
    g.drawImage(this.stamp, p[0] - R, p[1] - R, R * 2, R * 2);
    g.globalAlpha = 1;
    const q = this.w;
    q.fillStyle = DRY;
    q.beginPath();
    q.arc(p[0] / 2, p[1] / 2, R * 0.45, 0, Math.PI * 2);
    q.fill();
    this.dirty = true;
  }
  /* the finishing stroke: 一 across the whole sheet */
  paintIchi() {
    K.stroke(this.g, ICHI, { w: 132, prof: ichiProf, dry: 0.72, dryStart: 0.4, seed: 77, streak: 520, edge: 0.12 });
    K.splat(this.g, 170, 560, 220, 5, 34, { size: 1.0 });
    K.splat(this.g, 1000, 536, 900, 6, 70, { dir: 0, spread: 0.3, size: 0.45, max: 9 });
    const q = this.w;
    q.strokeStyle = "rgb(0,64,0)";
    q.lineCap = "round";
    q.lineWidth = 54;
    q.beginPath();
    q.moveTo(ICHI[0][0] / 2, ICHI[0][1] / 2);
    for (const p of ICHI) q.lineTo(p[0] / 2, p[1] / 2);
    q.stroke();
    // keep the stroke so the colour can rise underneath it
    this.ichi = document.createElement("canvas");
    this.ichi.width = CW;
    this.ichi.height = CH;
    const ig = this.ichi.getContext("2d");
    K.stroke(ig, ICHI, { w: 132, prof: ichiProf, dry: 0.72, dryStart: 0.4, seed: 77, streak: 520, edge: 0.12 });
    K.splat(ig, 170, 560, 220, 5, 34, { size: 1.0 });
    this.dirty = true;
  }
  startFlood() {
    this.flood = 0;
  }
  update(dt, frame) {
    // ink dries
    if (frame % 4 === 0) {
      this.w.fillStyle = "rgba(0,236,0,0.045)";
      this.w.fillRect(0, 0, CW / 2, CH / 2);
      this.wdirty = true;
    }
    if (this.flood >= 0 && this.flood < 3.4) {
      this.flood += dt;
      const rr = 2700 * Math.pow(K.clamp(this.flood / 3.0), 1.5);
      const g = this.g;
      g.save();
      g.beginPath();
      for (let x = -40; x <= CW + 40; x += 24) g.lineTo(x, 545 - rr * (0.35 + 1.1 * K.fbm1(x / 300, 5, 3)) - 26 * K.n1(x / 23, 9));
      for (let x = CW + 40; x >= -40; x -= 24) g.lineTo(x, 545 + rr * (0.35 + 1.1 * K.fbm1(x / 280, 15, 3)) + 26 * K.n1(x / 23, 19));
      g.closePath();
      g.clip();
      g.drawImage(this.colour, 0, 0);
      g.restore();
      if (this.ichi) {
        g.globalCompositeOperation = "multiply";
        g.drawImage(this.ichi, 0, 0);
        g.globalCompositeOperation = "source-over";
      }
      this.dirty = true;
    }
    if (this.dirty && frame % 2 === 0) {
      this.tex.needsUpdate = true;
      this.wdirty = true;
      this.dirty = false;
    }
    if (this.wdirty && frame % 2 === 1) {
      this.wtex.needsUpdate = true;
      this.wdirty = false;
    }
  }
}
