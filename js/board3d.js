// ===== Plateau 3D : orbes sur un tapis de jeu, avec Three.js =====
"use strict";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

// Charge Three.js seulement quand on choisit la 3D
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (loadThree.promise) return loadThree.promise;
  loadThree.promise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = THREE_URL;
    s.onload = resolve;
    s.onerror = () => { loadThree.promise = null; reject(new Error("Three.js indisponible")); };
    document.head.appendChild(s);
  });
  return loadThree.promise;
}

// Three.js r128 calcule en couleurs linéaires : sans cette conversion, tout sort délavé
const linearColor = (value) => new window.THREE.Color(value).convertSRGBToLinear();

class Board3D extends BoardBase {
  constructor(host) {
    super(host);
    const T = window.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputEncoding = T.sRGBEncoding;
    // Pas de « tone mapping » : il délaverait les couleurs, et ici elles sont tout le jeu
    this.renderer.toneMapping = T.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    host.appendChild(this.canvas);

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(26, 1, 0.1, 300);
    this.camTarget = new T.Vector3(0, 0.3, 0.1);
    this.camDir = new T.Vector3(0, 0.86, 0.5).normalize();
    this.camDist = 16;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.W = 0;
    this.H = 0;
    this.layout = { pads: [], rings: [], coreR: 1.4, r: 1 };
    this.view = new T.Vector3();

    this.glowTex = this._makeGlowTexture();
    this.scene.environment = this._makeEnvironment();
    this._buildLights();
    this._buildTable();
    this._buildCore();
    this._buildFx();

    this.orbGeo = new T.SphereGeometry(1, 48, 32);
    this.ringGeo = new T.TorusGeometry(1, 0.045, 12, 64);
    this.beamGeo = new T.CylinderGeometry(1, 1, 1, 10, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
    this.discGeo = new T.CircleGeometry(1, 40);
    this.padsGroup = new T.Group();
    this.scene.add(this.padsGroup);

    this.lastCoreText = "";
    this.resizeObs = new ResizeObserver(() => this.relayout());
    this.resizeObs.observe(host);
    host.addEventListener("pointermove", (e) => {
      const b = host.getBoundingClientRect();
      this.pointer.x = (e.clientX - b.left) / b.width - 0.5;
      this.pointer.y = (e.clientY - b.top) / b.height - 0.5;
    });
    this.coreChanged();
  }

  // ----- Textures -----
  _makeGlowTexture() {
    const T = window.THREE;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }

  // Studio photo : un fond sombre avec des panneaux lumineux, pour les reflets sur le verre
  _makeEnvironment() {
    const T = window.THREE;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#5a4a8a");
    sky.addColorStop(0.5, "#1c1530");
    sky.addColorStop(1, "#08060e");
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 256);
    const panel = (x, y, w, h, color) => {
      g.fillStyle = color;
      g.filter = "blur(6px)";
      g.fillRect(x, y, w, h);
      g.filter = "none";
    };
    panel(60, 22, 110, 54, "#ffffff");
    panel(250, 34, 60, 80, "#ffe45c");
    panel(390, 28, 80, 70, "#c9b0ff");
    const tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.encoding = T.sRGBEncoding;
    const pmrem = new T.PMREMGenerator(this.renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }

  _makeFeltTexture() {
    const T = window.THREE;
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const base = g.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size / 2);
    base.addColorStop(0, "#2d2150");
    base.addColorStop(0.65, "#191230");
    base.addColorStop(1, "#0c0917");
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    // Grain de la feutrine
    for (let k = 0; k < 26000; k++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.028})`;
      g.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6);
    }
    // Anneaux jaune et mauve
    const ring = (r, css, w) => {
      g.strokeStyle = css;
      g.lineWidth = w;
      g.beginPath();
      g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      g.stroke();
    };
    ring(492, "rgba(255,214,10,0.75)", 7);
    ring(474, "rgba(155,109,255,0.65)", 3);
    ring(190, "rgba(155,109,255,0.22)", 2);
    // X Turbonix en filigrane
    g.save();
    g.translate(size / 2, size / 2);
    g.globalAlpha = 0.08;
    g.fillStyle = "#ffd60a";
    const x = 150;
    for (const flip of [1, -1]) {
      g.beginPath();
      g.moveTo(flip * -x, -x);
      g.lineTo(flip * (-x + 62), -x);
      g.lineTo(flip * x, x);
      g.lineTo(flip * (x - 62), x);
      g.closePath();
      g.fill();
    }
    g.restore();
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  // ----- Construction de la scène -----
  _buildLights() {
    const T = window.THREE;
    this.scene.add(new T.HemisphereLight(0xffffff, 0x120c22, 0.42));
    const key = new T.DirectionalLight(0xffffff, 1.05);
    key.position.set(-5, 13, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -11;
    key.shadow.camera.right = key.shadow.camera.top = 11;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 5;
    this.scene.add(key);
    const rim = new T.DirectionalLight(0x9b6dff, 0.35);
    rim.position.set(7, 4, -9);
    this.scene.add(rim);
    // Deux lumières colorées seulement : leur nombre reste fixe, donc le coût aussi
    this.flashLight = new T.PointLight(0xffffff, 0, 16, 1.6);
    this.flashLight.position.set(0, 2.4, 0);
    this.scene.add(this.flashLight);
    this.coreLight = new T.PointLight(0x9b6dff, 0.9, 10, 1.6);
    this.coreLight.position.set(0, 1.5, 0);
    this.scene.add(this.coreLight);
  }

  _buildTable() {
    const T = window.THREE;
    this.table = new T.Mesh(
      new T.CircleGeometry(1, 96),
      new T.MeshStandardMaterial({ map: this._makeFeltTexture(), roughness: 0.92, metalness: 0.02 })
    );
    this.table.rotation.x = -Math.PI / 2;
    this.table.receiveShadow = true;
    this.scene.add(this.table);
  }

  _buildCore() {
    const T = window.THREE;
    this.coreGroup = new T.Group();
    this.scene.add(this.coreGroup);
    this.crystalMat = new T.MeshPhysicalMaterial({
      color: 0xd8ccff, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05,
      flatShading: true, emissive: 0x9b6dff, emissiveIntensity: 0.35, transparent: true, opacity: 0.94,
    });
    this.crystal = new T.Mesh(new T.IcosahedronGeometry(1, 0), this.crystalMat);
    this.crystal.castShadow = true;
    this.coreGroup.add(this.crystal);

    const orbitMat = (color) => new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false });
    this.orbitA = new T.Mesh(new T.TorusGeometry(1.5, 0.018, 8, 90), orbitMat(0xffd60a));
    this.orbitB = new T.Mesh(new T.TorusGeometry(1.75, 0.014, 8, 90), orbitMat(0x9b6dff));
    this.coreGroup.add(this.orbitA, this.orbitB);

    this.coreHalo = new T.Sprite(new T.SpriteMaterial({ map: this.glowTex, color: 0x9b6dff, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    this.coreGroup.add(this.coreHalo);

    // Compteur : une petite texture redessinée uniquement quand le texte change
    this.labelCanvas = document.createElement("canvas");
    this.labelCanvas.width = this.labelCanvas.height = 256;
    this.labelTex = new T.CanvasTexture(this.labelCanvas);
    this.labelTex.encoding = T.sRGBEncoding;
    this.label = new T.Sprite(new T.SpriteMaterial({ map: this.labelTex, transparent: true, depthTest: false, depthWrite: false }));
    this.label.renderOrder = 10;
    this.scene.add(this.label);
  }

  _buildFx() {
    const T = window.THREE;
    // Particules : réserve fixe
    this.pCount = 520;
    this.pPos = new Float32Array(this.pCount * 3);
    this.pCol = new Float32Array(this.pCount * 3);
    this.pBase = new Float32Array(this.pCount * 3);
    this.pVel = new Float32Array(this.pCount * 3);
    this.pLife = new Float32Array(this.pCount);
    this.pMax = new Float32Array(this.pCount);
    this.pAt = 0;
    this.pAlive = false;
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(this.pPos, 3));
    geo.setAttribute("color", new T.BufferAttribute(this.pCol, 3));
    this.points = new T.Points(geo, new T.PointsMaterial({
      size: 0.24, map: this.glowTex, vertexColors: true, transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // Ondes sur le tapis : réserve fixe
    const ringGeo = new T.RingGeometry(0.93, 1, 64);
    this.shocks = Array.from({ length: 10 }, () => {
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      return { mesh: m, life: 0, max: 1, from: 0, to: 1 };
    });
    this.shockAt = 0;
  }

  _rebuildPads() {
    const T = window.THREE;
    while (this.padsGroup.children.length) {
      const child = this.padsGroup.children.pop();
      child.traverse((o) => { if (o.material) o.material.dispose(); });
    }
    this.meshes = this.pads.map((p) => {
      const color = linearColor(p.hex);
      const group = new T.Group();
      const orbMat = new T.MeshPhysicalMaterial({
        color, roughness: 0.14, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.06,
        emissive: color, emissiveIntensity: 0.1, envMapIntensity: 0.9, transparent: true,
      });
      const orb = new T.Mesh(this.orbGeo, orbMat);
      orb.castShadow = true;
      const ringMat = new T.MeshStandardMaterial({ color: 0x3b3350, roughness: 0.3, metalness: 0.85, emissive: color, emissiveIntensity: 0.2 });
      const ring = new T.Mesh(this.ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      const pool = new T.Mesh(this.discGeo, new T.MeshBasicMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.15, blending: T.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      const halo = new T.Sprite(new T.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
      const beam = new T.Mesh(this.beamGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      beam.visible = false;
      group.add(orb, ring, pool, halo);
      this.padsGroup.add(group, beam);
      return { group, orb, orbMat, ring, ringMat, pool, halo, beam, color, gray: linearColor(0x56526a), work: new T.Color() };
    });
  }

  relayout() {
    const T = window.THREE;
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    if (!W || !H || !this.pads.length) return;
    if (this.W !== W || this.H !== H) {
      this.W = W;
      this.H = H;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(W, H, false);
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
    }
    const aspect = W / H;
    // En portrait, le plateau s'étire en hauteur pour occuper toute la zone
    const worldW = aspect < 0.9 ? 12 : 12 * Math.min(1.6, aspect * 1.25);
    const worldH = aspect < 0.9 ? Math.min(20, (12 / aspect) * 1.1) : 12;
    this.layout = layoutPads(this.pads.length, worldW, worldH, 0.03);
    if (!this.meshes || this.meshes.length !== this.pads.length || this.meshesKey !== this.colorsKey) {
      this._rebuildPads();
      this.meshesKey = this.colorsKey;
    }
    this.pads.forEach((p, i) => {
      const at = this.layout.pads[i];
      p.x = at.x;
      p.z = at.y;
      p.r = at.r * 0.8; // Les orbes flottent, donc paraissent plus grosses : on les réduit un peu
      const m = this.meshes[i];
      m.pool.scale.setScalar(p.r * 2.6);
      m.pool.position.y = 0.02;
      m.ring.position.y = 0.05;
    });

    const ring = this.layout.rings[0];
    const extX = ring.rx + this.layout.r + 0.8;
    const extZ = ring.ry + this.layout.r + 0.8;
    this.table.scale.set(extX * 1.03, extZ * 1.03, 1);

    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    this.camDist = Math.max((extZ * 1.02) / tan, extX / (tan * aspect)) * 1.06;

    const coreR = this.layout.coreR;
    this.crystal.scale.setScalar(coreR * 0.55);
    this.orbitA.scale.setScalar(coreR * 0.62);
    this.orbitB.scale.setScalar(coreR * 0.62);
    this.coreHalo.scale.setScalar(coreR * 3.8);
    this.coreGroup.position.y = coreR * 0.75 + 0.3;
    this.label.position.set(0, this.coreGroup.position.y + coreR * 0.2, 0);
    this.label.scale.setScalar(coreR * 1.7);
  }

  // ----- Texte du centre -----
  coreChanged() {
    const c = this.core;
    const progress = Math.round((c.progress || 0) * 80);
    const text = `${c.big}|${c.small}|${progress}`;
    if (text === this.lastCoreText) return;
    this.lastCoreText = text;
    const g = this.labelCanvas.getContext("2d");
    const S = 256;
    const R = 116;
    g.clearRect(0, 0, S, S);
    const disc = g.createRadialGradient(S / 2 - 30, S / 2 - 40, 8, S / 2, S / 2, R);
    disc.addColorStop(0, "rgba(59,45,94,0.92)");
    disc.addColorStop(1, "rgba(13,10,21,0.9)");
    g.fillStyle = disc;
    g.beginPath();
    g.arc(S / 2, S / 2, R, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = "rgba(201,176,255,0.75)";
    g.stroke();
    if (c.progress > 0.002) {
      const grad = g.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, "#ffd60a");
      grad.addColorStop(1, "#9b6dff");
      g.strokeStyle = grad;
      g.lineWidth = 11;
      g.lineCap = "round";
      g.beginPath();
      g.arc(S / 2, S / 2, R - 14, -Math.PI / 2, -Math.PI / 2 + Math.min(1, c.progress) * Math.PI * 2);
      g.stroke();
    }
    const big = String(c.big);
    const size = big.length <= 2 ? 92 : big.length === 3 ? 74 : big.length === 4 ? 58 : 46;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.font = `900 ${size}px Outfit, "Segoe UI", sans-serif`;
    g.fillText(big, S / 2, S / 2 - (c.small ? 12 : 0));
    if (c.small) {
      g.font = '700 26px Outfit, "Segoe UI", sans-serif';
      g.fillStyle = "#c9b0ff";
      g.fillText(c.small, S / 2, S / 2 + 50);
    }
    this.labelTex.needsUpdate = true;
  }

  // ----- Effets -----
  _shock(x, z, from, to, color, life) {
    const s = this.shocks[this.shockAt++ % this.shocks.length];
    s.mesh.material.color.copy(linearColor(color));
    s.mesh.position.set(x, 0.05, z);
    s.mesh.visible = true;
    Object.assign(s, { from, to, life, max: life });
  }

  _burst(x, y, z, color, count, speed = 4.5, grav = 5) {
    if (this.reduced) return;
    const c = color.isColor ? color : linearColor(color);
    for (let k = 0; k < count; k++) {
      const i = this.pAt++ % this.pCount;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 1.2 - 0.1;
      const v = speed * (0.35 + Math.random() * 0.8);
      this.pPos.set([x, y, z], i * 3);
      this.pVel.set([Math.cos(a) * v, up * v, Math.sin(a) * v], i * 3);
      this.pBase.set([c.r, c.g, c.b], i * 3);
      this.pLife[i] = this.pMax[i] = 0.5 + Math.random() * 0.6;
    }
    this.pGrav = grav;
    this.pAlive = true;
  }

  onFlash(p, ms, strength) {
    // Les orbes n'existent pas tant que la zone de jeu n'a pas de taille (onglet ou panneau qui s'ouvre)
    if (!this.meshes || !this.meshes[p.i]) return;
    const quick = ms < 120;
    this._shock(p.x, p.z, p.r * 0.9, p.r * 2.9, p.hex, quick ? 0.35 : 0.7);
    this._burst(p.x, p.r + 1, p.z, this.meshes[p.i].color, Math.round((quick ? 5 : 16) * strength));
    this.flashLight.color.copy(this.meshes[p.i].color);
    this.flashLight.position.set(p.x, p.r + 2.4, p.z);
    this.flashLight.intensity = 4.5;
  }

  onPing() {
    this._shock(0, 0, this.layout.coreR, this.layout.coreR * 2.4, "#ffffff", 0.55);
  }

  onWrong(p) {
    this._shock(p.x, p.z, p.r, p.r * 3.6, "#ff4d6d", 0.8);
    this._burst(p.x, p.r + 1, p.z, 0xff4d6d, 42, 6.5, 9);
  }

  onCelebrate(level) {
    this._shock(0, 0, this.layout.coreR, 13, "#ffd60a", 1);
    if (level > 1) {
      this._shock(0, 0, this.layout.coreR, 10, "#9b6dff", 1.25);
      const bursts = level > 2 ? 6 : 3;
      for (let k = 0; k < bursts; k++) {
        this.schedule(k * 260, () => {
          const x = (Math.random() - 0.5) * 11;
          const z = (Math.random() - 0.5) * 8;
          const col = [0xffd60a, 0x9b6dff, 0xffffff, 0xc4a8ff][k % 4];
          this._burst(x, 3 + Math.random() * 3, z, col, 46, 7, 6);
          this._shock(x, z, 0.2, 3, col, 0.7);
        });
      }
    }
  }

  // ----- Pointeur -----
  pick(x, y) {
    if (!this.W || !this.meshes || this.meshes.length !== this.pads.length) return -1;
    let best = -1;
    let bestD = Infinity;
    for (const p of this.pads) {
      const m = this.meshes[p.i];
      const pos = this._toScreen(m.group.position.x, m.orb.position.y, m.group.position.z);
      const edge = this._toScreen(m.group.position.x + p.r, m.orb.position.y, m.group.position.z);
      const radius = Math.hypot(edge.x - pos.x, edge.y - pos.y);
      const d = Math.hypot(x - pos.x, y - pos.y);
      if (d < radius * 1.3 && d < bestD) { best = p.i; bestD = d; }
    }
    if (best >= 0) return best;
    const c = this._toScreen(0, this.label.position.y, 0);
    const e = this._toScreen(this.layout.coreR * 0.85, this.label.position.y, 0);
    if (Math.hypot(x - c.x, y - c.y) < Math.hypot(e.x - c.x, e.y - c.y)) return -2;
    return -1;
  }

  _toScreen(x, y, z) {
    this.view.set(x, y, z).project(this.camera);
    return { x: (this.view.x * 0.5 + 0.5) * this.W, y: (-this.view.y * 0.5 + 0.5) * this.H };
  }

  // ----- Dessin -----
  draw(dt) {
    if (!this.W || !this.meshes || this.meshes.length !== this.pads.length) return;
    const time = this.time;

    // Caméra : suit doucement le pointeur et respire
    const pt = this.pointer;
    pt.sx += (pt.x - pt.sx) * (1 - Math.exp(-dt * 3));
    pt.sy += (pt.y - pt.sy) * (1 - Math.exp(-dt * 3));
    const motion = this.reduced ? 0 : 1;
    const cam = this.camera.position;
    cam.copy(this.camDir).multiplyScalar(this.camDist).add(this.camTarget);
    cam.x += motion * (pt.sx * 2.4 + Math.sin(time * 0.3) * 0.25);
    cam.z += motion * (pt.sy * 1.3);
    if (this.shake) {
      cam.x += Math.sin(time * 71) * this.shake * 0.35;
      cam.y += Math.cos(time * 57) * this.shake * 0.3;
    }
    this.camera.lookAt(this.camTarget);

    // Orbes
    const core = this.coreGroup.position;
    this.pads.forEach((p, i) => {
      const m = this.meshes[i];
      const appear = Math.max(0, p.appear);
      const hover = p.r + 0.42 + (motion ? Math.sin(time * 1.25 + p.phase) * 0.08 : 0);
      const rest = p.r + 0.08;
      const y = hover + (rest - hover) * p.fall + p.lift * 0.6;
      const glow = p.glow * (1 - p.mute);
      const scale = p.r * appear * (1 + glow * 0.16);

      m.group.position.set(p.x, 0, p.z);
      m.orb.position.y = y;
      m.orb.scale.setScalar(Math.max(0.001, scale));
      m.orb.visible = p.alpha > 0.01 && appear > 0.01;
      m.orbMat.opacity = p.alpha;
      m.work.copy(m.color).lerp(m.gray, p.mute);
      m.orbMat.color.copy(m.work);
      m.orbMat.emissive.copy(m.work);
      m.orbMat.emissiveIntensity = 0.14 * (1 - p.mute) + glow * 1.4;

      const padOn = this.show === "hidden" ? 0.05 : 0.2 * (1 - p.mute);
      m.ringMat.emissive.copy(m.work);
      m.ringMat.emissiveIntensity = padOn + glow * 2.4;

      m.pool.material.opacity = (this.show === "hidden" ? 0 : 0.14 * (1 - p.mute)) + glow * 0.95;
      m.halo.position.y = y;
      m.halo.scale.setScalar(p.r * (2.2 + glow * 3.6));
      m.halo.material.opacity = (0.07 * (1 - p.mute) + glow * 0.9) * p.alpha;
      m.halo.visible = p.alpha > 0.01;

      // Faisceau entre le centre et l'orbe
      const beamOn = glow * p.alpha;
      m.beam.visible = beamOn > 0.04;
      if (m.beam.visible) {
        const dx = p.x - core.x;
        const dy = y - core.y;
        const dz = p.z - core.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        m.beam.position.copy(core);
        m.beam.scale.set(0.02 + beamOn * 0.075, len, 0.02 + beamOn * 0.075);
        this.view.set(dx / len, dy / len, dz / len);
        m.beam.quaternion.setFromUnitVectors(Board3D.UP, this.view);
        m.beam.material.opacity = beamOn * 0.85;
      }

      // Marque « c'était celle-ci » après une erreur
      if (p.mark > 0) {
        const beat = 0.5 + 0.5 * Math.sin(time * 14);
        m.ringMat.emissive.setRGB(1, 1, 1);
        m.ringMat.emissiveIntensity = p.mark * (1 + beat * 3);
        m.ring.scale.setScalar(p.r * (1.08 + beat * 0.14 * p.mark));
      } else {
        m.ring.scale.setScalar(p.r * 1.08);
      }
    });

    // Centre
    const spin = motion ? 0.35 + this.energy * 2.2 : 0;
    this.crystal.rotation.y += dt * spin;
    this.crystal.rotation.x += dt * spin * 0.5;
    this.orbitA.rotation.x = 1.25 + Math.sin(time * 0.6) * 0.3;
    this.orbitA.rotation.y += dt * spin * 1.4;
    this.orbitB.rotation.x = 1.75 + Math.cos(time * 0.5) * 0.3;
    this.orbitB.rotation.y -= dt * spin * 1.1;
    const c = this.core;
    const tint = this.crystalMat.emissive;
    tint.setRGB(c.tint[0] / 255, c.tint[1] / 255, c.tint[2] / 255).convertSRGBToLinear();
    this.crystalMat.emissiveIntensity = 0.3 + c.pulse * 1.3;
    this.coreHalo.material.color.copy(tint);
    this.coreHalo.material.opacity = 0.32 + c.pulse * 0.55;
    this.coreLight.color.copy(tint);
    this.coreLight.intensity = 0.8 + c.pulse * 1.6;
    this.flashLight.intensity *= Math.exp(-dt * 7);

    this._updateFx(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateFx(dt) {
    for (const s of this.shocks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const t = Math.max(0, 1 - s.life / s.max);
      const eased = 1 - (1 - t) ** 3;
      s.mesh.scale.setScalar(s.from + (s.to - s.from) * eased);
      s.mesh.material.opacity = (1 - t) * 0.9;
      if (s.life <= 0) s.mesh.visible = false;
    }

    if (!this.pAlive) return;
    let alive = false;
    const g = this.pGrav || 5;
    for (let i = 0; i < this.pCount; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      const j = i * 3;
      if (this.pLife[i] <= 0) {
        this.pCol[j] = this.pCol[j + 1] = this.pCol[j + 2] = 0;
        continue;
      }
      alive = true;
      this.pVel[j + 1] -= g * dt;
      this.pVel[j] *= 1 - 1.2 * dt;
      this.pVel[j + 2] *= 1 - 1.2 * dt;
      this.pPos[j] += this.pVel[j] * dt;
      this.pPos[j + 1] += this.pVel[j + 1] * dt;
      this.pPos[j + 2] += this.pVel[j + 2] * dt;
      const t = this.pLife[i] / this.pMax[i];
      this.pCol[j] = this.pBase[j] * t;
      this.pCol[j + 1] = this.pBase[j + 1] * t;
      this.pCol[j + 2] = this.pBase[j + 2] * t;
    }
    this.pAlive = alive;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// Défini une fois Three.js chargé (voir app.js)
Board3D.init = () => { Board3D.UP = new window.THREE.Vector3(0, 1, 0); };
