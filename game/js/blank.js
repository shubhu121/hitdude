// THE BLANK: an origami dragon. Real folded paper has facets, so the low-polygon look here is the honest one.
import * as THREE from "three";
import { PW, PH } from "./desk.js";
const K = window.K;
const N = 58,
  SEG = 0.027,
  SIDES = 6,
  HS = 0.15; // head length
const rad = (u) => 0.05 * (0.6 + 0.4 * K.ss(0, 0.1, u)) * (1 - 0.95 * Math.pow(K.ss(0.3, 1, u), 1.2));
const LOW = 0.034;

function triGeo(tris) {
  const a = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((p, j) => a.set(p, i * 9 + j * 3)));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}
const mz = (p) => [p[0], p[1], -p[2]];

function buildHead(paper, dark) {
  const head = new THREE.Group();
  const Np = [1.05, 0.02, 0],
    SL = [0.86, -0.02, 0.13],
    BL = [0.38, 0.3, 0.24],
    C = [0.05, 0.4, 0],
    KL = [-0.3, 0.2, 0.34],
    HL = [0.3, -0.04, 0.36],
    ML = [-0.28, -0.06, 0.32];
  const SR = mz(SL),
    BR = mz(BL),
    KR = mz(KL),
    HR = mz(HL),
    MR = mz(ML);
  const skull = [
    [Np, BL, BR],
    [BL, C, BR],
    [C, BL, KL],
    [C, KR, BR],
    [C, KL, KR],
    [Np, SL, BL],
    [SL, HL, BL],
    [BL, HL, KL],
    [HL, ML, KL],
    [Np, BR, SR],
    [SR, BR, HR],
    [BR, KR, HR],
    [HR, KR, MR],
    [KL, ML, MR],
    [KL, MR, KR],
  ];
  // frill: spikes swept back
  for (const [P, s] of [
    [KL, 1],
    [ML, 1],
    [KR, -1],
    [MR, -1],
  ])
    skull.push([P, [P[0] - 0.55, P[1] + 0.08, P[2] + s * 0.16], [P[0] - 0.05, P[1] - 0.13, P[2]]]);
  skull.push([C, [C[0] - 0.6, C[1] + 0.16, 0.0], [KL[0], KL[1], 0.1]], [C, [C[0] - 0.6, C[1] + 0.16, 0.0], [KR[0], KR[1], -0.1]]);
  const sk = new THREE.Mesh(triGeo(skull), paper);
  head.add(sk);
  head.add(new THREE.Mesh(triGeo([[Np, SL, SR], [SL, HL, HR], [SL, HR, SR], [HL, ML, MR], [HL, MR, HR]]), dark));
  // jaw, hinged at the back of the mouth
  const jaw = new THREE.Group();
  jaw.position.set(-0.25, -0.09, 0);
  const JT = [1.2, 0, 0],
    JL = [0.55, 0, 0.3],
    JBL = [0, 0, 0.32],
    JC = [0.5, -0.24, 0],
    JBC = [0, -0.16, 0];
  const JR = mz(JL),
    JBR = mz(JBL);
  jaw.add(new THREE.Mesh(triGeo([[JT, JL, JC], [JT, JC, JR], [JL, JBL, JC], [JR, JC, JBR], [JBL, JBC, JC], [JBR, JC, JBC], [JBL, JBR, JBC]]), paper));
  jaw.add(new THREE.Mesh(triGeo([[JT, JL, JR], [JL, JBL, JBR], [JL, JBR, JR]].map((t) => t.map((p) => [p[0], p[1] + 0.004, p[2]]))), dark));
  head.add(jaw);
  // teeth
  const tooth = new THREE.ConeGeometry(0.034, 0.12, 4);
  for (const s of [1, -1])
    for (let i = 0; i < 5; i++) {
      const u = 0.1 + i * 0.2;
      const up = new THREE.Mesh(tooth, paper);
      up.position.set(K.lerp(SL[0], HL[0], u), K.lerp(SL[1], HL[1], u) - 0.06, s * K.lerp(SL[2], HL[2], u) * 0.96);
      up.rotation.x = Math.PI;
      head.add(up);
      const lo = new THREE.Mesh(tooth, paper);
      lo.position.set(K.lerp(JT[0], JL[0], u + 0.1) * 0.97, 0.06, s * K.lerp(JT[2], JL[2], u + 0.1) * 0.94);
      jaw.add(lo);
    }
  // horns
  const horn = new THREE.ConeGeometry(0.06, 1.0, 4);
  for (const s of [1, -1]) {
    const h = new THREE.Mesh(horn, paper);
    const dir = new THREE.Vector3(-0.82, 0.5, s * 0.28).normalize();
    h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    h.position.set(-0.05, 0.3, s * 0.2).addScaledVector(dir, 0.5);
    head.add(h);
  }
  // eyes: punched holes
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x0a0806, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const a = new THREE.Vector3(...BL).setZ(s * BL[2]),
      b = new THREE.Vector3(...HL).setZ(s * HL[2]),
      c = new THREE.Vector3(...KL).setZ(s * KL[2]);
    const cen = a.clone().add(b).add(c).divideScalar(3);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (n.z * s < 0) n.negate();
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), eyeM);
    e.position.copy(cen).addScaledVector(n, 0.006).add(new THREE.Vector3(0.06, 0.03, 0));
    e.lookAt(e.position.clone().add(n));
    head.add(e);
  }
  head.scale.setScalar(HS);
  head.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  head.userData.jaw = jaw;
  return head;
}

export class Blank {
  constructor(scene) {
    this.mat = new THREE.MeshStandardMaterial({ color: 0xf5f0e2, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    this.dark = new THREE.MeshStandardMaterial({ color: 0x120e0a, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
    const tris = N * SIDES * 2 + N;
    this.arr = new Float32Array(tris * 9);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.arr, 3).setUsage(THREE.DynamicDrawUsage));
    this.body = new THREE.Mesh(this.geo, this.mat);
    this.body.castShadow = this.body.receiveShadow = true;
    this.body.frustumCulled = false;
    this.head = buildHead(this.mat, this.dark);
    scene.add(this.body, this.head);
    this.rings = [];
    for (let i = 0; i <= N; i++) this.rings.push({ x: 0, y: 0, z: 0, a: 0 });
    this.v = { T: new THREE.Vector3(), S: new THREE.Vector3(), U: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3(1, 0, 0), m: new THREE.Matrix4() };
    this.reset();
  }
  reset() {
    this.hp = 100;
    this.state = "slither";
    this.timer = 4.2;
    this.tt = 0;
    this.hx = PW / 2 + 0.25;
    this.hy = 0.12;
    this.hz = -PH / 2 - 0.1;
    this.th = Math.PI * 0.8;
    this.orb = 0;
    this.combo = 0;
    this.travel = 0;
    this.hist = [];
    this.rnd = K.rng(11);
    this.hitT = 0;
    this.jaw = 0.2;
    this.side = 1;
    this.lockZ = 0;
    this.v.d.set(-1, 0, 0.4).normalize();
    // a body already trailing off the desk
    for (let i = 80; i >= 0; i--) this.hist.push({ x: this.hx + i * 0.02, y: 0.12 + i * 0.004, z: this.hz - i * 0.012, d: -i * 0.0236 });
    this.body.visible = this.head.visible = true;
    this.alive = true;
    this.updateMesh(0);
  }
  get phase() {
    return this.hp > 66 ? 1 : this.hp > 33 ? 2 : 3;
  }
  get vulnerable() {
    return this.hy < 0.1 && this.alive;
  }
  hurt(n) {
    if (this.state === "stun") return;
    this.hp = Math.max(0, this.hp - n);
    this.hitT = 0.14;
    if (this.hp <= 0) {
      this.state = "stun";
      this.tt = 0;
    }
  }
  steer(tx, tz, rate, dt) {
    let d = Math.atan2(tz - this.hz, tx - this.hx) - this.th;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.th += K.clamp(d, -rate * dt, rate * dt);
  }
  update(dt, t, pl, ev) {
    const P = this.phase;
    const px = this.hx,
      py = this.hy,
      pz = this.hz;
    const bx = PW / 2 - 0.05,
      bz = PH / 2 - 0.05;
    this.tt += dt;
    let look = null;
    switch (this.state) {
      case "slither": {
        this.timer -= dt;
        this.orb += dt * 1.1;
        let tx = K.clamp(pl.x + Math.cos(this.orb) * 0.3, -bx, bx),
          tz = K.clamp(pl.z + Math.sin(this.orb * 1.3) * 0.2, -bz, bz);
        this.steer(tx, tz, 2.4 + P * 0.4, dt);
        const sp = [0, 0.4, 0.5, 0.62][P];
        const wig = this.th + 0.55 * Math.sin(t * (3.2 + P));
        this.hx += Math.cos(wig) * sp * dt;
        this.hz += Math.sin(wig) * sp * dt;
        this.hy += (LOW - this.hy) * Math.min(1, dt * 4);
        this.jaw += (0.25 + 0.15 * Math.sin(t * 5) - this.jaw) * Math.min(1, dt * 6);
        const inside = Math.abs(this.hx) < bx && Math.abs(this.hz) < bz;
        if (this.timer <= 0 && inside) {
          this.tt = 0;
          if (P >= 2 && this.rnd() < 0.45) {
            this.state = "chargePrep";
            this.side = pl.x > 0 ? -1 : 1;
            this.lockZ = pl.z;
          } else this.state = "rise";
        }
        break;
      }
      case "rise": {
        const k = K.clamp(this.tt / 0.7);
        this.hy = K.lerp(LOW, 0.44, K.ease.out3(k));
        this.steer(pl.x, pl.z, 4, dt);
        this.hx += Math.cos(this.th) * 0.45 * dt;
        this.hz += Math.sin(this.th) * 0.45 * dt;
        this.jaw += (0.7 - this.jaw) * Math.min(1, dt * 5);
        if (k >= 1) {
          this.state = "hover";
          this.tt = 0;
          ev.push({ type: "rise" });
        }
        break;
      }
      case "hover": {
        const f = Math.min(1, dt * (4.5 + P));
        this.hx += (pl.x - this.hx) * f;
        this.hz += (pl.z - 0.05 - this.hz) * f;
        this.hy = 0.44 + 0.012 * Math.sin(t * 9);
        this.jaw += (1 - this.jaw) * Math.min(1, dt * 6);
        look = [pl.x, 0, pl.z];
        if (this.tt > [0, 0.62, 0.5, 0.36][P]) {
          this.state = "slam";
          this.tt = 0;
          this.sx = this.hx;
          this.sz = this.hz + 0.05;
        }
        break;
      }
      case "slam": {
        const k = K.clamp(this.tt / 0.15);
        this.hy = K.lerp(0.44, LOW, k * k);
        this.hx = K.lerp(this.hx, this.sx, k);
        this.hz = K.lerp(this.hz, this.sz, k);
        look = [this.sx, -0.3, this.sz];
        if (k >= 1) {
          ev.push({ type: "slam", x: this.sx, z: this.sz });
          this.state = "stuck";
          this.tt = 0;
        }
        break;
      }
      case "stuck": {
        this.jaw += (0.05 - this.jaw) * Math.min(1, dt * 12);
        this.hx += Math.sin(t * 40) * 0.0006;
        if (this.tt > [0, 1.7, 1.45, 1.15][P]) {
          if (P === 3 && this.combo < 1) {
            this.combo++;
            this.state = "rise";
          } else {
            this.combo = 0;
            this.state = "slither";
            this.timer = 3.2 + this.rnd() * 2 - P * 0.4;
          }
          this.tt = 0;
        }
        break;
      }
      case "chargePrep": {
        const gx = this.side * (PW / 2 + 0.24);
        this.steer(gx, this.lockZ, 6, dt);
        const d = Math.hypot(gx - this.hx, this.lockZ - this.hz);
        const sp = Math.min(1.5, d * 6 + 0.2);
        this.hx += Math.cos(this.th) * sp * dt;
        this.hz += Math.sin(this.th) * sp * dt;
        this.hy += (0.16 - this.hy) * Math.min(1, dt * 5);
        this.jaw += (0.9 - this.jaw) * Math.min(1, dt * 5);
        if (this.tt > 0.5 && !this.told) {
          this.told = true;
          ev.push({ type: "telegraph", z: this.lockZ, side: this.side });
        }
        if ((d < 0.06 && this.tt > 1.0) || this.tt > 2.2) {
          this.state = "charge";
          this.tt = 0;
          this.told = false;
          this.th = this.side > 0 ? Math.PI : 0;
          ev.push({ type: "charge" });
        }
        break;
      }
      case "charge": {
        this.hx += Math.cos(this.th) * (1.7 + P * 0.15) * dt;
        this.hz += (this.lockZ - this.hz) * Math.min(1, dt * 10);
        this.hy += (LOW - this.hy) * Math.min(1, dt * 14);
        if (Math.abs(this.hx) > PW / 2 + 0.3 && Math.sign(this.hx) === -this.side) {
          this.state = "slither";
          this.timer = 3 + this.rnd() * 1.5;
          this.th += Math.PI;
          this.tt = 0;
        }
        break;
      }
      case "stun": {
        const f = Math.min(1, dt * 1.6);
        this.hx += (0.16 - this.hx) * f;
        this.hz += (-0.02 - this.hz) * f;
        this.hy += (LOW + 0.004 - this.hy) * Math.min(1, dt * 3);
        this.jaw += (0.75 + 0.1 * Math.sin(t * 3) - this.jaw) * Math.min(1, dt * 3);
        this.th += Math.sin(t * 2.2) * 0.4 * dt;
        break;
      }
    }
    // which way the head faces
    const d = this.v.d;
    const vx = this.hx - px,
      vy = this.hy - py,
      vz = this.hz - pz;
    const vl = Math.hypot(vx, vy, vz);
    if (look) d.set(look[0] - this.hx, look[1] - this.hy, look[2] - this.hz).normalize();
    else if (this.state === "stuck") d.set(Math.cos(this.th), -0.35, Math.sin(this.th)).normalize();
    else if (vl > 1e-5) d.lerp(new THREE.Vector3(vx / vl, vy / vl, vz / vl), Math.min(1, dt * 12)).normalize();
    this.travel += vl;
    const last = this.hist[this.hist.length - 1];
    if (Math.hypot(this.hx - last.x, this.hy - last.y, this.hz - last.z) > 0.005) {
      this.hist.push({ x: this.hx, y: this.hy, z: this.hz, d: this.travel });
      if (this.hist.length > 1100) this.hist.splice(0, 200);
    }
    this.hitT = Math.max(0, this.hitT - dt);
    this.updateMesh(t);
  }
  updateMesh(t) {
    const { T, S, U, up, d, m } = this.v;
    // head
    const X = d.clone();
    const Z = X.clone().cross(up);
    if (Z.lengthSq() < 1e-4) Z.set(0, 0, 1);
    Z.normalize();
    const Y = Z.clone().cross(X).normalize();
    m.makeBasis(X, Y, Z);
    this.head.quaternion.setFromRotationMatrix(m);
    this.head.position.set(this.hx, this.hy + 0.012, this.hz);
    this.head.userData.jaw.rotation.z = -this.jaw * 0.62;
    const hit = this.hitT > 0 ? 0.55 : 1;
    this.mat.color.setRGB(0.96 * hit, 0.94 * hit, 0.885 * hit);
    // rings follow the path the head took
    const H = this.hist;
    let j = H.length - 1;
    const neck = HS * 0.22;
    for (let i = 0; i <= N; i++) {
      const D = this.travel - neck - i * SEG;
      while (j > 0 && H[j - 1].d > D) j--;
      const a = H[Math.max(0, j - 1)],
        b = H[j];
      const f = b.d > a.d ? K.clamp((D - a.d) / (b.d - a.d)) : 0;
      const r = this.rings[i];
      r.a = rad(i / N) * (i % 2 ? 0.7 : 1);
      r.x = a.x + (b.x - a.x) * f;
      r.z = a.z + (b.z - a.z) * f;
      r.y = Math.max(r.a * 0.62 + 0.002, a.y + (b.y - a.y) * f);
    }
    const A = this.arr;
    let o = 0;
    const ringPt = (i, k, out) => {
      const r = this.rings[i],
        p = this.rings[Math.max(0, i - 1)],
        n = this.rings[Math.min(N, i + 1)];
      T.set(p.x - n.x, p.y - n.y, p.z - n.z).normalize();
      S.copy(T).cross(up);
      if (S.lengthSq() < 1e-4) S.set(0, 0, 1);
      S.normalize();
      U.copy(S).cross(T).normalize();
      const ph = ((k + 0.5) / SIDES) * Math.PI * 2;
      const c = Math.cos(ph) * r.a,
        s = Math.sin(ph) * r.a * 0.62;
      out[0] = r.x + S.x * c + U.x * s;
      out[1] = r.y + S.y * c + U.y * s;
      out[2] = r.z + S.z * c + U.z * s;
    };
    const ring = [];
    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let k = 0; k < SIDES; k++) {
        const v = [0, 0, 0];
        ringPt(i, k, v);
        row.push(v);
      }
      ring.push(row);
    }
    for (let i = 0; i < N; i++)
      for (let k = 0; k < SIDES; k++) {
        const k2 = (k + 1) % SIDES;
        const a = ring[i][k],
          b = ring[i + 1][k],
          c = ring[i + 1][k2],
          e = ring[i][k2];
        A.set(a, o);
        A.set(b, o + 3);
        A.set(c, o + 6);
        A.set(a, o + 9);
        A.set(c, o + 12);
        A.set(e, o + 15);
        o += 18;
      }
    // dorsal fins
    for (let i = 0; i < N; i++) {
      const r = this.rings[i],
        n = this.rings[Math.min(N, i + 1)];
      if (i % 2 || r.a < 0.008) {
        A.fill(0, o, o + 9);
        o += 9;
        continue;
      }
      const top = r.a * 0.6;
      A.set([r.x, r.y + top, r.z], o);
      A.set([n.x, n.y + top + r.a * 1.25, n.z], o + 3);
      const q = this.rings[Math.min(N, i + 2)];
      A.set([q.x, q.y + q.a * 0.6, q.z], o + 6);
      o += 9;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  /* it comes apart: every fold becomes scraps */
  explode(petals) {
    for (let i = 0; i <= N; i += 1) {
      const r = this.rings[i];
      petals.burst(r.x, r.y + 0.02, r.z, r.a > 0.02 ? 9 : 4, i * 13);
    }
    petals.burst(this.hx, this.hy + 0.04, this.hz, 60, 999);
    this.body.visible = this.head.visible = false;
    this.alive = false;
  }
}
