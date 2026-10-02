// Stackbrawl: game controller. Wires run state, the 3D table, input and fights.
import * as THREE from 'three';
import { CARDS, PACKS, TRACKS, TRACK_STEPS, RULES, wallSlots, fortressHp, eats, starMult } from './content.js';
import * as R from './run.js';
import { TRINKETS, RACK_SLOTS, TK_BY, trinketSellValue } from './trinkets.js';
import { TRINKET_METAL } from './gfx/draw.js';
import { createBattle, DT } from './sim.js';
import { fetchGhost, submitGhost } from './ghosts.js';
import { createWorld, L, CARD, wallX, arenaX, rackX } from './gfx/world.js';
import { CardView, loadArt, setAnisotropy, artURL, cardImageURL } from './gfx/card.js';
import { createFx } from './gfx/fx.js';
import { createFortressHud } from './gfx/fortress.js';
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
    if (!s || s.v !== R.SAVE_VERSION) return null;
    // Drop cards and packs that no longer exist after a roster change.
    s.table = s.table.filter((c) => CARDS[c.id]);
    s.wall = s.wall.map((c) => (c && CARDS[c.id] ? c : null));
    s.shop = s.shop.map((o) => (o && CARDS[o.id] ? o : null));
    s.packs = s.packs.filter((p) => PACKS[p.pack]).map((p) => ({ ...p, cards: p.cards.filter((id) => CARDS[id]) })).filter((p) => p.cards.length);
    for (const t of TRACKS) s.fed[t.id] ??= 0;
    // older saves: bind to the track whose look the land already wears
    if (!s.bound) s.bound = TRACKS.find((t) => t.id === s.theme && s.fed[t.id] >= 5)?.id || TRACKS.find((t) => s.fed[t.id] >= 5)?.id || null;
    s.trinkets = Array.from({ length: RACK_SLOTS }, (_, i) => (s.trinkets?.[i] && TRINKETS[s.trinkets[i].id] ? s.trinkets[i] : null));
    return s;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
}

let S = load() || R.newRun();
let mode = 'shop';
const views = new Map(); // inst uid -> CardView
const trinketViews = new Map(); // trinket uid -> CardView (rack)
let enemyTrinkets = []; // CardViews for the ghost's trinkets during a fight
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
const shrineCanvas = () => D.drawTile('shrine', { steps: TRACK_STEPS, tracks: TRACKS.map((t) => ({ ...t, fed: S.fed[t.id], sealed: !!S.bound && S.bound !== t.id, bound: S.bound === t.id })) });
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
  const v = new CardView(scene, { id: inst.id, inst, perm: inst.perm, meals: inst.meals || 0, stars: inst.stars || 0 });
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

// Trinket cards on the rack, keyed by trinket uid so moves keep their card.
function syncTrinkets() {
  const alive = new Set();
  S.trinkets.forEach((t, i) => {
    if (!t) return;
    alive.add(t.uid);
    let v = trinketViews.get(t.uid);
    if (!v) {
      v = new CardView(scene, { id: t.id });
      v.place(rackX(i), L.rack.z);
      trinketViews.set(t.uid, v);
    }
    v.trinket = t;
    v.rackSlot = i;
    if (mode !== 'battle' && mode !== 'intro' && mode !== 'outro' && !v.dragging && !v.busy && !v.flight) v.moveTo(rackX(i), L.rack.z);
  });
  for (const [uid, v] of trinketViews) {
    if (!alive.has(uid) && !v.busy) { fx.puffs(v.pos, { n: 6, s: 0.35 }); v.dispose(scene); trinketViews.delete(uid); }
  }
}

function syncViews() {
  syncTrinkets();
  const alive = new Set();
  for (const inst of [...S.table, ...S.wall.filter(Boolean)]) {
    alive.add(inst.uid);
    if (inst.x == null && !S.wall.includes(inst)) Object.assign(inst, findSpot(0, 0));
    const h = homeOf(inst);
    let v = views.get(inst.uid);
    if (!v) v = makeView(inst, h.x, h.z);
    v.inst = inst;
    if (v.perm !== inst.perm || v.id !== inst.id || v.meals !== (inst.meals || 0)) v.setFace(inst.id, inst.perm, inst.meals || 0);
    if ((v.stack || 1) !== (inst.stack || 1)) v.setStack(inst.stack || 1);
    if ((v.stars || 0) !== (inst.stars || 0)) v.setStars(inst.stars || 0);
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

// Wall cards show their real numbers with neighbour and pack bonuses applied.
function refreshLive() {
  const snap = R.snapshot(S, 'You');
  const probe = createBattle({ left: snap, right: { name: 'probe', hp: 1, slots: 1, wall: [null] }, seed: 1 });
  const onWall = new Set();
  probe.sides[0].units.forEach((u, i) => {
    const inst = S.wall[i];
    const v = inst && views.get(inst.uid);
    if (!v || !u) return;
    onWall.add(v);
    if (!v.busy) v.setLive(probe.liveStats(u));
  });
  for (const v of views.values()) if (!onWall.has(v) && !v.busy && v.live) v.setLive(null);
}

function refresh() {
  world.setTheme(S.theme || 'meadow');
  refreshSlots();
  refreshPlaque();
  refreshShopTiles();
  syncViews();
  refreshLive();
  ui.hud(S, codex);
  save();
}

// ------------------------------------------------------------------ picking

const stage = $('stage');
function pickAt(cx, cy) {
  const ray = world.pointerRay(cx, cy);
  const objs = [];
  for (const v of [...views.values(), ...trinketViews.values(), ...enemyTrinkets, ...packViews.values(), ...marketViews.filter(Boolean), ...bv[1].filter(Boolean), ...bv[0].filter((x) => x && x.summoned)]) {
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
  if (mode !== 'shop' || v.busy || v.flight || v.enemyTrinket) return false;
  return true;
}

// ------------------------------------------------------------------ drop logic

const stackOf = (v) => v.inst?.stack || 1;
function rackSlotAt(x, z) {
  for (let i = 0; i < RACK_SLOTS; i++) if (inRect(x, z, rackX(i), L.rack.z, L.rack.step, CARD.h + 0.5)) return i;
  return -1;
}

function evalDrop(v, x, z) {
  const def = v.def;
  if (v.trinket) {
    const slot = rackSlotAt(x, z);
    if (slot >= 0) return { kind: 'tmove', slot };
    if (inRect(x, z, L.sellX, L.shopZ, L.tile.w + 0.3, L.tile.h + 0.3)) return { kind: 'tsell' };
    return { kind: 'tback' };
  }
  if (!v.pack) {
    const slot = rackSlotAt(x, z);
    if (slot >= 0 && v.market == null) {
      if (def.kind !== 'ingredient') return { kind: 'bad', why: 'Only bundles of one resource can be forged into trinkets' };
      if (stackOf(v) < 2) return { kind: 'bad', why: 'Stack 2 or more of the same resource first' };
      return { kind: 'forge', slot, size: stackOf(v), res: v.id, replaces: S.trinkets[slot] };
    }
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
    if (best && v.market == null && def.kind === 'unit' && best.w.id === v.id && best.w.inst) {
      const si = R.starInfo(S, v.inst.uid, best.w.inst.uid);
      if (si?.ok) return { kind: 'star', target: best.w, stars: si.stars, cost: si.cost };
      if (si) return { kind: 'bad', why: si.reason };
    }
    if (best && v.market == null && def.kind === 'ingredient' && best.w.id === v.id) {
      const bi = R.bundleInfo(S, v.inst.uid, best.w.inst.uid);
      if (bi?.ok) return { kind: 'bundle', target: best.w, n: bi.n };
      return { kind: 'bad', why: bi?.reason || 'Nothing happens' };
    }
    if (best && stackOf(v) > 1) best = { ...best, bundle: true };
    if (best && !best.bundle && (best.w.inst?.stack || 1) === 1) {
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
  if (d.kind === 'star') {
    const broke = S.gold < d.cost;
    return [`Star up → <span class="rare">${'★'.repeat(d.stars)}</span> · ${ui.ico('coin')} ${d.cost}${broke ? ' (not enough gold)' : ''}`, broke];
  }
  if (d.kind === 'bundle') return [`Bundle ×${d.n}${d.n >= 2 ? ' · drop on the trinket rack to forge' : ''}`, false];
  if (d.kind === 'forge') {
    const cost = R.forgeCost(S, d.size);
    const broke = S.gold < cost;
    const rep = d.replaces ? ` · replaces <b>${ui.esc(TRINKETS[d.replaces.id].name)}</b>` : '';
    return [`Forge a ${TRINKET_METAL[d.size].name.toLowerCase()} trinket · ${ui.ico('coin')} ${cost}${broke ? ' (not enough gold)' : ''}${rep}`, broke];
  }
  if (d.kind === 'tmove') return [S.trinkets[d.slot] && S.trinkets[d.slot] !== v.trinket ? 'Swap trinkets' : 'Move trinket', false];
  if (d.kind === 'tsell') return [`Sell for ${ui.ico('coin')} ${trinketSellValue(v.trinket)}`, false];
  if (d.kind === 'tback') return [null, false];
  if (d.kind === 'card') {
    const key = `${d.info.a}+${d.info.b}`;
    const known = codex.has(key);
    const rareKnown = codex.has(`${key}!`);
    let s = known ? `→ <b>${ui.esc(CARDS[d.info.result].name)}</b>` : '✦ A new combination!';
    if (d.info.rare) s += ` <span class="rare">★ ${d.info.chance}% ${rareKnown ? ui.esc(CARDS[d.info.rare].name) : 'rare'}</span>`;
    const broke = S.gold < d.info.cost;
    s += ` · ${ui.ico('coin')} ${d.info.cost}${broke ? ' (not enough gold)' : ''}`;
    return [s, broke];
  }
  if (d.kind === 'eat') {
    const e = R.eatInfo(d.target.id, d.target.inst?.meals || 0);
    const per = d.target.def.eats.per || 1;
    const meals = d.target.inst?.meals || 0;
    const stat = { burn: 'burn', poison: 'poison', heal: 'heal', dmg: 'damage' }[d.target.def.main] || '';
    const grow = (meals + 1) % per === 0 ? `Feed: +1 ${stat}` : `Feed: +1 ${stat} next meal`;
    return [e.next ? `${grow} · ${e.left - 1 <= 0 ? `evolves into <b>${ui.esc(CARDS[e.into].name)}</b>!` : `${e.left - 1} more to evolve`}` : grow, false];
  }
  if (d.kind === 'sell') return [`Sell for ${ui.ico('coin')} ${v.inst ? R.sellPrice(S, v.inst) : 0}${R.bonusSalesLeft(S) < RULES.sellBonusPerDay ? ` · bonus sales left ${R.bonusSalesLeft(S)}` : ''}`, false];
  if (d.kind === 'feed') {
    const t = R.feedTrack(v.id);
    if (!t) return ['The shrine wants Ember, Bone, Berry, Coin, Stone or Ice', true];
    if (S.bound && S.bound !== t.id) return [`Sealed: the shrine is bound to ${TRACKS.find((x) => x.id === S.bound).name}`, true];
    const n = S.fed[t.id] + (v.inst?.stack || 1);
    const [s1, s2] = TRACK_STEPS;
    const commit = !S.bound && S.fed[t.id] < s1 && n >= s1 ? ' · <b>binds the shrine</b>: other tracks seal' : '';
    const gift = S.fed[t.id] < s2 && n >= s2 ? ` · <b>completes it</b>: free ${ui.esc(CARDS[PACKS[t.packs[1]].rare].name)}!` : '';
    return [`Feed the ${t.name} track (${Math.min(n, s2)}/${n >= s1 ? s2 : s1})${commit}${gift}`, false];
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
stage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const card = pickAt(e.clientX, e.clientY)?.card;
  if (!card || card.pack || !CARDS[card.id]) { ui.combos(null); return; }
  const owned = new Set([...views.values()].map((v) => v.id));
  ui.info(null);
  ui.combos(card.id, { codex, owned, artURL, x: e.clientX, y: e.clientY });
});
// Any other click or Escape closes the combine popover.
const closeCombos = () => { ui.combos(null); ui.preview(null); };
window.addEventListener('pointerdown', (e) => { if (e.button !== 2 && !e.target.closest?.('#combos')) closeCombos(); }, true);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCombos(); });
// Hovering a row in the popover previews the card it makes.
$('combos').addEventListener('mouseover', (e) => {
  const row = e.target.closest('.cb-row');
  if (!row) return;
  const id = row.dataset.result;
  const rare = row.dataset.rare;
  const note = rare ? `<span class="rare">★</span> ${row.dataset.chance}% chance of a rare instead` : '';
  const box = $('combos').getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  const side = box.right + 300 > window.innerWidth ? 'left' : 'right';
  ui.preview({ key: `c:${id}`, id, img: cardImageURL(id), label: row.dataset.known === '1' ? 'Combines into' : 'Combines into <span class="muted">(undiscovered)</span>', note }, side === 'left' ? box.left : box.right - 14, rr.top + rr.height / 2, { side });
});
$('combos').addEventListener('mouseleave', () => ui.preview(null));

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

// What a resource card can become on the trinket rack.
function bundleNote(card) {
  if (card.def?.kind !== 'ingredient') return '';
  const n = card.inst?.stack || 1;
  if (n < 2) return `<p class="muted">Stack ${ui.esc(card.def.name)} on ${ui.esc(card.def.name)} to make a bundle (up to ×5), then forge it into a trinket on the rack.</p>`;
  const names = TK_BY[card.id][n].map((id) => `<b>${ui.esc(TRINKETS[id].name)}</b>`).join(', ');
  return `<p><b>Bundle ×${n}.</b> Drop it on the trinket rack to forge one of ${names} (${ui.ico('coin')} ${R.forgeCost(S, n)}).</p>`;
}

// Shrine hover: what each bowl has been fed and what it opens.
function shrineInfo() {
  const rows = TRACKS.map((t) => {
    const n = S.fed[t.id] || 0;
    const [a, b] = t.packs.map((id) => PACKS[id]);
    const step = (pack, need) => (n >= need ? `<span class="ok">✓ ${ui.esc(pack.name)}</span>` : `<span class="muted">${ui.esc(pack.name)} at ${need}</span>`);
    if (S.bound && S.bound !== t.id) return `<div class="shr-row none">${ui.ico(t.feed)}<span class="shr-name"><b>${t.name}</b> · sealed</span></div>`;
    return `<div class="shr-row${n ? '' : ' none'}">${ui.ico(t.feed)}<span class="shr-name"><b>${t.name}</b> · ${n} ${ui.esc(CARDS[t.feed].name)} fed</span><span class="shr-steps">${step(a, TRACK_STEPS[0])} ${step(b, TRACK_STEPS[1])} ${n >= TRACK_STEPS[1] ? '' : `<span class="muted">· ${ui.esc(CARDS[b.rare].name)} free at ${TRACK_STEPS[1]}</span>`}</span></div>`;
  }).join('');
  const bound = TRACKS.find((t) => t.id === S.bound);
  const note = bound
    ? `<p class="muted small">Bound to <b>${bound.name}</b> for this run: the other tracks are sealed, and the land wears the ${bound.name} look.</p>`
    : '<p class="muted small"><b>Choose carefully:</b> the first track you open binds the shrine for the rest of the run and seals the others. The land changes to match.</p>';
  return `<h3>Shrine</h3><p>Drop ingredients (or whole bundles) here. ${TRACK_STEPS[0]} opens a track's first pack. ${TRACK_STEPS[1]} opens its second and hands you the track's rare.</p><div class="shr-list">${rows}</div>${note}`;
}

function updateHover(cx, cy) {
  const hit = pickAt(cx, cy);
  const card = hit?.card || null;
  const tile = hit?.tile || null;
  hover = card || tile;
  stage.className = card || tile ? 'point' : '';
  if (card) {
    if (card.trinket || card.enemyTrinket) ui.info(ui.trinketInfo(card.id, { sell: card.trinket && mode === 'shop' ? trinketSellValue(card.trinket) : null }));
    else if (card.enemy || card.summoned) ui.info(ui.cardInfo(card.id, { inst: { perm: card.perm, stars: card.stars || 0 }, codex }));
    else if (card.pack) ui.info(ui.packInfo(card.pack, { price: false }));
    else if (card.market != null) ui.info(ui.cardInfo(card.id, { price: S.shop[card.market]?.price, codex }));
    else ui.info(ui.cardInfo(card.id, { inst: card.inst, sell: card.inst && mode === 'shop' ? R.sellPrice(S, card.inst) : null, codex, extra: bundleNote(card) }));
  } else if (tile) {
    if (tile.kind === 'pack') ui.info(ui.packInfo(tile.pack));
    else if (tile.kind === 'sell') ui.info('<h3>Sell</h3><p>Drop a card here for gold: 1 per tier (ingredients sell for 1).</p>');
    else if (tile.kind === 'shrine') ui.info(shrineInfo());
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
  if (d.kind === 'star') { d.target.glowGoal = 1; d.target.glowColor.set('#ffe27a'); }
  slotGlow.forEach((m, i) => { m.userData.goal = (d.kind === 'slot' && d.slot === i) ? 0.55 : (d.kind === 'bad' && d.slot === i) ? 0.25 : 0; m.material.color.set(d.kind === 'bad' ? '#e7a69c' : '#fff7c4'); });
  sellTile.hover = d.kind === 'sell' ? 1 : 0;
  shrineTile.hover = d.kind === 'feed' ? 1 : 0;
  const [html, bad] = dropHint(d, card);
  if (html !== lastHint) lastHint = html;
  ui.hint(html, e.clientX, e.clientY - 30, bad);
  ui.preview(dropPreview(d), e.clientX, e.clientY, { avoid: $('hint') });
}

// The card a drop would produce: a combine's result, or the eater after its meal.
function dropPreview(d) {
  if (d.kind === 'star') {
    const inst = d.target.inst;
    const mult = starMult(CARDS[inst.id], d.stars);
    return { key: `s:${inst.id}:${d.stars}`, id: inst.id, img: cardImageURL(inst.id, { perm: inst.perm, meals: inst.meals || 0, stars: d.stars }), label: `Becomes ${'★'.repeat(d.stars)}`, note: `All its numbers ×${mult}, and ${Math.round(d.stars * RULES.starHaste * 100)}% faster.` };
  }
  if (d.kind === 'forge') {
    const ids = TK_BY[d.res][d.size];
    return { key: `f:${d.res}:${d.size}`, label: 'Forges one of', cards: ids.map((id) => ({ id, img: cardImageURL(id), name: TRINKETS[id].name, text: TRINKETS[id].text })) };
  }
  if (d.kind === 'card') {
    const r = d.info;
    const rareKnown = codex.has(`${r.a}+${r.b}!`);
    const note = r.rare ? `<span class="rare">★</span> ${r.chance}% chance of ${rareKnown ? `<b>${ui.esc(CARDS[r.rare].name)}</b>` : 'a rare'} instead` : '';
    return { key: `c:${r.result}`, id: r.result, img: cardImageURL(r.result), label: 'Combines into', note };
  }
  if (d.kind === 'eat') {
    const inst = d.target.inst || { perm: 0, meals: 0 };
    const meals = (inst.meals || 0) + 1;
    const per = d.target.def.eats.per || 1;
    const e = R.eatInfo(d.target.id, inst.meals || 0);
    if (e.into && meals >= e.next) return { key: `e:${e.into}`, id: e.into, img: cardImageURL(e.into), label: 'Evolves into' };
    const perm = (inst.perm || 0) + (meals % per === 0 ? 1 : 0);
    return { key: `m:${d.target.id}:${perm}:${meals}`, id: d.target.id, img: cardImageURL(d.target.id, { perm, meals }), label: 'After this meal' };
  }
  return null;
}

function clearDragFx() {
  for (const w of views.values()) w.glowGoal = 0;
  slotGlow.forEach((m) => { m.userData.goal = 0; });
  sellTile.hover = 0;
  shrineTile.hover = 0;
  ui.hint(null);
  ui.preview(null);
}

function endDrag() {
  const { card, from } = drag;
  const d = drag.drop || evalDrop(card, card.target.x, card.target.z);
  card.dragging = false;
  drag = null;
  clearDragFx();
  stage.className = '';
  sfx.drop();

  if (card.trinket) {
    if (d.kind === 'tmove') { R.moveTrinket(S, card.rackSlot, d.slot); card.kick(0.08); sfx.drop(); }
    else if (d.kind === 'tsell') {
      const slot = card.rackSlot;
      const res = R.sellTrinket(S, slot);
      if (res.ok) { sfx.coin(); fx.number(card.pos.clone().setY(0.5), `+${res.price}`, 'gold'); }
    } else card.moveTo(rackX(card.rackSlot), L.rack.z);
    refresh();
    return;
  }

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
  if (d.kind === 'star') {
    const target = d.target;
    const res = R.starUp(S, inst.uid, target.inst.uid);
    if (!res.ok) { ui.toast(res.reason, 'bad', 'coin'); bounceBack(card); refresh(); return; }
    views.delete(inst.uid);
    card.busy = true;
    leaving.add(card);
    card.flyTo(target.pos.x, target.pos.z, { dur: 0.25, arc: 1.2, done: () => {
      leaving.delete(card);
      card.dispose(scene);
      fx.sparkles(target.pos.clone().setY(0.4), { n: 14 + res.stars * 10, color: CARDS[target.id].rare ? '#ffe27a' : '#f2c64a', spread: 0.8 + res.stars * 0.3 });
      sfx.rare();
    } });
    ui.toast(`${ui.esc(CARDS[target.id].name)} <span class="rare">${'★'.repeat(res.stars)}</span>`, 'good', 'bless');
    sfx.coin();
    refresh();
    return;
  }
  if (d.kind === 'bundle') {
    const target = d.target;
    const res = R.bundle(S, inst.uid, target.inst.uid);
    if (!res.ok) { ui.toast(res.reason, 'bad'); bounceBack(card); refresh(); return; }
    views.delete(inst.uid);
    card.busy = true;
    leaving.add(card);
    card.flyTo(target.pos.x, target.pos.z, { dur: 0.22, arc: 0.6, done: () => { leaving.delete(card); card.dispose(scene); target.kick(0.12); } });
    sfx.drop();
    refresh();
    return;
  }
  if (d.kind === 'forge') {
    const res = R.forge(S, inst.uid, d.slot);
    if (!res.ok) { ui.toast(res.reason, 'bad', 'coin'); bounceBack(card); refresh(); return; }
    views.delete(inst.uid);
    card.busy = true;
    leaving.add(card);
    card.scaleGoal = 0.3;
    const sx = rackX(d.slot);
    card.flyTo(sx, L.rack.z, {
      dur: 0.35, arc: 1.4, done: () => {
        leaving.delete(card);
        card.dispose(scene);
        fx.sparkles(new THREE.Vector3(sx, 0.4, L.rack.z), { n: 22, color: '#ffe9a8', spread: 1.2 });
        const v = trinketViews.get(res.trinket.uid);
        if (v) { v.flip = Math.PI; v.flipGoal = 0; v.kick(0.2); }
        sfx.rare();
        const t = TRINKETS[res.trinket.id];
        ui.toast(`Forged <b>${ui.esc(t.name)}</b>`, 'good', 'bless');
      },
    });
    sfx.coin();
    refresh();
    // the new trinket waits face-down until the bundle lands on it
    const nv = trinketViews.get(res.trinket.uid);
    if (nv) { nv.flip = Math.PI; nv.flipGoal = Math.PI; }
    return;
  }
  if (d.kind === 'card') {
    if (S.gold < d.info.cost) { ui.toast(`Combining this costs ${d.info.cost} gold`, 'bad', 'coin'); bounceBack(card); refresh(); return; }
    return startCombine(card, d.target);
  }
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
    if (res.gift) {
      later(0.5, () => {
        ui.toast(`The shrine grants you <b>${ui.esc(CARDS[res.gift.id].name)}</b>!`, 'good', 'bless');
        const v = views.get(res.gift.uid);
        if (v) { v.place(L.shrine.x, L.shrine.z); v.kick(0.3); fx.sparkles(v.pos.clone().setY(0.4), { n: 24, color: '#ffe9a8' }); }
      });
    }
    if (res.unlocked) {
      ui.toast(`${PACKS[res.unlocked].name} unlocked!${res.unlocked === res.track.packs[0] ? ' The land changes…' : ''}`, 'good', 'bless');
      sfx.rare();
      // sweep the new land in (refresh's own setTheme then finds it already set)
      world.setTheme(S.theme, { animate: true });
      later(0.3, () => sfx.whoosh());
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
  const info = R.combineInfo(S, a.id, b.id);
  S.gold -= info.cost;
  ui.hud(S, codex);
  sfx.coin();
  a.busy = true;
  b.busy = true;
  a.raise();
  a.moveTo(b.pos.x, b.pos.z + 0.34);
  combos.push({ a, b, t: 0, paid: info.cost });
}

function updateCombos(dt) {
  for (let i = combos.length - 1; i >= 0; i--) {
    const c = combos[i];
    c.t += dt;
    c.b.setBar(c.t / RULES.combineTime);
    if (c.t < RULES.combineTime) continue;
    combos.splice(i, 1);
    c.b.setBar(null);
    const res = R.combine(S, c.a.inst.uid, c.b.inst.uid, { prepaid: true });
    c.a.busy = false;
    c.b.busy = false;
    if (!res.ok) S.gold += c.paid;
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
let fightToken = 0;
let speed = 1;
let acc = 0;
let result = null;
let lastBreakdown = null;
// Shield now shows on the health bar, so the old tower domes are off.
const noFx = { hit() {}, set() {}, update() {}, reset() {} };
const fortFx = { 0: noFx, 1: noFx };

const fortHud = { 0: createFortressHud(scene, { x: 0, z: A.playerTowerZ }), 1: createFortressHud(scene, { x: 0, z: A.enemyTowerZ, top: true }) };
fortHud[0].hide();
fortHud[1].hide();
// Hits fly at the health bar, Bazaar style.
const towerPos = (side) => fortHud[side].target();
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
  const token = fightToken;
  ghost = await fetchGhost({ day: S.day, wins: S.wins, losses: S.losses, runSeed: S.seed, seed: (S.seed ^ (S.day * 2654435761)) >>> 0 });
  if (token !== fightToken) return; // a new game started while the ghost loaded
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
    const v = new CardView(scene, { id: c.id, perm: c.perm || 0, stars: c.stars || 0 });
    v.place(arenaX(i), A.enemyZ - 3);
    v.flyTo(arenaX(i), A.enemyZ, { dur: 0.7, arc: 5, delay: 0.7 + i * 0.12, done: () => { fx.puffs(v.pos, { n: 6, s: 0.35 }); sfx.drop(); } });
    v.busy = true;
    v.enemy = true;
    bv[1][i] = v;
  }
  // Trinkets sit beside each wall in the arena.
  const tkPos = (i, z) => ({ x: 5.35 + (i % 3) * 1.05, z: z + (i < 3 ? -0.62 : 0.62) });
  let ti = 0;
  for (const v of trinketViews.values()) {
    const p = tkPos(ti++, A.playerZ);
    v.busy = true;
    v.scaleGoalBase = 0.72;
    v.flyTo(p.x, p.z, { dur: 0.9, arc: 3.5, delay: 0.2 + ti * 0.05 });
  }
  enemyTrinkets = (ghost.trinkets || []).filter((id) => TRINKETS[id]).map((id, i) => {
    const v = new CardView(scene, { id });
    const p = tkPos(i, A.enemyZ);
    v.place(p.x, p.z - 3);
    v.flyTo(p.x, p.z, { dur: 0.7, arc: 4, delay: 0.9 + i * 0.1 });
    v.enemyTrinket = true;
    v.busy = true;
    v.scaleGoalBase = 0.72;
    return v;
  });
  fortFx[0].reset();
  fortFx[1].reset();
  fortHud[0].reset(snap.hp);
  fortHud[1].reset(ghost.hp);
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
      // Damage lands in the fortress's counters beside the tower, never on the castle itself.
      const impact = () => {
        const kind = e.kind === 'burn' || e.kind === 'poison' || e.kind === 'sudden' ? e.kind : 'hit';
        fortHud[e.side].add(kind, e.amount);
        if (e.absorbed > 0) { fortHud[e.side].add('blocked', e.absorbed); fortFx[e.side].hit(); }
        if (e.amount > 0 && kind === 'hit') fx.puffs(towerPos(e.side).setY(1.1), { n: e.amount >= 10 ? 6 : 2, s: 0.28, spread: 0.8 });
        if (kind === 'burn' || kind === 'poison') sfx.tick();
        else if (e.amount + e.absorbed >= 15) { sfx.bigHit(); view.shake = Math.min(0.4, view.shake + 0.2); }
        else sfx.hit();
        if (e.crit) fx.label(towerPos(e.side).add(new THREE.Vector3(-2.6, 0.6, -1.2)), 'crit!', '#f2c64a', 0.8);
      };
      if (e.src) {
        sfx.shoot();
        fx.projectile(unitPos(e.src), towerPos(e.side), e.pierce ? 'charge' : 'dmg', { size: e.crit ? 1.5 : 1, dur: 0.5, onHit: impact });
      } else impact();
      break;
    }
    case 'tick': {
      ui.flashStatus(e.side, e.kind);
      fortHud[e.side].tick(e.kind, e.amount);
      break;
    }
    case 'heal':
      fx.projectile(unitPos(e.src), towerPos(e.side), 'heal', { arc: 1.4, dur: 0.45, size: 0.8, onHit: () => { fortHud[e.side].add('heal', e.amount); sfx.heal(); } });
      break;
    case 'shield':
      if (!e.src) { fortHud[e.side].add('shield', e.amount); break; }
      fx.projectile(unitPos(e.src), towerPos(e.side), 'shield', { arc: 1.4, dur: 0.45, size: 0.8, onHit: () => { fortHud[e.side].add('shield', e.amount); fortFx[e.side].hit(); sfx.shield(); } });
      break;
    case 'delay': {
      const tv = e.target && bv[e.target.side][e.target.slot];
      if (e.target) fx.projectile(e.src ? unitPos(e.src) : lastTk[1 - e.target.side] || towerPos(1 - e.target.side), unitPos(e.target), 'sand', { arc: 1, dur: 0.3, size: 0.6, onHit: () => { if (tv) { tv.kick(-0.1); fx.label(tv.pos.clone().setY(0.4), 'slowed', '#e8c98f', 0.55); } } });
      break;
    }
    case 'status': {
      if (e.src && e.src.side !== e.side) {
        fx.projectile(unitPos(e.src), towerPos(e.side), e.kind, { dur: 0.5, size: 0.9, onHit: () => ui.flashStatus(e.side, e.kind) });
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
      fx.projectile(e.src ? unitPos(e.src) : lastTk[1 - e.target.side] || towerPos(1 - e.target.side), unitPos(e.target), 'freeze', { arc: 1.6, dur: 0.3, onHit: () => { if (tv) { fx.sparkles(tv.pos, { n: 6, color: '#bfe9ff' }); tv.kick(-0.08); } sfx.freeze(); } });
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
    case 'trinket': {
      const v = e.side === 0 ? [...trinketViews.values()].find((w) => w.id === e.id) : enemyTrinkets.find((w) => w.id === e.id);
      if (!v) break;
      v.kick(0.18);
      v.hop(1.8);
      v.glowGoal = 0;
      fx.sparkles(v.pos.clone().setY(0.3), { n: 5, color: '#ffe9a8', spread: 0.5 });
      lastTk[e.side] = v.pos.clone().setY(0.35);
      break;
    }
    case 'confused': {
      const v = bv[e.src.side][e.src.slot];
      if (v) { fx.label(v.pos.clone().setY(0.5), 'confused!', '#d9b3ff', 0.8); v.kick(-0.1); }
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

let liveClock = 0;
function updateBattle(dt) {
  liveClock -= dt;
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
        // countdown units show their fuse instead of a cooldown
        const fuse = !t && u.def.once && !u.onceDone ? Math.min(1, (B.t - (u.onceStart || 0) + (u.onceAdv || 0)) / u.def.once[0]) : null;
        v.setBar(mode === 'battle' ? (t ? t.prog / t.cd : fuse) : null, u.frozen > 0 ? '#5aa9d6' : fuse != null ? '#d65c4a' : D.INK);
        v.frostGoal = u.frozen > 0 ? 0.55 : 0;
        if (mode !== 'intro') v.setTally(Math.floor(u.dealt));
        if (liveClock <= 0) v.setLive(B.liveStats(u));
      });
      fortFx[side].set(B.sides[side].shield);
      fortHud[side].set(B.sides[side]);
    }
    ui.battleUpdate(B);
    if (liveClock <= 0) liveClock = 0.2;
  }
}

function endBattle() {
  mode = 'outro';
  const won = B.winner === 0;
  const blank = { hit: 0, burn: 0, poison: 0, burnApplied: 0, poisonApplied: 0, freeze: 0, heal: 0, shield: 0, attacks: 0, crits: 0, misses: 0 };
  lastBreakdown = [0, 1].map((side) => {
    const Sd = B.sides[side];
    const units = [];
    for (const u of B.roster[side]) {
      const st = { ...blank, ...(u.st || {}) };
      const prev = u.summoned && units.find((x) => x.summoned && x.id === u.id);
      if (prev) {
        prev.n += 1;
        prev.dealt += Math.round(u.dealt);
        for (const k in blank) prev.st[k] += st[k];
      } else units.push({ id: u.id, summoned: !!u.summoned, n: 1, dealt: Math.round(u.dealt), st });
    }
    units.sort((a, b) => b.dealt - a.dealt);
    return {
      name: side ? ghost.name : 'You',
      units,
      taken: { ...Sd.taken },
      time: B.t,
      attacks: Sd.attacks,
      crits: Sd.crits,
      misses: Sd.misses,
      peak: { ...Sd.peak },
    };
  });
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
    ${ui.breakdown(lastBreakdown, { artURL })}
    <div class="lines">${lines}<div class="total"><span>Gold for tomorrow</span><span>${ui.ico('coin')} +${r.total}</span></div></div>
    <div class="actions"><button class="big-btn red" data-continue>${r.over ? 'See results' : 'Continue'}</button></div>`, true);
  el.querySelector('[data-continue]').addEventListener('click', () => closeBattle());
  const toggle = el.querySelector('[data-board]');
  toggle?.addEventListener('click', () => {
    const box = el.querySelector('.board-sum');
    box.hidden = !box.hidden;
    toggle.textContent = box.hidden ? 'See board summary' : 'Hide board summary';
    if (!box.hidden) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// After a fight: our trinkets fly home to the rack, the ghost's vanish.
function returnTrinkets(animate) {
  for (const v of enemyTrinkets) { if (animate) fx.puffs(v.pos, { n: 6, s: 0.35 }); v.dispose(scene); }
  enemyTrinkets = [];
  for (const v of trinketViews.values()) {
    v.busy = false;
    v.scaleGoalBase = 1;
    if (animate) v.flyTo(rackX(v.rackSlot), L.rack.z, { dur: 0.85, arc: 4, delay: 0.1 });
    else v.place(rackX(v.rackSlot), L.rack.z);
  }
}
const lastTk = [null, null];

function closeBattle() {
  ui.modal(null);
  ui.hideBanner();
  ui.battleEnd();
  fortHud[0].hide();
  fortHud[1].hide();
  for (const v of bv[0]) if (v) { v.setTally(null); v.setBar(null); }
  for (const v of bv[1]) if (v) { fx.puffs(v.pos, { n: 6, s: 0.35 }); v.dispose(scene); }
  for (const [i, v] of bv[0].entries()) {
    if (!v) continue;
    if (v.summoned) { fx.puffs(v.pos, { n: 6, s: 0.35 }); v.dispose(scene); continue; }
    v.frostGoal = 0;
    v.flyTo(wallX(i), L.wall.z, { dur: 0.85, arc: 4, delay: i * 0.06, done: (c) => { c.busy = false; } });
  }
  returnTrinkets(true);
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

// Stop a fight in progress (used when starting a new game mid-fight).
function abortBattle() {
  fightToken += 1;
  timers.length = 0;
  ui.hideBanner();
  ui.battleEnd();
  fortHud[0].hide();
  fortHud[1].hide();
  for (const v of bv[1]) if (v) v.dispose(scene);
  returnTrinkets(false);
  bv = [[], []];
  B = null;
  fx.clear();
  view.zoom = 1;
}

function newRun() {
  ui.modal(null);
  if (mode !== 'shop' && mode !== 'over') abortBattle();
  for (const v of views.values()) v.dispose(scene);
  for (const v of packViews.values()) v.dispose(scene);
  for (const v of trinketViews.values()) v.dispose(scene);
  trinketViews.clear();
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
  ui.banner('Day 1<small>click your free pack to open it</small>');
}

// ------------------------------------------------------------------ chrome buttons

ui.setSound(sfx.muted);
$('btn-sound').addEventListener('click', () => ui.setSound(sfx.toggle()));
function bindModal(el) {
  el?.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ui.modal(null)));
  el?.querySelector('[data-newgame]')?.addEventListener('click', () => bindModal(ui.confirmNewGame(S, { midFight: mode !== 'shop' && mode !== 'over' })));
  el?.querySelector('[data-confirm-new]')?.addEventListener('click', () => newRun());
  el?.querySelector('[data-help]')?.addEventListener('click', () => bindModal(ui.help()));
  el?.querySelector('[data-ideas]')?.addEventListener('click', () => bindModal(ui.ideas(codex)));
  el?.querySelector('[data-sound]')?.addEventListener('click', () => { ui.setSound(sfx.toggle()); openMenu(); });
}
// New game is only offered between fights, so a battle never gets cut off midway.
const openMenu = () => bindModal(ui.menu(S, { muted: sfx.muted, midFight: mode !== 'shop' && mode !== 'over' }));
$('btn-menu').addEventListener('click', openMenu);
$('btn-ideas').addEventListener('click', () => bindModal(ui.ideas(codex)));
$('btn-help').addEventListener('click', () => bindModal(ui.help()));
$('modal').addEventListener('pointerdown', (e) => {
  if (e.target.id === 'modal' && !e.target.querySelector('[data-continue],[data-new]')) ui.modal(null);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').querySelector('[data-continue],[data-new]')) {
    if ($('modal').hidden) openMenu();
    else ui.modal(null);
  }
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

  const all = [...views.values(), ...trinketViews.values(), ...enemyTrinkets, ...leaving, ...packViews.values(), ...marketViews.filter(Boolean), ...bv[1].filter(Boolean), ...bv[0].filter((v) => v && v.summoned)];
  for (const v of all) {
    const hovered = v === hover && !drag && !v.busy;
    v.liftGoal = v.restLift + (v.dragging ? 0.75 : hovered ? 0.1 : 0) + (v.busy && combos.some((c) => c.a === v) ? 0.06 : 0);
    v.scaleGoal = (v.scaleGoalBase || 1) * (v.dragging ? 1.07 : hovered ? 1.035 : 1);
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
  const simRate = B && mode === 'battle' ? speed : 0;
  fortHud[0].update(dt, simRate);
  fortHud[1].update(dt, simRate);
  fx.update(dt);
  world.updateTheme(dt);
  world.updateCamera(dt);
  world.render();

  if (save.pending && !drag) { save.pending = false; save(); }
  updateTutorial();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('loading').classList.add('gone');
setTimeout(() => $('loading').remove(), 500);

// ------------------------------------------------------------------ tutorial
// Five hands-on steps; each waits for the player to do the thing.
const TUT_KEY = 'stackbrawl.tutorial';
const tutDone = () => { try { return localStorage.getItem(TUT_KEY) === 'done'; } catch { return true; } };
const scr = (x, z) => world.toScreen(new THREE.Vector3(x, 0, z));
const viewOf = (pred) => [...views.values()].find((v) => !v.dead && v.def && pred(v));
const TUT = [
  { key: 'open', text: 'Click your <b>pack</b> to open it.', at: () => { const v = [...packViews.values()][0]; return v && scr(v.pos.x, v.pos.z); }, done: () => !S.packs.length || (S.table.some((c) => c.id === 'villager') && S.table.some((c) => c.id === 'wood')) },
  { key: 'combine', text: 'Drag the <b>Villager</b> onto the <b>Wood</b> to combine them.', at: () => { const v = viewOf((w) => w.id === 'villager'); return v && scr(v.pos.x, v.pos.z); }, done: () => S.discovered.length > 0 || owned().some((c) => CARDS[c.id].kind === 'unit' && CARDS[c.id].tier >= 2) },
  { key: 'wall', text: 'Drag your unit onto the <b>wall</b>. Only units on the wall fight.', at: () => scr(wallX(0), L.wall.z), done: () => S.wall.some(Boolean) },
  { key: 'shop', text: 'Each day you earn gold. Spend it on <b>packs</b> up here to grow your army.', at: () => { const t = packTiles[0]; return t && scr(t.group.position.x, t.group.position.z); }, next: true },
  { key: 'fight', text: "Ready? Press <b>Fight!</b> Your wall battles another player's.", at: () => { const r = $('btn-fight').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, done: () => mode !== 'shop' },
];
const owned = () => [...S.table, ...S.wall.filter(Boolean)];
let tut = null; // index into TUT while the tutorial runs
function endTutorial() {
  tut = null;
  ui.coach(null);
  try { localStorage.setItem(TUT_KEY, 'done'); } catch { /* ignore */ }
}
function updateTutorial() {
  if (tut == null) return;
  // jump past the furthest step the player has already done
  for (let i = TUT.length - 1; i >= tut; i--) if (TUT[i].done?.()) { tut = i + 1; break; }
  if (tut >= TUT.length) { endTutorial(); return; }
  const step = TUT[tut];
  const hide = drag || !$('modal').hidden || (mode !== 'shop' && step.key !== 'fight');
  if (hide) { ui.coach(null); return; }
  ui.coach({ ...step, n: tut + 1, of: TUT.length }, step.at());
}
$('coach').addEventListener('click', (e) => {
  if (e.target.closest('[data-co-skip]')) endTutorial();
  if (e.target.closest('[data-co-next]') && tut != null) { tut += 1; updateTutorial(); }
});

if (!S.history.length && S.day === 1 && !tutDone()) {
  const el = ui.intro();
  el.querySelector('[data-start-tut]').addEventListener('click', () => { ui.modal(null); tut = 0; });
  el.querySelector('[data-skip-tut]').addEventListener('click', () => { ui.modal(null); endTutorial(); });
} else if (!S.history.length && S.day === 1 && S.packs.length) ui.banner('Day 1<small>click your free pack to open it</small>');

// Debug handle for the console.
window.stackbrawl = { get state() { return S; }, get battle() { return B; }, views, world, R, refresh, fortHud };
