// Procedural PBR textures: nothing is loaded from disk.
import * as THREE from "three";
const K = window.K;

export function canvasTex(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}
const mk = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/* Sobel a height canvas (luminance) into a tangent-space normal map. */
export function heightToNormal(hc, strength = 2) {
  const w = hc.width,
    h = hc.height;
  const src = hc.getContext("2d").getImageData(0, 0, w, h).data;
  const out = mk(w, h);
  const og = out.getContext("2d");
  const id = og.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength,
        dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      id.data[i] = (-dx / l) * 127 + 128;
      id.data[i + 1] = (dy / l) * 127 + 128;
      id.data[i + 2] = (1 / l) * 127 + 128;
      id.data[i + 3] = 255;
    }
  og.putImageData(id, 0, 0);
  return out;
}

/* dark walnut: figure bands warped by slow noise, fine streaks along the grain */
export function woodTextures() {
  const S = 1024;
  const col = mk(S, S),
    rgh = mk(S, S),
    hgt = mk(S, S);
  const cg = col.getContext("2d"),
    rg = rgh.getContext("2d"),
    hg = hgt.getContext("2d");
  const ci = cg.createImageData(S, S),
    ri = rg.createImageData(S, S),
    hi = hg.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const warp = K.fbm2(x / 300, y / 110, 3, 3) * 46;
      const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.07 + K.fbm2(x / 900, y / 40, 9, 2) * 7);
      const fine = K.n2(x / 320, y / 1.9, 5) * 0.6 + K.n2(x / 90, y / 0.9, 6) * 0.4;
      const pore = K.hash(x >> 3, y, 2) > 0.985 ? 0.18 : 0;
      const sh = K.clamp(0.28 + 0.34 * ring + 0.42 * (fine - 0.5) - pore);
      const i = (y * S + x) * 4;
      ci.data[i] = 30 + 78 * sh;
      ci.data[i + 1] = 17 + 46 * sh;
      ci.data[i + 2] = 10 + 24 * sh;
      ci.data[i + 3] = 255;
      const r = 255 * K.clamp(0.3 + 0.3 * (1 - fine) + pore);
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = r;
      ri.data[i + 3] = 255;
      const hv = 255 * K.clamp(0.5 + 0.5 * (fine - 0.5) - pore * 2);
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv;
      hi.data[i + 3] = 255;
    }
  cg.putImageData(ci, 0, 0);
  rg.putImageData(ri, 0, 0);
  hg.putImageData(hi, 0, 0);
  const rep = [3, 2];
  return {
    map: canvasTex(col, { repeat: rep }),
    roughnessMap: canvasTex(rgh, { srgb: false, repeat: rep }),
    normalMap: canvasTex(heightToNormal(hgt, 1.6), { srgb: false, repeat: rep }),
  };
}

/* washi tooth: grain plus long fibres, as a normal map */
export function fibreNormal() {
  const S = 512;
  const c = mk(S, S),
    g = c.getContext("2d");
  const id = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = 128 + (K.hash(x, y, 3) - 0.5) * 70 + (K.n2(x / 6, y / 6, 4) - 0.5) * 60;
      const i = (y * S + x) * 4;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
  g.putImageData(id, 0, 0);
  const R = K.rng(21);
  g.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const x = R() * S,
      y = R() * S,
      a = R() * 6.283,
      l = 20 + R() * 90;
    g.strokeStyle = R() < 0.6 ? `rgba(255,255,255,${0.25 + R() * 0.4})` : `rgba(0,0,0,${0.15 + R() * 0.25})`;
    g.lineWidth = 0.8 + R() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return heightToNormal(c, 2.2);
}

/* wool felt: matted short fibres */
export function feltTextures() {
  const S = 512;
  const c = mk(S, S),
    g = c.getContext("2d");
  g.fillStyle = "#1a2030";
  g.fillRect(0, 0, S, S);
  const R = K.rng(8);
  for (let i = 0; i < 9000; i++) {
    const x = R() * S,
      y = R() * S,
      a = R() * 6.283,
      l = 3 + R() * 9;
    const v = 20 + R() * 34;
    g.strokeStyle = `rgba(${v},${v + 8},${v + 24},0.5)`;
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const rep = [5, 3.2];
  return { map: canvasTex(c, { repeat: rep }), normalMap: canvasTex(heightToNormal(c, 3), { srgb: false, repeat: rep }) };
}

/* brushed metal: scratches along one axis, as roughness */
export function brushedRoughness() {
  const c = mk(256, 256),
    g = c.getContext("2d");
  const id = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const v = 70 + K.n2(x / 60, y / 1.2, 3) * 70 + (K.hash(x, y, 5) - 0.5) * 20;
      const i = (y * 256 + x) * 4;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
  g.putImageData(id, 0, 0);
  return canvasTex(c, { srgb: false, repeat: [2, 1] });
}

/* slate: fine speckle, a few pale veins */
export function slateTextures() {
  const S = 512;
  const c = mk(S, S),
    g = c.getContext("2d");
  const id = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = 30 + K.fbm2(x / 70, y / 70, 2, 4) * 26 + (K.hash(x, y, 7) - 0.5) * 16;
      const i = (y * S + x) * 4;
      id.data[i] = v;
      id.data[i + 1] = v + 1;
      id.data[i + 2] = v + 4;
      id.data[i + 3] = 255;
    }
  g.putImageData(id, 0, 0);
  return { map: canvasTex(c), normalMap: canvasTex(heightToNormal(c, 4), { srgb: false }) };
}
