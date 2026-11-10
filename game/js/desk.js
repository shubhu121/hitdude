// The calligrapher's desk: everything around the sheet. Real materials, lit by one lamp and a cold window.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { woodTextures, feltTextures, brushedRoughness, slateTextures, fibreNormal, canvasTex } from "./textures.js";

export const PW = 1.6,
  PH = 0.9; // the sheet, in metres

const shadow = (m, cast = true, recv = true) => {
  m.castShadow = cast;
  m.receiveShadow = recv;
  return m;
};

export function buildDesk(scene, renderer) {
  const refs = {};
  // reflections: a soft studio room, kept dim so the lamp does the talking
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  scene.background = new THREE.Color(0x0b0907);

  // ---- light
  const key = new THREE.SpotLight(0xffe0bc, 30, 6, 0.62, 0.7, 1.6);
  key.position.set(-1.25, 1.75, -0.75);
  key.target.position.set(0.05, 0, 0.02);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.6;
  key.shadow.camera.far = 4.5;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 8;
  scene.add(key, key.target);
  refs.key = key;
  scene.add(new THREE.HemisphereLight(0x8a9ab4, 0x2a1a0e, 0.62));

  // ---- desk
  const wt = woodTextures();
  const desk = shadow(
    new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 4.2),
      new THREE.MeshStandardMaterial({ ...wt, roughness: 0.82, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6) }),
    ),
    false,
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.014;
  desk.renderOrder = -1; // drawn after the things lying on it, so hidden pixels cost nothing
  scene.add(desk);

  // ---- felt underlay
  const ft = feltTextures();
  const felt = shadow(new THREE.Mesh(new RoundedBoxGeometry(PW + 0.3, 0.008, PH + 0.24, 2, 0.003), new THREE.MeshStandardMaterial({ ...ft, roughness: 1 })));
  felt.position.y = -0.009;
  felt.renderOrder = -2;
  scene.add(felt);

  // ---- paperweights (bunchin): brushed steel bars
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xb9bcc2, metalness: 1, roughness: 0.6, roughnessMap: brushedRoughness(), anisotropy: 0.7, anisotropyRotation: 0 });
  for (const sx of [-1, 1]) {
    const b = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.02, 0.034, 3, 0.004), steel));
    b.position.set(sx * 0.52, 0.012, -PH / 2 + 0.03);
    b.rotation.y = sx * 0.03;
    scene.add(b);
    const knob = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xc8a25a, metalness: 1, roughness: 0.28 })));
    knob.position.set(sx * 0.52, 0.028, -PH / 2 + 0.03);
    scene.add(knob);
  }

  // ---- inkstone (suzuri) with a pool of wet ink
  const st = slateTextures();
  const slate = new THREE.MeshStandardMaterial({ ...st, roughness: 0.62, metalness: 0.05, normalScale: new THREE.Vector2(0.5, 0.5) });
  const stone = new THREE.Group();
  const rr = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };
  const outer = rr(0.2, 0.3, 0.02);
  const hole = rr(0.16, 0.25, 0.014);
  outer.holes.push(hole);
  const rim = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.03, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 3 }), slate));
  rim.rotation.x = -Math.PI / 2;
  stone.add(rim);
  const base = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(rr(0.2, 0.3, 0.02), { depth: 0.012, bevelEnabled: false }), slate));
  base.rotation.x = -Math.PI / 2;
  stone.add(base);
  // the grinding slope and the well
  const slope = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.158, 0.004, 0.18), slate), false);
  slope.position.set(0, 0.02, 0.03);
  slope.rotation.x = 0.06;
  stone.add(slope);
  const ink = new THREE.Mesh(new THREE.ShapeGeometry(rr(0.158, 0.24, 0.012)), new THREE.MeshPhysicalMaterial({ color: 0x030303, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.y = 0.0185;
  ink.receiveShadow = true;
  stone.add(ink);
  stone.position.set(PW / 2 + 0.3, -0.012, 0.02);
  stone.rotation.y = -0.12;
  scene.add(stone);
  // ink stick resting on the rim
  const stick = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.016, 0.12, 3, 0.003), new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, roughness: 0.22, clearcoat: 0.6 })));
  stick.position.set(PW / 2 + 0.25, 0.03, -0.1);
  stick.rotation.set(0.12, 0.5, 0);
  scene.add(stick);
  const band = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.0275, 0.0175, 0.012), new THREE.MeshPhysicalMaterial({ color: 0xcaa24e, metalness: 1, roughness: 0.3 })));
  band.position.copy(stick.position);
  band.rotation.copy(stick.rotation);
  band.translateZ(-0.035);
  scene.add(band);

  // ---- the brush, on a porcelain rest
  const glaze = new THREE.MeshPhysicalMaterial({ color: 0xe9ebe6, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 });
  const rest = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 14, 28, Math.PI), glaze));
  rest.position.set(PW / 2 + 0.22, -0.012, 0.36);
  rest.rotation.y = 0.5;
  scene.add(rest);
  const brush = new THREE.Group();
  const bamboo = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0056, 0.3, 18), new THREE.MeshPhysicalMaterial({ color: 0xc19a55, roughness: 0.42, clearcoat: 0.3 })));
  bamboo.rotation.z = Math.PI / 2;
  brush.add(bamboo);
  for (const x of [-0.06, 0.03, 0.1]) {
    const node = new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0009, 6, 18), new THREE.MeshStandardMaterial({ color: 0x7c5c2a, roughness: 0.6 }));
    node.rotation.y = Math.PI / 2;
    node.position.x = x;
    brush.add(node);
  }
  const fer = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0074, 0.0066, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.5 })));
  fer.rotation.z = Math.PI / 2;
  fer.position.x = -0.165;
  brush.add(fer);
  const hairPts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    hairPts.push(new THREE.Vector2(0.0072 * Math.sin(Math.PI * Math.pow(u, 0.62)) * (1 - u * 0.25) + 0.0003, u * 0.07));
  }
  const hair = shadow(new THREE.Mesh(new THREE.LatheGeometry(hairPts.reverse(), 20), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.15 })));
  hair.rotation.z = Math.PI / 2;
  hair.position.x = -0.18;
  brush.add(hair);
  brush.position.set(PW / 2 + 0.2, 0.026, 0.4);
  brush.rotation.set(0, 2.06, 0.09);
  scene.add(brush);

  // ---- left: seal paste, the seal, a cup of tea
  const lathe = (pts, mat, seg = 40) => shadow(new THREE.Mesh(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg), mat));
  const dish = lathe(
    [
      [0, 0],
      [0.045, 0],
      [0.055, 0.006],
      [0.06, 0.022],
      [0.056, 0.024],
      [0.05, 0.008],
      [0, 0.006],
    ],
    glaze,
  );
  dish.position.set(-PW / 2 - 0.24, -0.012, 0.26);
  scene.add(dish);
  const paste = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 40), new THREE.MeshStandardMaterial({ color: 0xc22a14, roughness: 0.85 }));
  paste.position.set(-PW / 2 - 0.24, -0.002, 0.26);
  paste.receiveShadow = true;
  scene.add(paste);
  const seal = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.062, 0.03, 3, 0.004), new THREE.MeshPhysicalMaterial({ color: 0x6f8466, roughness: 0.3, transmission: 0.25, thickness: 0.03, ior: 1.55 })));
  seal.position.set(-PW / 2 - 0.13, 0.019, 0.35);
  seal.rotation.y = 0.5;
  scene.add(seal);
  const celadon = new THREE.MeshPhysicalMaterial({ color: 0x8fb09c, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
  const cup = lathe(
    [
      [0, 0.004],
      [0.03, 0.004],
      [0.032, 0],
      [0.036, 0.003],
      [0.043, 0.04],
      [0.046, 0.085],
      [0.043, 0.085],
      [0.04, 0.042],
      [0.03, 0.012],
      [0, 0.01],
    ],
    celadon,
  );
  cup.position.set(-PW / 2 - 0.26, -0.012, -0.2);
  scene.add(cup);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.0425, 40), new THREE.MeshPhysicalMaterial({ color: 0x3a2a08, roughness: 0.03, transmission: 0.3, thickness: 0.05 }));
  tea.rotation.x = -Math.PI / 2;
  tea.position.set(-PW / 2 - 0.26, 0.058, -0.2);
  scene.add(tea);

  // ---- a paper lantern at the back of the desk: the warm blur behind everything
  const lantern = new THREE.Group();
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff0d6, emissive: 0xffb866, emissiveIntensity: 2.6, roughness: 1, side: THREE.DoubleSide, normalMap: canvasTex(fibreNormal(), { srgb: false, repeat: [2, 2] }) }));
  lantern.add(lp);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.6 });
  for (const y of [-0.17, 0.17]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.016, 6), frameM);
    ring.position.y = y;
    lantern.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.34, 0.01), frameM);
    post.position.set(Math.cos(a) * 0.114, 0, Math.sin(a) * 0.114);
    lantern.add(post);
  }
  lantern.position.set(-1.02, 0.17, -0.98);
  scene.add(lantern);
  refs.glow = lp.material;
  refs.lantern = lp;

  // ---- a stack of spare sheets, far right, for scale
  const pile = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.02, 0.36, 2, 0.002), new THREE.MeshStandardMaterial({ color: 0xe6dfcc, roughness: 0.95 })));
  pile.position.set(PW / 2 + 0.55, -0.004, -0.72);
  pile.rotation.y = 0.2;
  scene.add(pile);
  return refs;
}
