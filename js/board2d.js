// ===== Plateau 2D : orbes de verre dessinées sur un canvas =====
"use strict";

class Board2D extends BoardBase {
  constructor(host) {
    super(host);
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    host.appendChild(this.canvas);
    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.layout = { pads: [], rings: [], coreR: 40, r: 30 };

    // Réserves d'objets réutilisés : rien n'est recréé, même après 1000 couleurs
    this.sparks = Array.from({ length: 280 }, () => ({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, size: 2, css: "#fff", g: 0 }));
    this.sparkAt = 0;
    this.waves = Array.from({ length: 28 }, () => ({ life: 0, max: 1, x: 0, y: 0, from: 0, to: 0, css: "#fff", width: 2 }));
    this.waveAt = 0;
    this.dust = Array.from({ length: 64 }, () => ({
      x: Math.random(), y: Math.random(),
      s: 0.5 + Math.random() * 1.5,
      v: 0.006 + Math.random() * 0.018,
      tw: Math.random() * 6.28,
      c: Math.random() < 0.5 ? "255,214,10" : "201,176,255",
    }));

    this.resizeObs = new ResizeObserver(() => this.relayout());
    this.resizeObs.observe(host);
    this.coreGlow = this._radial([255, 255, 255]);
  }

  relayout() {
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    if (!W || !H) return;
    this.W = W;
    this.H = H;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.layout = layoutPads(this.pads.length || 4, W, H - 30, 1);
    this.cx = W / 2;
    this.cy = H / 2 + 14;
    this.pads.forEach((p, i) => {
      const at = this.layout.pads[i];
      p.r = at.r;
      p.orb =this._makeOrb(p.rgb, p.r, false);
      p.gray = this._makeOrb([104, 100, 124], p.r, true);
      p.halo = this._radial(p.rgb);
      p.css = rgbCss(p.rgb);
    });
    this.setSlots(this.layout.pads);
  }

  place(p, x, y) {
    p.x = this.cx + x;
    p.y = this.cy + y;
  }

  // ----- Images préparées à l'avance (dessiner une image coûte très peu) -----
  _radial(rgb) {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgbCss(rgb, 0.95));
    grad.addColorStop(0.28, rgbCss(rgb, 0.5));
    grad.addColorStop(0.6, rgbCss(rgb, 0.13));
    grad.addColorStop(1, rgbCss(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  _makeOrb(rgb, r, flat) {
    const scale = this.dpr;
    const R = r * scale;
    const size = Math.ceil(R * 2.3);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const cx = size / 2;
    const cy = size / 2;

    // Corps de la sphère, éclairé en haut à gauche
    const body = g.createRadialGradient(cx - R * 0.36, cy - R * 0.44, R * 0.04, cx, cy, R);
    body.addColorStop(0, rgbCss(mixRgb(rgb, WHITE, 0.62)));
    body.addColorStop(0.32, rgbCss(mixRgb(rgb, WHITE, 0.12)));
    body.addColorStop(0.66, rgbCss(rgb));
    body.addColorStop(0.9, rgbCss(mixRgb(rgb, BLACK, 0.42)));
    body.addColorStop(1, rgbCss(mixRgb(rgb, BLACK, 0.66)));
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();

    if (!flat) {
      // Lumière qui traverse le verre, en bas à droite
      g.save();
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.clip();
      g.globalCompositeOperation = "lighter";
      const glass = g.createRadialGradient(cx + R * 0.32, cy + R * 0.56, 0, cx + R * 0.32, cy + R * 0.56, R * 0.78);
      glass.addColorStop(0, rgbCss(mixRgb(rgb, WHITE, 0.45), 0.72));
      glass.addColorStop(1, rgbCss(rgb, 0));
      g.fillStyle = glass;
      g.fillRect(0, 0, size, size);
      g.restore();
    }

    // Reflet principal
    g.save();
    g.translate(cx - R * 0.32, cy - R * 0.5);
    g.rotate(-0.5);
    g.scale(1, 0.56);
    const spec = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.38);
    spec.addColorStop(0, `rgba(255,255,255,${flat ? 0.35 : 0.92})`);
    spec.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = spec;
    g.beginPath();
    g.arc(0, 0, R * 0.38, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Fin liseré
    g.strokeStyle = "rgba(255,255,255,0.3)";
    g.lineWidth = Math.max(1, scale);
    g.beginPath();
    g.arc(cx, cy, R - g.lineWidth / 2, 0, Math.PI * 2);
    g.stroke();
    return c;
  }

  // ----- Effets -----
  _wave(x, y, from, to, css, life, width) {
    const w = this.waves[this.waveAt++ % this.waves.length];
    Object.assign(w, { x, y, from, to, css, life, max: life, width });
  }

  _sparks(x, y, count, css, speed = 150, g = 150) {
    if (this.reduced) return;
    for (let k = 0; k < count; k++) {
      const s = this.sparks[this.sparkAt++ % this.sparks.length];
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      s.x = x;
      s.y = y;
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.life = s.max = 0.45 + Math.random() * 0.55;
      s.size = 1 + Math.random() * 2.4;
      s.css = css;
      s.g = g;
    }
  }

  onFlash(p, ms, strength) {
    const quick = ms < 120;
    this._wave(p.x, p.y, p.r * 0.9, p.r * 2.5, p.css, quick ? 0.35 : 0.65, 3);
    this._sparks(p.x, p.y, Math.round((quick ? 5 : 15) * strength), p.css);
  }

  onPing() {
    this._wave(this.cx, this.cy, this.layout.coreR, this.layout.coreR * 2.2, "rgba(255,255,255,.75)", 0.55, 2);
  }

  onWrong(p) {
    this._wave(p.x, p.y, p.r, p.r * 3.4, "#ff4d6d", 0.7, 5);
    this._sparks(p.x, p.y, 34, "#ff4d6d", 230, 280);
  }

  onCelebrate(level) {
    this._wave(this.cx, this.cy, this.layout.coreR, Math.max(this.W, this.H) * 0.7, "#ffd60a", 0.9, 4);
    if (level > 1) {
      this._wave(this.cx, this.cy, this.layout.coreR, Math.max(this.W, this.H) * 0.5, "#9b6dff", 1.1, 3);
      const bursts = level > 2 ? 6 : 3;
      for (let k = 0; k < bursts; k++) {
        this.schedule(k * 260, () => {
          const x = this.W * (0.15 + Math.random() * 0.7);
          const y = this.H * (0.18 + Math.random() * 0.55);
          const css = ["#ffd60a", "#9b6dff", "#ffffff", "#c4a8ff"][k % 4];
          this._wave(x, y, 4, 80, css, 0.6, 3);
          this._sparks(x, y, 42, css, 260, 170);
        });
      }
    }
  }

  // ----- Pointeur -----
  pick(x, y) {
    let best = -1;
    let bestD = Infinity;
    for (const p of this.pads) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < p.r * 1.14 && d < bestD) { best = p.i; bestD = d; }
    }
    if (best >= 0) return best;
    if (Math.hypot(x - this.cx, y - this.cy) < this.layout.coreR) return -2;
    return -1;
  }

  // ----- Dessin -----
  draw(dt) {
    const g = this.ctx;
    const { W, H, dpr, cx, cy, time } = this;
    if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    if (this.shake) {
      const a = this.shake * 9;
      g.translate(Math.sin(time * 71) * a, Math.cos(time * 57) * a);
    }

    this._drawDust(g, dt);
    this._drawRings(g);
    this._drawBeams(g);
    this._drawWaves(g, dt);
    this._drawCore(g);
    for (const p of this.pads) this._drawPad(g, p);
    this._drawSparks(g, dt);
  }

  _drawDust(g, dt) {
    if (this.reduced) return;
    const { W, H, time } = this;
    g.globalCompositeOperation = "lighter";
    for (const d of this.dust) {
      d.y -= d.v * dt * (1 + this.energy * 2);
      if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
      const twinkle = 0.25 + 0.3 * Math.sin(time * 1.4 + d.tw) ** 2;
      g.fillStyle = `rgba(${d.c},${twinkle})`;
      g.beginPath();
      g.arc(d.x * W, d.y * H, d.s, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  _drawRings(g) {
    const { cx, cy, time } = this;
    const spin = this.reduced ? 0 : time;
    this.layout.rings.forEach((ring, k) => {
      g.beginPath();
      g.ellipse(cx, cy, ring.rx, ring.ry, 0, 0, Math.PI * 2);
      g.setLineDash([2, 11]);
      g.lineDashOffset = (k % 2 ? 1 : -1) * spin * 14;
      g.lineWidth = 1.6;
      g.strokeStyle = k % 2 ? "rgba(255,214,10,0.34)" : "rgba(196,168,255,0.42)";
      g.stroke();
    });
    g.setLineDash([]);
  }

  _drawBeams(g) {
    const { cx, cy, time } = this;
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (const p of this.pads) {
      const strength = p.glow * (1 - p.mute) * p.alpha;
      if (strength < 0.04) continue;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const bend = Math.sin(time * 9 + p.phase) * 10;
      const mx = cx + dx * 0.5 - (dy / (Math.hypot(dx, dy) || 1)) * bend;
      const my = cy + dy * 0.5 + (dx / (Math.hypot(dx, dy) || 1)) * bend;
      const grad = g.createLinearGradient(cx, cy, p.x, p.y);
      grad.addColorStop(0, rgbCss(mixRgb(p.rgb, WHITE, 0.5), 0.08 * strength));
      grad.addColorStop(1, rgbCss(mixRgb(p.rgb, WHITE, 0.25), 0.85 * strength));
      g.strokeStyle = grad;
      g.lineWidth = p.r * 0.34 * strength;
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo(mx, my, p.x, p.y);
      g.stroke();
      g.lineWidth = 1.5;
      g.strokeStyle = `rgba(255,255,255,${0.75 * strength})`;
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  }

  _drawWaves(g, dt) {
    g.globalCompositeOperation = "lighter";
    for (const w of this.waves) {
      if (w.life <= 0) continue;
      w.life -= dt;
      const t = Math.max(0, 1 - w.life / w.max);
      const eased = 1 - (1 - t) ** 3;
      g.globalAlpha = (1 - t) * 0.85;
      g.strokeStyle = w.css;
      g.lineWidth = w.width * (1 - t) + 0.5;
      g.beginPath();
      g.arc(w.x, w.y, w.from + (w.to - w.from) * eased, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  _drawSparks(g, dt) {
    if (this.reduced) return;
    g.globalCompositeOperation = "lighter";
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vy += s.g * dt;
      s.vx *= 1 - 1.4 * dt;
      s.vy *= 1 - 1.4 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const t = Math.max(0, s.life / s.max);
      g.globalAlpha = t;
      g.fillStyle = s.css;
      g.beginPath();
      g.arc(s.x, s.y, s.size * (0.4 + t * 0.6), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  _drawCore(g) {
    const { cx, cy } = this;
    const c = this.core;
    const R = this.layout.coreR * (1 + c.pulse * 0.06);

    // Halo
    const halo = R * (2.6 + c.pulse * 1.3);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.24 + c.pulse * 0.42;
    g.drawImage(this._coreHalo(c.tint), cx - halo, cy - halo, halo * 2, halo * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // Disque de verre sombre
    const disc = g.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
    disc.addColorStop(0, "#3b2d5e");
    disc.addColorStop(0.7, "#191327");
    disc.addColorStop(1, "#0d0a15");
    g.fillStyle = disc;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = rgbCss(mixRgb(c.tint, WHITE, 0.2), 0.75);
    g.stroke();

    // Arc de progression jaune → mauve
    if (c.drawn > 0.002) {
      const a0 = -Math.PI / 2;
      const grad = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      grad.addColorStop(0, "#ffd60a");
      grad.addColorStop(1, "#9b6dff");
      g.strokeStyle = grad;
      g.lineWidth = Math.max(3, R * 0.09);
      g.lineCap = "round";
      g.beginPath();
      g.arc(cx, cy, R - g.lineWidth - 1, a0, a0 + Math.min(1, c.drawn) * Math.PI * 2);
      g.stroke();
    }

    // Texte
    g.textAlign = "center";
    g.textBaseline = "middle";
    const big = String(c.big);
    let size = R * (big.length <= 2 ? 0.78 : big.length === 3 ? 0.62 : big.length === 4 ? 0.5 : 0.4);
    g.font = `900 ${size}px Outfit, "Segoe UI", sans-serif`;
    g.fillStyle = "#ffffff";
    g.fillText(big, cx, cy - (c.small ? R * 0.1 : 0));
    if (c.small) {
      g.font = `700 ${Math.max(9, R * 0.21)}px Outfit, "Segoe UI", sans-serif`;
      g.fillStyle = "#c9b0ff";
      g.fillText(c.small, cx, cy + R * 0.42);
    }
  }

  _coreHalo(tint) {
    // Le halo du centre change de teinte : on l'obtient en recolorant une image préparée
    const key = `${(tint[0] / 16) | 0}-${(tint[1] / 16) | 0}-${(tint[2] / 16) | 0}`;
    if (key !== this._haloKey) {
      this._haloKey = key;
      this._haloImg = this._radial(tint);
    }
    return this._haloImg;
  }

  _drawPad(g, p) {
    if (p.appear < 0.01 || p.alpha < 0.01 || !p.orb) return;
    const floats = this.reduced ? 0 : Math.sin(this.time * 1.25 + p.phase) * 3 * (1 - p.fall);
    const fallY = Math.max(0, this.H - p.r - 8 - p.y);
    const x = p.x;
    const y = p.y + floats - p.lift * 16 + p.fall * fallY;
    const scale = Math.max(0, p.appear) * (1 + p.glow * 0.17 + p.lift * 0.1);
    const r = p.r * scale;
    const colorOn = 1 - p.mute;

    g.globalAlpha = p.alpha;

    // Ombre portée douce
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(x, y + r * 1.08, r * 0.74, r * 0.16, 0, 0, Math.PI * 2);
    g.fill();

    // Halo permanent (faible) et halo d'allumage (fort)
    const glow = p.glow * colorOn;
    if (colorOn > 0.02) {
      g.globalCompositeOperation = "lighter";
      const haloR = r * (1.65 + glow * 2.2);
      g.globalAlpha = p.alpha * colorOn * (0.2 + glow * 0.8);
      g.drawImage(p.halo, x - haloR, y - haloR, haloR * 2, haloR * 2);
      g.globalCompositeOperation = "source-over";
    }

    // La sphère, couleur et gris en fondu
    const d = r * 2.3;
    if (colorOn > 0.01) {
      g.globalAlpha = p.alpha * Math.min(1, colorOn * 1.4);
      g.drawImage(p.orb, x - d / 2, y - d / 2, d, d);
    }
    if (p.mute > 0.01) {
      g.globalAlpha = p.alpha * p.mute;
      g.drawImage(p.gray, x - d / 2, y - d / 2, d, d);
    }

    // Cœur brûlant quand elle est allumée
    if (glow > 0.02) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = p.alpha * glow * 0.85;
      const hot = r * 1.15;
      g.drawImage(p.halo, x - hot, y - hot, hot * 2, hot * 2);
      g.globalAlpha = p.alpha * glow * 0.55;
      const white = r * 0.8;
      g.drawImage(this.coreGlow, x - white, y - white, white * 2, white * 2);
      g.globalCompositeOperation = "source-over";
    }

    // Anneau blanc : « c'était celle-ci » après une erreur
    if (p.mark > 0) {
      const beat = 0.5 + 0.5 * Math.sin(this.time * 14);
      g.globalAlpha = Math.min(1, p.mark * 1.5);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, r * (1.14 + beat * 0.18), 0, Math.PI * 2);
      g.stroke();
    }

    // Touche du clavier
    const key = this.keys[p.i];
    if (key && colorOn > 0.5 && p.r >= 20) {
      g.globalAlpha = p.alpha * 0.85;
      g.font = `800 ${Math.max(10, p.r * 0.4)}px Outfit, "Segoe UI", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 3;
      g.strokeStyle = "rgba(0,0,0,0.45)";
      g.strokeText(key, x, y + 1);
      g.fillStyle = "#ffffff";
      g.fillText(key, x, y + 1);
    }
    g.globalAlpha = 1;
  }
}
