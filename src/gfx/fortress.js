// In-world fortress readouts for fights: an HP plaque beside each tower and
// fixed "combo counters" that add up hits of one kind, then float away.
// Nothing stacks on the castle itself, so every number stays readable.
import * as THREE from 'three';
import * as D from './draw.js';
import { canvasTexture } from './world.js';

const KIND = {
  hit: { color: '#fff7e6', icon: 'dmg', sign: '-' },
  blocked: { color: '#8fbfee', icon: 'shield', sign: '-' },
  burn: { color: '#ff9a4a', icon: 'burn', sign: '-' },
  poison: { color: '#9fd05f', icon: 'poison', sign: '-' },
  heal: { color: '#ff8f86', icon: 'heal', sign: '+' },
  shield: { color: '#8fbfee', icon: 'shield', sign: '+' },
  sudden: { color: '#e05050', icon: null, sign: '-' },
};

// Lane offsets from the tower (x, z). Damage on the left, gains on the right.
const LANES = {
  hit: [-2.6, -0.55], blocked: [-2.6, 0.35], burn: [-4.6, -0.55], poison: [-4.6, 0.35], sudden: [-4.6, 1.2],
  heal: [6.4, -0.55], shield: [6.4, 0.35],
};

function drawPlaque(st) {
  const W = 640;
  const H = 150;
  const cv = D.canvas(W, H);
  const c = cv.getContext('2d');
  c.fillStyle = '#2b2724';
  D.rrect(c, 0, 0, W, H, 34);
  c.fill();
  const bx = 24;
  const by = 62;
  const bw = W - 48;
  const bh = 46;
  c.fillStyle = '#4a433d';
  D.rrect(c, bx, by, bw, bh, 23);
  c.fill();
  const p = Math.max(0, st.hp) / st.max;
  const lag = Math.max(p, st.lag / st.max);
  c.save();
  D.rrect(c, bx, by, bw, bh, 23);
  c.clip();
  c.fillStyle = '#fff3d6';
  c.fillRect(bx, by, bw * lag, bh);
  c.fillStyle = st.flash > 0 ? '#ff9c90' : '#e8695d';
  c.fillRect(bx, by, bw * p, bh);
  if (st.healFlash > 0) {
    c.globalAlpha = st.healFlash;
    c.fillStyle = '#b8f0a0';
    c.fillRect(bx, by, bw * p, bh);
    c.globalAlpha = 1;
  }
  if (st.shield > 0) {
    const sw = bw * Math.min(1, st.shield / st.max);
    c.fillStyle = 'rgba(143,191,238,0.95)';
    c.fillRect(bx, by, sw, bh * 0.42);
  }
  c.fillStyle = 'rgba(0,0,0,0.14)';
  c.fillRect(bx, by + bh - 9, bw, 9);
  c.restore();
  c.fillStyle = '#fff';
  c.textBaseline = 'middle';
  c.font = '900 40px "Nunito", sans-serif';
  c.textAlign = 'left';
  D.glyph(c, 'heal', 44, 32, 40);
  c.fillText(`${Math.max(0, Math.ceil(st.hp))}`, 72, 33);
  c.globalAlpha = 0.55;
  c.font = '900 28px "Nunito", sans-serif';
  const hpW = c.measureText(`${Math.max(0, Math.ceil(st.hp))}`).width;
  c.font = '900 40px "Nunito", sans-serif';
  const hpW2 = c.measureText(`${Math.max(0, Math.ceil(st.hp))}`).width;
  c.font = '900 28px "Nunito", sans-serif';
  c.fillText(`/ ${st.max}`, 80 + hpW2, 36);
  c.globalAlpha = 1;
  void hpW;
  let x = W - 24;
  c.textAlign = 'right';
  c.font = '900 34px "Nunito", sans-serif';
  for (const [k, icon] of [['poison', 'poison'], ['burn', 'burn'], ['shield', 'shield']]) {
    if (!(st[k] > 0)) continue;
    const label = String(st[k]);
    const tw = c.measureText(label).width;
    c.fillText(label, x, 34);
    D.glyph(c, icon, x - tw - 22, 32, 34);
    x -= tw + 62;
  }
  return cv;
}

export function createFortressHud(scene, tower) {
  const g = new THREE.Group();
  scene.add(g);
  const plaqueMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.0), plaqueMat);
  plaque.rotation.x = -Math.PI / 2;
  plaque.renderOrder = 6;
  g.add(plaque);

  const st = { hp: 0, max: 1, lag: 0, shield: 0, burn: 0, poison: 0, flash: 0, healFlash: 0 };
  let dirty = true;
  let redraw = 0;
  const counters = {};
  const floaters = [];
  let kick = 0;

  function place() {
    g.position.set(tower.position.x, 0.05, tower.position.z);
    plaque.position.set(3.3, 0.02, 0);
  }
  place();

  function counterSprite(kind, value) {
    const k = KIND[kind];
    const cv = D.drawNumber(`${k.sign}${value}`, k.color, 96, k.icon);
    const mat = new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthTest: false, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.renderOrder = 30;
    sp.userData.aspect = cv.width / cv.height;
    return sp;
  }

  function setValue(c, kind) {
    const k = KIND[kind];
    const cv = D.drawNumber(`${k.sign}${c.value}`, k.color, 96, k.icon);
    c.sprite.material.map.dispose();
    c.sprite.material.map = canvasTexture(cv);
    c.sprite.userData.aspect = cv.width / cv.height;
  }

  return {
    reset(maxHp) {
      Object.assign(st, { hp: maxHp, max: maxHp, lag: maxHp, shield: 0, burn: 0, poison: 0, flash: 0, healFlash: 0 });
      for (const c of Object.values(counters)) { g.remove(c.sprite); c.sprite.material.map.dispose(); c.sprite.material.dispose(); }
      for (const k of Object.keys(counters)) delete counters[k];
      for (const f of floaters.splice(0)) g.remove(f.sprite);
      dirty = true;
      place();
      g.visible = true;
    },
    hide() { g.visible = false; },
    // Add an amount to a lane's running counter.
    add(kind, n) {
      if (!(n > 0) || !KIND[kind]) return;
      let c = counters[kind];
      if (!c) {
        c = { value: 0, idle: 0, pop: 0 };
        c.sprite = counterSprite(kind, n);
        const [lx, lz] = LANES[kind];
        c.sprite.position.set(lx, 1.2, lz);
        g.add(c.sprite);
        counters[kind] = c;
      }
      c.value += Math.round(n);
      c.idle = 0;
      c.pop = 1;
      setValue(c, kind);
      if (kind === 'hit' || kind === 'burn' || kind === 'poison' || kind === 'sudden') { st.flash = 0.25; kick = Math.min(1, kick + 0.35 + n / 30); }
      if (kind === 'heal') st.healFlash = 0.6;
    },
    set(S) {
      if (S.hp !== st.hp || S.shield !== st.shield || S.burn !== st.burn || S.poison !== st.poison) dirty = true;
      st.hp = S.hp;
      st.shield = S.shield;
      st.burn = S.burn;
      st.poison = S.poison;
    },
    update(dt) {
      // The pale "lag" bar drains down to the real HP so recent damage stays visible.
      if (st.lag > st.hp) { st.lag = Math.max(st.hp, st.lag - Math.max(6, (st.lag - st.hp) * 2.2) * dt); dirty = true; }
      else st.lag = st.hp;
      if (st.flash > 0) { st.flash -= dt; dirty = true; }
      if (st.healFlash > 0) { st.healFlash = Math.max(0, st.healFlash - dt * 1.5); dirty = true; }
      redraw -= dt;
      if (dirty && redraw <= 0) {
        plaqueMat.map?.dispose();
        plaqueMat.map = canvasTexture(drawPlaque(st));
        plaqueMat.needsUpdate = true;
        dirty = false;
        redraw = 0.06;
      }
      kick = Math.max(0, kick - dt * 3);
      tower.scale.set(0.9 * (1 + kick * 0.05), 0.9 * (1 - kick * 0.08), 0.9 * (1 + kick * 0.05));
      for (const [kind, c] of Object.entries(counters)) {
        c.idle += dt;
        c.pop = Math.max(0, c.pop - dt * 5);
        const s = 1.05 + Math.min(0.6, c.value / 60) + c.pop * 0.3;
        c.sprite.scale.set(s * c.sprite.userData.aspect, s, 1);
        // After a quiet moment the counter floats off and the lane is free again.
        if (c.idle > 1.1) {
          floaters.push({ sprite: c.sprite, age: 0 });
          delete counters[kind];
        }
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.age += dt;
        f.sprite.position.y += dt * 1.2;
        f.sprite.position.z -= dt * 0.5;
        f.sprite.material.opacity = Math.max(0, 1 - f.age / 0.7);
        if (f.age > 0.7) {
          g.remove(f.sprite);
          f.sprite.material.map.dispose();
          f.sprite.material.dispose();
          floaters.splice(i, 1);
        }
      }
    },
  };
}
