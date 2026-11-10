// The lens: one pass does depth of field, vignette, grain, tone mapping. Cheap enough for integrated graphics.
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

/* The scene is a desk seen from above, so focus distance can be found per pixel from the desk plane:
   no second depth render is needed. */
const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    res: { value: new THREE.Vector2(1920, 1080) },
    camPos: { value: new THREE.Vector3() },
    invVP: { value: new THREE.Matrix4() },
    focus: { value: 1.6 },
    aperture: { value: 0.02 },
    maxBlur: { value: 0.011 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, focus, aperture, maxBlur; uniform vec2 res;
    uniform vec3 camPos; uniform mat4 invVP; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 wp = invVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
      vec3 dir = normalize(wp.xyz / wp.w - camPos);
      float t = dir.y < -0.02 ? min(-camPos.y / dir.y, 7.0) : 7.0;
      float coc = min(maxBlur, aperture * abs(t - focus) / t);
      vec2 asp = vec2(res.y / res.x, 1.0);
      vec3 c = vec3(0.0); float wsum = 0.0;
      float rot = h(vUv * res) * 6.2831;
      for (int i = 0; i < 13; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 13.0);
        float a = fi * 2.39996 + rot;
        vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * coc * asp).rgb;
        float w = 1.0 + dot(s, vec3(0.3)) * 1.5;   // bright points open into discs
        c += s * w; wsum += w;
      }
      c /= wsum;
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      c *= mix(1.0, 0.3, smoothstep(0.1, 0.62, r2 * 1.55));
      float n = h(floor(vUv * res) + floor(time * 24.0) * 7.13);
      c += (n - 0.5) * 0.02 * (0.25 + sqrt(max(c.g, 0.0)));
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function makeLens(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const mat = new THREE.ShaderMaterial(LensShader);
  const quad = new FullScreenQuad(mat);
  const vp = new THREE.Matrix4();
  const lens = {
    uniforms: mat.uniforms,
    rt,
    setSize(w, h) {
      rt.setSize(w, h);
      mat.uniforms.res.value.set(w, h);
    },
    render() {
      camera.updateMatrixWorld();
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      mat.uniforms.invVP.value.copy(vp).invert();
      mat.uniforms.camPos.value.copy(camera.position);
      mat.uniforms.tDiffuse.value = rt.texture;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      quad.render(renderer);
    },
  };
  lens.setSize(size.x, size.y);
  return lens;
}

/* Scraps of the Blank: they burst, tumble, catch the lamp, and settle on the sheet. */
export class Petals {
  constructor(scene, n = 560) {
    this.n = n;
    const g = new THREE.PlaneGeometry(0.022, 0.014, 2, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.004 * (1 - Math.pow(p.getX(i) / 0.011, 2)));
    g.computeVertexNormals();
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), n);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.p = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3);
    this.r = new Float32Array(n * 3);
    this.w = new Float32Array(n * 3);
    this.age = new Float32Array(n);
    this.live = 0;
    this.col = new THREE.Color();
    scene.add(this.mesh);
    this.d = new THREE.Object3D();
  }
  clear() {
    this.live = 0;
    this.mesh.count = 0;
  }
  burst(x, y, z, k, seed) {
    const K = window.K;
    for (let j = 0; j < k && this.live < this.n; j++) {
      const i = this.live++;
      const a = K.hash(i, seed, 1) * 6.283,
        s = 0.25 + K.hash(i, seed, 2) * 1.1;
      this.p.set([x, y, z], i * 3);
      this.v.set([Math.cos(a) * s, 0.5 + K.hash(i, seed, 3) * 1.5, Math.sin(a) * s], i * 3);
      this.r.set([K.hash(i, 4) * 6, K.hash(i, 5) * 6, K.hash(i, 6) * 6], i * 3);
      this.w.set([(K.hash(i, 7) - 0.5) * 16, (K.hash(i, 8) - 0.5) * 16, (K.hash(i, 9) - 0.5) * 16], i * 3);
      this.age[i] = 0;
    }
    this.mesh.count = this.live;
  }
  update(dt, t) {
    const d = this.d;
    for (let i = 0; i < this.live; i++) {
      const j = i * 3;
      this.age[i] += dt;
      const rest = this.p[j + 1] <= 0.006 && this.age[i] > 0.3;
      if (!rest) {
        this.v[j + 1] -= 1.5 * dt;
        const drag = Math.exp(-2.2 * dt);
        this.v[j] = this.v[j] * drag + Math.sin(t * 3 + i) * 0.25 * dt + 0.1 * dt;
        this.v[j + 2] = this.v[j + 2] * drag + Math.cos(t * 2.3 + i * 1.7) * 0.25 * dt;
        this.v[j + 1] = Math.max(this.v[j + 1] * Math.exp(-1.1 * dt), -0.32);
        this.p[j] += this.v[j] * dt;
        this.p[j + 1] = Math.max(0.006, this.p[j + 1] + this.v[j + 1] * dt);
        this.p[j + 2] += this.v[j + 2] * dt;
        this.r[j] += this.w[j] * dt;
        this.r[j + 1] += this.w[j + 1] * dt;
        this.r[j + 2] += this.w[j + 2] * dt;
      } else {
        this.r[j] += (Math.PI / 2 - (this.r[j] % Math.PI)) * 0 + 0;
      }
      d.position.set(this.p[j], this.p[j + 1], this.p[j + 2]);
      if (rest) d.rotation.set(-Math.PI / 2, 0, this.r[j + 1]);
      else d.rotation.set(this.r[j], this.r[j + 1], this.r[j + 2]);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      // paper white, blushing to sakura as it falls
      const c = Math.min(1, this.age[i] / 1.6) * (i % 4 === 0 ? 0.15 : 1);
      this.col.setRGB(1 - 0.06 * c, 0.97 - 0.42 * c, 0.92 - 0.3 * c);
      this.mesh.setColorAt(i, this.col);
    }
    if (this.live) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
