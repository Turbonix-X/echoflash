// ===== Règles du jeu (aucun affichage ici, aucun minuteur) =====
"use strict";

// Hasard : crypto.getRandomValues, lu par paquets, sans biais de modulo
const RNG = (() => {
  const buf = new Uint32Array(1024);
  let k = buf.length;
  const next = () => {
    if (k >= buf.length) { crypto.getRandomValues(buf); k = 0; }
    return buf[k++];
  };
  return {
    int(n) {
      const limit = Math.floor(0x100000000 / n) * n;
      let v;
      do { v = next(); } while (v >= limit);
      return v % n;
    },
    float() { return next() / 0x100000000; },
  };
})();

// Suite de couleurs : un octet par couleur, capacité doublée au besoin.
// Lire une valeur ou en ajouter une prend le même temps à 10 ou à 1 000 000 de couleurs.
class Sequence {
  constructor(capacity = 64) {
    this.data = new Uint8Array(capacity);
    this.length = 0;
  }
  push(v) {
    if (this.length === this.data.length) {
      const bigger = new Uint8Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    this.data[this.length++] = v;
  }
  at(i) { return this.data[i]; }
  clear() { this.length = 0; }
}

/*
  Une partie passe par ces phases :
    demo  : le site montre la suite
    input : le joueur la refait
    add   : (mode Piège) le joueur ajoute sa couleur
    over  : terminé

  Réglages (cfg) :
    colors    nombre de couleurs
    players   "solo" | "turns" | "trap"
    shuffle   nouvelle suite entière à chaque manche
    once      la suite de départ n'est montrée qu'une fois
    sudden    une seule vie (solo)
    startLen  longueur de départ
    grow      en Mélange : allonger de 1 à chaque manche
    lives     vies en solo
*/
class GameEngine {
  constructor(cfg, randInt = RNG.int) {
    this.cfg = cfg;
    this.randInt = randInt;
    this.seq = new Sequence();
    this.phase = "idle";
    this.round = 0;
    this.player = 0;
    this.pos = 0;
    this.demoFrom = 0;
    this.retry = false;
    this.lives = 1;
    this.completed = 0;
    this.best = 0;
    this.good = 0;
    this.errors = 0;
    this.winner = null;
    this.missed = [];
  }

  get versus() { return this.cfg.players !== "solo"; }

  // Score affiché : nombre de suites réussies en Mélange à longueur fixe, plus longue suite sinon
  get score() {
    return this.cfg.shuffle && !this.cfg.grow && !this.versus ? this.completed : this.best;
  }

  start() {
    this.seq.clear();
    this.round = 1;
    this.player = 0;
    this.pos = 0;
    this.demoFrom = 0;
    this.retry = false;
    this.lives = this.versus ? 1 : this.cfg.sudden ? 1 : this.cfg.lives;
    this.completed = 0;
    this.best = 0;
    this.good = 0;
    this.errors = 0;
    this.winner = null;
    this.missed = [];
    if (this.cfg.players === "trap") {
      this.phase = "add"; // La suite part de zéro : le joueur 1 choisit la première couleur
    } else {
      this._addRandom(this.cfg.startLen);
      this.phase = "demo";
    }
  }

  // Les couleurs à montrer : [début, fin[
  demoRange() {
    const len = this.seq.length;
    // Une seule fois : après une faute à la première manche, la suite de base n'est pas remontrée
    if (this.cfg.once && this.retry && this.round === 1) return [len, len];
    return [this.demoFrom, len];
  }

  demoDone() {
    if (this.phase !== "demo") return;
    this.phase = "input";
    this.pos = 0;
  }

  press(color) {
    if (this.phase === "input") return this._pressInput(color);
    if (this.phase === "add") return this._pressAdd(color);
    return null;
  }

  abandon() { this.phase = "over"; }

  // Temps limité : le temps de départ, plus timeAdd secondes par manche déjà passée
  timeLimit() {
    return this.cfg.timeStart + this.cfg.timeAdd * (this.round - 1);
  }

  // Le temps est écoulé : ça compte comme une faute
  timeUp() {
    if (this.phase !== "input") return null;
    const ev = this._wrong(-1, this.seq.at(this.pos));
    ev.timeout = true;
    return ev;
  }

  _pressInput(color) {
    const expected = this.seq.at(this.pos);
    if (color !== expected) return this._wrong(color, expected);
    this.good++;
    this.pos++;
    if (this.pos < this.seq.length) return { type: "good", pos: this.pos, len: this.seq.length };

    // Suite terminée
    const len = this.seq.length;
    this.best = Math.max(this.best, len);
    this.retry = false;

    if (this.cfg.players === "trap") {
      this.phase = "add";
      return { type: "complete", next: "add", len };
    }
    if (this.cfg.players === "turns" && this.player === 0) {
      this.player = 1;
      this.pos = 0;
      this.phase = "demo";
      return { type: "complete", next: "pass", len };
    }
    this._nextRound();
    return { type: "complete", next: "round", len };
  }

  _pressAdd(color) {
    this.seq.push(color);
    const len = this.seq.length;
    this.round = len;
    this.demoFrom = this.cfg.once ? len - 1 : 0;
    this.player = 1 - this.player;
    this.pos = 0;
    this.phase = "demo";
    return { type: "added", color, len };
  }

  _wrong(color, expected) {
    this.errors++;
    this.missed.push(expected);
    if (this.versus) {
      this.winner = 1 - this.player;
      this.phase = "over";
      return { type: "wrong", color, expected, over: true, winner: this.winner, lives: 0 };
    }
    this.lives--;
    if (this.lives <= 0) {
      this.phase = "over";
      return { type: "wrong", color, expected, over: true, winner: null, lives: 0 };
    }
    this.pos = 0;
    this.retry = true;
    this.phase = "demo";
    return { type: "wrong", color, expected, over: false, winner: null, lives: this.lives };
  }

  _nextRound() {
    this.completed++;
    this.round++;
    this.player = 0;
    this.pos = 0;
    this.phase = "demo";
    if (this.cfg.shuffle) {
      const len = this.cfg.grow ? this.cfg.startLen + this.round - 1 : this.cfg.startLen;
      this.seq.clear();
      this._addRandom(len);
      this.demoFrom = 0;
    } else {
      this.demoFrom = this.cfg.once ? this.seq.length : 0;
      this._addRandom(1);
    }
  }

  _addRandom(count) {
    for (let k = 0; k < count; k++) this.seq.push(this.randInt(this.cfg.colors));
  }
}

// Durée d'une couleur pendant la démonstration, en ms
const SPEEDS = { slow: 820, normal: 600, fast: 380, flash: 200 };
function stepDuration(speed, accel, length) {
  const base = SPEEDS[speed] || SPEEDS.normal;
  if (!accel) return base;
  return base * Math.max(0.32, Math.pow(0.975, length - 1));
}
