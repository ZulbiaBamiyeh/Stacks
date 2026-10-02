// Fight readouts, Bazaar style: a wide health bar beside each side's board with
// the HP number large in the middle, shield layered on top, and burn/poison
// chips at the end. Damage adds up in fixed counters beside the bar.
import * as THREE from 'three';
import * as D from './draw.js';
import { canvasTexture } from './world.js';
import { RULES } from '../content.js';

const KIND = {
  hit: { color: '#fff7e6', icon: 'dmg', sign: '-' },
  blocked: { color: '#8fbfee', icon: 'shield', sign: '-' },
  burn: { color: '#ff9a4a', icon: 'burn', sign: '-' },
  poison: { color: '#9fd05f', icon: 'poison', sign: '-' },
  heal: { color: '#8fe07a', icon: 'heal', sign: '+' },
  shield: { color: '#8fbfee', icon: 'shield', sign: '+' },
  sudden: { color: '#e05050', icon: null, sign: '-' },
};

export const BAR = { w: 9.6, h: 1.25 };

// Counter lanes relative to the bar centre (x, z). Losses left, gains right.
const LANES = {
  hit: [-6.5, -0.4], blocked: [-6.5, 0.45], burn: [-8.2, -0.4], poison: [-8.2, 0.45], sudden: [-8.2, 1.2],
  heal: [6.5, -0.4], shield: [6.5, 0.45],
};

const font = (px) => `900 ${px}px "Nunito", sans-serif`;

function drawBar(st) {
  const Wp = 1152;
  const Hp = 150;
  const cv = D.canvas(Wp, Hp);
  const c = cv.getContext('2d');
  // frame
  c.fillStyle = '#2b2724';
  D.rrect(c, 0, 0, Wp, Hp, 40);
  c.fill();
  const bx = 14;
  const by = 14;
  const bw = Wp - 28;
  const bh = Hp - 28;
  c.save();
  D.rrect(c, bx, by, bw, bh, 30);
  c.clip();
  c.fillStyle = '#4a433d';
  c.fillRect(bx, by, bw, bh);
  const p = Math.max(0, st.hp) / st.max;
  const lag = Math.min(1, Math.max(p, st.lag / st.max));
  c.fillStyle = '#fff3d6';
  c.fillRect(bx, by, bw * lag, bh);
  const hpGrad = c.createLinearGradient(0, by, 0, by + bh);
  hpGrad.addColorStop(0, st.flash > 0 ? '#ff9c8c' : '#7fd16a');
  hpGrad.addColorStop(1, st.flash > 0 ? '#e0604f' : '#4fa648');
  c.fillStyle = hpGrad;
  c.fillRect(bx, by, bw * p, bh);
  if (st.healFlash > 0) {
    c.globalAlpha = st.healFlash * 0.6;
    c.fillStyle = '#e8ffd8';
    c.fillRect(bx, by, bw * p, bh);
    c.globalAlpha = 1;
  }
  // Shield sits on top of the bar from the left, like The Bazaar.
  if (st.shield > 0) {
    const sw = bw * Math.min(1, st.shield / st.max);
    c.fillStyle = 'rgba(244, 214, 92, 0.92)';
    c.fillRect(bx, by, sw, bh * 0.38);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(bx, by, sw, bh * 0.1);
  }
  // segment ticks every 50 HP
  c.fillStyle = 'rgba(0,0,0,0.18)';
  for (let v = 50; v < st.max; v += 50) c.fillRect(bx + (bw * v) / st.max - 1.5, by + bh * 0.62, 3, bh * 0.38);
  c.restore();
  // big HP number centred
  const hpText = `${Math.max(0, Math.ceil(st.hp))}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = font(86);
  c.lineJoin = 'round';
  c.lineWidth = 14;
  c.strokeStyle = '#2a241c';
  c.strokeText(hpText, Wp / 2, Hp / 2 + 4);
  c.fillStyle = '#fff';
  c.fillText(hpText, Wp / 2, Hp / 2 + 4);
  // shield number on the left, statuses on the right
  c.font = font(54);
  c.lineWidth = 10;
  if (st.shield > 0) {
    c.textAlign = 'left';
    D.glyph(c, 'shield', 64, Hp / 2, 66);
    c.strokeText(String(st.shield), 104, Hp / 2 + 3);
    c.fillStyle = '#f6dc6a';
    c.fillText(String(st.shield), 104, Hp / 2 + 3);
  }
  // Burn and poison counters: the number eases down after each tick and the
  // icon gives a small pulse, like The Bazaar.
  let x = Wp - 44;
  c.textAlign = 'right';
  for (const [k, color] of [['poison', '#c8f0a0'], ['burn', '#ffc890']]) {
    const shown = Math.round(st.disp[k]);
    if (!(shown > 0)) continue;
    const pulse = st.pulse[k];
    const label = String(shown);
    c.font = font(54 + pulse * 6);
    const tw = c.measureText(label).width;
    c.strokeText(label, x, Hp / 2 + 3);
    c.fillStyle = pulse > 0.05 ? '#fff' : color;
    c.fillText(label, x, Hp / 2 + 3);
    const gx = x - tw - 36;
    if (pulse > 0.02) {
      c.save();
      c.globalAlpha = pulse * 0.45;
      c.fillStyle = color;
      c.beginPath();
      c.arc(gx, Hp / 2, 34 + pulse * 10, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    D.glyph(c, k, gx, Hp / 2 - pulse * 3, 62 * (1 + pulse * 0.22));
    x -= tw + 110;
  }
  return cv;
}

// Strip under the bar for the side-wide stacks: Luck, Sand, Heat, Cold.
const BUFFS = [
  ['luck', 'luck', '#bfe8a8', (n) => `${Math.round(Math.min(60, n * RULES.luckCrit * 100))}% crit`],
  ['sand', 'sand', '#f0d8a4', (n) => `${Math.round(Math.min(RULES.sandCap, n * RULES.sandMiss) * 100)}% miss`],
  ['heat', 'heat', '#ffc890', (n) => `+${Math.min(50, n * 2)}% speed`],
  ['cold', 'cold', '#c8ecfa', (n) => `-${Math.min(50, n * 2)}% speed`],
];
function drawBuffs(st) {
  const Wp = 1152;
  const Hp = 84;
  const cv = D.canvas(Wp, Hp);
  const c = cv.getContext('2d');
  const items = BUFFS.filter(([k]) => st[k] > 0);
  if (!items.length) return cv;
  c.font = font(38);
  const parts = items.map(([k, icon, color, fx]) => {
    const label = `${st[k]}`;
    const sub = fx(st[k]);
    c.font = font(38);
    const w1 = c.measureText(label).width;
    c.font = '800 28px "Nunito", sans-serif';
    const w2 = c.measureText(sub).width;
    return { icon, color, label, sub, w: 56 + w1 + 14 + w2 + 34 };
  });
  const total = parts.reduce((a, p) => a + p.w, 0) + (parts.length - 1) * 14;
  let x = (Wp - total) / 2;
  for (const p of parts) {
    c.fillStyle = '#2b2724';
    D.rrect(c, x, 8, p.w, Hp - 16, (Hp - 16) / 2);
    c.fill();
    D.glyph(c, p.icon, x + 36, Hp / 2, 44);
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.font = font(38);
    c.fillStyle = p.color;
    c.fillText(p.label, x + 64, Hp / 2 + 2);
    const w1 = c.measureText(p.label).width;
    c.font = '800 28px "Nunito", sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillText(p.sub, x + 64 + w1 + 14, Hp / 2 + 3);
    x += p.w + 14;
  }
  return cv;
}

// opts: { x, z } bar centre in world space.
export function createFortressHud(scene, { x, z }) {
  const g = new THREE.Group();
  g.position.set(x, 0.06, z);
  scene.add(g);
  const barMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(BAR.w, BAR.h), barMat);
  bar.rotation.x = -Math.PI / 2;
  bar.renderOrder = 6;
  g.add(bar);
  const buffMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const buffs = new THREE.Mesh(new THREE.PlaneGeometry(BAR.w, BAR.w * (84 / 1152)), buffMat);
  buffs.rotation.x = -Math.PI / 2;
  buffs.position.z = BAR.h / 2 + 0.42;
  buffs.renderOrder = 6;
  g.add(buffs);
  let buffKey = null;

  const st = { hp: 0, max: 1, lag: 0, shield: 0, burn: 0, poison: 0, flash: 0, healFlash: 0, disp: { burn: 0, poison: 0 }, pulse: { burn: 0, poison: 0 } };
  let dirty = true;
  let redraw = 0;
  let kick = 0;
  const counters = {};
  const floaters = [];

  function sprite(kind, value) {
    const k = KIND[kind];
    const cv = D.drawNumber(`${k.sign}${value}`, k.color, 96, k.icon);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 30;
    sp.userData.aspect = cv.width / cv.height;
    return sp;
  }

  return {
    // Where projectiles should land: the middle of the bar.
    target: () => new THREE.Vector3(x, 0.6, z),
    reset(maxHp) {
      Object.assign(st, { hp: maxHp, max: maxHp, lag: maxHp, shield: 0, burn: 0, poison: 0, flash: 0, healFlash: 0, disp: { burn: 0, poison: 0 }, pulse: { burn: 0, poison: 0 } });
      for (const c of Object.values(counters)) g.remove(c.sprite);
      for (const k of Object.keys(counters)) delete counters[k];
      for (const f of floaters.splice(0)) g.remove(f.sprite);
      dirty = true;
      buffKey = null;
      g.visible = true;
    },
    hide() { g.visible = false; },
    // A burn or poison tick: pulse that counter.
    tick(kind) {
      if (st.pulse[kind] != null) { st.pulse[kind] = 1; dirty = true; }
    },
    add(kind, n) {
      if (!(n > 0) || !KIND[kind]) return;
      let c = counters[kind];
      if (!c) {
        c = { value: 0, idle: 0, pop: 0 };
        c.sprite = sprite(kind, n);
        const [lx, lz] = LANES[kind];
        c.sprite.position.set(lx, 1.0, lz);
        g.add(c.sprite);
        counters[kind] = c;
      }
      c.value += Math.round(n);
      c.idle = 0;
      c.pop = 1;
      const k = KIND[kind];
      const cv = D.drawNumber(`${k.sign}${c.value}`, k.color, 96, k.icon);
      c.sprite.material.map.dispose();
      c.sprite.material.map = canvasTexture(cv);
      c.sprite.userData.aspect = cv.width / cv.height;
      if (kind === 'hit' || kind === 'burn' || kind === 'poison' || kind === 'sudden') { st.flash = 0.2; kick = Math.min(1, kick + 0.3 + n / 30); }
      if (kind === 'heal') st.healFlash = 0.8;
    },
    set(S) {
      if (S.hp !== st.hp || S.shield !== st.shield || S.burn !== st.burn || S.poison !== st.poison) dirty = true;
      const key = `${S.luck}|${S.sand}|${S.heat}|${S.cold}`;
      if (key !== buffKey) {
        buffKey = key;
        Object.assign(st, { luck: S.luck, sand: S.sand, heat: S.heat, cold: S.cold });
        buffMat.map?.dispose();
        buffMat.map = canvasTexture(drawBuffs(st));
        buffMat.needsUpdate = true;
      }
      st.hp = S.hp;
      st.shield = S.shield;
      st.burn = S.burn;
      st.poison = S.poison;
    },
    update(dt) {
      if (st.lag > st.hp) { st.lag = Math.max(st.hp, st.lag - Math.max(6, (st.lag - st.hp) * 2.2) * dt); dirty = true; }
      else st.lag = st.hp;
      if (st.flash > 0) { st.flash -= dt; dirty = true; }
      if (st.healFlash > 0) { st.healFlash = Math.max(0, st.healFlash - dt * 1.5); dirty = true; }
      for (const k of ['burn', 'poison']) {
        const target = st[k];
        const d = st.disp[k];
        if (Math.abs(target - d) > 0.01) {
          // new stacks pop in quickly; losses count down a little slower so you see them go
          const rate = target > d ? 14 : 5;
          st.disp[k] = d + (target - d) * Math.min(1, dt * rate);
          if (Math.abs(target - st.disp[k]) < 0.05) st.disp[k] = target;
          dirty = true;
        }
        if (st.pulse[k] > 0) { st.pulse[k] = Math.max(0, st.pulse[k] - dt * 2.8); dirty = true; }
      }
      redraw -= dt;
      if (dirty && redraw <= 0) {
        barMat.map?.dispose();
        barMat.map = canvasTexture(drawBar(st));
        barMat.needsUpdate = true;
        dirty = false;
        redraw = 0.033;
      }
      kick = Math.max(0, kick - dt * 3);
      const s = 1 + kick * 0.04;
      bar.scale.set(s, s, 1);
      bar.position.x = kick > 0.05 ? (Math.random() - 0.5) * kick * 0.12 : 0;
      for (const [kind, c] of Object.entries(counters)) {
        c.idle += dt;
        c.pop = Math.max(0, c.pop - dt * 5);
        const sc = 1.0 + Math.min(0.6, c.value / 60) + c.pop * 0.3;
        c.sprite.scale.set(sc * c.sprite.userData.aspect, sc, 1);
        if (c.idle > 1.1) { floaters.push({ sprite: c.sprite, age: 0 }); delete counters[kind]; }
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.age += dt;
        f.sprite.position.y += dt * 1.2;
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
