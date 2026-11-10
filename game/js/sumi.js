// Sumi: a paper cut-out standing on the sheet, redrawn 12 times a second from the film's rig.
import * as THREE from "three";
const K = window.K;
const S = 384,
  SCALE = 1.85,
  HIPX = 192,
  HIPY = 236,
  SIZE = 0.3;

export class Sumi {
  constructor(scene) {
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = c.height = S;
      return c;
    };
    this.c = mk();
    this.g = this.c.getContext("2d");
    this.tc = mk();
    this.tg = this.tc.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE);
    const foot = ((S - (HIPY + 46 * SCALE)) / S) * SIZE;
    geo.translate(0, SIZE / 2 - foot, 0);
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, transparent: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.mesh.castShadow = true;
    this.mesh.rotation.x = -0.44;
    scene.add(this.mesh);
    this.reset();
  }
  reset() {
    this.x = -0.45;
    this.z = 0.18;
    this.face = 1;
    this.phase = 0;
    this.hp = 5;
    this.ink = 1;
    this.inv = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.hurtT = 0;
    this.lastDraw = -1;
    this.pose = K.POSE.stand;
    this.mesh.visible = true;
    this.mat.opacity = 1;
    this.fade = 1;
  }
  /* draw the cut-out: a paper-white rim first, then the ink figure on it */
  draw(pose, t, wind, gust) {
    const o = { x: HIPX, y: HIPY, s: SCALE, f: this.face, pose, t, wind, gust };
    const tg = this.tg,
      g = this.g;
    tg.clearRect(0, 0, S, S);
    K.sumi(tg, Object.assign({}, o, { color: "#f6f1e3", scarf: "#f6f1e3" }));
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      g.drawImage(this.tc, Math.cos(a) * 3.2, Math.sin(a) * 3.2);
    }
    K.sumi(g, o);
    if (this.fade < 1) {
      // she is ink too: when she is hit, she thins
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = `rgba(0,0,0,${1 - this.fade})`;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = "source-over";
    }
    this.tex.needsUpdate = true;
  }
  place() {
    this.mesh.position.set(this.x, 0.003, this.z);
  }
}
