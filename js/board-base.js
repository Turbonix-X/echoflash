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
      pads.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, r });
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
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      };
    });
    this.relayout();
  }

  relayout() {}

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
