/* HITOFUDE — the clock. Every frame is drawn from film time alone (24 fps), in any order. */
(function () {
  "use strict";
  const K = window.K,
    W = K.W,
    H = K.H;
  const film = document.getElementById("film");
  const out = film.getContext("2d");
  const DUR = 50;

  function renderAt(time) {
    const f = Math.min(DUR * K.FPS - 1, Math.max(0, K.frame(time)));
    const t = f / K.FPS;
    let shot = K.SHOTS[K.SHOTS.length - 1];
    for (const s of K.SHOTS) {
      if (t >= s.t0 - 1e-6 && t < s.t1 - 1e-6) {
        shot = s;
        break;
      }
    }
    const g = K.layer("scene");
    g.drawImage(K.paper, 0, 0);
    const post = shot.fn(g, t - shot.t0, t, f) || {};
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = "source-over";
    out.globalAlpha = 1;
    out.filter = "none";
    const sh = post.shake;
    if (sh && (sh[0] || sh[1])) {
      const z = 1.035;
      out.setTransform(z, 0, 0, z, (W * (1 - z)) / 2 + sh[0], (H * (1 - z)) / 2 + sh[1]);
      out.drawImage(g.canvas, 0, 0);
      out.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      // a hair of overscan hides the ragged filter edge at the frame border
      const z = 1.008;
      out.setTransform(z, 0, 0, z, (W * (1 - z)) / 2, (H * (1 - z)) / 2);
      out.drawImage(g.canvas, 0, 0);
      out.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (post.invert) {
      out.globalCompositeOperation = "difference";
      out.fillStyle = "#fff";
      out.fillRect(0, 0, W, H);
      out.globalCompositeOperation = "source-over";
    }
  }
  K.renderAt = renderAt;

  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.to({}, { duration: DUR }, 0);
  window.__timelines["main"] = tl;

  window.addEventListener("hf-seek", (e) => {
    renderAt(e.detail.time);
  });
  // the display face must be in before the first card is drawn
  const fontsIn = Promise.all([document.fonts.load('500 40px "EB Garamond"'), document.fonts.ready]).then(() => renderAt(K.__t || 0));
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady["hitofude"] = fontsIn;
  const q = new URLSearchParams(location.search).get("t");
  K.__t = q ? parseFloat(q) : 0;
  renderAt(K.__t);
})();
