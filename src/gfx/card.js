// A physical card on the table: rounded slab + printed face, springy motion,
// tilt while dragged, flip, Stacklands-style progress bar, highlight glow.
import * as THREE from 'three';
import * as D from './draw.js';
import { CARD, faceGeometry, slabGeometry, canvasTexture } from './world.js';
import { CARDS } from '../content.js';

const bodyGeo = slabGeometry(CARD.w, CARD.h, CARD.r, CARD.t);
const faceGeo = faceGeometry(CARD.w, CARD.h, CARD.r);
const backGeo = faceGeometry(CARD.w, CARD.h, CARD.r).rotateZ(Math.PI);
const glowGeo = faceGeometry(CARD.w + 0.2, CARD.h + 0.2, CARD.r + 0.1);
const bodyMat = new THREE.MeshLambertMaterial({ color: D.INK });

// ------------------------------------------------------------------ art + textures

const art = new Map();
export async function loadArt() {
  let manifest = {};
  try {
    const res = await fetch('art/cards/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* no manifest: placeholders everywhere */ }
  await Promise.all(Object.entries(manifest).map(([id, file]) => new Promise((resolve) => {
    if (!CARDS[id]) return resolve();
    const img = new Image();
    img.onload = () => { art.set(id, img); resolve(); };
    img.onerror = () => resolve();
    img.src = `art/cards/${file}`;
  })));
}

const faceCache = new Map();
let anisotropy = 4;
export function setAnisotropy(a) { anisotropy = a; }

function faceTexture(key, draw) {
  let t = faceCache.get(key);
  if (!t) {
    t = canvasTexture(draw());
    t.anisotropy = anisotropy;
    faceCache.set(key, t);
  }
  return t;
}
export function cardTexture(id, perm = 0, summon = false) {
  return faceTexture(`c:${id}:${perm}:${summon}`, () => D.drawCard(CARDS[id], { perm, art: art.get(id), summon }));
}
export function packTexture(packId) {
  return faceTexture(`p:${packId}`, () => D.drawPack(packId));
}
let backTex = null;

// ------------------------------------------------------------------ bar

function makeBar() {
  const g = new THREE.Group();
  const w = 1.02;
  const h = 0.17;
  const mk = (gw, gh, color, y) => {
    const geo = new THREE.PlaneGeometry(gw, gh);
    geo.translate(gw / 2, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(-gw / 2, y, 0);
    g.add(m);
    return m;
  };
  mk(w + 0.06, h + 0.06, D.INK, 0);
  mk(w - 0.04, h - 0.05, '#fbf7ec', 0.002);
  const fill = mk(w - 0.04, h - 0.05, D.INK, 0.004);
  fill.scale.x = 0;
  g.visible = false;
  g.userData.fill = fill;
  return g;
}

// ------------------------------------------------------------------ card

let layerCounter = 1;

export class CardView {
  constructor(scene, { id = null, pack = null, inst = null, perm = 0, summon = false, faceDown = false }) {
    this.id = id;
    this.pack = pack;
    this.inst = inst;
    this.perm = perm;
    this.summon = summon;
    this.root = new THREE.Group();
    this.tiltGroup = new THREE.Group();
    this.root.add(this.tiltGroup);

    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.faceMat = new THREE.MeshLambertMaterial({ map: pack ? packTexture(pack) : cardTexture(id, perm, summon), transparent: true });
    this.face = new THREE.Mesh(faceGeo, this.faceMat);
    this.face.position.y = CARD.t + 0.001;
    this.face.receiveShadow = true;
    if (!backTex) backTex = canvasTexture(D.drawCardBack());
    this.back = new THREE.Mesh(backGeo, new THREE.MeshLambertMaterial({ map: backTex }));
    this.back.rotation.x = Math.PI;
    this.back.position.y = -0.001;
    this.glowMat = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false });
    this.glow = new THREE.Mesh(glowGeo, this.glowMat);
    this.glow.position.y = 0.001;
    this.glow.renderOrder = -1;
    this.frostMat = new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0, depthWrite: false });
    this.frost = new THREE.Mesh(faceGeo, this.frostMat);
    this.frost.position.y = CARD.t + 0.004;
    this.tiltGroup.add(this.body, this.face, this.back, this.glow, this.frost);

    this.bar = makeBar();
    this.bar.position.set(0, CARD.t + 0.01, -CARD.h / 2 - 0.2);
    this.tiltGroup.add(this.bar);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.lift = 0;
    this.liftGoal = 0;
    this.scale = 1;
    this.scaleVel = 0;
    this.scaleGoal = 1;
    this.flip = faceDown ? Math.PI : 0;
    this.flipGoal = 0;
    this.tilt = new THREE.Vector2();
    this.flight = null;
    this.dragging = false;
    this.stiff = 160;
    this.glowGoal = 0;
    this.glowColor = new THREE.Color('#fff3a0');
    this.frostGoal = 0;
    this.layer = layerCounter++;
    this.dead = false;
    this.busy = false;
    this.restLift = 0;
    this.hopY = 0;
    this.hopV = 0;
    this.root.userData.card = this;
    this.pickMeshes = [this.body, this.face];
    for (const m of this.pickMeshes) m.userData.card = this;
    scene.add(this.root);
  }

  get def() { return this.id ? CARDS[this.id] : null; }

  setFace(id, perm = this.perm) {
    this.id = id;
    this.perm = perm;
    this.faceMat.map = cardTexture(id, perm, this.summon);
    this.faceMat.needsUpdate = true;
  }

  place(x, z) {
    this.pos.set(x, 0, z);
    this.target.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.root.position.copy(this.pos);
    return this;
  }

  moveTo(x, z) {
    this.target.set(x, 0, z);
    return this;
  }

  // Arc through the air to a destination over `dur` seconds.
  flyTo(x, z, { dur = 0.55, arc = 1.6, delay = 0, done = null, spin = 0 } = {}) {
    this.flight = { from: this.pos.clone(), to: new THREE.Vector3(x, 0, z), t: -delay, dur, arc, done, spin, lastFlip: this.flip };
    this.target.set(x, 0, z);
    return this;
  }

  raise() { this.layer = layerCounter++; }

  kick(amount = 0.12) { this.scaleVel += amount * 30; }

  hop(v = 2.4) { if (this.hopY <= 0.001) this.hopV = v; }

  setBar(p, color = null) {
    this.bar.visible = p != null;
    if (p == null) return;
    const fill = this.bar.userData.fill;
    fill.scale.x = Math.max(0.0001, Math.min(1, p));
    if (color) fill.material.color.set(color);
  }

  update(dt) {
    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      if (f.t >= 0) {
        const u = Math.min(1, f.t / f.dur);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const prev = this.pos.clone();
        this.pos.lerpVectors(f.from, f.to, e);
        this.pos.y = Math.sin(Math.PI * u) * f.arc;
        if (dt > 0) this.vel.copy(this.pos).sub(prev).divideScalar(dt);
        if (f.spin) this.flip = f.lastFlip + (f.spin - f.lastFlip) * e;
        if (u >= 1) {
          this.flight = null;
          this.pos.y = 0;
          this.vel.set(0, 0, 0);
          this.kick(0.08);
          f.done?.(this);
        }
      }
    } else {
      const k = this.dragging ? 900 : this.stiff;
      const c = 2 * Math.sqrt(k) * (this.dragging ? 1 : 0.95);
      // Substep so the stiff spring stays stable on slow frames.
      const n = Math.ceil(dt / (1 / 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const ax = (this.target.x - this.pos.x) * k - this.vel.x * c;
        const az = (this.target.z - this.pos.z) * k - this.vel.z * c;
        this.vel.x += ax * h;
        this.vel.z += az * h;
        this.pos.x += this.vel.x * h;
        this.pos.z += this.vel.z * h;
      }
      this.pos.y = 0;
    }

    this.lift += (this.liftGoal - this.lift) * (1 - Math.exp(-dt * 18));
    if (this.hopV || this.hopY > 0) {
      this.hopY += this.hopV * dt;
      this.hopV -= 28 * dt;
      if (this.hopY <= 0) { this.hopY = 0; this.hopV = 0; }
    }
    const sk = 320;
    for (let i = 0, n = Math.ceil(dt / (1 / 240)), h = dt / n; i < n; i++) {
      this.scaleVel += ((this.scaleGoal - this.scale) * sk - this.scaleVel * 2 * Math.sqrt(sk) * 0.45) * h;
      this.scale += this.scaleVel * h;
    }
    if (!this.flight) this.flip += (this.flipGoal - this.flip) * (1 - Math.exp(-dt * 10));

    const tx = THREE.MathUtils.clamp(this.vel.z * 0.035, -0.4, 0.4);
    const tz = THREE.MathUtils.clamp(-this.vel.x * 0.035, -0.4, 0.4);
    this.tilt.x += (tx - this.tilt.x) * (1 - Math.exp(-dt * 14));
    this.tilt.y += (tz - this.tilt.y) * (1 - Math.exp(-dt * 14));

    const base = 0.002 + (this.layer % 60) * 0.0035;
    this.root.position.set(this.pos.x, base + this.pos.y + this.lift + this.hopY, this.pos.z);
    this.tiltGroup.rotation.set(this.tilt.x, 0, this.tilt.y + this.flip, 'XZY');
    this.root.scale.setScalar(Math.max(0.01, this.scale));

    const go = this.glowGoal;
    this.glowMat.opacity += (go - this.glowMat.opacity) * (1 - Math.exp(-dt * 12));
    this.glowMat.color.copy(this.glowColor);
    this.glow.visible = this.glowMat.opacity > 0.01;
    this.frostMat.opacity += (this.frostGoal - this.frostMat.opacity) * (1 - Math.exp(-dt * 10));
    this.frost.visible = this.frostMat.opacity > 0.01;
  }

  dispose(scene) {
    this.dead = true;
    scene.remove(this.root);
    this.faceMat.dispose();
    this.glowMat.dispose();
    this.frostMat.dispose();
    this.bar.traverse((o) => o.material?.dispose?.());
  }
}
