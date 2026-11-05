// ===== Base commune des plateaux 2D et 3D : état animé des orbes =====
"use strict";

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgbCss = (c, alpha = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/*
  Place les orbes dans une zone W × H (centre = 0, 0).
  Jusqu'à 10 couleurs : un anneau. Au-delà : deux anneaux décalés.
*/
function layoutPads(n, W, H, unit = 1) {
  const base = Math.min(W, H);
  const margin = 14 * unit;
  const pads = [];
  const rings = [];
  const place = (count, rx, ry, r, start) => {
    for (let k = 0; k < count; k++) {
      const a = start + (k / count) * Math.PI * 2;
      pads.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, r, angle: a, rx, ry });
    }
    rings.push({ rx, ry });
  };

  if (n <= 10) {
    const r = Math.min(base * 0.15, Math.max(16 * unit, ((Math.PI * base * 0.37) / Math.max(n, 3)) * 0.68));
    const ry = H / 2 - r - margin - 6 * unit;
    const rx = Math.min(W / 2 - r - margin, ry * 1.5);
    place(n, rx, ry, r, n === 2 ? Math.PI : -Math.PI / 2);
    const coreR = Math.max(26 * unit, Math.min(Math.min(rx, ry) - r - 12 * unit, base * 0.16));
    return { pads, rings, coreR, r };
  }

  const outer = Math.ceil(n * 0.6);
  const inner = n - outer;
  const r = Math.min(base * 0.1, Math.max(15 * unit, ((Math.PI * base * 0.4) / outer) * 0.72));
  const ry = H / 2 - r - margin - 2 * unit;
  const rx = Math.min(W / 2 - r - margin, ry * 1.5);
  const ratio = 0.6;
  place(outer, rx, ry, r, -Math.PI / 2);
  place(inner, rx * ratio, ry * ratio, r, -Math.PI / 2 + Math.PI / inner);
  const coreR = Math.max(24 * unit, Math.min(rx * ratio, ry * ratio) - r - 7 * unit);
  return { pads, rings, coreR, r };
}

class BoardBase {
  constructor(host) {
    this.host = host;
    this.pads = [];
    this.keys = [];
    this.show = "all"; // all | hidden (éclipse) | mute (aveugle)
    this.core = {
      big: "▶",
      small: "lancer",
      progress: 0,
      drawn: 0,
      tint: [155, 109, 255],
      tintTo: [155, 109, 255],
      pulse: 0,
      idle: true,
    };
    this.energy = 0;
    this.shake = 0;
    this.timers = [];
    this.running = false;
    this.visible = true;
    this.colorsKey = "";
    this.slots = [];
    this.motion = { spin: false, swap: false, chaos: false };
    this.spinAngle = 0;
    this.spinSpeed = 0;
    this.spinDir = 1;
    this.swapIn = 0;
    this.reduced =matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.time = 0;
    this.lastFrame = 0;
    this._loop = this._loop.bind(this);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
        if (this.visible && this.running) this._kick();
      }).observe(host);
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.running) this._kick();
    });
  }

  // ----- Boucle d'animation -----
  start() {
    if (this.running) return;
    this.running = true;
    this.relayout();
    this._kick();
  }
  stop() { this.running = false; }
  _kick() {
    if (this.frame) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this._loop);
  }
  _loop(now) {
    this.frame = 0;
    if (!this.running || !this.visible || document.hidden) return;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this._update(dt, now);
    this.draw(dt, now);
    this.frame = requestAnimationFrame(this._loop);
  }

  // ----- Couleurs -----
  setColors(hexList, keys = []) {
    const key = hexList.join(",") + "|" + keys.join("");
    if (key === this.colorsKey) return;
    const sameCount = hexList.length === this.pads.length;
    this.colorsKey = key;
    this.keys = keys;
    this.pads = hexList.map((hex, i) => {
      const old = sameCount ? this.pads[i] : null;
      return {
        i,
        hex,
        rgb: hexToRgb(hex),
        x: 0, y: 0, r: 20,
        glow: 0, rel: 8, until: 0,
        lift: 0, liftV: 0,
        fall: old ? old.fall : 0, fallV: 0, fallen: old ? old.fallen : false,
        alpha: 1, mute: 0, mark: 0,
        appear: old ? 1 : 0, appearV: 0,
        appearAt: old ? 0 : performance.now() + 60 + i * 34,
        phase: i * 1.7,
        slot: i, slotFrom: i, swapT: 1, swapDur: 0.6,
        ox: 0, oy: 0, cx: 0, cy: 0, dir: 0,
      };
    });
    this.relayout();
  }

  relayout() {}

  // Reçoit les emplacements calculés par layoutPads
  setSlots(slots) {
    this.slots = slots;
    if (this.motion.spin || this.motion.swap || this.motion.chaos) return;
    this.pads.forEach((p) => {
      const s = slots[p.slot];
      p.ox = Math.cos(s.angle + this.spinAngle) * s.rx;
      p.oy = Math.sin(s.angle + this.spinAngle) * s.ry;
      this.place(p, p.ox, p.oy);
    });
  }

  // Pose une orbe dans le repère du plateau (centre = 0, 0)
  place() {}

  // ----- Plateau tournant, échanges, pagaille -----
  setMotion(flags) {
    const was = this.motion;
    const next = {
      spin: !!(flags && flags.spin),
      swap: !!(flags && flags.swap),
      chaos: !!(flags && flags.chaos),
    };
    this.motion = next;
    if (next.spin && !was.spin) this.spinDir = Math.random() < 0.5 ? -1 : 1;
    if (next.swap && !was.swap) this.swapIn = 0.8;
    if (next.chaos && !was.chaos) {
      this.pads.forEach((p) => {
        p.cx = p.ox;
        p.cy = p.oy;
        p.dir = Math.random() * Math.PI * 2;
      });
    }
    if (was.swap && !next.swap) {
      // Chaque orbe retourne à sa place d'origine
      this.pads.forEach((p) => {
        p.slotFrom = p.slot;
        p.slot = p.i;
        p.swapT = p.slotFrom === p.slot ? 1 : 0;
        p.swapDur = 0.7;
      });
    }
  }

  _startSwaps() {
    const free = this.pads.filter((p) => p.swapT >= 1);
    const pairs = this.pads.length >= 12 ? 2 : 1;
    for (let k = 0; k < pairs && free.length >= 2; k++) {
      const a = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      const b = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      a.slotFrom = a.slot;
      b.slotFrom = b.slot;
      a.slot = b.slotFrom;
      b.slot = a.slotFrom;
      a.swapT = b.swapT = 0;
      a.swapDur = b.swapDur = 0.6;
    }
  }

  // Pagaille : les orbes filent dans tous les sens, rebondissent sur le bord, le centre et entre elles
  _moveChaos(dt) {
    const { rx, ry } = this.slots[0];
    const speed = Math.min(rx, ry) * 0.55;
    const coreR = this.layout.coreR;
    const pads = this.pads;
    // Quand il y a beaucoup d'orbes, elles peuvent se chevaucher un peu : sinon elles se coincent
    const padR = pads[0].r;
    const room = Math.PI * (rx * ry - coreR * coreR);
    const spacing = Math.min(1.06, Math.sqrt((0.38 * room) / (pads.length * Math.PI * padR * padR)));
    const bounce = (p, nx, ny) => {
      const vx = Math.cos(p.dir);
      const vy = Math.sin(p.dir);
      const dot = vx * nx + vy * ny;
      if (dot > 0) p.dir = Math.atan2(vy - 2 * dot * ny, vx - 2 * dot * nx);
    };
    for (const p of pads) {
      p.dir += (Math.random() - 0.5) * dt * 7;
      p.cx += Math.cos(p.dir) * speed * dt;
      p.cy += Math.sin(p.dir) * speed * dt;

      const e = (p.cx * p.cx) / (rx * rx) + (p.cy * p.cy) / (ry * ry);
      if (e > 1) {
        const s = 1 / Math.sqrt(e);
        p.cx *= s;
        p.cy *= s;
        const nx = p.cx / (rx * rx);
        const ny = p.cy / (ry * ry);
        const len = Math.hypot(nx, ny) || 1;
        bounce(p, nx / len, ny / len);
      }

      const dist = Math.hypot(p.cx, p.cy) || 0.001;
      const minCore = coreR + p.r + coreR * 0.1;
      if (dist < minCore) {
        p.cx *= minCore / dist;
        p.cy *= minCore / dist;
        bounce(p, -p.cx / minCore, -p.cy / minCore);
      }
    }
    for (let a = 0; a < pads.length; a++) {
      for (let b = a + 1; b < pads.length; b++) {
        const pa = pads[a];
        const pb = pads[b];
        const dx = pb.cx - pa.cx;
        const dy = pb.cy - pa.cy;
        const d = Math.hypot(dx, dy) || 0.001;
        const min = (pa.r + pb.r) * spacing;
        if (d >= min) continue;
        const nx = dx / d;
        const ny = dy / d;
        const push = (min - d) / 2;
        pa.cx -= nx * push;
        pa.cy -= ny * push;
        pb.cx += nx * push;
        pb.cy += ny * push;
        bounce(pa, nx, ny);
        bounce(pb, -nx, -ny);
      }
    }
  }

  _updateMotion(dt) {
    const m = this.motion;
    const slots = this.slots;
    if (!slots.length || slots.length !== this.pads.length) return;

    if (m.spin) {
      this.spinSpeed += (this.spinDir * 0.5 - this.spinSpeed) * (1 - Math.exp(-dt * 2.5));
      this.spinAngle += this.spinSpeed * dt;
    } else if (this.spinAngle) {
      // Retour à la position de départ par le chemin le plus court
      this.spinSpeed = 0;
      this.spinAngle = Math.atan2(Math.sin(this.spinAngle), Math.cos(this.spinAngle)) * Math.exp(-dt * 3.5);
      if (Math.abs(this.spinAngle) < 0.001) this.spinAngle = 0;
    }

    if (m.swap) {
      this.swapIn -= dt;
      if (this.swapIn <= 0) {
        this._startSwaps();
        this.swapIn = 1.1 + Math.random() * 0.9;
      }
    }
    if (m.chaos) this._moveChaos(dt);

    const moving = m.spin || m.swap || m.chaos;
    const smooth = 1 - Math.exp(-dt * (moving ? 18 : 5));
    for (const p of this.pads) {
      let tx;
      let ty;
      if (m.chaos) {
        tx = p.cx;
        ty = p.cy;
      } else {
        const to = slots[p.slot];
        tx = Math.cos(to.angle + this.spinAngle) * to.rx;
        ty = Math.sin(to.angle + this.spinAngle) * to.ry;
        if (p.swapT < 1) {
          p.swapT = Math.min(1, p.swapT + dt / p.swapDur);
          const from = slots[p.slotFrom];
          const fx = Math.cos(from.angle + this.spinAngle) * from.rx;
          const fy = Math.sin(from.angle + this.spinAngle) * from.ry;
          const t = p.swapT * p.swapT * (3 - 2 * p.swapT);
          const arc = Math.sin(Math.PI * t) * 0.28;
          // Les deux orbes passent chacune d'un côté, sans se traverser
          const dx = tx - fx;
          const dy = ty - fy;
          tx = fx + dx * t - dy * arc;
          ty = fy + dy * t + dx * arc;
        }
      }
      p.ox += (tx - p.ox) * smooth;
      p.oy += (ty - p.oy) * smooth;
      this.place(p, p.ox, p.oy);
    }
  }

  // ----- Actions du jeu -----
  setShow(mode) { this.show = mode; }

  setCore(values) {
    Object.assign(this.core, values);
    this.coreChanged();
  }
  coreChanged() {}

  // Allume une orbe. fast = démonstration très rapide (moins de particules)
  flash(i, ms, { strength = 1 } = {}) {
    const p = this.pads[i];
    if (!p) return;
    const now = performance.now();
    p.until = now + ms;
    p.glow = Math.max(p.glow, 0.85);
    p.rel = Math.max(6, Math.min(34, 2600 / Math.max(ms, 30)));
    p.liftV += 5.5 * strength;
    this.core.tintTo = p.rgb;
    this.core.pulse = 1;
    if (!this.reduced) this.onFlash(p, ms, strength);
  }
  onFlash() {}

  // Mode aveugle : le centre pulse, aucune couleur
  ping(ms) {
    this.core.tintTo = WHITE;
    this.core.pulse = 1;
    this.onPing(ms);
  }
  onPing() {}

  // Tour d'honneur : les orbes s'allument à la suite
  chase(duration = 520) {
    const n = this.pads.length;
    this.pads.forEach((p, k) => {
      this.schedule((k / n) * duration, () => this.flash(p.i, 150, { strength: 0.6 }));
    });
  }

  wrong(i, expected) {
    this.shake = 1;
    const p = this.pads[i];
    if (p) {
      p.until = performance.now() + 420;
      p.glow = 1;
      p.rel = 6;
      this.onWrong(p);
    }
    const e = this.pads[expected];
    if (e) e.mark = 1;
    this.core.tintTo = [255, 77, 109];
    this.core.pulse = 1;
  }
  onWrong() {}

  celebrate(level = 1) { this.onCelebrate(level); }
  onCelebrate() {}

  // Fin de partie : les orbes tombent puis restent éteintes
  collapse() {
    this.pads.forEach((p, k) => {
      this.schedule(k * 45 + Math.random() * 60, () => { p.fallen = true; });
    });
    this.core.tintTo = [120, 110, 150];
  }
  assemble() {
    this.timers = [];
    this.pads.forEach((p, k) => {
      this.schedule(k * 30, () => { p.fallen = false; });
    });
    this.core.tintTo = [155, 109, 255];
  }

  schedule(delay, fn) { this.timers.push({ at: performance.now() + delay, fn }); }

  // Index de l'orbe sous le pointeur, -2 pour le centre, -1 pour rien
  pick() { return -1; }

  // ----- Mise à jour de tous les états -----
  _update(dt, now) {
    if (this.timers.length) {
      const pending = [];
      const due = [];
      for (const t of this.timers) (t.at <= now ? due : pending).push(t);
      this.timers = pending;
      for (const t of due) t.fn();
    }

    this._updateMotion(dt);

    let energy = 0;
    for (const p of this.pads) {
      const lit = now < p.until;
      if (lit) p.glow += (1 - p.glow) * (1 - Math.exp(-dt * 50));
      else p.glow *= Math.exp(-dt * p.rel);
      energy = Math.max(energy, p.glow);

      const alphaTo = this.show === "hidden" ? (lit || p.glow > 0.06 ? 1 : 0) : p.fallen ? 0.6 : 1;
      p.alpha += (alphaTo - p.alpha) * (1 - Math.exp(-dt * (alphaTo > p.alpha ? 50 : 9)));

      const muteTo = this.show === "mute" ? 1 : p.fallen ? 0.6 : 0;
      p.mute += (muteTo - p.mute) * (1 - Math.exp(-dt * 8));

      // Ressort du saut quand l'orbe s'allume
      p.liftV += (-190 * p.lift - 15 * p.liftV) * dt;
      p.lift += p.liftV * dt;

      // Ressort de la chute : peu amorti, pour que les orbes rebondissent
      const fallTo = p.fallen ? 1 : 0;
      p.fallV += (70 * (fallTo - p.fall) - (p.fallen ? 5 : 13) * p.fallV) * dt;
      p.fall += p.fallV * dt;

      // Apparition
      if (now >= p.appearAt) {
        p.appearV += (150 * (1 - p.appear) - 13 * p.appearV) * dt;
        p.appear += p.appearV * dt;
      }

      p.mark *= Math.exp(-dt * 1.1);
      if (p.mark < 0.01) p.mark = 0;
    }
    this.energy += (energy - this.energy) * (1 - Math.exp(-dt * 10));

    const c = this.core;
    c.tint = mixRgb(c.tint, c.tintTo, 1 - Math.exp(-dt * 9));
    c.pulse *= Math.exp(-dt * 5);
    c.drawn += (c.progress - c.drawn) * (1 - Math.exp(-dt * 16));
    this.shake *= Math.exp(-dt * 6);
    if (this.shake < 0.004) this.shake = 0;
  }
}
