// ===== Interface, déroulement des parties, sauvegarde et partage =====
"use strict";

const SAVE_KEY = "echo-save";
const PREFS_KEY = "echo-prefs";
const SAVE_VERSION = 1;
const MAX_LEN = 100000;

const PALETTE = [
  ["Mauve", "#9b6dff"], ["Jaune", "#ffd60a"], ["Corail", "#ff4d6d"], ["Menthe", "#2ee6a6"],
  ["Azur", "#38bdf8"], ["Orange", "#ff8a1f"], ["Magenta", "#f03fd0"], ["Citron", "#a3e635"],
  ["Bleu roi", "#3f5efb"], ["Blanc", "#f5f3ff"], ["Bordeaux", "#a3123f"], ["Sarcelle", "#0f9d8a"],
  ["Pêche", "#ffb38a"], ["Lavande", "#cdb8ff"], ["Forêt", "#2f8f3a"], ["Nuit", "#26307a"],
  ["Or", "#c58b00"], ["Gris", "#8a879a"], ["Chocolat", "#8a4b2a"], ["Ciel", "#a8e6ff"],
];
const COLOR_PRESETS = ["#ffd60a", "#ffffff", "#141414", "#9b6dff", "#ff4d6d", "#2ee6a6", "#38bdf8"];
const NAMES_FR = {
  rouge: "#e5263a", bleu: "#2563eb", vert: "#22a447", jaune: "#ffd60a", noir: "#141414", blanc: "#ffffff",
  gris: "#8a879a", orange: "#ff8a1f", violet: "#7c3aed", mauve: "#9b6dff", rose: "#ff6fae", marron: "#8a4b2a",
  turquoise: "#14c8c0", or: "#d4a017", argent: "#c0c4cc", cyan: "#22d3ee", bordeaux: "#7f1d3a", beige: "#e8d9b5",
};
const KEY_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"];
const COUNT_CHIPS = [2, 3, 4, 6, 8, 10, 12, 16, 20];
const VARIANTS = ["shuffle", "once", "eclipse", "blind", "sudden", "spin", "swap", "chaos", "timed"];
const PLAYERS_INFO = {
  solo: "👤 <strong>Solo</strong> : refais la suite, elle s’allonge d’une couleur à chaque manche, sans aucune limite. Tu as 3 vies.",
  turns: "🔁 <strong>Chacun son tour</strong> : les deux joueurs refont la même suite, l’un après l’autre. Le premier qui se trompe a perdu.",
  trap: "🪤 <strong>Piège</strong> : chaque joueur refait la suite, puis ajoute sa propre couleur pour piéger l’autre. Le premier qui se trompe a perdu.",
};
const TAGS = {
  shuffle: "🔀 Mélange", once: "1️⃣ Une seule fois", eclipse: "🌑 Éclipse", blind: "🙈 Aveugle", sudden: "💀 Mort subite",
  spin: "🌀 Plateau tournant", swap: "🔄 Échanges", chaos: "🤪 Pagaille", timed: "⏱️ Temps limité",
};
const PLAYERS_TAG = { solo: "👤 Solo", turns: "🔁 Chacun son tour", trap: "🪤 Piège" };

const $ = (id) => document.getElementById(id);
const els = {};
["stage", "boardHost", "hudLeft", "hudRight", "status", "trail", "playBtn", "ghostBtn", "modeTags", "viewSwitch",
  "recentList", "colorsCard", "colorCount", "colorRange", "countChips", "randCountBtn", "colorGrid", "dupWarn",
  "editorTitle", "colorPresets", "colorPreview", "colorInput", "colorNative", "colorError", "colorRecents",
  "randColorsBtn", "resetColorsBtn", "modesCard", "playersChips", "playersInfo", "namesBox", "name0", "name1",
  "suddenText", "timePill", "timeBar", "timeFill", "timedBox", "timeStart", "timeAdd", "timedExample", "lengthField", "lengthLabel", "startLen", "randLenBtn", "growRow", "opt-grow", "speedChips", "opt-accel",
  "kpiGames", "kpiBest", "kpiGood", "kpiAccuracy", "duelBox", "duelName0", "duelName1", "duelScore", "errorBars",
  "errorEmpty", "history", "resetStatsBtn", "soundBtn", "vibBtn", "shareBtn", "clearBtn", "themeBtn", "shareDialog",
  "shareLink", "copyLinkBtn", "fileWarn", "pasteLink", "loadLinkBtn", "pasteError", "exportBtn", "importInput",
  "confirmDialog", "confirmTitle", "confirmText", "confirmOk", "toast", "year"].forEach((id) => { els[id] = $(id); });

// ----- État -----
const defaultConfig = () => ({
  view: "2d",
  colors: PALETTE.slice(0, 4).map(([name, hex]) => ({ name, hex })),
  players: "solo",
  shuffle: false, once: false, eclipse: false, blind: false, sudden: false,
  spin: false, swap: false, chaos: false,
  timed: false, timeStart: 2, timeAdd: 1,
  startLen: 1,
  grow: false,
  speed: "normal",
  accel: true,
  names: ["Joueur 1", "Joueur 2"],
});
const defaultStats = () => ({
  games: 0, good: 0, presses: 0, best: {}, recent: [], history: [], missed: {}, wins: [0, 0],
});

let config = defaultConfig();
let stats = defaultStats();
const prefs = { theme: null, sound: true, vib: true, recents: [] };
let selectedColor = 0;
let game = null;       // { engine, cfg } pendant une partie
let board = null;
const boards = { "2d": null, "3d": null };

// ----- Petits outils -----
const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const clampTime = (v, min, max, fallback) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n * 10) / 10)) : fallback;
};
const formatSeconds = (n) => `${String(Math.round(n * 10) / 10).replace(".", ",")} s`;
const randomLogInt = (min, max) => Math.round(Math.exp(Math.log(min) + RNG.float() * (Math.log(max) - Math.log(min))));
const formatNumber = (n) => n.toLocaleString("fr-FR");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

const probe = document.createElement("canvas").getContext("2d");
function parseColor(text) {
  let s = text.trim().toLowerCase();
  if (!s) return null;
  if (NAMES_FR[s]) return NAMES_FR[s];
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(s)) s = "#" + s;
  probe.fillStyle = "#010203";
  probe.fillStyle = s;
  const out = probe.fillStyle;
  if (out === "#010203" && s !== "#010203") return null;
  return out.startsWith("#") ? out : null;
}
function colorName(text, hex) {
  const s = text.trim().toLowerCase();
  if (NAMES_FR[s]) return s[0].toUpperCase() + s.slice(1);
  const known = PALETTE.find(([, h]) => h === hex);
  return known ? known[0] : hex;
}

// ----- Sauvegarde -----
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, config, stats })); } catch (e) { /* stockage indisponible */ }
  }, 300);
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* stockage indisponible */ }
}

function sanitizeConfig(o) {
  const base = defaultConfig();
  if (!o || typeof o !== "object") return base;
  if (o.view === "3d") base.view = "3d";
  if (Array.isArray(o.colors)) {
    const list = o.colors.slice(0, 20).map((c) => {
      const hex = c && typeof c.hex === "string" && /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex.toLowerCase() : null;
      return hex ? { hex, name: typeof c.name === "string" ? c.name.slice(0, 16) : hex } : null;
    }).filter(Boolean);
    if (list.length >= 2) base.colors = list;
  }
  if (["solo", "turns", "trap"].includes(o.players)) base.players = o.players;
  VARIANTS.forEach((k) => { base[k] = !!o[k]; });
  base.startLen = clampInt(o.startLen, 1, MAX_LEN, 1);
  base.grow = !!o.grow;
  base.timeStart = clampTime(o.timeStart, 0.5, 3600, base.timeStart);
  base.timeAdd = clampTime(o.timeAdd, 0, 600, base.timeAdd);
  if (SPEEDS[o.speed]) base.speed = o.speed;
  if (typeof o.accel === "boolean") base.accel = o.accel;
  if (Array.isArray(o.names)) {
    base.names = [0, 1].map((k) => (typeof o.names[k] === "string" && o.names[k].trim() ? o.names[k].trim().slice(0, 16) : base.names[k]));
  }
  normalizeConfig(base);
  return base;
}

function sanitizeStats(o) {
  const base = defaultStats();
  if (!o || typeof o !== "object") return base;
  base.games = clampInt(o.games, 0, 1e12, 0);
  base.good = clampInt(o.good, 0, 1e15, 0);
  base.presses = clampInt(o.presses, 0, 1e15, 0);
  if (o.best && typeof o.best === "object") base.best = o.best;
  if (Array.isArray(o.recent)) base.recent = o.recent.slice(0, 10);
  if (Array.isArray(o.history)) base.history = o.history.slice(0, 60).map((n) => clampInt(n, 0, 1e9, 0));
  if (o.missed && typeof o.missed === "object") base.missed = o.missed;
  if (Array.isArray(o.wins)) base.wins = [clampInt(o.wins[0], 0, 1e9, 0), clampInt(o.wins[1], 0, 1e9, 0)];
  return base;
}

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    if (p) Object.assign(prefs, p);
  } catch (e) { /* préférences illisibles */ }
  if (!Array.isArray(prefs.recents)) prefs.recents = [];
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data && data.v === SAVE_VERSION) {
      config = sanitizeConfig(data.config);
      stats = sanitizeStats(data.stats);
    }
  } catch (e) { /* sauvegarde illisible */ }
}

// ----- Règles entre les modes -----
// Retire les combinaisons impossibles. changed = le réglage que le joueur vient d'activer.
function normalizeConfig(c, changed) {
  const messages = [];
  const off = (key, why) => {
    if (c[key]) { c[key] = false; messages.push(why); }
  };
  if (c.players === "trap") {
    off("shuffle", "🔀 Mélange coupé : en mode Piège, ce sont les joueurs qui écrivent la suite.");
  }
  if (c.shuffle && c.once) {
    if (changed === "shuffle") off("once", "1️⃣ Une seule fois coupé : il ne va pas avec Mélange.");
    else off("shuffle", "🔀 Mélange coupé : il ne va pas avec Une seule fois.");
  }
  if (c.blind && c.eclipse) {
    if (changed === "blind") off("eclipse", "🌑 Éclipse coupée : il ne va pas avec Aveugle.");
    else off("blind", "🙈 Aveugle coupé : il ne va pas avec Éclipse.");
  }
  if (c.chaos && (c.spin || c.swap)) {
    if (changed === "chaos") {
      off("spin", "🌀 Plateau tournant coupé : il ne va pas avec Pagaille.");
      off("swap", "🔄 Échanges coupés : ils ne vont pas avec Pagaille.");
    } else {
      off("chaos", "🤪 Pagaille coupée : elle ne va pas avec ce mode.");
    }
  }
  return messages;
}

function engineConfig() {
  return {
    colors: config.colors.length,
    players: config.players,
    shuffle: config.shuffle,
    once: config.once,
    sudden: config.sudden,
    startLen: config.startLen,
    grow: config.grow,
    lives: 3,
    timeStart: config.timeStart,
    timeAdd: config.timeAdd,
  };
}

function recordKey() {
  const flags = VARIANTS.filter((k) => config[k]).join("+") || "base";
  const grow = config.shuffle && config.grow ? "+long" : "";
  const start = config.players === "trap" ? 1 : config.startLen;
  const timed = config.timed ? `|t${config.timeStart}+${config.timeAdd}` : "";
  return `${config.players}|${config.colors.length}|${flags}${grow}|${start}${timed}`;
}

// ----- Plateau -----
function applyBoardColors() {
  const hexes = config.colors.map((c) => c.hex);
  const showKeys = matchMedia("(hover: hover)").matches;
  Sound.setColors(hexes.length);
  if (board) board.setColors(hexes, showKeys ? KEY_LABELS.slice(0, hexes.length) : []);
}

async function setView(view, { silent = false } = {}) {
  let target = view;
  if (view === "3d" && !boards["3d"]) {
    try {
      await loadThree();
      Board3D.init();
      boards["3d"] = new Board3D(els.boardHost);
    } catch (e) {
      target = "2d";
      if (!silent) toast("La 3D n’est pas disponible sur cet appareil : retour à la 2D.");
    }
  }
  if (target === "2d" && !boards["2d"]) boards["2d"] = new Board2D(els.boardHost);

  const previous = board;
  board = boards[target];
  if (previous && previous !== board) {
    previous.stop();
    previous.canvas.style.display = "none";
    board.setCore(previous.core);
    board.core.tint = previous.core.tint;
    board.show = previous.show;
  }
  board.canvas.style.display = "block";
  config.view = target;
  applyBoardColors();
  // Après les couleurs : les orbes d'un plateau tout neuf doivent exister pour partir de leur place
  if (previous && previous !== board) board.setMotion(previous.motion);
  board.start();

  els.viewSwitch.dataset.active = target === "3d" ? "1" : "0";
  els.viewSwitch.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.view === target));
  save();
}

function stagePoint(e) {
  const b = els.boardHost.getBoundingClientRect();
  return [e.clientX - b.left, e.clientY - b.top];
}

function idleCore() {
  board.setCore({ big: "▶", small: "lancer", progress: 0, tintTo: [155, 109, 255] });
}

// ----- Déroulement d'une partie -----
function setStatus(label, value) {
  const s = els.status;
  s.innerHTML = "";
  if (label) {
    const l = document.createElement("span");
    l.className = "result-label line";
    l.textContent = label;
    s.appendChild(l);
  }
  if (value) {
    const v = document.createElement("strong");
    v.textContent = value;
    s.appendChild(v);
  }
  s.classList.remove("reveal");
  void s.offsetWidth;
  s.classList.add("reveal");
}

function renderHud() {
  const left = els.hudLeft;
  const right = els.hudRight;
  left.innerHTML = "";
  right.innerHTML = "";

  if (game && game.engine.versus) {
    config.names.forEach((name, k) => {
      const pill = document.createElement("span");
      pill.className = "hud-pill" + (game.engine.player === k ? " active" : "");
      pill.textContent = name;
      left.appendChild(pill);
    });
  } else {
    const max = config.sudden ? 1 : 3;
    const lives = game ? game.engine.lives : max;
    for (let k = 0; k < max; k++) {
      const h = document.createElement("span");
      h.className = "heart" + (k >= lives ? " lost" : "");
      h.textContent = "❤️";
      left.appendChild(h);
    }
  }

  right.appendChild(els.timePill);
  const record = stats.best[recordKey()] || 0;
  const pill = document.createElement("span");
  pill.className = "hud-pill gold";
  pill.textContent = `🏆 ${formatNumber(record)}`;
  right.appendChild(pill);
}

// Ruban : 16 pastilles réutilisées, le nombre d'éléments ne grandit jamais
const TRAIL_SIZE = 16;
const trailDots = [];
const trailColors = [];
function buildTrail() {
  for (let k = 0; k < TRAIL_SIZE; k++) {
    const d = document.createElement("span");
    d.className = "trail-dot";
    d.style.visibility = "hidden";
    els.trail.appendChild(d);
    trailDots.push(d);
  }
}
function pushTrail(color) {
  trailColors.push(color);
  if (trailColors.length > TRAIL_SIZE) trailColors.shift();
  const offset = TRAIL_SIZE - trailColors.length;
  trailDots.forEach((d, k) => {
    const c = trailColors[k - offset];
    if (c === undefined) {
      d.style.visibility = "hidden";
    } else {
      d.style.visibility = "visible";
      d.style.setProperty("--c", config.colors[c].hex);
    }
  });
  const last = trailDots[TRAIL_SIZE - 1];
  last.classList.remove("fresh");
  void last.offsetWidth;
  last.classList.add("fresh");
}
function clearTrail() {
  trailColors.length = 0;
  trailDots.forEach((d) => { d.style.visibility = "hidden"; });
}

function setLocked(locked) {
  [els.colorsCard, els.modesCard].forEach((card) => {
    card.inert = locked;
    card.classList.toggle("locked", locked);
  });
  document.body.classList.toggle("busy", locked);
  els.playBtn.disabled = locked;
  els.playBtn.textContent = locked ? "Partie en cours…" : "▶ Lancer la partie";
  els.ghostBtn.textContent = locked ? "⏹ Abandonner" : "🔀 Tout au hasard";
}

function currentName() {
  return config.names[game.engine.player];
}

// ----- Temps limité -----
function stopTimer(g) {
  if (g && g.timer) {
    clearInterval(g.timer);
    g.timer = 0;
  }
  if (g) g.deadline = 0;
  els.timeBar.classList.add("hidden");
  els.timePill.classList.add("hidden");
}

function startTimer(g) {
  stopTimer(g);
  if (!config.timed) return;
  g.limit = g.engine.timeLimit();
  g.deadline = performance.now() + g.limit * 1000;
  g.lastBeep = Infinity;
  els.timeBar.classList.remove("hidden", "low");
  els.timePill.classList.remove("hidden", "low");
  g.timer = setInterval(() => tickTimer(g), 50);
  tickTimer(g);
}

function tickTimer(g) {
  if (game !== g || g.engine.phase !== "input") {
    stopTimer(g);
    return;
  }
  const left = (g.deadline - performance.now()) / 1000;
  if (left <= 0) {
    onTimeUp(g);
    return;
  }
  els.timeFill.style.transform = `scaleX(${left / g.limit})`;
  els.timePill.textContent = `⏱️ ${left.toFixed(1).replace(".", ",")} s`;
  const low = left <= Math.min(3, g.limit * 0.35);
  els.timeBar.classList.toggle("low", low);
  els.timePill.classList.toggle("low", low);
  // Un petit bip par seconde quand il ne reste presque plus rien
  const whole = Math.ceil(left);
  if (low && whole < g.lastBeep) {
    g.lastBeep = whole;
    Sound.ping();
  }
}

function onTimeUp(g) {
  stopTimer(g);
  const ev = g.engine.timeUp();
  if (ev) handleWrong(g, ev);
}

function startGame() {
  if (game) return;
  if (config.blind && !Sound.enabled) {
    setSound(true);
    toast("🔊 Le mode Aveugle a besoin du son : je l’ai réactivé.");
  }
  const engine = new GameEngine(engineConfig());
  engine.start();
  game = { engine, presses: 0, ticket: 0 };
  setLocked(true);
  board.assemble();
  board.setShow("all");
  clearTrail();
  renderHud();
  setStatus("C’est parti !", "");
  board.setCore({ big: "…", small: "", progress: 0 });
  Sound.start();
  Haptics.vibrate(15);
  els.stage.scrollIntoView({ behavior: "smooth", block: "center" });
  if (config.blind) {
    runSoundPreview(game);
  } else {
    startMotion();
    proceed(game, 500);
  }
}

function startMotion() {
  board.setMotion({ spin: config.spin, swap: config.swap, chaos: config.chaos });
}

// Mode Aveugle : avant de commencer, chaque couleur joue sa note une fois
async function runSoundPreview(g) {
  g.previewing = true;
  const count = config.colors.length;
  setStatus("Mode Aveugle", "Écoute le son de chaque couleur 👂");
  board.setCore({ big: 0, small: `sur ${count}`, progress: 0 });
  await sleep(600);
  for (let i = 0; i < count; i++) {
    if (game !== g) return;
    if (document.hidden) {
      await waitVisible();
      if (game !== g) return;
    }
    Sound.note(i, 0.5);
    board.flash(i, 420);
    board.setCore({ big: i + 1, progress: (i + 1) / count });
    await sleep(640);
  }
  if (game !== g) return;
  g.previewing = false;
  startMotion();
  setStatus("À toi de retenir !", "La partie commence… 🙈");
  proceed(g, 900);
}

// Passe à l'étape suivante selon la phase du moteur
async function proceed(g, delay = 0) {
  // Seul le dernier appel compte : un joueur rapide ne peut pas lancer deux démonstrations à la fois
  const ticket = ++g.ticket;
  if (delay) await sleep(delay);
  if (game !== g || ticket !== g.ticket) return;
  const e = g.engine;
  if (e.phase === "demo") await runDemo(g);
  if (game !== g) return;
  if (e.phase === "input") {
    clearTrail();
    board.setCore({ big: 0, small: `sur ${formatNumber(e.seq.length)}`, progress: 0 });
    const who = e.versus ? `${currentName()}, à toi !` : "À toi !";
    setStatus(roundLabel(e), `${who} 👆`);
    startTimer(g);
  } else if (e.phase === "add") {
    board.setCore({ big: "+1", small: "ajoute", progress: 1 });
    const other = config.names[1 - e.player];
    const first = e.seq.length === 0;
    setStatus(roundLabel(e), first ? `${currentName()}, choisis la première couleur 🪤` : `${currentName()}, ajoute une couleur pour piéger ${other} 🪤`);
    renderHud();
  }
}

function roundLabel(e) {
  const time = config.timed ? ` · ${formatSeconds(e.timeLimit())}` : "";
  if (e.cfg.players === "trap") return `Suite de ${formatNumber(e.seq.length)}${time}`;
  return `Manche ${formatNumber(e.round)} · suite de ${formatNumber(e.seq.length)}${time}`;
}

function waitVisible() {
  return new Promise((resolve) => {
    const check = () => {
      if (!document.hidden) {
        document.removeEventListener("visibilitychange", check);
        resolve();
      }
    };
    document.addEventListener("visibilitychange", check);
  });
}

async function runDemo(g) {
  const e = g.engine;
  const [from, to] = e.demoRange();
  const len = e.seq.length;
  renderHud();

  if (to <= from) {
    setStatus(roundLabel(e), "Refais-la de mémoire 🧠");
    await sleep(700);
    if (game === g) e.demoDone();
    return;
  }

  const blind = config.blind;
  setStatus(roundLabel(e), blind ? "Écoute bien 👂" : from > 0 ? "Regarde la nouvelle couleur 👀" : "Regarde bien 👀");
  els.stage.classList.add("rolling");
  board.setShow(blind ? "mute" : config.eclipse ? "hidden" : "all");
  board.setCore({ big: formatNumber(len), small: blind ? "écoute" : "regarde", progress: 0 });
  await sleep(650);

  const step = stepDuration(config.speed, config.accel, len);
  const on = step * 0.62;
  let next = performance.now();
  for (let k = from; k < to; k++) {
    if (game !== g) return;
    if (document.hidden) {
      await waitVisible();
      if (game !== g) return;
      next = performance.now();
    }
    const color = e.seq.at(k);
    Sound.note(color, (on / 1000) * 1.5);
    if (blind) board.ping(on);
    else board.flash(color, on);
    board.setCore({ progress: (k + 1 - from) / (to - from) });
    next += step;
    await sleep(Math.max(0, next - performance.now()));
  }
  if (game !== g) return;
  els.stage.classList.remove("rolling");
  board.setShow("all");
  e.demoDone();
}

function isMilestone(len) {
  return [10, 25, 50, 100, 250, 500].includes(len) || (len >= 1000 && len % 1000 === 0);
}

function showBanner(title, subtitle) {
  const b = document.createElement("div");
  b.className = "banner";
  const s = document.createElement("span");
  s.textContent = title;
  const m = document.createElement("small");
  m.textContent = subtitle;
  b.append(s, m);
  els.stage.appendChild(b);
  b.addEventListener("animationend", (ev) => { if (ev.target === b) b.remove(); });
  els.stage.classList.remove("jackpot");
  void els.stage.offsetWidth;
  els.stage.classList.add("jackpot");
  setTimeout(() => els.stage.classList.remove("jackpot"), 3700);
}

function landed() {
  const s = els.stage;
  s.classList.remove("landed");
  void s.offsetWidth;
  s.classList.add("landed");
}

function pressColor(color) {
  const g = game;
  if (!g) {
    // Hors partie : entraînement libre
    Sound.note(color, 0.45);
    board.flash(color, 260);
    return;
  }
  const e = g.engine;
  if (g.previewing) return;
  if (e.phase !== "input" && e.phase !== "add") return;
  // Appui arrivé juste après la fin du temps, avant le prochain contrôle du minuteur
  if (e.phase === "input" && g.deadline && performance.now() >= g.deadline) {
    onTimeUp(g);
    return;
  }
  const ev = e.press(color);
  if (!ev) return;
  g.presses++;
  if (ev.type === "complete" || ev.type === "wrong") stopTimer(g);

  if (ev.type === "wrong") {
    handleWrong(g, ev);
    return;
  }

  Sound.note(color, 0.34);
  board.flash(color, 220);
  Haptics.vibrate(10);
  pushTrail(color);

  if (ev.type === "good") {
    board.setCore({ big: formatNumber(ev.pos), progress: ev.pos / ev.len });
  } else if (ev.type === "complete") {
    board.setCore({ big: formatNumber(ev.len), small: "réussi !", progress: 1 });
    handleComplete(g, ev);
  } else if (ev.type === "added") {
    board.setCore({ big: formatNumber(ev.len), small: "ajoutée", progress: 1 });
    Sound.turn();
    renderHud();
    setStatus("Couleur ajoutée", `${currentName()}, à toi ! 🔁`);
    proceed(g, 1100);
  }
}

function handleComplete(g, ev) {
  const e = g.engine;
  const milestone = isMilestone(ev.len);
  landed();
  Haptics.vibrate([20, 40, 30]);

  if (milestone) {
    Sound.fanfare();
    Haptics.vibrate([60, 40, 60, 40, 200]);
    board.celebrate(ev.len >= 100 ? 3 : 2);
    showBanner("INCROYABLE !", `Suite de ${formatNumber(ev.len)} couleurs`);
  } else {
    Sound.success();
    board.celebrate(1);
  }
  board.chase(420);
  renderHud();

  if (ev.next === "add") {
    proceed(g, milestone ? 1200 : 450);
    return;
  }
  if (ev.next === "pass") {
    Sound.turn();
    setStatus("Bien joué !", `${currentName()}, à toi maintenant 🔁`);
  } else {
    setStatus("Suite réussie !", `Suite de ${formatNumber(ev.len)} ✅`);
    const best = stats.best[recordKey()] || 0;
    if (e.score > best) {
      stats.best[recordKey()] = e.score;
      renderHud();
      renderStats();
      save();
    }
  }
  proceed(g, milestone ? 2200 : ev.next === "pass" ? 1300 : 900);
}

function handleWrong(g, ev) {
  Sound.wrong();
  Haptics.vibrate([40, 30, 90]);
  board.wrong(ev.color, ev.expected);
  clearTrail();
  if (ev.over) {
    finishGame(g, ev);
    return;
  }
  const hearts = els.hudLeft.querySelectorAll(".heart");
  const lost = hearts[ev.lives];
  if (lost) lost.classList.add("lost", "breaking");
  const plural = ev.lives > 1 ? "vies" : "vie";
  setStatus(ev.timeout ? "Temps écoulé ⏰" : "Raté !", `Il te reste ${ev.lives} ${plural} 💔`);
  board.setCore({ big: "✕", small: ev.timeout ? "trop tard" : "raté", progress: 0 });
  proceed(g, 1500);
}

function finishGame(g, ev) {
  const e = g.engine;
  game = null;
  stopTimer(g);
  els.stage.classList.remove("rolling");
  board.setShow("all");
  board.setMotion(null);
  recordGame(g, ev.winner);
  setLocked(false);
  renderHud();

  const hearts = els.hudLeft.querySelectorAll(".heart");
  hearts.forEach((h) => h.classList.add("lost"));

  if (ev.winner !== null) {
    const winner = config.names[ev.winner];
    const loser = config.names[1 - ev.winner];
    setStatus(ev.timeout ? `${loser} n’a pas fini à temps ⏰` : `${loser} s’est trompé`, `🏆 ${winner} gagne !`);
    board.setCore({ big: "🏆", small: winner.slice(0, 10), progress: 1, tintTo: [255, 214, 10] });
    Sound.fanfare();
    board.celebrate(2);
  } else {
    const label = config.shuffle && !config.grow ? "Suites réussies" : "Plus longue suite";
    setStatus(ev.timeout ? "Temps écoulé ⏰ · partie terminée" : "Partie terminée", `${label} : ${formatNumber(e.score)}`);
    board.setCore({ big: formatNumber(e.score), small: "score", progress: 0 });
    Sound.gameOver();
  }
  board.collapse();
  setTimeout(() => {
    if (game) return;
    board.assemble();
    idleCore();
  }, ev.winner !== null ? 3400 : 2600);
}

function abandonGame() {
  const g = game;
  if (!g) return;
  game = null;
  stopTimer(g);
  g.engine.abandon();
  els.stage.classList.remove("rolling");
  board.setShow("all");
  board.setMotion(null);
  if (g.presses > 0) recordGame(g, null);
  setLocked(false);
  clearTrail();
  renderHud();
  idleCore();
  board.assemble();
  setStatus("Partie abandonnée", "");
}

function recordGame(g, winner) {
  const e = g.engine;
  const score = e.score;
  stats.games++;
  stats.good += e.good;
  stats.presses += g.presses;
  const key = recordKey();
  if (score > (stats.best[key] || 0)) stats.best[key] = score;
  for (const c of e.missed) {
    const hex = config.colors[c].hex;
    if (!stats.missed[hex]) stats.missed[hex] = { n: 0, name: config.colors[c].name };
    stats.missed[hex].n++;
    stats.missed[hex].name = config.colors[c].name;
  }
  if (winner !== null && winner !== undefined) stats.wins[winner]++;
  stats.history.unshift(score);
  stats.history.length = Math.min(stats.history.length, 60);
  const flags = VARIANTS.filter((k) => config[k]).map((k) => TAGS[k].split(" ")[0]).join("");
  stats.recent.unshift({
    mode: PLAYERS_TAG[config.players].split(" ")[0],
    colors: config.colors.length,
    flags,
    score,
    winner: winner !== null && winner !== undefined ? config.names[winner] : null,
  });
  stats.recent.length = Math.min(stats.recent.length, 10);
  renderStats();
  save();
}

// ----- Affichage des réglages -----
function renderTags() {
  const tags = [PLAYERS_TAG[config.players], `🎨 ${config.colors.length} couleurs`];
  VARIANTS.forEach((k) => {
    if (k === "timed") {
      if (config.timed) tags.push(`⏱️ ${formatSeconds(config.timeStart)} +${formatSeconds(config.timeAdd)}`);
    } else if (config[k] && !(k === "sudden" && config.players !== "solo")) {
      tags.push(TAGS[k]);
    }
  });
  els.modeTags.innerHTML = "";
  tags.forEach((t) => {
    const s = document.createElement("span");
    s.className = "mode-tag";
    s.textContent = t;
    els.modeTags.appendChild(s);
  });
}

function renderCount() {
  const n = config.colors.length;
  els.colorCount.value = n;
  els.colorRange.value = n;
  els.colorRange.style.setProperty("--fill", `${((n - 2) / 18) * 100}%`);
  els.countChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", Number(c.dataset.n) === n));
}

function renderColorGrid() {
  const n = config.colors.length;
  if (selectedColor >= n) selectedColor = n - 1;
  els.colorGrid.innerHTML = "";
  config.colors.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "color-tile" + (i === selectedColor ? " active" : "");
    b.style.setProperty("--c", c.hex);
    b.dataset.i = i;
    b.setAttribute("aria-label", `Couleur ${i + 1} : ${c.name}`);
    const orb = document.createElement("span");
    orb.className = "tile-orb";
    const name = document.createElement("span");
    name.className = "tile-name";
    name.textContent = c.name;
    b.append(orb, name);
    els.colorGrid.appendChild(b);
  });
  const hexes = config.colors.map((c) => c.hex);
  els.dupWarn.classList.toggle("hidden", new Set(hexes).size === hexes.length);
  renderEditor();
}

function swatch(hex, onPick, mini) {
  const b = document.createElement("button");
  b.className = "swatch" + (mini ? " mini" : "");
  b.style.setProperty("--c", hex);
  b.setAttribute("aria-label", `Couleur ${hex}`);
  b.addEventListener("click", () => onPick(hex));
  return b;
}

function renderEditor() {
  const c = config.colors[selectedColor];
  els.editorTitle.textContent = `Modifier la couleur n° ${selectedColor + 1} : ${c.name}`;
  els.colorPreview.style.background = c.hex;
  els.colorNative.value = c.hex;
  els.colorInput.value = "";
  els.colorError.classList.add("hidden");
  els.colorPresets.innerHTML = "";
  COLOR_PRESETS.forEach((hex) => {
    const s = swatch(hex, (h) => setColor(h, h, false));
    if (hex === c.hex) s.classList.add("active");
    els.colorPresets.appendChild(s);
  });
  els.colorRecents.innerHTML = "";
  if (!prefs.recents.length) {
    const none = document.createElement("span");
    none.className = "muted small";
    none.textContent = "Aucune pour l’instant.";
    els.colorRecents.appendChild(none);
  }
  prefs.recents.forEach((hex) => {
    const s = swatch(hex, (h) => setColor(h, h, false), true);
    if (hex === c.hex) s.classList.add("active");
    els.colorRecents.appendChild(s);
  });
}

function setColor(hex, typed, remember = true) {
  const c = config.colors[selectedColor];
  c.hex = hex;
  c.name = colorName(typed, hex);
  if (remember && !COLOR_PRESETS.includes(hex)) {
    prefs.recents = [hex, ...prefs.recents.filter((h) => h !== hex)].slice(0, 7);
    savePrefs();
  }
  renderColorGrid();
  applyBoardColors();
  save();
}

function setColorCount(n) {
  const count = clampInt(n, 2, 20, config.colors.length);
  const current = config.colors;
  const next = [];
  for (let i = 0; i < count; i++) {
    if (current[i]) { next.push(current[i]); continue; }
    const free = PALETTE.find(([, hex]) => !current.some((c) => c.hex === hex) && !next.some((c) => c.hex === hex));
    const [name, hex] = free || PALETTE[i];
    next.push({ name, hex });
  }
  config.colors = next;
  renderCount();
  renderColorGrid();
  renderTags();
  renderHud();
  renderStats();
  applyBoardColors();
  save();
}

function randomHexes(count) {
  // Couleurs bien réparties sur le cercle des teintes, pour qu'elles restent faciles à distinguer
  const start = RNG.float() * 360;
  const hexes = [];
  for (let k = 0; k < count; k++) {
    const h = (start + (k * 360) / count + RNG.float() * 12) % 360;
    const s = 70 + RNG.float() * 28;
    const l = 45 + RNG.float() * 25;
    probe.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
    hexes.push(probe.fillStyle);
  }
  // Mélange pour que les voisines à l'écran ne soient pas toujours de teintes proches
  for (let k = hexes.length - 1; k > 0; k--) {
    const j = RNG.int(k + 1);
    [hexes[k], hexes[j]] = [hexes[j], hexes[k]];
  }
  return hexes;
}

function renderModes() {
  els.playersChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.players === config.players));
  els.playersInfo.innerHTML = PLAYERS_INFO[config.players];
  const versus = config.players !== "solo";
  const trap = config.players === "trap";
  els.namesBox.classList.toggle("hidden", !versus);
  els.name0.value = config.names[0];
  els.name1.value = config.names[1];

  VARIANTS.forEach((k) => {
    const input = $(`opt-${k}`);
    const row = $(`row-${k}`);
    const lockedOff = k === "shuffle" && trap;
    const lockedOn = k === "sudden" && versus;
    input.checked = lockedOn ? true : !!config[k];
    input.disabled = lockedOff || lockedOn;
    row.classList.toggle("on", input.checked);
    row.classList.toggle("locked", lockedOff || lockedOn);
  });
  els.suddenText.textContent = versus
    ? "Toujours actif à deux : le premier qui se trompe a perdu."
    : "Tu meurs à la première faute (sinon, tu as 3 vies).";

  els.timedBox.classList.toggle("hidden", !config.timed);
  els.timeStart.value = config.timeStart;
  els.timeAdd.value = config.timeAdd;
  els.timedExample.textContent = `Manche 1 : ${formatSeconds(config.timeStart)} · manche 2 : ${formatSeconds(config.timeStart + config.timeAdd)} · manche 3 : ${formatSeconds(config.timeStart + config.timeAdd * 2)}…`;

  els.lengthField.classList.toggle("hidden", trap);
  els.lengthLabel.textContent = config.shuffle ? "Longueur de la suite" : "Longueur de départ";
  els.startLen.value = config.startLen;
  els.growRow.classList.toggle("hidden", !config.shuffle);
  els["opt-grow"].checked = config.grow;

  els.speedChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.speed === config.speed));
  els["opt-accel"].checked = config.accel;

  els.duelBox.classList.toggle("hidden", !versus);
  renderTags();
  renderStats();
  renderHud();
}

function renderStats() {
  els.kpiGames.textContent = formatNumber(stats.games);
  const record = stats.best[recordKey()];
  els.kpiBest.textContent = record ? formatNumber(record) : "—";
  els.kpiGood.textContent = formatNumber(stats.good);
  els.kpiAccuracy.textContent = stats.presses ? `${Math.round((stats.good / stats.presses) * 100)} %` : "—";

  els.duelName0.textContent = config.names[0];
  els.duelName1.textContent = config.names[1];
  els.duelScore.textContent = `${stats.wins[0]} – ${stats.wins[1]}`;

  const entries = Object.entries(stats.missed).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  els.errorBars.innerHTML = "";
  els.errorEmpty.classList.toggle("hidden", entries.length > 0);
  const total = entries.reduce((sum, [, m]) => sum + m.n, 0);
  const max = entries.length ? entries[0][1].n : 1;
  entries.forEach(([hex, m]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("div");
    label.className = "bar-label";
    const name = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = "bar-swatch";
    dot.style.setProperty("--c", /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#888888");
    name.append(dot, document.createTextNode(`${m.name} — ${m.n}`));
    const pct = document.createElement("small");
    pct.textContent = `${Math.round((m.n / total) * 100)} %`;
    label.append(name, pct);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(m.n / max) * 100}%`;
    bar.appendChild(fill);
    row.append(label, bar);
    els.errorBars.appendChild(row);
  });

  els.history.innerHTML = "";
  if (!stats.history.length) {
    const none = document.createElement("span");
    none.className = "muted";
    none.textContent = "Aucune partie pour l’instant.";
    els.history.appendChild(none);
  }
  stats.history.forEach((score, k) => {
    const h = document.createElement("span");
    h.className = "history-item" + (k % 2 ? " alt" : "");
    h.textContent = formatNumber(score);
    els.history.appendChild(h);
  });

  els.recentList.innerHTML = "";
  stats.recent.forEach((r) => {
    const li = document.createElement("li");
    li.className = "recent-item";
    const obj = document.createElement("span");
    obj.className = "recent-obj";
    obj.textContent = `${r.mode} 🎨${r.colors}`;
    const arrow = document.createElement("span");
    arrow.className = "recent-arrow";
    arrow.textContent = "→";
    const strong = document.createElement("strong");
    strong.textContent = r.winner ? `🏆 ${r.winner}` : formatNumber(r.score);
    const small = document.createElement("small");
    small.className = "muted";
    small.textContent = r.winner ? `suite ${formatNumber(r.score)} ${r.flags}` : r.flags;
    li.append(obj, arrow, strong, small);
    els.recentList.appendChild(li);
  });
}

function renderAll() {
  renderCount();
  renderColorGrid();
  renderModes();
}

// ----- Confirmation -----
function askConfirm(title, text, okLabel) {
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmOk.textContent = okLabel;
  els.confirmDialog.returnValue = "cancel";
  els.confirmDialog.showModal();
  return new Promise((resolve) => {
    els.confirmDialog.addEventListener("close", () => resolve(els.confirmDialog.returnValue === "ok"), { once: true });
  });
}

// ----- Son, vibrations, thème -----
function setSound(on) {
  prefs.sound = on;
  Sound.setEnabled(on);
  els.soundBtn.classList.toggle("off", !on);
  els.soundBtn.setAttribute("aria-pressed", on);
  els.soundBtn.title = on ? "Sons activés" : "Sons coupés";
  savePrefs();
}
function setVib(on) {
  prefs.vib = on;
  Haptics.setEnabled(on);
  els.vibBtn.classList.toggle("off", !on);
  els.vibBtn.setAttribute("aria-pressed", on);
  const note = Haptics.supported ? "" : " (sur téléphone uniquement)";
  els.vibBtn.title = (on ? "Vibrations activées" : "Vibrations coupées") + note;
  savePrefs();
}

// ----- Partage -----
const b64urlEncode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function b64urlDecode(text) {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
}
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
async function encodeConfig() {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  if ("CompressionStream" in window) return "z" + b64urlEncode(await pipe(bytes, new CompressionStream("deflate-raw")));
  return "j" + b64urlEncode(bytes);
}
async function decodeConfig(code) {
  let bytes = b64urlDecode(code.slice(1));
  if (code[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  return sanitizeConfig(JSON.parse(new TextDecoder().decode(bytes)));
}
async function applySharedCode(code) {
  const loaded = await decodeConfig(code);
  const view = config.view;
  config = loaded;
  config.view = view;
  renderAll();
  applyBoardColors();
  save();
}

// ----- Événements -----
function bindEvents() {
  els.playBtn.addEventListener("click", startGame);
  els.ghostBtn.addEventListener("click", () => {
    if (game) { abandonGame(); return; }
    randomizeAll();
  });

  els.viewSwitch.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.dataset.view !== config.view) {
      Sound.click();
      setView(b.dataset.view);
    }
  });

  // Plateau
  els.boardHost.addEventListener("pointerdown", (e) => {
    if (!board || e.button > 0) return;
    const [x, y] = stagePoint(e);
    const hit = board.pick(x, y);
    if (hit >= 0) {
      e.preventDefault();
      pressColor(hit);
    } else if (hit === -2 && !game) {
      startGame();
    }
  });
  els.boardHost.addEventListener("pointermove", (e) => {
    if (!board || e.pointerType === "touch") return;
    const [x, y] = stagePoint(e);
    const hit = board.pick(x, y);
    const active = hit >= 0 || (hit === -2 && !game);
    board.canvas.classList.toggle("over", active);
  });

  // Clavier
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.code === "Space") {
      if (t && t.tagName === "BUTTON" && !game) return; // Espace sur un bouton : son action normale
      e.preventDefault();
      if (!game) startGame();
      return;
    }
    let color = -1;
    const digit = e.code.match(/^(?:Digit|Numpad)(\d)$/);
    if (digit) color = (Number(digit[1]) + 9) % 10;
    else if (e.key.length === 1) {
      const at = "azertyuiop".indexOf(e.key.toLowerCase());
      if (at >= 0) color = 10 + at;
    }
    if (color >= 0 && color < config.colors.length) {
      e.preventDefault();
      pressColor(color);
    }
  });

  // Couleurs
  els.colorCount.addEventListener("change", () => setColorCount(els.colorCount.value));
  els.colorRange.addEventListener("input", () => setColorCount(els.colorRange.value));
  els.randCountBtn.addEventListener("click", () => { Sound.click(); setColorCount(2 + RNG.int(19)); });
  COUNT_CHIPS.forEach((n) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.dataset.n = n;
    b.textContent = n;
    b.addEventListener("click", () => { Sound.click(); setColorCount(n); });
    els.countChips.appendChild(b);
  });
  els.colorGrid.addEventListener("click", (e) => {
    const b = e.target.closest(".color-tile");
    if (!b) return;
    selectedColor = Number(b.dataset.i);
    pressColor(selectedColor);
    renderColorGrid();
  });
  els.colorInput.addEventListener("input", () => {
    const text = els.colorInput.value;
    const hex = parseColor(text);
    els.colorError.classList.toggle("hidden", !!hex || !text.trim());
    if (!hex) {
      els.colorError.textContent = "Couleur inconnue. Essaie #ff8800 ou un nom comme orange, turquoise…";
      return;
    }
    const c = config.colors[selectedColor];
    c.hex = hex;
    c.name = colorName(text, hex);
    els.colorPreview.style.background = hex;
    els.colorNative.value = hex;
    applyBoardColors();
    save();
  });
  els.colorInput.addEventListener("change", () => {
    const text = els.colorInput.value;
    const hex = parseColor(text);
    if (hex) setColor(hex, text);
  });
  els.colorNative.addEventListener("input", () => {
    const c = config.colors[selectedColor];
    c.hex = els.colorNative.value;
    c.name = colorName("", c.hex);
    els.colorPreview.style.background = c.hex;
    applyBoardColors();
  });
  els.colorNative.addEventListener("change", () => setColor(els.colorNative.value, ""));
  els.randColorsBtn.addEventListener("click", () => {
    Sound.click();
    randomHexes(config.colors.length).forEach((hex, i) => { config.colors[i] = { hex, name: hex }; });
    renderColorGrid();
    applyBoardColors();
    save();
  });
  els.resetColorsBtn.addEventListener("click", () => {
    Sound.click();
    config.colors = PALETTE.slice(0, config.colors.length).map(([name, hex]) => ({ name, hex }));
    renderColorGrid();
    applyBoardColors();
    save();
  });

  // Modes
  els.playersChips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    Sound.click();
    config.players = b.dataset.players;
    normalizeConfig(config).forEach(toast);
    renderModes();
    save();
  });
  VARIANTS.forEach((k) => {
    $(`opt-${k}`).addEventListener("change", (e) => {
      config[k] = e.target.checked;
      Sound.click();
      normalizeConfig(config, k).forEach(toast);
      renderModes();
      save();
    });
  });
  els.startLen.addEventListener("change", () => {
    config.startLen = clampInt(els.startLen.value, 1, MAX_LEN, config.startLen);
    els.startLen.value = config.startLen;
    renderStats();
    renderHud();
    save();
  });
  [["timeStart", 0.5, 3600], ["timeAdd", 0, 600]].forEach(([key, min, max]) => {
    els[key].addEventListener("change", () => {
      config[key] = clampTime(els[key].value, min, max, config[key]);
      renderModes();
      save();
    });
  });
  els.randLenBtn.addEventListener("click", () => {
    Sound.click();
    config.startLen = randomLogInt(1, 1000);
    els.startLen.value = config.startLen;
    renderStats();
    renderHud();
    save();
  });
  els["opt-grow"].addEventListener("change", (e) => { config.grow = e.target.checked; Sound.click(); renderStats(); renderHud(); save(); });
  els["opt-accel"].addEventListener("change", (e) => { config.accel = e.target.checked; Sound.click(); save(); });
  els.speedChips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    Sound.click();
    config.speed = b.dataset.speed;
    renderModes();
    save();
  });
  [els.name0, els.name1].forEach((input, k) => {
    input.addEventListener("change", () => {
      config.names[k] = input.value.trim().slice(0, 16) || `Joueur ${k + 1}`;
      input.value = config.names[k];
      renderStats();
      renderHud();
      save();
    });
  });

  // Statistiques
  els.resetStatsBtn.addEventListener("click", async () => {
    if (await askConfirm("Réinitialiser les statistiques ?", "Est-ce que vous voulez vraiment remettre les statistiques à zéro ? Les records et l’historique seront perdus.", "Oui, réinitialiser")) {
      stats = defaultStats();
      renderStats();
      renderHud();
      save();
    }
  });

  // Header
  els.soundBtn.addEventListener("click", () => {
    setSound(!prefs.sound);
    Sound.click();
    if (game && config.blind && !prefs.sound) toast("⚠️ Sans le son, le mode Aveugle devient impossible.");
  });
  els.vibBtn.addEventListener("click", () => {
    setVib(!prefs.vib);
    Haptics.vibrate(20);
  });
  els.themeBtn.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    prefs.theme = theme;
    savePrefs();
  });
  els.clearBtn.addEventListener("click", async () => {
    if (await askConfirm("Effacer la sauvegarde ?", "Est-ce que vous voulez vraiment tout effacer ? Les couleurs, les modes, les statistiques et l’historique seront remis à zéro. Cette action est définitive.", "Oui, tout effacer")) {
      if (game) abandonGame();
      clearTimeout(saveTimer);
      try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(PREFS_KEY);
      } catch (e) { /* stockage indisponible */ }
      const view = config.view;
      config = defaultConfig();
      config.view = view;
      stats = defaultStats();
      prefs.recents = [];
      renderAll();
      applyBoardColors();
      toast("Tout est effacé 🗑️");
    }
  });

  // Partage
  els.shareBtn.addEventListener("click", async () => {
    els.shareLink.value = "Création du lien…";
    els.pasteLink.value = "";
    els.pasteError.classList.add("hidden");
    els.fileWarn.classList.toggle("hidden", location.protocol !== "file:");
    els.shareDialog.showModal();
    const code = await encodeConfig();
    els.shareLink.value = `${location.href.split("#")[0]}#c=${code}`;
    els.shareLink.select();
  });
  els.copyLinkBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.shareLink.value);
    } catch (e) {
      els.shareLink.select();
      document.execCommand("copy");
    }
    toast("Lien copié ! 🔗");
  });
  els.loadLinkBtn.addEventListener("click", async () => {
    const text = els.pasteLink.value.trim();
    const m = text.match(/#c=([\w-]+)/) || text.match(/^([zj][\w-]+)$/);
    try {
      if (!m) throw new Error("lien invalide");
      if (game) abandonGame();
      await applySharedCode(m[1]);
      els.shareDialog.close();
      toast("Configuration chargée ! 🎉");
    } catch (e) {
      els.pasteError.textContent = "Ce lien n’est pas valide.";
      els.pasteError.classList.remove("hidden");
    }
  });
  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ v: SAVE_VERSION, config, stats }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "echoflash-sauvegarde.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  els.importInput.addEventListener("change", async () => {
    const file = els.importInput.files[0];
    els.importInput.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !data.config) throw new Error("fichier invalide");
      if (game) abandonGame();
      config = sanitizeConfig(data.config);
      stats = sanitizeStats(data.stats);
      await setView(config.view, { silent: true });
      renderAll();
      applyBoardColors();
      save();
      els.shareDialog.close();
      toast("Sauvegarde chargée ! 💾");
    } catch (e) {
      toast("Ce fichier n’est pas une sauvegarde valide.");
    }
  });

  // Quitter pendant la démonstration : rien à faire, la boucle attend le retour de l'onglet
  window.addEventListener("pagehide", () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, config, stats })); } catch (e) { /* stockage indisponible */ }
  });
}

function randomizeAll() {
  Sound.click();
  const n = 2 + RNG.int(19);
  const hexes = randomHexes(n);
  config.colors = hexes.map((hex) => ({ hex, name: hex }));
  config.players = ["solo", "solo", "turns", "trap"][RNG.int(4)];
  VARIANTS.forEach((k) => { config[k] = RNG.int(3) === 0; });
  normalizeConfig(config);
  config.startLen = randomLogInt(1, 12);
  config.grow = RNG.int(2) === 0;
  config.timeStart = 2 + RNG.int(9);
  config.timeAdd = 1 + RNG.int(3);
  config.speed = Object.keys(SPEEDS)[RNG.int(4)];
  renderAll();
  applyBoardColors();
  save();
  toast("🔀 Tout est au hasard !");
}

// ----- Démarrage -----
async function init() {
  els.year.textContent = new Date().getFullYear();
  load();
  document.documentElement.dataset.theme = prefs.theme || document.documentElement.dataset.theme;
  Sound.setEnabled(prefs.sound !== false);
  Haptics.setEnabled(prefs.vib !== false);
  setSound(prefs.sound !== false);
  setVib(prefs.vib !== false);

  buildTrail();
  bindEvents();

  const shared = location.hash.match(/^#c=([\w-]+)/);
  const wantView = config.view;
  await setView("2d", { silent: true });
  renderAll();
  idleCore();
  setStatus("Prêt ?", "Lance la partie !");

  if (shared) {
    try {
      await applySharedCode(shared[1]);
      toast("Configuration chargée depuis le lien ! 🎉");
    } catch (e) {
      toast("Ce lien n’est pas valide.");
    }
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (wantView === "3d") await setView("3d", { silent: true });

  // La police peut arriver après le premier dessin du plateau 3D
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (boards["3d"]) { boards["3d"].lastCoreText = ""; boards["3d"].coreChanged(); }
    });
  }
}

init();
