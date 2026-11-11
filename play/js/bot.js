// A player for the recording. It plays through the same key state a keyboard writes to,
// reads only what a person can see on screen, reacts late, and sometimes gets it wrong.
const SC = 1.25,
  HS = 170 * 1.55;

export function makeBot(G, F, B, K) {
  let R = K.rng(1);
  const S = { last: "", react: 0, plan: "", t: 0, combo: 0, hold: 0, holdFor: 0, cd: 0, jumped: false, dashed: false, aired: false, tapT: -1, off: "wave", acts: 0 };
  const down = (k) => {
    if (!G.keys[k]) G.press[k] = true;
    G.keys[k] = true;
  };
  const up = (k) => (G.keys[k] = false);
  const tap = (k) => {
    G.press[k] = true;
    G.keys[k] = true;
    S["rel_" + k] = 0.07;
  };
  const sx = () => 960 + F.x * SC;
  const headX = () => B.hx + B.dir[0] * HS * 0.42;
  const moveTo = (x, tol = 26) => {
    const d = x - sx();
    up("left");
    up("right");
    if (d > tol) down("right");
    else if (d < -tol) down("left");
    return Math.abs(d) <= tol;
  };
  /* the nearest spot no shard is about to land on */
  const safeX = () => {
    const pend = B.sh.filter((s) => !s.done).map((s) => s.x);
    if (!pend.length) return null;
    const here = sx();
    let best = null;
    for (let x = 150; x <= 1500; x += 20) {
      let m = 1e9;
      for (const p of pend) m = Math.min(m, Math.abs(p - x));
      if (m >= 108 && (best == null || Math.abs(x - here) < Math.abs(best - here))) best = x;
    }
    return best;
  };
  return {
    reset(seed) {
      R = K.rng(seed);
      Object.assign(S, { last: "", react: 0, plan: "", t: 0, combo: 0, hold: 0, holdFor: 0, cd: 0, jumped: false, dashed: false, aired: false, off: "wave", acts: 0 });
      for (const k of ["left", "right", "block", "heavy", "light", "kick", "dash", "jump"]) G.keys[k] = false;
    },
    step(dt) {
      for (const k of ["light", "kick", "dash", "jump", "heavy"])
        if (S["rel_" + k] > 0) {
          S["rel_" + k] -= dt;
          if (S["rel_" + k] <= 0) up(k);
        }
      S.t += dt;
      S.cd -= dt;
      S.react -= dt;
      const st = B.state;
      if (st !== S.last) {
        // something new on screen: it takes a moment to register
        S.last = st;
        S.react = 0.1 + R() * 0.16;
        S.t = 0;
        S.jumped = S.dashed = false;
        S.combo = 0;
        const r = R(),
          hurt = F.hp < 40;
        if (st === "biteTell") S.plan = r < 0.46 ? "parry" : r < 0.66 ? "early" : r < (hurt ? 0.97 : 0.86) ? "dodge" : "slow";
        else if (st === "wipe") S.plan = r < 0.86 ? "jump" : "late";
        else if (st === "breathTell") S.plan = r < 0.72 ? "dash" : r < 0.9 ? "block" : "slow";
        else if (st === "hover") S.off = G.ink > 55 && R() < 0.5 ? "wave" : "jump";
        if (st !== "hover" && G.kActive && st !== "rest") up("heavy");
      }
      const busy = F.state === "hurt" || F.state === "knock" || F.state === "down" || F.state === "getup" || F.state === "ko";
      if (busy) {
        for (const k of ["left", "right", "block", "heavy"]) up(k);
        S.hold = 0;
        return;
      }
      // the one stroke
      if (G.mode === "stun") {
        up("block");
        if (G.mt < 0.9) return moveTo(B.hx - 420, 40);
        up("left");
        up("right");
        down("heavy");
        return;
      }
      if (G.mode !== "fight") return;
      const x = sx(),
        grounded = F.y >= 0;
      // shards outrank everything except the blow already coming
      const sfx = safeX();
      const shardNear = B.sh.some((s) => !s.done && Math.abs(s.x - x) < 108);
      if (shardNear && sfx != null && st !== "bite" && S.react <= 0) {
        up("block");
        up("heavy");
        if (!moveTo(sfx, 12) && G.ink > 30 && Math.abs(sfx - x) > 150 && S.cd <= 0 && grounded) {
          tap("dash");
          S.cd = 0.5;
        }
        return;
      }
      switch (st) {
        case "biteTell": {
          up("heavy");
          up("left");
          up("right");
          if (S.react > 0) break;
          if (S.plan === "early" && B.t > B.tell * 0.35) down("block");
          if (S.plan === "dodge" && B.t > B.tell - 0.07 && !S.dashed && G.ink >= 9) {
            down("left");
            tap("dash");
            S.dashed = true;
          }
          if (S.plan === "slow") moveTo(x - 200);
          break;
        }
        case "bite": {
          if (S.plan === "parry" && B.t > 0.02) down("block");
          if (S.plan === "early") down("block");
          break;
        }
        case "rest": {
          up("block");
          if (S.react > 0) break;
          const hx = headX();
          if (hx < x + 30) {
            // it landed on top of her: step back out, then turn on it
            moveTo(hx - 190, 30);
            break;
          }
          if (!moveTo(hx - 195, 46)) break;
          up("left");
          up("right");
          if (S.cd > 0 || G.ink < 7) break;
          if (S.combo < 3) {
            tap("light");
            S.combo++;
            S.cd = 0.17 + R() * 0.07;
          } else if (G.ink >= 14 && !G.kActive) {
            down("heavy");
            S["rel_heavy"] = 0.24;
            S.combo = 0;
            S.cd = 0.75;
          }
          break;
        }
        case "wipeTell": {
          up("block");
          up("heavy");
          moveTo(Math.min(x, 900), 60);
          break;
        }
        case "wipe": {
          up("left");
          up("right");
          const lead = S.plan === "jump" ? 380 : 70;
          if (!S.jumped && B.wipeX - x < lead && grounded) {
            tap("jump");
            S.jumped = true;
          }
          break;
        }
        case "breathTell": {
          up("heavy");
          up("left");
          up("right");
          if (S.plan === "block" && S.react <= 0) down("block");
          break;
        }
        case "breath": {
          if (S.plan === "block") {
            down("block");
            break;
          }
          if (S.plan === "dash" && !S.dashed && B.gx > x && B.gx - x < 215 && G.ink >= 9 && grounded) {
            up("block");
            down("right");
            tap("dash");
            S.dashed = true;
          } else if (S.dashed && F.state !== "dash") up("right");
          break;
        }
        case "shardTell":
        case "shards": {
          up("block");
          up("heavy");
          if (sfx != null) moveTo(sfx, 14);
          else {
            up("left");
            up("right");
          }
          break;
        }
        case "hover": {
          up("block");
          if (S.react > 0) break;
          const hx = headX();
          if (G.ink < 16) {
            up("heavy");
            moveTo(hx - 520, 80);
            break;
          }
          if (S.off === "wave") {
            // stand off and throw ink
            if (!G.kActive && S.hold === 0) {
              if (!moveTo(K.clamp(hx - 560, 260, 900), 70)) break;
              up("left");
              up("right");
              if (G.ink >= 37 && grounded && S.cd <= 0) {
                down("heavy");
                S.hold = 0.001;
                S.holdFor = 0.62 + R() * 0.16;
              }
            } else {
              S.hold += dt;
              if (S.hold >= S.holdFor) {
                up("heavy");
                S.hold = 0;
                S.cd = 0.5;
                S.off = R() < 0.55 ? "jump" : "wave";
                if (G.ink < 50) S.off = "jump";
              }
            }
          } else {
            // go under it and cut upward
            up("heavy");
            if (grounded) {
              S.aired = false;
              if (!moveTo(hx - 150, 40)) break;
              up("left");
              up("right");
              if (S.cd <= 0 && G.ink >= 10) {
                tap("jump");
                S.cd = 0.2;
              }
            } else if (!S.aired && F.vy > -640) {
              tap("light");
              S.aired = true;
              S.cd = 0.34 + R() * 0.2;
              S.acts++;
              if (S.acts % 3 === 0 && G.ink > 60) S.off = "wave";
            }
          }
          break;
        }
      }
    },
  };
}
