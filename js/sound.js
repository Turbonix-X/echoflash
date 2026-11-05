// ===== Sons (générés en direct, aucun fichier audio) et vibrations =====
"use strict";

const Sound = (() => {
  let ctx = null;
  let master = null;
  let send = null;
  let enabled = true;
  let freqs = [];

  // Gamme pentatonique sur 4 octaves : toutes les notes sonnent bien ensemble
  const SCALE = [];
  for (let oct = 0; oct < 4; oct++) {
    for (const semi of [0, 2, 4, 7, 9]) SCALE.push(196 * Math.pow(2, oct + semi / 12));
  }

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(comp).connect(ctx.destination);
      // Petit écho pour donner de l'espace aux notes
      send = ctx.createGain();
      send.gain.value = 0.22;
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.19;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.3;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 2600;
      send.connect(delay).connect(tone).connect(feedback).connect(delay);
      tone.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, { when = 0, dur = 0.4, peak = 0.3, type = "sine", attack = 0.006, wet = true, slideTo = 0 } = {}) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + when;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    g.connect(master);
    if (wet) g.connect(send);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + attack + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + attack + dur + 0.03);
    // Libère les nœuds audio : le coût reste le même, même après des milliers de notes
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  // Répartit les notes selon le nombre de couleurs : plus elles sont peu nombreuses, plus elles sont espacées
  function setColors(n) {
    const span = Math.min(SCALE.length - 1, (n - 1) * 3);
    const offset = Math.floor((SCALE.length - 1 - span) / 2);
    freqs = [];
    for (let i = 0; i < n; i++) {
      const at = n > 1 ? offset + Math.round((i * span) / (n - 1)) : offset;
      freqs.push(SCALE[at]);
    }
  }

  // La note d'une couleur : son de cloche de verre
  function note(i, dur = 0.4) {
    const f = freqs[i] || 440;
    const d = Math.max(0.09, Math.min(0.9, dur));
    tone(f, { dur: d, peak: 0.34 });
    tone(f * 2, { dur: d * 0.6, peak: 0.1 });
    tone(f * 3.01, { dur: d * 0.28, peak: 0.045, type: "triangle" });
  }

  function click() { tone(880, { dur: 0.05, peak: 0.08, wet: false }); }

  function ping() { tone(1320, { dur: 0.12, peak: 0.05, type: "triangle" }); }

  function start() {
    [392, 523.25, 783.99].forEach((f, k) => tone(f, { when: k * 0.08, dur: 0.3, peak: 0.16 }));
  }

  // Do, mi, sol aigus : suite réussie
  function success() {
    [1046.5, 1318.5, 1568].forEach((f, k) => tone(f, { when: k * 0.07, dur: 0.28, peak: 0.13 }));
  }

  function turn() {
    tone(659.25, { dur: 0.25, peak: 0.16 });
    tone(987.77, { when: 0.13, dur: 0.4, peak: 0.16 });
  }

  function wrong() {
    tone(220, { dur: 0.42, peak: 0.2, type: "sawtooth", slideTo: 70, wet: false });
    tone(233, { dur: 0.42, peak: 0.14, type: "square", slideTo: 62, wet: false });
  }

  function gameOver() {
    [392, 329.63, 261.63, 196].forEach((f, k) => tone(f, { when: k * 0.17, dur: 0.5, peak: 0.2, type: "triangle" }));
  }

  function fanfare() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, k) => {
      tone(f, { when: k * 0.11, dur: 0.34, peak: 0.16 });
      tone(f / 2, { when: k * 0.11, dur: 0.3, peak: 0.07, type: "triangle" });
    });
  }

  return {
    note, click, ping, start, success, turn, wrong, gameOver, fanfare, setColors,
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },
  };
})();

const Haptics = (() => {
  let enabled = true;
  const supported = "vibrate" in navigator;
  return {
    supported,
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },
    vibrate(pattern) {
      // Chrome refuse la vibration tant que l'utilisateur n'a pas touché la page
      const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (enabled && supported && active) {
        try { navigator.vibrate(pattern); } catch (e) { /* vibration indisponible */ }
      }
    },
  };
})();
