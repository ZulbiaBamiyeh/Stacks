// Stackbrawl: game controller. Wires run state, the 3D table, input and fights.
import * as THREE from 'three';
import { CARDS, PACKS, TRACKS, RULES, wallSlots, fortressHp, eats } from './content.js';
import * as R from './run.js';
import { createBattle, DT } from './sim.js';
import { fetchGhost, submitGhost } from './ghosts.js';
import { createWorld, L, CARD, wallX, arenaX } from './gfx/world.js';
import { CardView, loadArt, setAnisotropy } from './gfx/card.js';
import { createFx, createFortressFx } from './gfx/fx.js';
import * as D from './gfx/draw.js';
import { createUI, loadCodex, saveCodex } from './ui.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'stackbrawl.run.v1';
const $ = (id) => document.getElementById(id);

await Promise.all(['900', '800', '700'].map((w) => document.fonts.load(`${w} 40px Nunito`)));
await loadArt();

const world = createWorld($('stage'));
setAnisotropy(world.anisotropy);
const { scene, view } = world;
const fx = createFx(scene);
const ui = createUI();
let codex = loadCodex();

// ------------------------------------------------------------------ state

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s && s.v === R.SAVE_VERSION ? s : null;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
}

let S = load() || R.newRun();
let mode = 'shop';
const views = new Map(); // inst uid -> CardView
const packViews = new Map(); // pack uid -> CardView
let marketViews = [];
const combos = [];
const timers = [];
let bv = [[], []]; // battle card views per side/slot
const leaving = new Set(); // cards animating out (fed to the shrine, eaten)
const later = (sec, fn) => timers.push({ t: sec, fn });

const HOME = { x: 0, z: 0.15, w: 19.4, h: 13.0 };
const A = L.arena;

// ------------------------------------------------------------------ fixed furniture

const tiles = [];
function registerTile(group, kind, data = {}) {
  const entry = { group, kind, ...data, hover: 0 };
  group.traverse((o) => { o.userData.tile = entry; });
  tiles.push(entry);
  return entry;
}
function removeTile(entry) {
  scene.remove(entry.group);
  const { mat } = entry.group.userData;
  mat.map?.dispose();
  mat.dispose();
  tiles.splice(tiles.indexOf(entry), 1);
}

const sellTile = registerTile(world.makeTile(L.tile.w, L.tile.h, D.drawTile('sell'), { x: L.sellX, z: L.shopZ }), 'sell');
const shrineCanvas = () => D.drawTile('shrine', { tracks: TRACKS.map((t) => ({ ...t, fed: S.fed[t.id] })) });
const shrineTile = registerTile(world.makeTile(L.shrine.w, L.shrine.h, shrineCanvas(), { x: L.shrine.x, z: L.shrine.z }), 'shrine');
const rr = L.market.reroll;
const rerollTile = registerTile(world.makeTile(rr.w, rr.h, D.drawTile('reroll'), { x: rr.x, z: rr.z }), 'reroll');

let packTiles = [];
let marketTiles = [];
const marketPos = (i) => ({ x: L.market.xs[i % 2], z: L.market.zs[Math.floor(i / 2)] });

const slotDecals = [];
const slotGlow = [];
const glowGeo = new THREE.PlaneGeometry(1.36, 1.8);
for (let i = 0; i < 6; i++) {
  slotDecals.push(world.makeDecal(L.tile.w, L.tile.h, D.drawSlot(), wallX(i), L.wall.z, 0.006));
  const g = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: '#fff7c4', transparent: true, opacity: 0, depthWrite: false }));
  g.rotation.x = -Math.PI / 2;
  g.position.set(wallX(i), 0.005, L.wall.z);
  scene.add(g);
  slotGlow.push(g);
}
let slotsShown = -1;
function refreshSlots() {
  const n = wallSlots(S.day);
  if (n === slotsShown) return;
  slotsShown = n;
  for (let i = 0; i < 6; i++) {
    slotDecals[i].setCanvas(i < n ? D.drawSlot({ label: String(i + 1) }) : D.drawSlot({ locked: true, label: `Day ${i === 4 ? 4 : 7}` }));
  }
}

const towerPlaque = world.makeDecal(2.3, 0.56, D.drawLabel(''), L.tower.x, L.tower.z + 1.45, 0.008);
let plaqueText = '';
function refreshPlaque() {
  const t = `Fortress  ${fortressHp(S.day)} HP`;
  if (t === plaqueText) return;
  plaqueText = t;
  towerPlaque.setCanvas(D.drawLabel(t, { bg: '#2b2724', color: '#fff', size: 54 }));
}


function refreshShopTiles() {
  // Packs row
  const list = R.availablePacks(S);
  const key = list.map((p) => `${p}:${S.gold >= PACKS[p].price}`).join('|');
  if (refreshShopTiles.key !== key) {
    refreshShopTiles.key = key;
    for (const t of packTiles) removeTile(t);
    const step = Math.min(L.packStep, (L.packX1 - L.packX0) / Math.max(1, list.length - 1));
    packTiles = list.map((packId, i) => registerTile(
      world.makeTile(L.tile.w, L.tile.h, D.drawTile('pack', { pack: packId, cantAfford: S.gold < PACKS[packId].price }), { x: L.packX0 + i * step, z: L.shopZ }),
      'pack', { pack: packId },
    ));
  }
  // Market tiles
  const mkey = S.shop.map((o) => (o ? `${o.id}:${o.price}` : '-')).join('|');
  if (refreshShopTiles.mkey !== mkey) {
    refreshShopTiles.mkey = mkey;
    for (const t of marketTiles) removeTile(t);
    marketTiles = S.shop.map((o, i) => {
      const p = marketPos(i);
      return registerTile(world.makeTile(L.market.w, L.market.h, D.drawTile('single', { price: o ? o.price : null }), p), 'single', { index: i });
    });
    syncMarket();
  }
  shrineTile.group.setCanvas(shrineCanvas());
}

function syncMarket() {
  const old = marketViews;
  marketViews = S.shop.map((o, i) => {
    const prev = old[i];
    if (prev && o && prev.id === o.id && prev.market === i) { old[i] = null; return prev; }
    if (!o) return null;
    const p = marketPos(i);
    const v = new CardView(scene, { id: o.id });
    v.market = i;
    v.restLift = 0.065;
    v.place(p.x, p.z - 0.2);
    v.scale = 0.2;
    v.kick(0.05);
    return v;
  });
  for (const v of old) if (v && !v.dragging && v.market != null) v.dispose(scene);
}

// ------------------------------------------------------------------ card views

function makeView(inst, x, z) {
  const v = new CardView(scene, { id: inst.id, inst, perm: inst.perm, meals: inst.meals || 0 });
  v.place(x, z);
  views.set(inst.uid, v);
  return v;
}

function homeOf(inst) {
  const f = R.find(S, inst.uid);
  if (!f) return null;
  if (f.where === 'wall') return { x: wallX(f.index), z: L.wall.z, wall: f.index };
  return { x: inst.x ?? 0, z: inst.z ?? 0 };
}

function syncViews() {
  const alive = new Set();
  for (const inst of [...S.table, ...S.wall.filter(Boolean)]) {
    alive.add(inst.uid);
    if (inst.x == null && !S.wall.includes(inst)) Object.assign(inst, findSpot(0, 0));
    const h = homeOf(inst);
    let v = views.get(inst.uid);
    if (!v) v = makeView(inst, h.x, h.z);
    v.inst = inst;
    if (v.perm !== inst.perm || v.id !== inst.id || v.meals !== (inst.meals || 0)) v.setFace(inst.id, inst.perm, inst.meals || 0);
    if (!v.dragging && !v.busy && !v.flight) v.moveTo(h.x, h.z);
  }
  for (const [uid, v] of views) {
    if (!alive.has(uid) && !v.busy) { v.dispose(scene); views.delete(uid); }
  }
  const palive = new Set();
  for (const p of S.packs) {
    palive.add(p.uid);
    if (p.x == null) Object.assign(p, findSpot(-6.5, -2.2));
    let v = packViews.get(p.uid);
    if (!v) {
      v = new CardView(scene, { pack: p.pack });
      v.packRef = p;
      v.place(p.x, p.z);
      packViews.set(p.uid, v);
    }
    if (!v.dragging && !v.flight) v.moveTo(p.x, p.z);
  }
  for (const [uid, v] of packViews) {
    if (!palive.has(uid)) { v.dispose(scene); packViews.delete(uid); }
  }
}

const T = L.table;
function clampTable(p) {
  p.x = THREE.MathUtils.clamp(p.x, T.x0 + CARD.w / 2, T.x1 - CARD.w / 2);
  p.z = THREE.MathUtils.clamp(p.z, T.z0 + CARD.h / 2, T.z1 - CARD.h / 2);
  return p;
}

function occupied() {
  const pts = [];
  for (const inst of S.table) if (inst.x != null) pts.push(inst);
  for (const p of S.packs) if (p.x != null) pts.push(p);
  return pts;
}

function findSpot(x, z, ignore = null) {
  const pts = occupied().filter((p) => p !== ignore);
  const free = (cx, cz) => pts.every((p) => Math.abs(p.x - cx) > CARD.w + 0.1 || Math.abs(p.z - cz) > CARD.h + 0.1);
  for (let ring = 0; ring < 14; ring++) {
    const n = Math.max(1, ring * 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = clampTable({ x: x + Math.cos(a) * ring * 0.7, z: z + Math.sin(a) * ring * 0.7 });
      if (free(c.x, c.z)) return c;
    }
  }
  return clampTable({ x, z });
}

// Gently push overlapping table cards apart (Stacklands-style).
function separate(dt) {
  const items = [];
  for (const inst of S.table) {
    const v = views.get(inst.uid);
    if (v && !v.dragging && !v.busy && !v.flight) items.push({ ref: inst, v });
  }
  for (const p of S.packs) {
    const v = packViews.get(p.uid);
    if (v && !v.dragging && !v.flight) items.push({ ref: p, v });
  }
  const gw = CARD.w + 0.12;
  const gh = CARD.h + 0.12;
  let moved = false;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].ref;
      const b = items[j].ref;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const ox = gw - Math.abs(dx);
      const oz = gh - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      if (dx === 0 && dz === 0) dx = 0.01;
      const step = Math.min(dt * 7, 0.2);
      if (ox / gw < oz / gh) {
        const s = Math.sign(dx) * Math.min(ox, step) / 2;
        a.x -= s; b.x += s;
      } else {
        const s = Math.sign(dz) * Math.min(oz, step) / 2;
        a.z -= s; b.z += s;
      }
      clampTable(a); clampTable(b);
      moved = true;
    }
  }
  for (const it of items) it.v.moveTo(it.ref.x, it.ref.z);
  if (moved) separate.dirty = true;
}

// ------------------------------------------------------------------ refresh

function refresh() {
  refreshSlots();
  refreshPlaque();
  refreshShopTiles();
  syncViews();
  ui.hud(S, codex);
  save();
}

// ------------------------------------------------------------------ picking

const stage = $('stage');
function pickAt(cx, cy) {
  const ray = world.pointerRay(cx, cy);
  const objs = [];
  for (const v of [...views.values(), ...packViews.values(), ...marketViews.filter(Boolean), ...bv[1].filter(Boolean), ...bv[0].filter((x) => x && x.summoned)]) {
    if (!v.dead) objs.push(v.body, v.face);
  }
  for (const t of tiles) t.group.traverse((o) => { if (o.isMesh) objs.push(o); });
  const hits = ray.intersectObjects(objs, false);
  let best = null;
  for (const h of hits) {
    const card = h.object.userData.card;
    if (card) {
      if (!best || !best.card || (best.dist - h.distance > -0.05 && card.layer > best.card.layer)) best = { card, dist: h.distance };
      continue;
    }
    if (!best) return { tile: h.object.userData.tile };
    break;
  }
  return best;
}

const inRect = (x, z, cx, cz, w, h) => Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= h / 2;

function canDrag(v) {
  if (mode !== 'shop' || v.busy || v.flight) return false;
  return true;
}

// ------------------------------------------------------------------ drop logic

function evalDrop(v, x, z) {
  const def = v.def;
  if (!v.pack) {
    // Card under the dragged card's centre
    let best = null;
    for (const w of views.values()) {
      if (w === v || w.busy || w.flight || w.dead) continue;
      const dx = Math.abs(w.pos.x - x);
      const dz = Math.abs(w.pos.z - z);
      if (dx < CARD.w * 0.62 && dz < CARD.h * 0.62) {
        const d = dx + dz;
        if (!best || d < best.d) best = { w, d };
      }
    }
    if (best) {
      if (eats(best.w.id, v.id)) return { kind: 'eat', target: best.w };
      const info = R.combineInfo(S, v.id, best.w.id);
      if (info) return { kind: 'card', target: best.w, info };
    }
    if (inRect(x, z, L.sellX, L.shopZ, L.tile.w + 0.3, L.tile.h + 0.3) && v.market == null) return { kind: 'sell' };
    if (inRect(x, z, L.shrine.x, L.shrine.z, L.shrine.w + 0.2, L.shrine.h + 0.2) && v.market == null) return { kind: 'feed' };
    for (let i = 0; i < 6; i++) {
      if (inRect(x, z, wallX(i), L.wall.z, L.wall.step, 2.1)) {
        if (def.kind !== 'unit') return { kind: 'bad', why: 'Only units stand on the wall', slot: i };
        if (i >= wallSlots(S.day)) return { kind: 'bad', why: `Unlocks on day ${i === 4 ? 4 : 7}`, slot: i };
        return { kind: 'slot', slot: i };
      }
    }
    if (best) return { kind: 'stack', target: best.w };
  }
  const p = clampTable({ x, z });
  return { kind: 'table', x: p.x, z: p.z };
}

function dropHint(d, v) {
  if (d.kind === 'card') {
    const key = `${d.info.a}+${d.info.b}`;
    const known = codex.has(key);
    const rareKnown = codex.has(`${key}!`);
    let s = known ? `→ <b>${ui.esc(CARDS[d.info.result].name)}</b>` : '✦ A new combination!';
    if (d.info.rare) s += ` <span class="rare">★ ${d.info.chance}% ${rareKnown ? ui.esc(CARDS[d.info.rare].name) : 'rare'}</span>`;
    return [s, false];
  }
  if (d.kind === 'eat') {
    const e = R.eatInfo(d.target.id, d.target.inst?.meals || 0);
    const per = d.target.def.eats.per || 1;
    const meals = d.target.inst?.meals || 0;
    const stat = { burn: 'burn', poison: 'poison', heal: 'heal', dmg: 'damage' }[d.target.def.main] || '';
    const grow = (meals + 1) % per === 0 ? `Feed: +1 ${stat}` : `Feed: +1 ${stat} next meal`;
    return [e.next ? `${grow} · ${e.left - 1 <= 0 ? `evolves into <b>${ui.esc(CARDS[e.into].name)}</b>!` : `${e.left - 1} more to evolve`}` : grow, false];
  }
  if (d.kind === 'sell') return [`Sell for ${ui.ico('coin')} ${v.inst ? R.sellPrice(S, v.inst) : 0}`, false];
  if (d.kind === 'feed') {
    const t = R.feedTrack(v.id);
    if (!t) return ['The shrine wants Ember, Bone, Berry, Coin or Stone', true];
    const n = S.fed[t.id] + 1;
    return [`Feed the ${t.name} track (${n}/${n > 5 ? 12 : 5})`, false];
  }
  if (d.kind === 'bad') return [d.why, true];
  if (d.kind === 'slot') return [S.wall[d.slot] && S.wall[d.slot] !== v.inst ? 'Swap places' : 'Place on the wall', false];
  if (d.kind === 'stack') return ['Nothing happens', true];
  return [null, false];
}

// ------------------------------------------------------------------ input

let press = null;
let drag = null;
let hover = null;
let lastPointer = { x: 0, y: 0 };

stage.addEventListener('pointerdown', (e) => {
  if (e.button === 2) return;
  sfx.unlock();
  stage.setPointerCapture(e.pointerId);
  const hit = pickAt(e.clientX, e.clientY);
  press = { x: e.clientX, y: e.clientY, id: e.pointerId, hit, button: e.button, goal: view.goal.clone() };
});

stage.addEventListener('pointermove', (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
  if (drag) { moveDrag(e); return; }
  if (press) {
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6;
    if (!moved) return;
    const card = press.hit?.card;
    if (card && press.button === 0 && canDrag(card)) { startDrag(card, e); return; }
    if (!press.pan) press.pan = true;
    pan(e);
    return;
  }
  updateHover(e.clientX, e.clientY);
});

stage.addEventListener('pointerup', (e) => {
  if (drag) { endDrag(e); press = null; return; }
  if (press && !press.pan) {
    const hit = press.hit;
    if (hit?.card) clickCard(hit.card);
    else if (hit?.tile) clickTile(hit.tile);
  }
  press = null;
  stage.className = '';
});
stage.addEventListener('pointercancel', () => { if (drag) endDrag(null); press = null; });
stage.addEventListener('contextmenu', (e) => e.preventDefault());

stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.zoom = THREE.MathUtils.clamp(view.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.45, 1.35);
}, { passive: false });

stage.addEventListener('dblclick', () => {
  view.zoom = 1;
  if (mode === 'shop') world.frame(HOME.x, HOME.z, HOME.w, HOME.h);
});

function pan(e) {
  const r = stage.getBoundingClientRect();
  const wpp = (2 * view.dist * Math.tan(THREE.MathUtils.degToRad(world.camera.fov / 2))) / r.height;
  const dx = (e.clientX - press.x) * wpp;
  const dz = (e.clientY - press.y) * wpp * 1.25;
  view.goal.set(press.goal.x - dx, 0, press.goal.z - dz);
  const cz = mode === 'shop' ? HOME.z : A.cz;
  view.goal.x = THREE.MathUtils.clamp(view.goal.x, -10, 10);
  view.goal.z = THREE.MathUtils.clamp(view.goal.z, cz - 8, cz + 8);
  stage.className = 'grabbing';
}

function updateHover(cx, cy) {
  const hit = pickAt(cx, cy);
  const card = hit?.card || null;
  const tile = hit?.tile || null;
  hover = card || tile;
  stage.className = card || tile ? 'point' : '';
  if (card) {
    if (card.enemy || card.summoned) ui.info(ui.cardInfo(card.id, { inst: { perm: card.perm }, codex }));
    else if (card.pack) ui.info(ui.packInfo(card.pack, { price: false }));
    else if (card.market != null) ui.info(ui.cardInfo(card.id, { price: S.shop[card.market]?.price, codex }));
    else ui.info(ui.cardInfo(card.id, { inst: card.inst, sell: card.inst && mode === 'shop' ? R.sellPrice(S, card.inst) : null, codex }));
  } else if (tile) {
    if (tile.kind === 'pack') ui.info(ui.packInfo(tile.pack));
    else if (tile.kind === 'sell') ui.info('<h3>Sell</h3><p>Drop a card here for gold: 1 per tier (ingredients sell for 1).</p>');
    else if (tile.kind === 'shrine') ui.info(`<h3>Shrine</h3><p>Feed ingredients to unlock themed packs for the rest of the run. 5 fed unlocks a tier-1 pack, 12 a tier-2 pack with a 10% rare chance.</p><div class="recipes">${TRACKS.map((t) => `<div>${ui.ico(t.feed)} ${CARDS[t.feed].name} → ${t.name}: <b>${S.fed[t.id]}</b></div>`).join('')}</div>`);
    else if (tile.kind === 'reroll') ui.info('<h3>Reroll</h3><p>New market singles for 1 gold.</p>');
    else if (tile.kind === 'single') ui.info('<h3>Market</h3><p>Sold out. Restocks tomorrow or on reroll.</p>');
  } else ui.info(null);
}

function startDrag(card, e) {
  drag = { card, from: { x: card.pos.x, z: card.pos.z } };
  const g = world.groundPoint(e.clientX, e.clientY, 0.75);
  drag.offset = g ? { x: card.pos.x - g.x, z: card.pos.z - g.z } : { x: 0, z: 0 };
  drag.offset.x *= 0.5;
  drag.offset.z *= 0.5;
  card.dragging = true;
  card.raise();
  hover = null;
  ui.info(null);
  stage.className = 'grabbing';
  sfx.pick();
  moveDrag(e);
}

let lastHint = null;
function moveDrag(e) {
  const card = drag.card;
  const g = world.groundPoint(e.clientX, e.clientY, 0.75);
  if (!g) return;
  card.target.set(g.x + drag.offset.x, 0, g.z + drag.offset.z);
  const d = evalDrop(card, card.target.x, card.target.z);
  drag.drop = d;
  // highlights
  for (const w of views.values()) w.glowGoal = 0;
  if (d.kind === 'card') { d.target.glowGoal = 0.95; d.target.glowColor.set(d.info.rare ? '#ffe27a' : '#fff6c8'); }
  if (d.kind === 'eat') { d.target.glowGoal = 0.95; d.target.glowColor.set('#ffc59a'); }
  slotGlow.forEach((m, i) => { m.userData.goal = (d.kind === 'slot' && d.slot === i) ? 0.55 : (d.kind === 'bad' && d.slot === i) ? 0.25 : 0; m.material.color.set(d.kind === 'bad' ? '#e7a69c' : '#fff7c4'); });
  sellTile.hover = d.kind === 'sell' ? 1 : 0;
  shrineTile.hover = d.kind === 'feed' ? 1 : 0;
  const [html, bad] = dropHint(d, card);
  if (html !== lastHint) lastHint = html;
  ui.hint(html, e.clientX, e.clientY - 30, bad);
}

function clearDragFx() {
  for (const w of views.values()) w.glowGoal = 0;
  slotGlow.forEach((m) => { m.userData.goal = 0; });
  sellTile.hover = 0;
  shrineTile.hover = 0;
  ui.hint(null);
}

function endDrag() {
  const { card, from } = drag;
  const d = drag.drop || evalDrop(card, card.target.x, card.target.z);
  card.dragging = false;
  drag = null;
  clearDragFx();
  stage.className = '';
  sfx.drop();

  if (card.pack) {
    const p = card.packRef;
    Object.assign(p, clampTable({ x: d.x ?? card.target.x, z: d.z ?? card.target.z }));
    card.moveTo(p.x, p.z);
    save();
    return;
  }

  // Buying from the market by dragging out.
  if (card.market != null) {
    const idx = card.market;
    if (d.kind === 'sell' || d.kind === 'feed' || d.kind === 'bad' || inMarket(card.target.x, card.target.z)) { returnToMarket(card); return; }
    const res = R.buySingle(S, idx);
    if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); returnToMarket(card); return; }
    sfx.coin();
    marketViews[idx] = null;
    card.market = null;
    card.restLift = 0;
    card.inst = res.inst;
    views.set(res.inst.uid, card);
    Object.assign(res.inst, findSpot(card.target.x, card.target.z));
    refreshShopTiles.mkey = null;
  }

  const inst = card.inst;
  if (d.kind === 'card') return startCombine(card, d.target);
  if (d.kind === 'eat') return feedEater(card, d.target);
  if (d.kind === 'sell') {
    const res = R.sell(S, inst.uid);
    if (res.ok) {
      sfx.coin();
      fx.puffs(card.pos, { n: 6 });
      fx.number(card.pos.clone().setY(0.5), `+${res.price}`, 'gold');
      views.delete(inst.uid);
      card.dispose(scene);
    }
    refresh();
    return;
  }
  if (d.kind === 'feed') {
    const res = R.feed(S, inst.uid);
    if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); bounceBack(card); refresh(); return; }
    views.delete(inst.uid);
    card.busy = true;
    leaving.add(card);
    card.flyTo(L.shrine.x - 1.0 + TRACKS.indexOf(res.track) * 0.1, L.shrine.z, {
      dur: 0.35, arc: 0.8, done: () => {
        fx.sparkles(card.pos, { n: 8, color: '#f6efdc' });
        leaving.delete(card);
        card.dispose(scene);
      },
    });
    card.scaleGoal = 0.2;
    sfx.coin();
    if (res.unlocked) {
      ui.toast(`${PACKS[res.unlocked].name} unlocked!`, 'good', 'bless');
      sfx.rare();
      later(0.4, () => { const t = packTiles[packTiles.length - 1]; if (t) fx.sparkles(t.group.position.clone().setY(0.3), { n: 18 }); });
    }
    refresh();
    return;
  }
  if (d.kind === 'slot') {
    const fromWall = S.wall.indexOf(inst);
    const res = R.toWall(S, inst.uid, d.slot);
    if (!res.ok) { ui.toast(res.reason, 'bad'); bounceBack(card); return; }
    if (res.swapped && fromWall < 0) {
      // occupant goes where the dragged card came from
      Object.assign(res.swapped, findSpot(from.x, Math.min(from.z, L.table.z1 - 1)));
    }
    card.kick(0.1);
    refresh();
    return;
  }
  if (d.kind === 'bad') { ui.toast(d.why, 'bad'); bounceBack(card); return; }
  if (d.kind === 'table' || d.kind === 'stack') {
    const onWall = S.wall.indexOf(inst) >= 0;
    if (onWall) {
      const res = R.toTable(S, inst.uid);
      if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); refresh(); return; }
    }
    const p = clampTable({ x: card.target.x, z: card.target.z });
    inst.x = p.x;
    inst.z = p.z;
    refresh();
  }
}

function inMarket(x, z) {
  return x > L.table.x1 - 0.1 && z < L.market.reroll.z + 0.8;
}

function returnToMarket(card) {
  const p = marketPos(card.market);
  card.moveTo(p.x, p.z - 0.2);
}

function bounceBack(card) {
  const inst = card.inst;
  if (!inst) return;
  const h = homeOf(inst);
  if (h) card.moveTo(h.x, h.z);
  sfx.deny();
}

function clickCard(card) {
  if (mode !== 'shop' || card.busy) return;
  if (card.pack) return openPack(card);
  if (card.market != null) return buyMarket(card);
  card.kick(0.12);
}

function clickTile(tile) {
  if (mode !== 'shop') return;
  if (tile.kind === 'pack') return buyPack(tile);
  if (tile.kind === 'reroll') {
    const res = R.reroll(S);
    if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); return; }
    sfx.coin();
    for (const v of marketViews) if (v) fx.puffs(v.pos, { n: 5, s: 0.3 });
    refreshShopTiles.mkey = null;
    refresh();
  }
}

function buyPack(tile) {
  const res = R.buyPack(S, tile.pack);
  if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); tile.group.userData.shake = 0.3; return; }
  sfx.coin();
  const spot = findSpot(-6.5 + packViews.size * 1.4, -2.2);
  Object.assign(res.pack, spot);
  const v = new CardView(scene, { pack: res.pack.pack });
  v.packRef = res.pack;
  v.place(tile.group.position.x, L.shopZ);
  v.flyTo(spot.x, spot.z, { dur: 0.6, arc: 2.2 });
  packViews.set(res.pack.uid, v);
  refresh();
}

function openPack(v) {
  const p = v.packRef;
  const res = R.openOne(S, p.uid);
  if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); v.kick(0.1); return; }
  sfx.pop();
  v.kick(0.18);
  v.hop(2.6);
  const spot = findSpot(v.pos.x + 1.4, v.pos.z + 0.6, null);
  Object.assign(res.inst, spot);
  const c = makeView(res.inst, v.pos.x, v.pos.z);
  c.raise();
  c.flip = Math.PI;
  c.flyTo(spot.x, spot.z, { dur: 0.55, arc: 2.0, spin: Math.PI * 2 });
  c.flipGoal = Math.PI * 2;
  later(0.6, () => { c.flip = 0; c.flipGoal = 0; });
  if (CARDS[res.inst.id].rare) later(0.5, () => { fx.sparkles(c.pos, { n: 24 }); sfx.rare(); ui.toast(`Rare! ${CARDS[res.inst.id].name}`, 'good', 'bless'); });
  if (res.empty) {
    later(0.25, () => {
      fx.puffs(v.pos, { n: 9 });
      packViews.delete(p.uid);
      v.dispose(scene);
    });
  }
  refresh();
}

function buyMarket(v) {
  const idx = v.market;
  const res = R.buySingle(S, idx);
  if (!res.ok) { ui.toast(res.reason, 'bad'); sfx.deny(); v.kick(0.1); return; }
  sfx.coin();
  marketViews[idx] = null;
  v.market = null;
  v.restLift = 0;
  v.inst = res.inst;
  views.set(res.inst.uid, v);
  const spot = findSpot(3.8, 0);
  Object.assign(res.inst, spot);
  v.flyTo(spot.x, spot.z, { dur: 0.5, arc: 1.6 });
  refreshShopTiles.mkey = null;
  refresh();
}

// ------------------------------------------------------------------ eating

function feedEater(food, eater) {
  const res = R.eat(S, food.inst.uid, eater.inst.uid);
  if (!res.ok) { bounceBack(food); return; }
  views.delete(food.inst.uid);
  food.busy = true;
  leaving.add(food);
  food.scaleGoal = 0.1;
  food.flyTo(eater.pos.x, eater.pos.z, {
    dur: 0.25, arc: 0.6, done: () => {
      leaving.delete(food);
      food.dispose(scene);
      eater.kick(0.22);
      eater.hop(2.2);
      fx.puffs(eater.pos, { n: 5, s: 0.3, color: '#ffd9b8' });
      if (res.inst.meals % (CARDS[res.inst.id].eats?.per || 1) === 0 || res.evolved) fx.number(eater.pos.clone().setY(0.4), '+1', eater.def.main || 'dmg', { icon: eater.def.main });
      sfx.pop();
      if (res.evolved) {
        sfx.rare();
        fx.sparkles(eater.pos, { n: 26, spread: 1.8 });
        ui.banner(`${ui.esc(CARDS[res.evolved].name)}<small>evolved after ${res.inst.meals} meals</small>`);
      }
      refresh();
      if (hover === eater) updateHover(lastPointer.x, lastPointer.y);
    },
  });
  save();
}

// ------------------------------------------------------------------ combining

function startCombine(a, b) {
  a.busy = true;
  b.busy = true;
  a.raise();
  a.moveTo(b.pos.x, b.pos.z + 0.34);
  combos.push({ a, b, t: 0 });
}

function updateCombos(dt) {
  for (let i = combos.length - 1; i >= 0; i--) {
    const c = combos[i];
    c.t += dt;
    c.b.setBar(c.t / RULES.combineTime);
    if (c.t < RULES.combineTime) continue;
    combos.splice(i, 1);
    c.b.setBar(null);
    const res = R.combine(S, c.a.inst.uid, c.b.inst.uid);
    c.a.busy = false;
    c.b.busy = false;
    if (!res.ok) { ui.toast(res.reason || 'Nothing happens'); refresh(); continue; }
    const at = c.b.pos.clone();
    fx.puffs(at, { n: 10, spread: 1.1 });
    views.delete(c.a.inst.uid);
    views.delete(c.b.inst.uid);
    c.a.dispose(scene);
    c.b.dispose(scene);
    const onWall = S.wall.indexOf(res.inst);
    if (onWall < 0) Object.assign(res.inst, clampTable({ x: at.x, z: at.z }));
    const v = makeView(res.inst, at.x, at.z);
    v.scale = 0.3;
    v.kick(0.25);
    v.hop(3);
    const name = CARDS[res.inst.id].name;
    if (res.rare) {
      sfx.rare();
      fx.sparkles(at, { n: 30, spread: 2 });
      ui.banner(`★ ${ui.esc(name)} ★<small>a rare appeared!</small>`);
    } else sfx.combine();
    if (res.firstTime) {
      const key = `${res.info.a}+${res.info.b}`;
      codex.add(key);
      if (res.rare) codex.add(`${key}!`);
      saveCodex(codex);
      ui.toast(`New idea: ${ui.esc(name)}`, 'good', 'bless');
      fx.sparkles(at, { n: 10, color: '#fff6c8' });
    }
    refresh();
  }
}

// ------------------------------------------------------------------ battle

let B = null;
let ghost = null;
let speed = 1;
let acc = 0;
let result = null;
const auraClock = [0, 0];
let lastBreakdown = null;
const fortFx = { 0: createFortressFx(scene, world.towers.player), 1: createFortressFx(scene, world.towers.enemy) };

const towerPos = (side) => (side === 0 ? world.towers.player : world.towers.enemy).position.clone().setY(1.7);
const unitPos = (ref) => {
  const v = ref && bv[ref.side][ref.slot];
  return v ? v.pos.clone().setY(0.35) : towerPos(ref ? ref.side : 0);
};

$('btn-fight').addEventListener('click', () => startFight());
document.querySelectorAll('.speed').forEach((b) => b.addEventListener('click', () => { speed = Number(b.dataset.speed); ui.setSpeed(speed); }));
$('btn-skip').addEventListener('click', () => {
  if (!B || mode !== 'battle') return;
  while (!B.over) B.step();
  B.events.length = 0;
});

async function startFight() {
  if (mode !== 'shop') return;
  if (combos.length) { ui.toast('Finish combining first', 'bad'); return; }
  const units = S.wall.slice(0, wallSlots(S.day)).filter(Boolean);
  if (!units.length) { ui.toast('Drag some units onto your wall first', 'bad'); sfx.deny(); return; }
  mode = 'intro';
  $('fight-box').hidden = true;
  ui.info(null);
  hover = null;
  const snap = R.snapshot(S, 'You');
  ghost = await fetchGhost({ day: S.day, wins: S.wins, losses: S.losses, runSeed: S.seed, seed: (S.seed ^ (S.day * 2654435761)) >>> 0 });
  submitGhost(snap, S.seed);
  B = createBattle({ left: snap, right: ghost, seed: (S.seed * 31 + S.day) >>> 0 });
  acc = 0;
  bv = [[], []];
  sfx.whoosh();
  for (let i = 0; i < snap.slots; i++) {
    const inst = S.wall[i];
    const v = inst && views.get(inst.uid);
    if (!v) continue;
    v.busy = true;
    v.raise();
    bv[0][i] = v;
    v.flyTo(arenaX(i), A.playerZ, { dur: 0.95, arc: 4, delay: i * 0.07 });
  }
  for (let i = 0; i < ghost.slots; i++) {
    const c = ghost.wall[i];
    if (!c || !CARDS[c.id]) continue;
    const v = new CardView(scene, { id: c.id, perm: c.perm || 0 });
    v.place(arenaX(i), A.enemyZ - 3);
    v.flyTo(arenaX(i), A.enemyZ, { dur: 0.7, arc: 5, delay: 0.7 + i * 0.12, done: () => { fx.puffs(v.pos, { n: 6, s: 0.35 }); sfx.drop(); } });
    v.busy = true;
    v.enemy = true;
    bv[1][i] = v;
  }
  fortFx[0].reset();
  fortFx[1].reset();
  world.frame(0, A.cz - 0.15, 19.4, 13.6);
  view.zoom = 1;
  ui.battleStart(snap, ghost);
  ui.setSpeed(speed);
  ui.battleUpdate(B);
  ui.banner(`Day ${S.day}<small>vs ${ui.esc(ghost.name)}</small>`);
  later(1.9, () => {
    ui.banner('Brawl!');
    sfx.bigHit();
    mode = 'battle';
  });
}

function battleEvent(e) {
  const kindOf = (k) => (k === 'dmg' ? 'dmg' : k);
  switch (e.type) {
    case 'act': {
      const v = e.src && bv[e.src.side][e.src.slot];
      if (v) { v.hop(e.mirror ? 1.6 : 2.2); v.kick(0.06); }
      break;
    }
    case 'dmg': {
      const impact = () => {
        const p = towerPos(e.side);
        const tick = e.kind === 'burn' || e.kind === 'poison';
        if (e.amount > 0 && !tick) {
          fx.number(p, `-${e.amount}`, kindOf(e.kind), { big: e.crit || e.amount >= 15, icon: e.kind === 'burn' || e.kind === 'poison' ? e.kind : null });
          fx.puffs(p.clone().setY(0.8), { n: e.amount >= 10 ? 7 : 3, s: 0.3, spread: 0.9 });
        }
        if (e.absorbed > 0) {
          fx.number(p.clone().add(new THREE.Vector3(0.9, 0.2, 0)), `-${e.absorbed}`, 'shield');
          fortFx[e.side].hit();
        }
        if (e.kind === 'burn' || e.kind === 'poison') sfx.tick();
        else if (e.amount + e.absorbed >= 15) { sfx.bigHit(); view.shake = Math.min(0.5, view.shake + 0.25); }
        else sfx.hit();
      };
      if (e.src) {
        sfx.shoot();
        fx.projectile(unitPos(e.src), towerPos(e.side), e.pierce ? 'charge' : 'dmg', { size: e.crit ? 1.5 : 1, onHit: impact });
      } else impact();
      break;
    }
    case 'tick': {
      // Status ticks get their own big number beside the tower: burn left, poison right.
      const p = towerPos(e.side).add(new THREE.Vector3(e.kind === 'burn' ? -1.7 : 1.7, 0.2, 0));
      fx.number(p, `-${e.amount}`, e.kind, { big: true, icon: e.kind, still: true });
      fx.puffs(towerPos(e.side).setY(1.2), { n: Math.min(10, 3 + Math.floor(e.amount / 4)), s: 0.28, spread: 1, color: e.kind === 'burn' ? '#ffb070' : '#b6e38a' });
      ui.flashStatus(e.side, e.kind);
      sfx.tick();
      break;
    }
    case 'heal':
      fx.projectile(unitPos(e.src), towerPos(e.side), 'heal', { arc: 1.4, dur: 0.32, size: 0.8, onHit: () => { fx.number(towerPos(e.side), `+${e.amount}`, 'heal'); sfx.heal(); } });
      break;
    case 'shield':
      if (!e.src) { fx.number(towerPos(e.side), `+${e.amount}`, 'shield'); break; }
      fx.projectile(unitPos(e.src), towerPos(e.side), 'shield', { arc: 1.4, dur: 0.32, size: 0.8, onHit: () => { fx.number(towerPos(e.side), `+${e.amount}`, 'shield'); fortFx[e.side].hit(); sfx.shield(); } });
      break;
    case 'status': {
      if (e.src && e.src.side !== e.side) {
        fx.projectile(unitPos(e.src), towerPos(e.side), e.kind, { dur: 0.4, size: 0.9, onHit: () => fx.number(towerPos(e.side).add(new THREE.Vector3(-0.9, 0, 0)), `+${e.amount}`, e.kind, { icon: e.kind }) });
      } else {
        fx.label(e.src ? unitPos(e.src) : towerPos(e.side), `+${e.amount}`, '#fff', 0.6, e.kind);
      }
      break;
    }
    case 'miss':
      fx.label(unitPos(e.src), 'miss', '#ffffff', 0.8);
      break;
    case 'crit':
      fx.label(unitPos(e.src), 'crit!', '#f2c64a', 0.9);
      break;
    case 'freeze': {
      const tv = bv[e.target.side][e.target.slot];
      fx.projectile(unitPos(e.src), unitPos(e.target), 'freeze', { arc: 1.6, dur: 0.3, onHit: () => { if (tv) { fx.sparkles(tv.pos, { n: 6, color: '#bfe9ff' }); tv.kick(-0.08); } sfx.freeze(); } });
      break;
    }
    case 'bless': {
      const tv = bv[e.target.side][e.target.slot];
      fx.projectile(unitPos(e.src), unitPos(e.target), 'bless', { arc: 1.2, dur: 0.28, size: 0.7, onHit: () => { if (tv) { fx.sparkles(tv.pos, { n: 4 }); tv.kick(0.08); } } });
      break;
    }
    case 'charge':
      if (e.src && e.target) fx.projectile(unitPos(e.src), unitPos(e.target), 'charge', { arc: 0.8, dur: 0.22, size: 0.6 });
      break;
    case 'copy':
      if (e.src) fx.sparkles(unitPos(e.src), { n: 6, color: '#d9c8ff' });
      break;
    case 'summon': {
      const z = e.side === 0 ? A.playerZ : A.enemyZ;
      const v = new CardView(scene, { id: e.id, summon: true });
      v.place(arenaX(e.slot), z);
      v.pos.y = 0;
      v.flyTo(arenaX(e.slot), z, { dur: 0.45, arc: 2.5, done: () => fx.puffs(v.pos, { n: 5, s: 0.3 }) });
      v.busy = true;
      v.summoned = true;
      if (e.src) fx.projectile(unitPos(e.src), new THREE.Vector3(arenaX(e.slot), 0.3, z), 'dmg', { arc: 1, dur: 0.25, size: 0.6 });
      bv[e.side][e.slot] = v;
      break;
    }
    case 'revive':
      fx.label(towerPos(e.side), 'REVIVE!', '#f2c64a', 1.4);
      fx.sparkles(towerPos(e.side), { n: 30, spread: 2.2 });
      sfx.rare();
      break;
    case 'resist':
      fx.label(towerPos(e.side), 'immune', '#bfe9ff', 0.8);
      break;
    default:
      break;
  }
}

function updateBattle(dt) {
  if (mode === 'battle') {
    acc += dt * speed;
    let steps = 0;
    while (acc >= DT && !B.over && steps < 400) {
      B.step();
      acc -= DT;
      steps += 1;
    }
    const evs = B.events.splice(0);
    for (const e of evs) battleEvent(e);
    if (B.over) endBattle();
  }
  if (B && (mode === 'battle' || mode === 'outro' || mode === 'intro')) {
    for (const side of [0, 1]) {
      B.sides[side].units.forEach((u, slot) => {
        const v = bv[side][slot];
        if (!v) return;
        if (!u) { v.setBar(null); return; }
        const t = u.timers[0];
        v.setBar(t && mode !== 'intro' ? t.prog / t.cd : null, u.frozen > 0 ? '#5aa9d6' : D.INK);
        v.frostGoal = u.frozen > 0 ? 0.55 : 0;
        if (mode !== 'intro') v.setTally(Math.floor(u.dealt));
      });
      fortFx[side].set(B.sides[side].shield);
      // Ambient flames / bubbles on a fortress that is burning or poisoned.
      const St = B.sides[side];
      auraClock[side] += dt;
      if (auraClock[side] > 0.12) {
        auraClock[side] = 0;
        const tp = towerPos(side);
        if (St.burn > 0 && Math.random() < Math.min(1, 0.25 + St.burn / 12)) fx.puffs(tp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, -0.6, (Math.random() - 0.5) * 1.2)), { n: 1, s: 0.22 + Math.min(0.3, St.burn / 60), up: 2.2, spread: 0.1, color: '#ff9a4a', life: 0.7 });
        if (St.poison > 0 && Math.random() < Math.min(1, 0.2 + St.poison / 15)) fx.puffs(tp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, -0.9, (Math.random() - 0.5) * 1.2)), { n: 1, s: 0.18 + Math.min(0.25, St.poison / 60), up: 1.4, spread: 0.05, color: '#9fd05f', life: 0.9 });
      }
    }
    ui.battleUpdate(B);
  }
}

function endBattle() {
  mode = 'outro';
  const won = B.winner === 0;
  lastBreakdown = [0, 1].map((side) => ({
    units: B.roster[side].map((u) => ({ id: u.id, dealt: Math.round(u.dealt), summoned: u.summoned }))
      .reduce((acc, u) => { const k = u.summoned ? `${u.id}*` : null; const prev = k && acc.find((x) => x.key === k); if (prev) { prev.dealt += u.dealt; prev.n += 1; } else acc.push({ ...u, key: k || Math.random(), n: 1 }); return acc; }, [])
      .sort((a, b) => b.dealt - a.dealt),
    taken: { ...B.sides[side].taken },
    time: B.t,
  }));
  result = R.finishFight(S, won, ghost.name);
  save();
  for (const v of bv[0]) if (v) v.setBar(null);
  for (const v of bv[1]) if (v) v.setBar(null);
  const loser = won ? 1 : 0;
  fx.puffs(towerPos(loser), { n: 18, spread: 2, s: 0.6 });
  view.shake = 0.5;
  if (won) sfx.win(); else sfx.lose();
  ui.banner(won ? 'Victory!' : 'Defeat', { hold: true });
  later(1.5, showResult);
}

function showResult() {
  const r = result;
  const lines = r.lines.map(([label, g]) => `<div><span>${ui.esc(label)}</span><span>${ui.ico('coin')} +${g}</span></div>`).join('');
  const el = ui.modal(`
    <h2 class="${r.won ? 'won' : 'lost'}">${r.won ? 'Victory' : 'Defeat'}</h2>
    <p>Day ${S.history[S.history.length - 1].day} against ${ui.esc(ghost.name)}. Record <b>${S.wins}–${S.losses}</b>.</p>
    ${ui.breakdown(lastBreakdown)}
    <div class="lines">${lines}<div class="total"><span>Gold for tomorrow</span><span>${ui.ico('coin')} +${r.total}</span></div></div>
    <div class="actions"><button class="big-btn red" data-continue>${r.over ? 'See results' : 'Continue'}</button></div>`);
  el.querySelector('[data-continue]').addEventListener('click', () => closeBattle());
}

function closeBattle() {
  ui.modal(null);
  ui.hideBanner();
  ui.battleEnd();
  for (const v of bv[0]) if (v) v.setTally(null);
  for (const v of bv[1]) if (v) { fx.puffs(v.pos, { n: 6, s: 0.35 }); v.dispose(scene); }
  for (const [i, v] of bv[0].entries()) {
    if (!v) continue;
    if (v.summoned) { fx.puffs(v.pos, { n: 6, s: 0.35 }); v.dispose(scene); continue; }
    v.frostGoal = 0;
    v.flyTo(wallX(i), L.wall.z, { dur: 0.85, arc: 4, delay: i * 0.06, done: (c) => { c.busy = false; } });
  }
  bv = [[], []];
  B = null;
  world.frame(HOME.x, HOME.z, HOME.w, HOME.h);
  view.zoom = 1;
  if (result.over) {
    later(0.9, showRunOver);
    mode = 'over';
    return;
  }
  const prevSlots = slotsShown;
  later(0.9, () => {
    mode = 'shop';
    $('fight-box').hidden = false;
    ui.banner(`Day ${S.day}`);
    refreshShopTiles.mkey = null;
    refresh();
    if (wallSlots(S.day) > prevSlots) {
      ui.toast('A new wall slot opened!', 'good', 'bless');
      fx.sparkles(new THREE.Vector3(wallX(wallSlots(S.day) - 1), 0.3, L.wall.z), { n: 20 });
    }
  });
}

function showRunOver() {
  const champion = S.wins >= RULES.winsToFinish;
  const el = ui.modal(`
    <h2 class="${champion ? 'won' : 'lost'}">${champion ? 'Champion!' : 'Run over'}</h2>
    <p>You finished with <b>${S.wins} wins</b> and <b>${S.losses} losses</b> over ${S.history.length} days.</p>
    <div class="lines">${S.history.map((h) => `<div><span>Day ${h.day} · ${ui.esc(h.vs)}</span><span class="${h.won ? 'won' : 'lost'}">${h.won ? 'won' : 'lost'}</span></div>`).join('')}</div>
    <div class="actions"><button class="big-btn red" data-new>New run</button></div>`);
  el.querySelector('[data-new]').addEventListener('click', () => newRun());
}

function newRun() {
  ui.modal(null);
  for (const v of views.values()) v.dispose(scene);
  for (const v of packViews.values()) v.dispose(scene);
  for (const v of marketViews) if (v) v.dispose(scene);
  views.clear();
  packViews.clear();
  marketViews = [];
  combos.length = 0;
  S = R.newRun();
  refreshShopTiles.key = null;
  refreshShopTiles.mkey = null;
  slotsShown = -1;
  mode = 'shop';
  $('fight-box').hidden = false;
  world.frame(HOME.x, HOME.z, HOME.w, HOME.h);
  refresh();
  ui.banner('Day 1<small>buy a pack to begin</small>');
}

// ------------------------------------------------------------------ chrome buttons

ui.setSound(sfx.muted);
$('btn-sound').addEventListener('click', () => ui.setSound(sfx.toggle()));
function bindModal(el) {
  el?.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ui.modal(null)));
  el?.querySelector('[data-newrun]')?.addEventListener('click', () => {
    if (mode !== 'shop') { ui.modal(null); return; }
    newRun();
  });
}
$('btn-ideas').addEventListener('click', () => bindModal(ui.ideas(codex)));
$('btn-help').addEventListener('click', () => bindModal(ui.help()));
$('modal').addEventListener('pointerdown', (e) => {
  if (e.target.id === 'modal' && !e.target.querySelector('[data-continue],[data-new]')) ui.modal(null);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').querySelector('[data-continue],[data-new]')) ui.modal(null);
  if (e.key === 'f' && mode === 'shop' && $('modal').hidden) startFight();
});

// ------------------------------------------------------------------ frame loop

window.addEventListener('resize', () => world.resize());
world.resize();
world.frame(HOME.x, HOME.z, HOME.w, HOME.h);
view.target.copy(view.goal);
view.dist = view.goalDist;
refresh();

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const t = timers.splice(i, 1)[0]; t.fn(); }
  }

  if (mode === 'shop') {
    separate(dt);
    if (separate.dirty) { separate.dirty = false; save.pending = true; }
    updateCombos(dt);
  }
  updateBattle(dt);

  const all = [...views.values(), ...leaving, ...packViews.values(), ...marketViews.filter(Boolean), ...bv[1].filter(Boolean), ...bv[0].filter((v) => v && v.summoned)];
  for (const v of all) {
    const hovered = v === hover && !drag && !v.busy;
    v.liftGoal = v.restLift + (v.dragging ? 0.75 : hovered ? 0.1 : 0) + (v.busy && combos.some((c) => c.a === v) ? 0.06 : 0);
    v.scaleGoal = v.dragging ? 1.07 : hovered ? 1.035 : 1;
    v.update(dt);
  }
  for (const t of tiles) {
    const g = t.group;
    const goal = 1 + (t === hover ? 0.03 : 0) + t.hover * 0.07;
    const s = g.scale.x + (goal - g.scale.x) * (1 - Math.exp(-dt * 14));
    g.scale.setScalar(s);
    if (g.userData.shake) { g.userData.shake = Math.max(0, g.userData.shake - dt); g.position.x += Math.sin(now * 0.06) * g.userData.shake * 0.04; }
  }
  for (const m of slotGlow) {
    const goal = m.userData.goal || 0;
    m.material.opacity += (goal - m.material.opacity) * (1 - Math.exp(-dt * 12));
  }
  fortFx[0].update(dt);
  fortFx[1].update(dt);
  fx.update(dt);
  world.updateCamera(dt);
  world.render();

  if (save.pending && !drag) { save.pending = false; save(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('loading').classList.add('gone');
setTimeout(() => $('loading').remove(), 500);

if (!S.history.length && !S.table.length && !S.packs.length && S.day === 1) {
  let seen = false;
  try { seen = localStorage.getItem('stackbrawl.seenHelp') === '1'; } catch { /* ignore */ }
  if (!seen) {
    try { localStorage.setItem('stackbrawl.seenHelp', '1'); } catch { /* ignore */ }
    bindModal(ui.help());
  } else ui.banner('Day 1<small>buy a pack to begin</small>');
}

// Debug handle for the console.
window.stackbrawl = { get state() { return S; }, world, R, refresh };
