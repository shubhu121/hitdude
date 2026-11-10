#!/usr/bin/env node
// HITOFUDE 一筆 — soundtrack synthesizer.
// Dependency-free, deterministic (seeded PRNG only). Writes assets/audio/score.wav:
// 50.000 s, 48 kHz, 16-bit stereo. Run: node tools/make-audio.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const DUR = 50;
const N = SR * DUR;
const TAU = Math.PI * 2;
const TARGET_LUFS = -15.0;
const LIMIT_CEIL_DB = -2.1; // sample-peak ceiling of the limiter
const TP_MAX_DB = -1.75; // true-peak guard (4x oversampled estimate)

// ---------------------------------------------------------------- utilities
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const dB = (x) => Math.pow(10, x / 20);
const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const at = (t) => Math.ceil(t * SR - 1e-6); // never before the cue

function bpFn(points) { // linear breakpoint function of time
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [t0, v0] = points[i - 1], [t1, v1] = points[i];
        return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1e-9);
      }
    }
    return points[points.length - 1][1];
  };
}
function envArr(points) { // full-length envelope, smoothstep between breakpoints
  const a = new Float32Array(N);
  let pi = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    while (pi < points.length - 2 && t > points[pi + 1][0]) pi++;
    const [t0, v0] = points[pi], [t1, v1] = points[pi + 1];
    let u = (t - t0) / (t1 - t0);
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    u = u * u * (3 - 2 * u);
    a[i] = v0 + (v1 - v0) * u;
  }
  return a;
}

class Biquad {
  constructor(type, f, q, gdb = 0) { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(type, f, q, gdb); }
  set(type, f, q, gdb = 0) {
    const w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else { const A = Math.pow(10, gdb / 40); b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
class SVF { // TPT state-variable filter, safe under modulation. p() returns unity-peak band-pass.
  constructor(f = 1000, q = 1) { this.i1 = 0; this.i2 = 0; this.lp = 0; this.hp = 0; this.set(f, q); }
  set(f, q) {
    const g = Math.tan((Math.PI * Math.min(f, SR * 0.45)) / SR);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  p(x) {
    const v3 = x - this.i2, v1 = this.a1 * this.i1 + this.a2 * v3, v2 = this.i2 + this.a2 * this.i1 + this.a3 * v3;
    this.i1 = 2 * v1 - this.i1; this.i2 = 2 * v2 - this.i2;
    this.lp = v2; this.hp = x - this.k * v1 - v2;
    return this.k * v1;
  }
}
function pinkGen(r) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    return p * 0.11;
  };
}
function norm(buf, peak = 1) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; }
  if (m > 0) { const g = peak / m; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}
function normRms2(L, R, from = 0, to = L.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += L[i] * L[i] + R[i] * R[i];
  const g = 1 / Math.sqrt(s / (2 * (to - from)) + 1e-20);
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
}
function rmsOf(buf) { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); }
function fadeOut(buf, sec) {
  const n = Math.min(buf.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i] *= i / n;
  return buf;
}

// ---------------------------------------------------------------- buses
const mkBus = () => ({ L: new Float64Array(N), R: new Float64Array(N), sL: new Float64Array(N), sR: new Float64Array(N) });
const main = mkBus(); // everything that the two "silence" ducks act on
const bed = mkBus(); // wind + the faint tone inside the silences (never ducked)

function put(buf, t, { gain = 1, pan = 0, panTo = null, rev = 0, to = main } = {}) {
  const s = at(t), n = buf.length;
  let gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const j = s + i;
    if (j < 0) continue;
    if (j >= N) break;
    if (panTo !== null && (i & 31) === 0) {
      const th = ((pan + ((panTo - pan) * i) / n + 1) * Math.PI) / 4;
      gl = Math.cos(th); gr = Math.sin(th);
    }
    const v = buf[i] * gain, l = v * gl, r = v * gr;
    to.L[j] += l; to.R[j] += r;
    if (rev) { to.sL[j] += l * rev; to.sR[j] += r * rev; }
  }
}
function putS(L, R, t, { gain = 1, rev = 0, to = main, env = null } = {}) {
  const s = at(t), n = L.length;
  for (let i = 0; i < n; i++) {
    const j = s + i;
    if (j < 0) continue;
    if (j >= N) break;
    const g = env ? gain * env(j / SR) : gain;
    const l = L[i] * g, r = R[i] * g;
    to.L[j] += l; to.R[j] += r;
    if (rev) { to.sL[j] += l * rev; to.sR[j] += r * rev; }
  }
}

// ---------------------------------------------------------------- instruments
// Generic taiko voice: swept sine body + membrane partials + a mid "skin/wood" band + noise slap + bachi click.
function drum(o) {
  const {
    f0, f1, sweep = 0.06, tau, parts = [[1.59, 0.45, 0.55], [2.3, 0.28, 0.35], [3.6, 0.18, 0.22]],
    midF = 0, midAmp = 0.25, midTau = 0.1, slapF = 1800, slapTau = 0.018, slapAmt = 0.8,
    skinF = 420, skinTau = 0.07, skinAmt = 0.6, stickF = 900, stickAmt = 0.2, drive = 1.5, seed = 1, len: lenS,
  } = o;
  const len = Math.floor(SR * (lenS || Math.min(5, tau * 9 + 0.06)));
  const out = new Float64Array(len), r = mulberry32(seed);
  const lpS = new Biquad('lp', slapF, 0.7), bpK = new Biquad('bp', skinF, 1.0);
  let ph = 0, phM = 0;
  const td = Math.tanh(drive);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / sweep);
    ph += (TAU * f) / SR;
    let x = Math.sin(ph) * Math.exp(-t / tau);
    for (let k = 0; k < parts.length; k++) x += parts[k][1] * Math.sin(ph * parts[k][0]) * Math.exp(-t / (tau * parts[k][2]));
    if (midF) {
      phM += (TAU * midF * (1 + 0.25 * Math.exp(-t / 0.02))) / SR;
      x += midAmp * (Math.sin(phM) + 0.5 * Math.sin(phM * 1.71)) * Math.exp(-t / midTau);
    }
    const w = r() * 2 - 1;
    x += slapAmt * lpS.p(w) * Math.exp(-t / slapTau) * 2 + skinAmt * bpK.p(w) * Math.exp(-t / skinTau) * 3;
    x += stickAmt * Math.sin(TAU * stickF * t) * Math.exp(-t / 0.004);
    out[i] = Math.tanh(drive * x) / td;
  }
  fadeOut(out, 0.03);
  return norm(out);
}
// "ka": bachi on the wooden rim.
function ka(seed) {
  const len = Math.floor(SR * 0.14), o = new Float64Array(len), r = mulberry32(seed);
  const bp = new Biquad('bp', 2400, 1.5);
  const P = [[640, 0.5, 0.016], [1150, 1, 0.012], [1830, 0.7, 0.009], [2740, 0.4, 0.006]];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let x = 0;
    for (const [f, a, tk] of P) x += a * Math.sin(TAU * f * t) * Math.exp(-t / tk);
    x += bp.p(r() * 2 - 1) * Math.exp(-t / 0.005) * 2.5;
    o[i] = x;
  }
  fadeOut(o, 0.01);
  return norm(o);
}
// Koto / shamisen pluck: Karplus-Strong with pick-position comb, attack pitch bend, tsume (pick) noise.
function koto({ freq, dur = 4, bright = 0.5, bend = 0.01, decay = 3, seed = 1, pick = 0.3 }) {
  const len = Math.floor(SR * dur), out = new Float64Array(len), r = mulberry32(seed);
  const a = lerp(0.55, 0.12, bright);
  const P = SR / freq, M = Math.ceil(P * 1.06) + 8, dl = new Float64Array(M);
  const eLen = Math.ceil(P), k = Math.max(1, Math.round(P * 0.19));
  const exc = new Float64Array(eLen + k + 2);
  const ea = lerp(0.85, 0.35, bright);
  let l1 = 0, l2 = 0, mean = 0;
  for (let i = 0; i < eLen; i++) { const w = r() * 2 - 1; l1 += (1 - ea) * (w - l1); l2 += (1 - ea) * (l1 - l2); exc[i] = l2; mean += l2; }
  mean /= eLen;
  for (let i = 0; i < eLen; i++) exc[i] -= mean;
  const exc2 = Float64Array.from(exc);
  for (let i = k; i < exc.length; i++) exc2[i] -= 0.85 * exc[i - k];
  const rho = Math.pow(10, -3 / (freq * decay));
  const pk = new Biquad('bp', 2600, 1.2);
  let w = 0, lp = 0, excPeak = 0;
  for (let i = 0; i < exc2.length; i++) excPeak = Math.max(excPeak, Math.abs(exc2[i]));
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = freq * (1 + bend * Math.exp(-t / 0.045));
    const D = SR / f - a / (1 - a);
    let rp = w - D;
    while (rp < 0) rp += M;
    const i0 = Math.floor(rp), fr = rp - i0;
    const s = dl[i0 % M] * (1 - fr) + dl[(i0 + 1) % M] * fr;
    lp += (1 - a) * (s - lp);
    const y = (i < exc2.length ? exc2[i] : 0) + rho * lp;
    dl[w] = y; w = (w + 1) % M;
    out[i] = y + pick * excPeak * 4 * pk.p(r() * 2 - 1) * Math.exp(-t / 0.003);
  }
  fadeOut(out, 0.08);
  return norm(out);
}
// Shakuhachi-like breath tone: harmonic tone with slow vibrato + pitched band-passed air, breathy chiff.
function breath({ dur, freq, vibRate = 4.7, vibDepth = 0.005, air = 0.5, att = 0.25, rel = 0.6, seed = 1, harm = [1, 0.4, 0.15, 0.06], chiff = 2 }) {
  const len = Math.floor(SR * dur), tone = new Float64Array(len), nz = new Float64Array(len), r = mulberry32(seed);
  const fF = typeof freq === 'function' ? freq : () => freq;
  const f1 = new SVF(), f2 = new SVF();
  let ph = 0, slow = 0, f = fF(0);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    slow += 0.0004 * (r() * 2 - 1 - slow);
    const sl = clamp(slow * 60, -1, 1);
    if ((i & 15) === 0) {
      const vibEnv = smooth((t - 0.3) / 0.8);
      f = fF(t) * (1 + vibDepth * vibEnv * Math.sin(TAU * vibRate * t) + 0.003 * sl);
      f1.set(f, 7); f2.set(f * 2.02, 5);
    }
    ph += (TAU * f) / SR;
    let x = 0;
    for (let k = 0; k < harm.length; k++) x += harm[k] * Math.sin((k + 1) * ph);
    const env = smooth(t / att) * smooth((dur - t) / rel);
    const w = r() * 2 - 1;
    tone[i] = x * env * (1 + 0.25 * sl);
    nz[i] = (f1.p(w) + 0.6 * f2.p(w) + 0.02 * w) * env * (1 + chiff * Math.exp(-t / 0.09)) * (1 + 0.5 * sl);
  }
  const g = (air * rmsOf(tone)) / (rmsOf(nz) + 1e-12);
  for (let i = 0; i < len; i++) tone[i] += nz[i] * g;
  return norm(tone);
}
// Band-limited noise gesture: brush swish (rough, heavy) or whoosh / riser.
function sweep({ dur, fa, fb, fc = fb, q = 1, peakAt = 0.5, risePow = 1, tailPow = 1.5, swells = 0, rough = 0, heavy = 0, pink = 0, seed = 1 }) {
  const len = Math.floor(dur * SR), o = new Float64Array(len), r = mulberry32(seed), pg = pinkGen(mulberry32(seed + 777));
  const s1 = new SVF(), s2 = new SVF();
  let rm = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    let env, f;
    if (u < peakAt) { const v = u / peakAt; env = Math.pow(Math.sin((Math.PI / 2) * v), 2 * risePow); f = fa * Math.pow(fb / fa, v); }
    else { const v = (u - peakAt) / (1 - peakAt || 1e-9); env = Math.pow(Math.cos((Math.PI / 2) * v), tailPow); f = fb * Math.pow(fc / fb, v); }
    if (swells) env *= 0.5 + 0.5 * Math.pow(Math.sin(Math.PI * swells * u), 2);
    if ((i & 15) === 0) { s1.set(f, q); s2.set(Math.max(60, f * 0.3), 0.9); }
    const w = (r() * 2 - 1) * (1 - pink) + pg() * pink * 3;
    rm += 0.005 * (r() * 2 - 1 - rm);
    const m = rough ? clamp(1 + rough * rm * 30, 0.15, 2.2) : 1;
    o[i] = (s1.p(w) + heavy * 1.3 * s2.p(w)) * env * m;
  }
  norm(o); // level reference = raw peak; then shave the rare noise spikes so the limiter never sees them
  for (let i = 0; i < len; i++) o[i] = 0.4 * Math.tanh(o[i] / 0.4);
  return o;
}
// Paper tear / erase: granular crackle of high-passed noise over a thin rough bed.
function crackle({ dur, d0 = 200, d1 = 200, hp = 1800, tone = 4500, bedAmt = 0.15, seed = 1, peakAt = 0.5, edge = 0.06 }) {
  const len = Math.floor(dur * SR), o = new Float64Array(len), r = mulberry32(seed);
  const hpF = new Biquad('hp', hp, 0.7), pkF = new Biquad('pk', tone, 1.2, 8);
  let e = 0, dc = 0.99, rb = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const dens = d0 * Math.pow(d1 / d0, u);
    if (r() < dens / SR) {
      const a = Math.pow(r(), 2.5) + 0.05;
      if (a > e) { e = a; dc = Math.exp(-1 / (SR * (0.0004 + 0.004 * r() * r()))); }
    }
    e *= dc;
    rb += 0.01 * (Math.abs(r() * 2 - 1) - rb);
    const shape = u < peakAt ? lerp(0.35, 1, u / peakAt) : lerp(1, 0.5, (u - peakAt) / (1 - peakAt || 1e-9));
    const env = smooth(u / edge) * smooth((1 - u) / edge) * shape;
    o[i] = pkF.p(hpF.p(r() * 2 - 1)) * (e + bedAmt * rb * 2) * env;
  }
  return norm(o);
}
// Blade: upward noise sweep + inharmonic metallic cluster (beating pairs), stereo.
function blade({ ring = 0.3, n = 9, seed = 1, sweepDur = 0.09, body = 0.25 }) {
  const len = Math.floor(SR * Math.min(4.5, ring * 7 + 0.3));
  const L = new Float64Array(len), R = new Float64Array(len), r = mulberry32(seed);
  const base = [2590, 3140, 3675, 4230, 4890, 5460, 6120, 6730, 7240, 8100, 9050].slice(0, n);
  const P = base.map((b, k) => ({ f: b * (1 + 0.012 * (r() - 0.5)), det: 2 + 7 * r(), a: 1 / (1 + k * 0.3), tau: ring * (1 - 0.055 * k) * (0.8 + 0.4 * r()), pan: (r() * 2 - 1) * 0.7, p1: TAU * r(), p2: TAU * r() }));
  P.push({ f: 1240, det: 1.5, a: body, tau: ring * 0.7, pan: -0.2, p1: 0, p2: 1 }, { f: 1795, det: 2.2, a: body * 0.8, tau: ring * 0.8, pan: 0.2, p1: 2, p2: 3 });
  for (const p of P) {
    const gl = Math.cos(((p.pan + 1) * Math.PI) / 4), gr = Math.sin(((p.pan + 1) * Math.PI) / 4);
    const w1 = (TAU * p.f) / SR, w2 = (TAU * (p.f + p.det)) / SR, dec = Math.exp(-1 / (SR * p.tau));
    let e = p.a;
    for (let i = 0; i < len; i++) {
      const v = e * (Math.sin(w1 * i + p.p1) + 0.7 * Math.sin(w2 * i + p.p2)) * (i < 24 ? i / 24 : 1);
      L[i] += v * gl; R[i] += v * gr; e *= dec;
    }
  }
  const sv = new SVF(), hp = new Biquad('hp', 6000, 0.7), r2 = mulberry32(seed + 5);
  const nLen = Math.min(len, Math.floor(SR * 0.9));
  for (let i = 0; i < nLen; i++) {
    const t = i / SR;
    if ((i & 7) === 0) sv.set(900 * Math.pow(11000 / 900, Math.min(1, t / sweepDur)), 2.2);
    const w = r2() * 2 - 1;
    const x = sv.p(w) * 4.5 * (1 - Math.exp(-t / 0.0008)) * Math.exp(-t / (sweepDur * 0.7)) + hp.p(w) * 0.5 * Math.exp(-t / 0.16);
    const sp = 0.15 * Math.sin(t * 40);
    L[i] += x * (1 - sp); R[i] += x * (1 + sp);
  }
  let m = 0;
  for (let i = 0; i < len; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
  for (let i = 0; i < len; i++) { L[i] /= m; R[i] /= m; }
  fadeOut(L, 0.05); fadeOut(R, 0.05);
  return [L, R];
}
// Ink / water drip: rising-chirp bubble with a tiny onset tick and a faint second bubble.
function drip(seed) {
  const len = Math.floor(SR * 0.3), o = new Float64Array(len), r = mulberry32(seed), hp = new Biquad('hp', 3000, 0.7);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 820 * (1 + 1.6 * (1 - Math.exp(-t / 0.022)));
    ph += (TAU * f) / SR;
    const amp = (1 - Math.exp(-t / 0.0007)) * Math.exp(-t / 0.045);
    let x = (Math.sin(ph) + 0.22 * Math.sin(2 * ph)) * amp + hp.p(r() * 2 - 1) * Math.exp(-t / 0.0015) * 0.35;
    const t2 = t - 0.062;
    if (t2 > 0) { ph2 += (TAU * 1500 * (1 + 0.75 * (1 - Math.exp(-t2 / 0.012)))) / SR; x += 0.28 * Math.sin(ph2) * (1 - Math.exp(-t2 / 0.0006)) * Math.exp(-t2 / 0.02); }
    o[i] = x;
  }
  fadeOut(o, 0.02);
  return norm(o);
}
// Dragon growl: fluttering low saw + noise through two slowly moving formants.
function growl({ dur = 2.8, seed = 1 }) {
  const len = Math.floor(SR * dur), o = new Float64Array(len), r = mulberry32(seed);
  const F1 = new SVF(), F2 = new SVF(), lp = new Biquad('lp', 160, 0.7);
  let p1 = 0, p2 = 0, pf = 0, j = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, u = i / len;
    j += 0.001 * (r() * 2 - 1 - j);
    const f = 46 * (1 + 0.06 * Math.sin(TAU * 0.6 * t) + j * 8) * (1 - 0.12 * u);
    p1 += f / SR; p2 += (f * 1.008) / SR; p1 -= Math.floor(p1); p2 -= Math.floor(p2);
    pf += (21 + 4 * Math.sin(TAU * 0.4 * t)) / SR;
    const saw = 2 * p1 - 1 + (2 * p2 - 1) * 0.8;
    const flut = 0.6 + 0.4 * Math.sin(TAU * pf);
    if ((i & 15) === 0) {
      F1.set(300 + 220 * Math.sin(Math.PI * u) ** 2 + 40 * Math.sin(TAU * 1.3 * t), 4);
      F2.set(900 + 400 * Math.sin(Math.PI * u * 1.5) ** 2, 5);
    }
    const src = saw * flut + 0.5 * (r() * 2 - 1);
    const x = 1.2 * F1.p(src) + 0.8 * F2.p(src) + 0.7 * lp.p(saw);
    o[i] = Math.tanh(1.8 * x) * smooth(t / 0.45) * smooth((dur - t) / 1.3);
  }
  return norm(o);
}
// Seal stamp: dry, woody thunk.
function seal(seed) {
  const len = Math.floor(SR * 0.4), o = new Float64Array(len), r = mulberry32(seed);
  const bp = new Biquad('bp', 1900, 1.2), lp = new Biquad('lp', 400, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += (TAU * (118 + 45 * Math.exp(-t / 0.012))) / SR;
    const w = r() * 2 - 1;
    let x = Math.sin(ph) * Math.exp(-t / 0.055) + 0.45 * Math.sin(TAU * 305 * t) * Math.exp(-t / 0.028) + 0.25 * Math.sin(TAU * 520 * t) * Math.exp(-t / 0.015);
    x += bp.p(w) * Math.exp(-t / 0.003) * 3 + lp.p(w) * Math.exp(-t / 0.02) * 1.5;
    o[i] = Math.tanh(1.8 * x);
  }
  fadeOut(o, 0.03);
  return norm(o);
}

// ---------------------------------------------------------------- continuous layers
function addWind(gainPoints) {
  const L = new Float64Array(N), R = new Float64Array(N);
  const pL = pinkGen(mulberry32(101)), pR = pinkGen(mulberry32(202)), pC = pinkGen(mulberry32(303));
  const l1 = new SVF(), l2 = new SVF(), r1 = new SVF(), r2 = new SVF(), c1 = new SVF();
  const hL = new Biquad('hp', 180, 0.7), hR = new Biquad('hp', 180, 0.7); // keep the wind out of the drums' register
  let gL = 1, gR = 1;
  for (let i = 0; i < N; i++) {
    if ((i & 31) === 0) {
      const t = i / SR;
      const m1 = Math.sin(TAU * 0.07 * t + 0.3) + 0.6 * Math.sin(TAU * 0.19 * t + 1.1) + 0.3 * Math.sin(TAU * 0.43 * t);
      const m2 = Math.sin(TAU * 0.053 * t + 2.0) + 0.6 * Math.sin(TAU * 0.23 * t + 0.4) + 0.3 * Math.sin(TAU * 0.37 * t + 1);
      const m3 = Math.sin(TAU * 0.041 * t + 4.0) + 0.5 * Math.sin(TAU * 0.13 * t + 2.2);
      l1.set(520 * Math.pow(2, 0.5 * m1), 1.6); l2.set(1500 * Math.pow(2, 0.45 * m2), 2.2);
      r1.set(560 * Math.pow(2, 0.5 * m2), 1.6); r2.set(1400 * Math.pow(2, 0.45 * m1), 2.2);
      c1.set(380 * Math.pow(2, 0.6 * m3), 1.2);
      gL = 0.75 + 0.25 * Math.sin(TAU * 0.11 * t + 2) * Math.sin(TAU * 0.031 * t + 0.5);
      gR = 0.75 + 0.25 * Math.sin(TAU * 0.09 * t + 0.7) * Math.sin(TAU * 0.037 * t + 1.9);
    }
    const c = pC(), l = pL() + 0.5 * c, r = pR() + 0.5 * c, cc = 0.6 * c1.p(c);
    L[i] = hL.p(l1.p(l) + 0.5 * l2.p(l) + cc) * gL;
    R[i] = hR.p(r1.p(r) + 0.5 * r2.p(r) + cc) * gR;
  }
  normRms2(L, R);
  const g = envArr(gainPoints);
  for (let i = 0; i < N; i++) {
    const l = L[i] * g[i], r = R[i] * g[i];
    bed.L[i] += l; bed.R[i] += r; bed.sL[i] += l * 0.15; bed.sR[i] += r * 0.15;
  }
}
// Low drone on D1/D2: evolving additive stack, low partials mono, upper ones slightly split L/R.
function addDrone(t0, t1, gainFn, semiFn, seed) {
  const s0 = at(t0), len = at(t1) - s0, L = new Float64Array(len), R = new Float64Array(len), r = mulberry32(seed);
  const K = 14, phL = new Float64Array(K), phR = new Float64Array(K), lr = [], lph = [], amp = [];
  for (let k = 0; k < K; k++) {
    lr[k] = 0.04 + 0.13 * r(); lph[k] = TAU * r();
    amp[k] = k === 0 ? 0.8 : k === 1 ? 1.0 : 1.3 / Math.pow(k + 1, 1.15);
    phL[k] = TAU * r(); phR[k] = phL[k] + (k >= 2 ? r() * 2 : 0);
  }
  let f = 36.708;
  const a = new Float64Array(K);
  for (let i = 0; i < len; i++) {
    if ((i & 15) === 0) {
      const t = (s0 + i) / SR;
      f = 36.708 * Math.pow(2, semiFn(t) / 12);
      for (let k = 0; k < K; k++) a[k] = amp[k] * (0.62 + 0.38 * Math.sin(TAU * lr[k] * t + lph[k]));
    }
    let l = 0, rr = 0;
    for (let k = 0; k < K; k++) {
      const w = (TAU * f * (k + 1)) / SR, d = k >= 2 ? 0.0006 : 0;
      phL[k] += w * (1 + d); phR[k] += w * (1 - d);
      l += a[k] * Math.sin(phL[k]); rr += a[k] * Math.sin(phR[k]);
    }
    L[i] = Math.tanh(0.5 * l); R[i] = Math.tanh(0.5 * rr);
  }
  normRms2(L, R);
  putS(L, R, t0, { rev: 0.25, env: gainFn });
}
// Sub rumble that grows into the boss card.
function addRumble(t0, tPeak, gain) {
  const tail = 0.6, len = Math.floor((tPeak - t0 + tail) * SR);
  const L = new Float64Array(len), R = new Float64Array(len), r = mulberry32(404);
  const lp = new Biquad('lp', 70, 0.7), bL = new Biquad('bp', 190, 1), bR = new Biquad('bp', 230, 1), pg1 = pinkGen(mulberry32(405)), pg2 = pinkGen(mulberry32(406));
  let b = 0, am = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    b = b * 0.998 + 0.02 * (r() * 2 - 1);
    am += 0.0008 * (r() * 2 - 1 - am);
    const low = lp.p(b) * 6 + 0.25 * Math.sin(TAU * 41 * t) * (1 + clamp(am * 40, -0.8, 0.8));
    L[i] = low + bL.p(pg1()) * 2.2; R[i] = low + bR.p(pg2()) * 2.2;
  }
  normRms2(L, R);
  const d = tPeak - t0;
  putS(L, R, t0, { gain, rev: 0.2, env: (t) => (t < tPeak ? Math.pow((t - t0) / d, 2.2) * (1 - 0.9 * smooth((t - (tPeak - 0.1)) / 0.07)) : 0.1 * Math.exp(-(t - tPeak) / 0.22)) }); // sucks out just before the hit
}
// Warm pad: D major add9, stacked detuned sine/triangle-ish voices, slow swell, thins from the top.
function addPad(gain) {
  const t0 = 39.5, t1 = 49.7, len = at(t1) - at(t0), L = new Float64Array(len), R = new Float64Array(len), r = mulberry32(909);
  const notes = [[73.42, 0.5, 2], [146.83, 1, 2], [220, 0.9, 1], [293.66, 0.8, 1], [329.63, 0.7, 0], [369.99, 0.75, 0], [440, 0.5, 0]];
  const g = [new Float32Array(len), new Float32Array(len), new Float32Array(len)];
  for (let i = 0; i < len; i++) {
    const t = t0 + i / SR, sw = Math.pow(smooth((t - 39.5) / 3.5), 1.3);
    g[0][i] = sw * (1 - 0.9 * smooth((t - 45) / 2.2));
    g[1][i] = sw * (1 - 0.8 * smooth((t - 46.5) / 2.4));
    g[2][i] = sw * (1 - 0.6 * smooth((t - 47.8) / 1.6));
  }
  for (const [freq, amp, grp] of notes) {
    for (const det of [-7, 0, 6]) {
      const f = freq * Math.pow(2, (det + (r() - 0.5) * 2) / 1200), pan = det === 0 ? (r() * 2 - 1) * 0.2 : Math.sign(det) * (0.35 + 0.4 * r());
      const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
      const lfoR = 0.08 + 0.2 * r(), lfoP = TAU * r(), w = (TAU * f) / SR, ge = g[grp];
      let ph = TAU * r(), a = amp;
      for (let i = 0; i < len; i++) {
        if ((i & 63) === 0) a = amp * (0.7 + 0.3 * Math.sin(TAU * lfoR * (i / SR) + lfoP));
        ph += w;
        const v = a * (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.08 * Math.sin(3 * ph)) * ge[i];
        L[i] += v * gl; R[i] += v * gr;
      }
    }
  }
  normRms2(L, R, Math.floor(3.6 * SR), Math.floor(5.4 * SR));
  putS(L, R, t0, { gain, rev: 0.5 });
}

// ---------------------------------------------------------------- reverb (8-line FDN, pre-delay, damped highs)
function reverb(inL, inR, { t60 = 2.2, pre = 0.028, damp = 0.3, clears = [] } = {}) {
  const outL = new Float64Array(N), outR = new Float64Array(N);
  const lens = [1447, 1789, 2083, 2389, 2707, 3049, 3391, 3701];
  const bufs = lens.map((l) => new Float64Array(l)), idx = new Int32Array(8), lpS = new Float64Array(8);
  const gains = lens.map((l) => Math.pow(10, (-3 * l) / (t60 * SR)));
  const preN = Math.floor(pre * SR), pL = new Float64Array(preN), pR = new Float64Array(preN);
  let pi = 0;
  const apLens = [[223, 367, 509], [241, 349, 541]];
  const ap = apLens.map((ls) => ls.map((l) => ({ b: new Float64Array(l), i: 0 })));
  const mkF = () => [new Biquad('hp', 110, 0.7), new Biquad('lp', 8000, 0.7)];
  let fL = mkF(), fR = mkF();
  const sgn = [1, 1, -1, 1, 1, -1, -1, -1];
  const clearAt = new Set(clears.map((t) => at(t)));
  const o = new Float64Array(8);
  const apRun = (chain, x) => {
    for (const a of chain) { const d = a.b[a.i], v = x + 0.6 * d; a.b[a.i] = v; a.i = (a.i + 1) % a.b.length; x = d - 0.6 * v; }
    return x;
  };
  for (let i = 0; i < N; i++) {
    if (clearAt.has(i)) {
      for (const b of bufs) b.fill(0);
      lpS.fill(0); pL.fill(0); pR.fill(0);
      for (const ch of ap) for (const a of ch) a.b.fill(0);
      fL = mkF(); fR = mkF();
    }
    let xl = pL[pi], xr = pR[pi];
    pL[pi] = inL[i]; pR[pi] = inR[i]; pi = (pi + 1) % preN;
    xl = apRun(ap[0], fL[1].p(fL[0].p(xl))); xr = apRun(ap[1], fR[1].p(fR[0].p(xr)));
    let sum = 0;
    for (let k = 0; k < 8; k++) { const v = bufs[k][idx[k]]; lpS[k] = v * (1 - damp) + lpS[k] * damp; o[k] = lpS[k]; sum += o[k]; }
    sum *= 0.25;
    let l = 0, r = 0;
    for (let k = 0; k < 8; k++) {
      bufs[k][idx[k]] = ((k & 1) === 0 ? xl : xr) * sgn[k] + gains[k] * (o[k] - sum);
      idx[k] = (idx[k] + 1) % lens[k];
      if ((k & 1) === 0) l += o[k] * sgn[(k + 3) & 7]; else r += o[k] * sgn[(k + 5) & 7];
    }
    outL[i] = l * 0.4; outR[i] = r * 0.4;
  }
  return [outL, outR];
}

// ---------------------------------------------------------------- metering + mastering
function lufs(L, R) {
  const z = new Float64Array(L.length + 1);
  const mk = () => [
    Object.assign(new Biquad('lp', 1000, 1), { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 }),
    Object.assign(new Biquad('lp', 1000, 1), { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }),
  ];
  const kl = mk(), kr = mk();
  for (let i = 0; i < L.length; i++) { const a = kl[1].p(kl[0].p(L[i])), b = kr[1].p(kr[0].p(R[i])); z[i + 1] = z[i] + a * a + b * b; }
  const blk = Math.floor(0.4 * SR), hop = blk / 4, zs = [];
  for (let s = 0; s + blk <= L.length; s += hop) zs.push((z[s + blk] - z[s]) / blk);
  const lk = (v) => -0.691 + 10 * Math.log10(v + 1e-30);
  const g1 = zs.filter((v) => lk(v) > -70);
  if (!g1.length) return -Infinity;
  const rel = lk(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter((v) => lk(v) > rel);
  return lk(g2.reduce((a, b) => a + b, 0) / g2.length);
}
const TP_TAPS = (() => { // 4x polyphase windowed-sinc interpolator, 12 taps per phase
  const t = [];
  for (const fr of [0.25, 0.5, 0.75]) {
    const h = [];
    for (let k = -5; k <= 6; k++) { const x = k - fr, w = 0.5 + 0.5 * Math.cos((Math.PI * x) / 6.5); h.push((x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w); }
    t.push(h);
  }
  return t;
})();
function truePeak(L, R) {
  let sp = 0;
  for (let i = 0; i < L.length; i++) sp = Math.max(sp, Math.abs(L[i]), Math.abs(R[i]));
  let tp = sp;
  for (const ch of [L, R]) {
    for (let i = 6; i < ch.length - 7; i++) {
      if (Math.abs(ch[i]) < 0.6 * sp && Math.abs(ch[i + 1]) < 0.6 * sp) continue;
      for (const h of TP_TAPS) { let v = 0; for (let k = 0; k < 12; k++) v += ch[i + k - 5] * h[k]; if (Math.abs(v) > tp) tp = Math.abs(v); }
    }
  }
  return { sp, tp };
}
function softClip(x, T = 0.6, A = 1.4) { // transparent below T, tanh knee towards A; the limiter does the rest
  const a = Math.abs(x);
  if (a <= T) return x;
  const y = T + (A - T) * Math.tanh((a - T) / (A - T));
  return x < 0 ? -y : y;
}
function limit(L, R, ceil, laMs = 5, relMs = 140) { // look-ahead brickwall limiter, zero latency after compensation
  const n = L.length, la = Math.round((laMs * SR) / 1000), g = new Float64Array(n), m = new Float64Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); g[i] = p > ceil ? ceil / p : 1; }
  const dq = new Int32Array(n);
  let head = 0, tail = 0;
  for (let j = 0; j < n + la; j++) { // m[i] = min g[i .. i+la]
    if (j < n) { while (tail > head && g[dq[tail - 1]] >= g[j]) tail--; dq[tail++] = j; }
    const i = j - la;
    if (i >= 0) { while (dq[head] < i) head++; m[i] = g[dq[head]]; }
  }
  const rel = Math.exp(-1 / ((relMs * SR) / 1000));
  let e = 1;
  for (let i = 0; i < n; i++) { const x = m[i]; e = x < e ? x : x + (e - x) * rel; m[i] = e; }
  let sum = 0, minG = 1;
  for (let i = 0; i < n; i++) {
    sum += m[i]; if (i >= la) sum -= m[i - la];
    const gg = i >= la - 1 ? sum / la : (sum + (la - 1 - i)) / la;
    L[i] *= gg; R[i] *= gg; if (gg < minG) minG = gg;
  }
  return minG;
}

// ================================================================ TIMELINE
// ---- drum kit (rendered once, reused)
const ODAIKO_BIG = drum({ f0: 98, f1: 46, sweep: 0.07, tau: 0.46, midF: 190, midAmp: 0.5, midTau: 0.18, slapF: 2400, slapAmt: 1.25, slapTau: 0.024, skinF: 430, skinAmt: 1.15, skinTau: 0.11, stickF: 950, stickAmt: 0.28, drive: 1.9, seed: 11 });
const ODAIKO = drum({ f0: 95, f1: 48, sweep: 0.065, tau: 0.36, midF: 200, midAmp: 0.5, midTau: 0.16, slapF: 2200, slapAmt: 1.2, slapTau: 0.022, skinF: 430, skinAmt: 1.1, skinTau: 0.1, stickF: 950, stickAmt: 0.25, drive: 1.7, seed: 12 });
const ODAIKO_LT = drum({ f0: 102, f1: 55, sweep: 0.05, tau: 0.27, midF: 215, midAmp: 0.32, midTau: 0.1, slapF: 2000, slapAmt: 0.8, slapTau: 0.018, skinF: 450, skinAmt: 0.7, skinTau: 0.07, stickAmt: 0.2, drive: 1.5, seed: 13 });
const chu = (tau, pitch, seed) => drum({ f0: 165 * pitch, f1: 98 * pitch, sweep: 0.03, tau, midF: 300 * pitch, midAmp: 0.4, midTau: 0.06, slapF: 3200, slapAmt: 0.95, slapTau: 0.012, skinF: 720, skinAmt: 0.7, skinTau: 0.04, stickF: 1300, stickAmt: 0.25, drive: 1.5, seed });
const CHU = [[chu(0.2, 1, 31), chu(0.2, 1.035, 32)], [chu(0.12, 1, 33), chu(0.12, 1.035, 34)], [chu(0.075, 1, 35), chu(0.075, 1.035, 36)]];
const shime = (pitch, seed) => drum({ f0: 340 * pitch, f1: 240 * pitch, sweep: 0.01, tau: 0.05, midF: 520 * pitch, midAmp: 0.45, midTau: 0.03, slapF: 6000, slapAmt: 1.1, slapTau: 0.008, skinF: 1500, skinAmt: 0.75, skinTau: 0.02, stickF: 2100, stickAmt: 0.3, drive: 1.3, seed });
const SHIME = [shime(1, 41), shime(1.02, 42), shime(0.985, 43), shime(1.01, 44)];
const KA = [ka(51), ka(52)];
const STEP = [0, 1].map((k) => drum({ f0: 130, f1: 72 + 4 * k, sweep: 0.015, tau: 0.04, midF: 210, midAmp: 0.35, midTau: 0.025, slapF: 900, slapAmt: 0.8, slapTau: 0.012, skinF: 350, skinAmt: 0.6, skinTau: 0.03, stickAmt: 0, drive: 1.2, seed: 61 + k }));
const THUD = drum({ f0: 105, f1: 58, sweep: 0.03, tau: 0.17, midF: 180, midAmp: 0.35, midTau: 0.07, slapF: 700, slapAmt: 0.5, slapTau: 0.02, skinF: 300, skinAmt: 0.55, skinTau: 0.05, stickAmt: 0, drive: 1.2, seed: 71 });
const HEART = drum({ f0: 80, f1: 46, sweep: 0.03, tau: 0.13, midF: 140, midAmp: 0.38, midTau: 0.06, slapF: 500, slapAmt: 0.35, slapTau: 0.02, skinF: 230, skinAmt: 0.55, skinTau: 0.04, stickAmt: 0, drive: 1.2, seed: 72 });
const hum = mulberry32(2024); // "humanise" levels only; timing stays on the cue grid

// ---- wind: the whole film, on the un-ducked bed
addWind([[0, 0], [0.3, 0.026], [1.5, 0.034], [3.5, 0.03], [6.5, 0.027], [9.5, 0.024], [13.5, 0.02], [16, 0.02], [19.2, 0.024], [20.4, 0.03], [21.6, 0.03],
  [22.0, 0.016], [24.6, 0.018], [24.9, 0.005], [26.9, 0.005], [27.3, 0.013], [28.6, 0.016], [36.29, 0.016], [36.31, 0.0018], [37.74, 0.0018], [37.78, 0.008],
  [39.5, 0.013], [41, 0.021], [45, 0.021], [47, 0.015], [49.2, 0.003], [49.66, 0]]);

// ---- s01 0.0-3.5: the range is brushed in left to right, the sun is stamped
put(sweep({ dur: 2.8, fa: 900, fb: 2600, fc: 1300, q: 0.8, peakAt: 0.5, swells: 3, rough: 0.5, heavy: 0.45, seed: 21 }), 0.2, { gain: 0.3, pan: -0.8, panTo: 0.8, rev: 0.3 });
put(THUD, 3.05, { gain: 0.34, pan: 0.25, rev: 0.35 });

// ---- s02 3.5-6.5 / s03 / s04: drone enters at 3.5, dips a semitone 8.0-9.5, holds under the boss card
const droneSemi = (t) => -smooth((t - 8.0) / 1.5);
addDrone(3.5, 13.8, bpFn([[3.5, 0], [5.0, 0.055], [8, 0.06], [9.5, 0.065], [11.3, 0.08], [13.0, 0.05], [13.8, 0]]), droneSemi, 81);
put(breath({ dur: 9.9, freq: (t) => 146.83 * Math.pow(2, droneSemi(t + 3.6) / 12), air: 0.9, att: 1.2, rel: 1.5, vibDepth: 0.004, seed: 82 }), 3.6, { gain: 0.05, pan: -0.15, rev: 0.5 });
put(koto({ freq: 293.66, dur: 3.2, bright: 0.5, seed: 91 }), 4.2, { gain: 0.26, pan: -0.2, rev: 0.5 });
put(koto({ freq: 311.13, dur: 3.2, bright: 0.45, seed: 92 }), 5.3, { gain: 0.22, pan: 0.15, rev: 0.5 });
put(koto({ freq: 220.0, dur: 3.0, bright: 0.4, seed: 93 }), 6.12, { gain: 0.16, pan: -0.05, rev: 0.55 });

// ---- s03 6.5-9.5: birds erased (three short crackles), then the long tear eating the far range
put(crackle({ dur: 0.16, d0: 500, d1: 250, seed: 111, peakAt: 0.15 }), 6.9, { gain: 0.26, pan: 0.3, rev: 0.3 });
put(crackle({ dur: 0.14, d0: 550, d1: 250, seed: 112, peakAt: 0.15, tone: 5200 }), 7.5, { gain: 0.26, pan: -0.1, rev: 0.3 });
put(crackle({ dur: 0.18, d0: 600, d1: 250, seed: 113, peakAt: 0.15, tone: 4000 }), 8.0, { gain: 0.28, pan: 0.45, rev: 0.3 });
put(crackle({ dur: 1.3, d0: 120, d1: 900, seed: 114, peakAt: 0.85, bedAmt: 0.3, edge: 0.08 }), 8.2, { gain: 0.3, pan: 0.6, panTo: -0.1, rev: 0.25 });
put(sweep({ dur: 1.3, fa: 700, fb: 2400, q: 0.9, peakAt: 0.85, risePow: 1.5, rough: 0.6, seed: 115 }), 8.2, { gain: 0.07, pan: 0.6, panTo: -0.1, rev: 0.3 });

// ---- s04 9.5-13.5: rumble grows, boss card at 11.30
addRumble(9.5, 11.3, 0.11);
put(ODAIKO, 11.3, { gain: 1.0, rev: 0.55 });
put(KA[0], 11.3, { gain: 0.12, pan: 0.2, rev: 0.4 });
put(ODAIKO_LT, 11.8, { gain: 0.42, pan: -0.1, rev: 0.4 });

// ---- s05 13.5-16.0: almost quiet; two heartbeats, one drip
put(HEART, 13.9, { gain: 0.25, rev: 0.25 });
put(HEART, 14.7, { gain: 0.25, rev: 0.25 });
put(drip(121), 15.55, { gain: 0.24, pan: 0.1, rev: 0.7 });

// ---- s06 16.0-19.0: the run. 32 sixteenths, accelerando ~160 -> ~176 BPM (mean 168), landing on 19.000
{
  const q = Math.pow(1.1, -1 / 31), d0 = (3 * (1 - q)) / (1 - Math.pow(q, 32));
  const tk = (k) => (k >= 32 ? 19.0 : 16 + (d0 * (1 - Math.pow(q, k))) / (1 - q));
  const acc = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1];
  for (let k = 0; k < 32; k++) {
    const t = tk(k), grow = 0.55 + 0.45 * (k / 32), h = 0.9 + 0.2 * hum();
    put(SHIME[k % 4], t, { gain: grow * h * (acc[k] ? 0.25 : 0.09), pan: 0.18, rev: 0.22 });
    if (acc[k]) put(CHU[1][k % 2], t, { gain: grow * h * 0.21, pan: -0.12, rev: 0.3 });
    if (k % 4 === 2) put(KA[(k >> 2) % 2], t, { gain: grow * 0.09, pan: 0.4, rev: 0.25 });
    if (k % 2 === 0) put(STEP[(k >> 1) % 2], t, { gain: grow * 0.16, pan: (k >> 1) % 2 ? 0.28 : -0.28, rev: 0.15 });
  }
  put(CHU[0][0], 19.0, { gain: 0.46, pan: -0.1, rev: 0.4 });
  put(SHIME[0], 19.0, { gain: 0.34, pan: 0.18, rev: 0.35 });
  put(KA[1], 19.0, { gain: 0.12, pan: 0.4, rev: 0.35 });
  put(crackle({ dur: 3.0, d0: 150, d1: 700, seed: 131, peakAt: 0.92, bedAmt: 0.25, edge: 0.03 }), 16.0, { gain: 0.11, pan: -0.65, rev: 0.2 });
  addDrone(15.8, 19.4, bpFn([[15.8, 0], [16.3, 0.045], [19.0, 0.075], [19.4, 0]]), () => 0, 83);
}

// ---- s07 19.0-21.5: the leap (rising whoosh), then the held breath
put(sweep({ dur: 1.1, fa: 220, fb: 4200, fc: 5200, q: 1.3, peakAt: 0.86, risePow: 1.6, tailPow: 1.2, pink: 0.4, seed: 141 }), 19.3, { gain: 0.36, pan: -0.3, panTo: 0.2, rev: 0.4 });
put(breath({ dur: 1.3, freq: 1174.66, air: 1.1, att: 0.35, rel: 0.3, vibDepth: 0.003, harm: [1, 0.2, 0.05], seed: 142 }), 20.35, { gain: 0.035, pan: 0.1, rev: 0.6 });

// ---- s08 21.5-23.5: brush anticipation, then the first cut at 22.00
put(sweep({ dur: 0.3, fa: 1200, fb: 3800, fc: 3000, q: 0.9, peakAt: 0.7, tailPow: 2, rough: 0.4, seed: 151 }), 21.7, { gain: 0.24, pan: -0.5, panTo: 0.4, rev: 0.3 });
put(ODAIKO, 22.0, { gain: 1.0, rev: 0.55 });
{ const [bl, br] = blade({ ring: 0.3, n: 9, seed: 152 }); putS(bl, br, 22.0, { gain: 0.42, rev: 0.5 }); }

// ---- s09 23.5-27.0: the tail wipes the frame right to left; then near silence
put(sweep({ dur: 1.0, fa: 500, fb: 3200, fc: 1500, q: 1.0, peakAt: 0.8, risePow: 1.3, tailPow: 1.5, pink: 0.3, rough: 0.3, seed: 161 }), 23.6, { gain: 0.52, pan: 0.85, panTo: -0.85, rev: 0.3 });
put(crackle({ dur: 1.0, d0: 200, d1: 1200, seed: 162, peakAt: 0.85, bedAmt: 0.3, edge: 0.05 }), 23.6, { gain: 0.34, pan: 0.85, panTo: -0.85, rev: 0.25 });
put(breath({ dur: 2.35, freq: (t) => 880 * Math.pow(2, (-0.35 * t) / 2.35 / 12), air: 1.2, att: 0.8, rel: 0.7, vibDepth: 0.003, harm: [1, 0.18, 0.04], seed: 163 }), 24.65, { gain: 0.006, pan: -0.1, rev: 0.6, to: bed });

// ---- s10 27.0-31.5: the heavy wet stroke, the dragon, the groove builds (12 eighths at ~124 BPM)
put(sweep({ dur: 1.3, fa: 500, fb: 2300, fc: 1600, q: 0.75, peakAt: 0.8, risePow: 0.8, tailPow: 2, rough: 0.6, heavy: 1.1, pink: 0.3, seed: 171 }), 27.3, { gain: 0.7, pan: -0.85, panTo: 0.85, rev: 0.4 });
put(ODAIKO, 28.6, { gain: 0.42, rev: 0.4 });
put(growl({ dur: 2.8, seed: 172 }), 28.6, { gain: 0.14, pan: 0.15, rev: 0.35 });
addDrone(28.4, 36.4, bpFn([[28.4, 0], [28.8, 0.045], [31.5, 0.05], [36.3, 0.07], [36.4, 0.07]]), () => 0, 84);
{
  const e = 2.9 / 12, T = (n) => 28.6 + n * e;
  const hits = [[2, 0.2], [4, 0.24], [5, 0.13], [6, 0.25], [7, 0.15], [8, 0.28], [9, 0.16], [10, 0.28], [10.5, 0.17], [11, 0.26], [11.5, 0.21]];
  hits.forEach(([n, g], k) => put(CHU[0][k % 2], T(n), { gain: g, pan: k % 2 ? 0.15 : -0.15, rev: 0.32 }));
  put(ODAIKO_LT, T(4), { gain: 0.22, rev: 0.35 });
  put(ODAIKO_LT, T(8), { gain: 0.26, rev: 0.35 });
  for (let n = 2; n < 12; n++) {
    put(SHIME[n % 4], T(n), { gain: 0.07 + 0.009 * n, pan: 0.3, rev: 0.25 });
    if (n >= 3 && n % 2 === 1) put(KA[n % 2], T(n), { gain: 0.065, pan: -0.35, rev: 0.25 });
  }
}

// ---- s11/s12 31.5-36.30: oroshi. 4 strokes/s at 31.5 -> 16/s at 35.0 (exponential), held at 16/s until the dead cut
{
  const A = (4 * 3.5) / Math.log(4), jMax = A * 3;
  const times = [];
  for (let j = 0; ; j++) {
    const t = j <= jMax ? 31.5 + (3.5 * Math.log(1 + j / A)) / Math.log(4) : 35 + (j - jMax) / 16;
    if (t > 36.27) break;
    times.push(t);
  }
  times.forEach((t, j) => {
    const rate = t < 35 ? 4 * Math.pow(4, (t - 31.5) / 3.5) : 16;
    const v = rate < 6.5 ? 0 : rate < 11 ? 1 : 2, hand = j % 2, accent = j % 4 === 0 ? 1.25 : 1;
    // shorter drum voices at speed carry less energy per stroke: compensate so the level only ever grows
    const prog = (t - 31.5) / 4.8, lvl = (0.095 + 0.095 * Math.pow(prog, 0.8)) * [1, 1.06, 1.14][v], h = 0.92 + 0.16 * hum();
    put(CHU[v][hand], t, { gain: lvl * h * accent, pan: hand ? 0.2 : -0.2, rev: 0.28 });
    put(SHIME[j % 4], t, { gain: lvl * h * (0.25 + 0.3 * prog), pan: hand ? -0.3 : 0.3, rev: 0.22 });
  });
  put(ODAIKO_LT, 31.5, { gain: 0.28, rev: 0.35 });
  put(ODAIKO_LT, 33.25, { gain: 0.25, rev: 0.35 });
  put(ODAIKO, 35.0, { gain: 0.27, rev: 0.35 });
  put(sweep({ dur: 0.8, fa: 600, fb: 4500, fc: 900, q: 1.1, peakAt: 0.12, tailPow: 2, pink: 0.3, seed: 181 }), 32.7, { gain: 0.3, pan: 0.6, panTo: -0.6, rev: 0.4 });
  put(sweep({ dur: 0.7, fa: 900, fb: 6000, fc: 1200, q: 1.4, peakAt: 0.15, tailPow: 2, seed: 182 }), 32.72, { gain: 0.16, pan: -0.5, panTo: 0.5, rev: 0.4 });
  put(sweep({ dur: 1.33, fa: 350, fb: 9000, q: 1.2, peakAt: 0.985, risePow: 1.8, pink: 0.3, seed: 183 }), 35.0, { gain: 0.17, rev: 0.3 });
}

// ---- s13 37.75: THE cut. Brightest blade + biggest odaiko + sub drop, then nothing until 39.5
put(ODAIKO_BIG, 37.75, { gain: 1.3, rev: 0.6 });
{
  const [bl, br] = blade({ ring: 0.55, n: 11, seed: 191, sweepDur: 0.11, body: 0.3 });
  putS(bl, br, 37.75, { gain: 0.58, rev: 0.55 });
  const len = Math.floor(2.4 * SR), sub = new Float64Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += (TAU * (30 + 55 * Math.exp(-t / 0.35))) / SR;
    sub[i] = Math.tanh(1.4 * (Math.sin(ph) + 0.25 * Math.sin(2 * ph))) * Math.exp(-t / 0.65) * (1 - Math.exp(-t / 0.004));
  }
  fadeOut(sub, 0.2);
  put(norm(sub), 37.75, { gain: 0.4, rev: 0.1 });
}

// ---- s14 39.5-45.0: colour returns. Koto arpeggio in the yo scale (D E F# A B), warm pad, petals
{
  const notes = [[146.83, 39.6], [220.0, 40.2], [293.66, 40.75], [329.63, 41.3], [369.99, 41.85], [440.0, 42.4], [493.88, 42.95], [587.33, 43.6]];
  notes.forEach(([f, t], k) => put(koto({ freq: f, dur: 4.2, bright: 0.36, decay: 3.6, bend: 0.007, seed: 201 + k, pick: 0.2 }), t, { gain: 0.3 + 0.012 * k, pan: (k % 2 ? 0.28 : -0.28) * (0.5 + k / 14), rev: 0.5 }));
  put(koto({ freq: 73.42, dur: 4.5, bright: 0.4, decay: 4, bend: 0.005, seed: 210, pick: 0.15 }), 39.6, { gain: 0.24, rev: 0.4 });
  addPad(0.06);
  const r = mulberry32(220), shEnv = bpFn([[40.2, 0], [42.5, 1], [44.3, 1], [45.6, 0]]);
  for (let t = 40.2; t < 45.5; t += -Math.log(1 - r() * 0.999) / 24) {
    const d = 0.05 + 0.08 * r(), len = Math.floor(d * SR), g = new Float64Array(len), bp = new Biquad('bp', 4500 + 5000 * r(), 5);
    for (let i = 0; i < len; i++) g[i] = bp.p(r() * 2 - 1) * Math.sin((Math.PI * i) / len) ** 2;
    put(norm(g), t, { gain: 0.012 * shEnv(t) * (0.35 + 0.65 * r()), pan: r() * 1.7 - 0.85, rev: 0.6 });
  }
}

// ---- s15 45.0-50.0: seal stamp at 47.00, last koto D at 47.6, fade
put(seal(231), 47.0, { gain: 0.45, pan: 0.2, rev: 0.07 });
put(koto({ freq: 146.83, dur: 2.3, bright: 0.4, decay: 3.5, bend: 0.006, seed: 232, pick: 0.2 }), 47.6, { gain: 0.36, pan: -0.05, rev: 0.75 });
put(koto({ freq: 293.66, dur: 2.3, bright: 0.33, decay: 3, bend: 0.005, seed: 233, pick: 0.1 }), 47.6, { gain: 0.1, pan: 0.15, rev: 0.75 });

// ================================================================ MIXDOWN
// The two deliberate silences: main bus is ducked, the reverb tail is killed, only the bed remains.
const duck = envArr([[0, 1], [24.6, 1], [24.8, 0], [26.95, 0], [27.05, 1], [36.3, 1], [36.312, 0], [37.7, 0], [37.74, 1], [50, 1]]);
const wetDuck = envArr([[0, 1], [24.6, 1], [24.85, 0], [24.87, 0], [24.95, 1], [36.3, 1], [36.315, 0], [36.33, 0], [36.4, 1], [50, 1]]);
const inL = new Float64Array(N), inR = new Float64Array(N);
for (let i = 0; i < N; i++) { inL[i] = bed.sL[i] + duck[i] * main.sL[i]; inR[i] = bed.sR[i] + duck[i] * main.sR[i]; }
const [wetL, wetR] = reverb(inL, inR, { t60: 2.2, pre: 0.028, damp: 0.3, clears: [24.86, 36.32] });
const finalFade = envArr([[0, 0], [0.004, 1], [48.7, 1], [49.64, 0], [50, 0]]);
const preL = new Float64Array(N), preR = new Float64Array(N);
{
  const hl = new Biquad('hp', 22, 0.7), hr = new Biquad('hp', 22, 0.7);
  const zeroFrom = at(49.64);
  for (let i = 0; i < N; i++) {
    const l = hl.p(bed.L[i] + duck[i] * main.L[i] + wetDuck[i] * wetL[i]);
    const r = hr.p(bed.R[i] + duck[i] * main.R[i] + wetDuck[i] * wetR[i]);
    preL[i] = i >= zeroFrom ? 0 : l * finalFade[i]; preR[i] = i >= zeroFrom ? 0 : r * finalFade[i];
  }
}

// ---- master: gain -> soft clip -> look-ahead limiter -> true-peak guard, iterated to the loudness target
const CEIL = dB(LIMIT_CEIL_DB);
let G = 1, outL, outR, stats;
for (let it = 0; it < 12; it++) {
  outL = new Float64Array(N); outR = new Float64Array(N);
  for (let i = 0; i < N; i++) { outL[i] = softClip(preL[i] * G); outR[i] = softClip(preR[i] * G); }
  const minG = limit(outL, outR, CEIL);
  let { sp, tp } = truePeak(outL, outR);
  const tpMax = dB(TP_MAX_DB);
  if (tp > tpMax) { const k = tpMax / tp; for (let i = 0; i < N; i++) { outL[i] *= k; outR[i] *= k; } sp *= k; tp = tpMax; }
  const l = lufs(outL, outR);
  stats = { G, lufs: l, sp, tp, minG };
  if (Math.abs(l - TARGET_LUFS) < 0.02) break;
  G *= dB(TARGET_LUFS - l);
}

// ---- write 16-bit stereo WAV
const pcm = new Int16Array(N * 2);
for (let i = 0; i < N; i++) {
  pcm[2 * i] = clamp(Math.round(outL[i] * 32767), -32768, 32767);
  pcm[2 * i + 1] = clamp(Math.round(outR[i] * 32767), -32768, 32767);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.byteLength, 4); header.write('WAVE', 8); header.write('fmt ', 12);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.byteLength, 40);
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio', 'score.wav');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.concat([header, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]));

// ================================================================ REPORT (measured from the written samples)
const X = (i, c) => pcm[2 * i + c] / 32768;
const rmsDb = (a, b) => { let s = 0; const i0 = at(a), i1 = at(b); for (let i = i0; i < i1; i++) s += X(i, 0) ** 2 + X(i, 1) ** 2; return toDb(Math.sqrt(s / (2 * (i1 - i0)))); };
const peakIn = (a, b) => { let m = 0; for (let i = at(a); i < at(b); i++) m = Math.max(m, Math.abs(X(i, 0)), Math.abs(X(i, 1))); return m; };
function onset(T) { // first sample exceeding 2x the peak of the preceding 40 ms; and first sample at half the local peak
  const pre = Math.max(peakIn(T - 0.045, T - 0.005), 0.002), loc = peakIn(T, T + 0.05);
  let first = null, half = null;
  for (let i = at(T - 0.02); i < at(T + 0.05); i++) {
    const a = Math.max(Math.abs(X(i, 0)), Math.abs(X(i, 1)));
    if (first === null && a > 2 * pre) first = i / SR;
    if (half === null && a >= 0.5 * loc) half = i / SR;
  }
  return { pre: toDb(pre), peak: toDb(loc), first, half };
}
console.log(`wrote ${outPath}`);
console.log(`samples ${N} (${(N / SR).toFixed(3)} s), master gain ${toDb(stats.G).toFixed(2)} dB, max limiter GR ${toDb(stats.minG).toFixed(2)} dB`);
console.log(`integrated ${stats.lufs.toFixed(2)} LUFS (script meter), sample peak ${toDb(stats.sp).toFixed(2)} dBFS, true peak ~${toDb(stats.tp).toFixed(2)} dBTP`);
for (const T of [3.05, 11.3, 11.8, 19.0, 22.0, 28.6, 37.75, 47.0, 47.6]) {
  const o = onset(T);
  const f = (v) => (v === null ? 'n/a' : `${v.toFixed(4)} (${((v - T) * 1000).toFixed(2)} ms)`);
  console.log(`cue ${T.toFixed(2)}: onset ${f(o.first)}, half-peak ${f(o.half)}, pre ${o.pre.toFixed(1)} dBFS, peak ${o.peak.toFixed(1)} dBFS`);
}
const maxWin = (a, b, w = 0.1) => { let m = -999; for (let t = a; t + w <= b + 1e-9; t += w / 4) m = Math.max(m, rmsDb(t, t + w)); return m; };
const W = [['wind open 0.3-3.0', 0.3, 3.0], ['drone 4-6.5', 4, 6.5], ['tear 8.2-9.5', 8.2, 9.5], ['boss 11.3-12.3', 11.3, 12.3], ['quiet 13.5-16', 13.5, 16], ['run 16-19', 16, 19],
  ['breath 20.5-21.5', 20.5, 21.5], ['cut1 22-23', 22, 23], ['SILENCE1 24.9-27.0', 24.9, 27.0], ['swish 27.3-28.6', 27.3, 28.6], ['groove 28.6-31.5', 28.6, 31.5], ['roll 31.5-35', 31.5, 35],
  ['roll full 35-36.3', 35, 36.3], ['SILENCE2 36.35-37.74', 36.35, 37.74], ['cut 37.75-38.75', 37.75, 38.75], ['ring 38.75-39.5', 38.75, 39.5], ['koto/pad 39.6-45', 39.6, 45], ['end 45-49', 45, 49], ['tail 49.7-50', 49.7, 50]];
for (const [name, a, b] of W) console.log(`rms ${name.padEnd(22)} ${rmsDb(a, b).toFixed(1)} dBFS   loudest 100 ms ${maxWin(a, b).toFixed(1)}   peak ${toDb(peakIn(a, b)).toFixed(1)}`);
