// Fight readouts, Bazaar style: a wide health bar beside each side's board with
// the HP number large in the middle, shield layered on top, and burn/poison
// chips at the end. Damage adds up in fixed counters beside the bar.
import * as THREE from 'three';
import * as D from './draw.js';
import { canvasTexture } from './world.js';
import { RULES } from '../content.js';
import { createBarFx, poisonLevel, burnLevel } from './barfx.js';

const KIND = {
  hit: { color: '#fff7e6', icon: 'dmg', sign: '-' },
  sudden: { color: '#ff7a6a', icon: null, sign: '-' },
  heal: { color: '#9cf08a', icon: 'heal', sign: '+' },
};

export const BAR = { w: 9.6, h: 1.25 };

// Damage and heal totals float just above the bar, either side of the HP number.
const LANES = { hit: -3.6, sudden: -6.6, heal: 0 };

// Status pills sit on the bar beside the HP number, The Bazaar style: shield
// on the left, burn and poison on the right.
const PILL = {
  shield: { fill: ['#ffe58a', '#e8b52e'], ring: '#f6d35a', text: '#ffe27a' },
  burn: { fill: ['#ffb46a', '#ef6a2a'], ring: '#ff9a4a', text: '#ffc58f' },
  poison: { fill: ['#c6ef8c', '#5fae3a'], ring: '#9fd05f', text: '#cdf2a6' },
};
const PILL_PX = { w: 280, h: 150 };
const PILL_H = 0.92;
const PILL_W = (PILL_H * PILL_PX.w) / PILL_PX.h;
const PILL_X = { shield: -2.05, first: 2.05, second: 3.85 };

const font = (px) => `900 ${px}px "Nunito", sans-serif`;

// Bar geometry in canvas pixels (1152 x 150 over BAR.w x BAR.h world units).
const BAR_PX = { w: 1152, h: 150, x: 14, y: 13, r: 28 };
BAR_PX.iw = BAR_PX.w - BAR_PX.x * 2;
BAR_PX.ih = BAR_PX.h - 32;

// Bottom layer: frame, empty track, the HP fill and the chunk just lost.
function drawBase(st) {
  const { w: Wp, h: Hp, x: bx, y: by, iw: bw, ih: bh, r } = BAR_PX;
  const cv = D.canvas(Wp, Hp);
  const c = cv.getContext('2d');
  c.fillStyle = '#1f1b19';
  D.rrect(c, 0, 4, Wp, Hp - 4, 40);
  c.fill();
  c.fillStyle = '#2f2a26';
  D.rrect(c, 0, 0, Wp, Hp - 6, 40);
  c.fill();
  c.save();
  D.rrect(c, bx, by, bw, bh, r);
  c.clip();
  const track = c.createLinearGradient(0, by, 0, by + bh);
  track.addColorStop(0, '#2a2422');
  track.addColorStop(1, '#3e3632');
  c.fillStyle = track;
  c.fillRect(bx, by, bw, bh);
  const p = Math.max(0, st.shown) / st.max;
  const lag = Math.min(1, Math.max(p, st.lag / st.max));
  if (lag > p) {
    c.fillStyle = st.flash > 0 ? '#fff6e0' : '#e8604a';
    c.fillRect(bx + bw * p, by, bw * (lag - p), bh);
  }
  const low = p < 0.3;
  const hpGrad = c.createLinearGradient(0, by, 0, by + bh);
  hpGrad.addColorStop(0, low ? '#f0a35a' : '#86d870');
  hpGrad.addColorStop(0.55, low ? '#e07c3a' : '#5cb84f');
  hpGrad.addColorStop(1, low ? '#c0582a' : '#3f9140');
  c.fillStyle = hpGrad;
  c.fillRect(bx, by, bw * p, bh);
  if (st.healFlash > 0) {
    c.globalAlpha = st.healFlash * 0.55;
    c.fillStyle = '#eaffdc';
    c.fillRect(bx, by, bw * p, bh);
    c.globalAlpha = 1;
  }
  c.restore();
  return cv;
}

// Top layer, drawn over the poison/burn effects: gloss, a see-through shield,
// segment ticks and the HP number.
function drawTop(st) {
  const { w: Wp, h: Hp, x: bx, y: by, iw: bw, ih: bh, r } = BAR_PX;
  const cv = D.canvas(Wp, Hp);
  const c = cv.getContext('2d');
  const p = Math.max(0, st.shown) / st.max;
  c.save();
  D.rrect(c, bx, by, bw, bh, r);
  c.clip();
  // glossy top band over the fill
  const gloss = c.createLinearGradient(0, by, 0, by + bh * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.32)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gloss;
  c.fillRect(bx, by + 4, bw * p, bh * 0.45);
  // Shield: translucent gold glass over the health it protects, from the left.
  if (st.shieldShown > 0.5) {
    const sw = bw * Math.min(1, st.shieldShown / st.max);
    const g = c.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, 'rgba(255,240,170,0.62)');
    g.addColorStop(0.5, 'rgba(246,206,72,0.38)');
    g.addColorStop(1, 'rgba(222,166,34,0.5)');
    c.fillStyle = g;
    c.fillRect(bx, by, sw, bh);
    c.save();
    c.beginPath();
    c.rect(bx, by, sw, bh);
    c.clip();
    c.strokeStyle = 'rgba(255,250,215,0.22)';
    c.lineWidth = 9;
    for (let x = bx - bh; x < bx + sw + bh; x += 36) {
      c.beginPath();
      c.moveTo(x, by + bh);
      c.lineTo(x + bh, by);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(255,236,150,0.95)';
    c.lineWidth = 6;
    c.strokeRect(bx + 3, by + 3, sw - 6, bh - 6);
    c.fillStyle = 'rgba(255,246,204,0.45)';
    c.fillRect(bx + sw - 3, by, 3, bh);
    if (st.shieldFlash > 0) {
      c.globalAlpha = st.shieldFlash * 0.5;
      c.fillStyle = '#fffbe8';
      c.fillRect(bx, by, sw, bh);
      c.globalAlpha = 1;
    }
  }
  const sh = c.createLinearGradient(0, by, 0, by + bh);
  sh.addColorStop(0, 'rgba(0,0,0,0.2)');
  sh.addColorStop(0.15, 'rgba(0,0,0,0)');
  sh.addColorStop(0.85, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = sh;
  c.fillRect(bx, by, bw, bh);
  c.restore();
  const hpText = `${Math.max(0, Math.ceil(st.shown))}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = font(84);
  c.lineJoin = 'round';
  c.lineWidth = 15;
  c.strokeStyle = '#231e1a';
  c.strokeText(hpText, Wp / 2, by + bh / 2 + 4);
  c.fillStyle = '#fff';
  c.fillText(hpText, Wp / 2, by + bh / 2 + 4);
  return cv;
}

// A status pill: coloured coin with the icon, then the count.
function drawPill(kind, value, flash) {
  const { w, h } = PILL_PX;
  const P = PILL[kind];
  const cv = D.canvas(w, h);
  const c = cv.getContext('2d');
  const r = h / 2 - 6;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  D.rrect(c, 6, 12, w - 12, h - 14, (h - 14) / 2);
  c.fill();
  c.fillStyle = '#2a2420';
  D.rrect(c, 6, 6, w - 12, h - 14, (h - 14) / 2);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = P.ring;
  c.globalAlpha = 0.55 + flash * 0.45;
  c.stroke();
  c.globalAlpha = 1;
  // coin
  const cx = 6 + r;
  const cy = h / 2 - 1;
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, flash > 0.05 ? '#ffffff' : P.fill[0]);
  g.addColorStop(1, P.fill[1]);
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 7;
  c.strokeStyle = '#2a2420';
  c.stroke();
  c.fillStyle = 'rgba(255,253,246,0.92)';
  c.beginPath();
  c.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
  c.fill();
  D.glyph(c, kind, cx, cy, r * 1.15);
  // count
  const label = String(value);
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  let size = 92;
  c.font = font(size);
  const room = w - (cx + r + 14) - 22;
  while (c.measureText(label).width > room && size > 50) { size -= 6; c.font = font(size); }
  c.lineJoin = 'round';
  c.lineWidth = 12;
  c.strokeStyle = '#1a1512';
  const tx = cx + r + 14;
  c.strokeText(label, tx, cy + 5);
  c.fillStyle = flash > 0.05 ? '#ffffff' : P.text;
  c.fillText(label, tx, cy + 5);
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
// top: the enemy's bar (above its wall); ours sits below our wall.
export function createFortressHud(scene, { x, z, top = false }) {
  const g = new THREE.Group();
  g.position.set(x, 0.06, z);
  scene.add(g);
  // The bar is three layers: base fill, poison/burn shader, then shield and number.
  const bar = new THREE.Group();
  g.add(bar);
  const layer = (order) => {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BAR.w, BAR.h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = order;
    bar.add(mesh);
    return mat;
  };
  const baseMat = layer(6);
  const fx = createBarFx(BAR, top ? 3.7 : 0);
  fx.mesh.renderOrder = 6.3;
  bar.add(fx.mesh);
  const topMat = layer(6.6);
  const buffMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const buffs = new THREE.Mesh(new THREE.PlaneGeometry(BAR.w, BAR.w * (84 / 1152)), buffMat);
  buffs.rotation.x = -Math.PI / 2;
  // the strip sits on the bar's far side from the wall: below ours, above theirs
  buffs.position.z = (top ? -1 : 1) * (BAR.h / 2 + 0.42);
  buffs.renderOrder = 6;
  g.add(buffs);
  let buffKey = null;
  // Floating numbers lean away from the board so they never cover the wall.
  const lift = top ? { y: 1.4, z: -0.7, py: 1.1, pz: -0.85 } : { y: 0.5, z: 1.15, py: 0.45, pz: 1.0 };

  const st = { hp: 0, shown: 0, max: 1, lag: 0, shield: 0, shieldShown: 0, flash: 0, healFlash: 0, shieldFlash: 0, poison: 0, burn: 0 };
  // Burn and poison damage drains out of the bar continuously: each tick's
  // damage is spread over the time until the next tick, so the overall rate
  // is unchanged but the bar flows down instead of stepping.
  const drain = { burn: 0, poison: 0 };
  const drainRate = { burn: 0, poison: 0 };
  const TICK = { burn: RULES.burnTick, poison: RULES.poisonTick };
  let shownText = null;
  let dirty = true;
  let redraw = 0;
  let kick = 0;
  const counters = {};
  const floaters = [];

  // Pills: one per status, drawn on the bar and animated as meshes.
  const pills = {};
  for (const kind of ['shield', 'burn', 'poison']) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PILL_W, PILL_H), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    mesh.renderOrder = 7;
    mesh.visible = false;
    g.add(mesh);
    pills[kind] = { kind, mesh, mat, value: 0, disp: 0, shown: null, flash: 0, pop: 0, pulse: 0, shake: 0, s: 0, x: kind === 'shield' ? PILL_X.shield : PILL_X.first };
  }

  function sprite(text, color, icon, size = 96) {
    const cv = D.drawNumber(text, color, size, icon);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 30;
    sp.userData.aspect = cv.width / cv.height;
    return sp;
  }

  // Small number that drifts up off a pill: a burn or poison tick, shield gained or lost.
  function pillFloat(kind, text) {
    const P = pills[kind];
    const sp = sprite(text, PILL[kind].text, null, 80);
    sp.position.set(P.x + PILL_W * 0.15 + (Math.random() - 0.5) * 0.5, lift.py, lift.pz + (Math.random() - 0.5) * 0.2);
    g.add(sp);
    floaters.push({ sprite: sp, age: 0, life: 1.0, rise: top ? 1.2 : 0.5, size: 0.7, pop: 1 });
  }

  // Little numbers peeling off the end of the health fill: burn and poison as
  // they drain (two or three a second), heals as they land.
  const TICK_COLOR = { burn: '#ff6a3d', poison: '#b6e04e', heal: '#7ef0a6' };
  function edgeFloat(kind, text) {
    const fill = Math.max(0, st.shown) / st.max;
    const ex = THREE.MathUtils.clamp(-BAR.w / 2 + 0.2 + fill * (BAR.w - 0.4), -BAR.w / 2 + 0.4, BAR.w / 2 - 0.4);
    const sp = sprite(text, TICK_COLOR[kind], null, 72);
    // each kind keeps its own lane so simultaneous ticks don't stack up
    const lane = { burn: -0.55, poison: 0.0, heal: -1.1 }[kind];
    sp.position.set(ex + lane + (Math.random() - 0.5) * 0.25, lift.py * 0.85, lift.pz * 0.7 + (Math.random() - 0.5) * 0.12);
    g.add(sp);
    floaters.push({ sprite: sp, age: 0, life: 0.9, rise: top ? 1.0 : 0.5, size: kind === 'heal' ? 0.68 : 0.6, pop: 1 });
  }
  const tickAcc = { burn: 0, poison: 0 };
  const tickClock = { burn: 0, poison: 0 };

  function clearSprites() {
    for (const c of Object.values(counters)) { g.remove(c.sprite); c.sprite.material.map.dispose(); c.sprite.material.dispose(); }
    for (const k of Object.keys(counters)) delete counters[k];
    for (const f of floaters.splice(0)) { g.remove(f.sprite); f.sprite.material.map.dispose(); f.sprite.material.dispose(); }
  }

  return {
    // Where projectiles should land: the middle of the bar.
    target: () => new THREE.Vector3(x, 0.6, z),
    reset(maxHp) {
      Object.assign(st, { hp: maxHp, shown: maxHp, max: maxHp, lag: maxHp, shield: 0, shieldShown: 0, flash: 0, healFlash: 0, shieldFlash: 0, poison: 0, burn: 0 });
      drain.burn = drain.poison = drainRate.burn = drainRate.poison = 0;
      tickAcc.burn = tickAcc.poison = tickClock.burn = tickClock.poison = 0;
      shownText = null;
      fx.reset();
      clearSprites();
      for (const P of Object.values(pills)) Object.assign(P, { value: 0, disp: 0, shown: null, flash: 0, pop: 0, pulse: 0, shake: 0, s: 0 });
      dirty = true;
      buffKey = null;
      g.visible = true;
    },
    hide() { g.visible = false; },
    // A burn or poison tick: the pill thumps and the damage drifts off it.
    tick(kind, amount) {
      const P = pills[kind];
      if (!P) return;
      P.pulse = 1;
      P.flash = 1;
    },
    add(kind, n) {
      if (!(n > 0)) return;
      n = Math.round(n);
      if (kind === 'blocked') {
        pills.shield.shake = 1;
        pills.shield.flash = 1;
        st.shieldFlash = 1;
        pillFloat('shield', `-${n}`);
        kick = Math.min(1, kick + 0.15);
        return;
      }
      if (kind === 'shield') {
        pills.shield.pop = 1;
        st.shieldFlash = 0.7;
        pillFloat('shield', `+${n}`);
        return;
      }
      if (kind === 'burn' || kind === 'poison') {
        // Spread this tick's damage over the time until the next one.
        drain[kind] += n;
        drainRate[kind] = drain[kind] / TICK[kind];
        return;
      }
      if (kind === 'heal') {
        st.healFlash = 0.8;
        edgeFloat('heal', `+${n}`);
        return;
      }
      const K = KIND[kind];
      if (!K) return;
      let c = counters[kind];
      if (!c) {
        c = { value: 0, idle: 0, pop: 0, age: 0 };
        c.sprite = sprite('0', K.color, K.icon);
        c.sprite.position.set(LANES[kind], lift.y, lift.z);
        g.add(c.sprite);
        counters[kind] = c;
      }
      c.value += n;
      c.idle = 0;
      c.pop = 1;
      const cv = D.drawNumber(`${K.sign}${c.value}`, K.color, 96, K.icon);
      c.sprite.material.map.dispose();
      c.sprite.material.map = canvasTexture(cv);
      c.sprite.userData.aspect = cv.width / cv.height;
      if (kind === 'heal') st.healFlash = 0.8;
      else { st.flash = 0.22; kick = Math.min(1, kick + 0.3 + n / 30); }
    },
    set(S) {
      if (S.hp !== st.hp || S.shield !== st.shield) dirty = true;
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
      st.poison = S.poison;
      st.burn = S.burn;
      for (const k of ['shield', 'burn', 'poison']) {
        const P = pills[k];
        if (S[k] > P.value && P.value > 0 && k !== 'shield') P.pop = Math.max(P.pop, 0.7);
        P.value = S[k];
      }
    },
    // simRate: how fast the fight clock runs (0 once the fight is over).
    update(dt, simRate = 1) {
      for (const k of ['burn', 'poison']) {
        if (drain[k] <= 0) continue;
        const dec = Math.min(drain[k], simRate > 0 ? drainRate[k] * dt * simRate : Math.max(drain[k] * dt * 6, 30 * dt));
        drain[k] -= dec;
        tickAcc[k] += dec;
        tickClock[k] += dt;
        // pop the drained amount off as a whole number every ~0.4s
        if (tickAcc[k] >= 1 && tickClock[k] >= 0.38) {
          const n = Math.floor(tickAcc[k]);
          tickAcc[k] -= n;
          tickClock[k] = 0;
          edgeFloat(k, `-${n}`);
        }
        if (drain[k] <= 1e-6) {
          drain[k] = 0;
          if (tickAcc[k] >= 0.5) edgeFloat(k, `-${Math.round(tickAcc[k])}`);
          tickAcc[k] = 0;
        }
      }
      const shown = Math.min(st.max, st.hp + drain.burn + drain.poison);
      if (shown !== st.shown) { st.shown = shown; dirty = true; }
      if (st.lag > st.shown) {
        st.lag = Math.max(st.shown, st.lag - Math.max(8, (st.lag - st.shown) * 2.2) * dt);
        dirty = true;
      } else st.lag = st.shown;
      fx.update(dt, Math.max(0, st.shown) / st.max, poisonLevel(st.poison), burnLevel(st.burn));
      if (st.flash > 0) { st.flash -= dt; dirty = true; }
      if (st.healFlash > 0) { st.healFlash = Math.max(0, st.healFlash - dt * 1.5); dirty = true; }
      if (st.shieldFlash > 0) { st.shieldFlash = Math.max(0, st.shieldFlash - dt * 3); dirty = true; }
      if (Math.abs(st.shieldShown - st.shield) > 0.05) {
        st.shieldShown += (st.shield - st.shieldShown) * Math.min(1, dt * 12);
        dirty = true;
      } else st.shieldShown = st.shield;

      // pills: ease the count, pop in/out, thump on ticks
      let slot = 0;
      for (const kind of ['shield', 'burn', 'poison']) {
        const P = pills[kind];
        const d = P.disp;
        if (Math.abs(P.value - d) > 0.01) {
          // gains land fast; losses count down so you watch them go
          const rate = P.value > d ? 16 : 6;
          P.disp = d + (P.value - d) * Math.min(1, dt * rate);
          if (Math.abs(P.value - P.disp) < 0.05) P.disp = P.value;
        }
        const live = P.value > 0 || P.disp >= 0.5;
        const want = live ? 1 : 0;
        P.s += (want - P.s) * Math.min(1, dt * (want ? 14 : 10));
        if (P.s < 0.01 && !live) { P.mesh.visible = false; P.s = 0; continue; }
        P.mesh.visible = true;
        if (kind !== 'shield') {
          const tx = slot === 0 ? PILL_X.first : PILL_X.second;
          P.x += (tx - P.x) * Math.min(1, dt * 12);
          if (live) slot += 1;
        }
        P.pulse = Math.max(0, P.pulse - dt * 3.2);
        P.pop = Math.max(0, P.pop - dt * 4);
        P.shake = Math.max(0, P.shake - dt * 4);
        P.flash = Math.max(0, P.flash - dt * 4);
        const shown = Math.max(0, Math.round(P.disp));
        const fl = P.flash > 0.05 ? 1 : 0;
        const key = `${shown}|${fl}`;
        if (key !== P.shown && (shown > 0 || P.shown == null)) {
          P.shown = key;
          P.mat.map?.dispose();
          P.mat.map = canvasTexture(drawPill(kind, shown, fl));
          P.mat.needsUpdate = true;
        }
        // back-out bounce for the pop-in, a squash-and-swell thump for ticks
        const thump = Math.sin(P.pulse * Math.PI) * 0.22 * P.pulse;
        const sc = P.s * (1 + thump + P.pop * 0.18);
        P.mesh.scale.set(sc, sc, 1);
        P.mesh.position.x = P.x + (P.shake > 0.02 ? Math.sin(P.shake * 40) * P.shake * 0.12 : 0);
        P.mesh.position.z = -thump * 0.25;
      }

      redraw -= dt;
      if (dirty && redraw <= 0) {
        baseMat.map?.dispose();
        baseMat.map = canvasTexture(drawBase(st));
        baseMat.needsUpdate = true;
        const text = `${Math.ceil(st.shown)}|${st.shieldShown.toFixed(1)}|${st.shieldFlash > 0 ? st.shieldFlash.toFixed(2) : 0}`;
        if (text !== shownText) {
          shownText = text;
          topMat.map?.dispose();
          topMat.map = canvasTexture(drawTop(st));
          topMat.needsUpdate = true;
        }
        dirty = false;
        redraw = 0.033;
      }
      kick = Math.max(0, kick - dt * 3);
      const s = 1 + kick * 0.03;
      bar.scale.set(s, 1, s);
      bar.position.x = kick > 0.05 ? (Math.random() - 0.5) * kick * 0.1 : 0;

      // running totals above the bar: pop on each add, drift away when quiet
      for (const [kind, c] of Object.entries(counters)) {
        c.idle += dt;
        c.age += dt;
        c.pop = Math.max(0, c.pop - dt * 6);
        const born = Math.min(1, c.age / 0.12);
        const sc = (1.0 + Math.min(0.3, c.value / 100)) * (0.6 + 0.4 * born) * (1 + Math.sin(c.pop * Math.PI) * 0.35);
        c.sprite.scale.set(sc * c.sprite.userData.aspect, sc, 1);
        // a burst ends after a pause, or after a while so it never piles up forever
        if (c.idle > 1.0 || c.age > 1.8) { floaters.push({ sprite: c.sprite, age: 0, life: 0.6, rise: top ? 1.3 : 0.5, size: sc, pop: 0 }); delete counters[kind]; }
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.age += dt;
        const u = f.age / f.life;
        f.sprite.position.y += dt * f.rise * (1 - u * 0.6);
        const sc = f.size * (1 + Math.max(0, 0.35 - f.age * 3) * f.pop);
        f.sprite.scale.set(sc * f.sprite.userData.aspect, sc, 1);
        f.sprite.material.opacity = u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4);
        if (u >= 1) {
          g.remove(f.sprite);
          f.sprite.material.map.dispose();
          f.sprite.material.dispose();
          floaters.splice(i, 1);
        }
      }
    },
  };
}
