// Every sound is synthesized: drum, blade, koto, wind, the brush on paper.
export class Sound {
  constructor() {
    this.ctx = null;
  }
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.out = C.createDynamicsCompressor();
    this.out.threshold.value = -14;
    this.out.ratio.value = 4;
    this.master = C.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.out);
    this.out.connect(C.destination);
    // a room
    const len = C.sampleRate * 2.4,
      ir = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb = C.createConvolver();
    this.verb.buffer = ir;
    const vg = C.createGain();
    vg.gain.value = 0.3;
    this.verb.connect(vg);
    vg.connect(this.master);
    this.noise = C.createBuffer(1, C.sampleRate * 2, C.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // wind bed
    const w = this.loop();
    const wf = C.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 420;
    wf.Q.value = 0.5;
    const wg = C.createGain();
    wg.gain.value = 0.05;
    w.connect(wf);
    wf.connect(wg);
    wg.connect(this.master);
    const lfo = C.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = C.createGain();
    lg.gain.value = 160;
    lfo.connect(lg);
    lg.connect(wf.frequency);
    lfo.start();
    // the brush
    const b = this.loop();
    const bf = C.createBiquadFilter();
    bf.type = "bandpass";
    bf.frequency.value = 2600;
    bf.Q.value = 0.7;
    this.brushG = C.createGain();
    this.brushG.gain.value = 0;
    b.connect(bf);
    bf.connect(this.brushG);
    this.brushG.connect(this.master);
  }
  loop() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start();
    return s;
  }
  send(node, wet = 0.5) {
    node.connect(this.master);
    const g = this.ctx.createGain();
    g.gain.value = wet;
    node.connect(g);
    g.connect(this.verb);
  }
  setBrush(v) {
    if (this.ctx) this.brushG.gain.setTargetAtTime(v * 0.16, this.ctx.currentTime, 0.04);
  }
  drum(vol = 1, f0 = 92, len = 1.5) {
    if (!this.ctx) return;
    const C = this.ctx,
      t = C.currentTime;
    const o = C.createOscillator(),
      g = C.createGain();
    o.frequency.setValueAtTime(f0 * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.3);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g);
    this.send(g, 0.6);
    o.start(t);
    o.stop(t + len);
    const n = C.createBufferSource(),
      nf = C.createBiquadFilter(),
      ng = C.createGain();
    n.buffer = this.noise;
    nf.type = "lowpass";
    nf.frequency.value = 1100;
    ng.gain.setValueAtTime(vol * 0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(nf);
    nf.connect(ng);
    this.send(ng, 0.4);
    n.start(t);
    n.stop(t + 0.2);
  }
  blade(vol = 1) {
    if (!this.ctx) return;
    const C = this.ctx,
      t = C.currentTime;
    for (const f of [2630, 3410, 4720, 5890, 7240]) {
      const o = C.createOscillator(),
        g = C.createGain();
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
      g.gain.setValueAtTime(vol * 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 1.3);
      o.connect(g);
      this.send(g, 0.8);
      o.start(t);
      o.stop(t + 1.4);
    }
    const n = C.createBufferSource(),
      nf = C.createBiquadFilter(),
      ng = C.createGain();
    n.buffer = this.noise;
    nf.type = "highpass";
    nf.frequency.setValueAtTime(900, t);
    nf.frequency.exponentialRampToValueAtTime(7000, t + 0.16);
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.connect(nf);
    nf.connect(ng);
    this.send(ng, 0.5);
    n.start(t);
    n.stop(t + 0.3);
  }
  pluck(freq, vol = 0.5, when = 0) {
    if (!this.ctx) return;
    const C = this.ctx,
      t = C.currentTime + when;
    const o = C.createOscillator(),
      o2 = C.createOscillator(),
      f = C.createBiquadFilter(),
      g = C.createGain();
    o.type = "triangle";
    o2.type = "sawtooth";
    o.frequency.setValueAtTime(freq * 1.015, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    o2.frequency.value = freq * 2.001;
    f.type = "lowpass";
    f.frequency.setValueAtTime(5200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.8);
    const g2 = C.createGain();
    g2.gain.value = 0.18;
    o.connect(f);
    o2.connect(g2);
    g2.connect(f);
    f.connect(g);
    this.send(g, 0.9);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.9);
    o2.stop(t + 1.9);
  }
  tear(vol = 0.4) {
    if (!this.ctx) return;
    const C = this.ctx,
      t = C.currentTime;
    const n = C.createBufferSource(),
      nf = C.createBiquadFilter(),
      ng = C.createGain();
    n.buffer = this.noise;
    n.playbackRate.value = 0.6 + Math.random() * 0.5;
    nf.type = "highpass";
    nf.frequency.value = 2200;
    ng.gain.setValueAtTime(vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    n.connect(nf);
    nf.connect(ng);
    this.send(ng, 0.3);
    n.start(t, Math.random());
    n.stop(t + 0.3);
  }
  whoosh(vol = 0.4, dur = 0.7) {
    if (!this.ctx) return;
    const C = this.ctx,
      t = C.currentTime;
    const n = C.createBufferSource(),
      nf = C.createBiquadFilter(),
      ng = C.createGain();
    n.buffer = this.noise;
    nf.type = "bandpass";
    nf.Q.value = 1.2;
    nf.frequency.setValueAtTime(300, t);
    nf.frequency.exponentialRampToValueAtTime(2400, t + dur);
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(vol, t + dur * 0.8);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(nf);
    nf.connect(ng);
    this.send(ng, 0.4);
    n.start(t);
    n.stop(t + dur + 0.05);
  }
}
