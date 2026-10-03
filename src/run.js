// Run state and rules: gold, shop, packs, combining, wall, day flow.
// Pure data in, data out (no DOM) so it can be saved and tested.
import {
  CARDS, PACKS, BASE_PACKS, TRACKS, TRACK_STEPS, TRACK_RARE_CHANCE, RULES, INGREDIENTS,
  BASE_UNITS, recipeFor, sellValue, fortressHp, wallSlots, eats, combineCost, starCost, starMult, attuneFor,
} from './content.js';
import { createRng, randomSeed } from './rng.js';
import { TRINKETS, TK_BY, RACK_SLOTS, MAX_STACK, FORGE_COST, aggregate, trinketSellValue } from './trinkets.js';

// Bump when rules change enough that old saves would be unplayable.
export const SAVE_VERSION = 2;

export function newRun(seed = randomSeed()) {
  const s = {
    v: SAVE_VERSION,
    seed,
    rng: seed,
    day: 1,
    gold: RULES.startGold,
    wins: 0,
    losses: 0,
    uid: 1,
    table: [],
    wall: Array(6).fill(null),
    trinkets: Array(RACK_SLOTS).fill(null),
    packs: [],
    shop: [],
    fed: Object.fromEntries(TRACKS.map((t) => [t.id, 0])),
    oracleUsed: false,
    bonusSales: 0,
    discovered: [],
    history: [],
  };
  rollShop(s);
  // Day 1 starts with a free Village Pack on the table.
  s.gold += PACKS.village.price;
  buyPack(s, 'village');
  // The free pack always teaches a first combine: Villager + Wood = Archer.
  s.packs[0].cards = ['villager', 'wood', 'berry'];
  return s;
}

function rng(s) {
  const r = createRng(s.rng);
  return {
    ...r,
    done() { s.rng = r.state; },
  };
}

const unlockedIngredient = (s, id) => {
  const ing = INGREDIENTS.find((i) => i.id === id);
  return !ing || ing.day <= s.day;
};

export const owned = (s) => [...s.table, ...s.wall.filter(Boolean)];
const ownedCount = (s, key) => owned(s).reduce((a, c) => a + (CARDS[c.id][key] ? 1 : 0), 0);
const ownedSum = (s, key) => owned(s).reduce((a, c) => a + (CARDS[c.id][key] || 0), 0);

export function tableFull(s) {
  return s.table.length >= RULES.tableLimit;
}

export function slotsToday(s) {
  return wallSlots(s.day);
}

export function makeInst(s, id, extra = {}) {
  return { uid: s.uid++, id, perm: 0, owned: 0, ...extra };
}

export function find(s, uid) {
  let i = s.table.findIndex((c) => c.uid === uid);
  if (i >= 0) return { where: 'table', index: i, inst: s.table[i] };
  i = s.wall.findIndex((c) => c && c.uid === uid);
  if (i >= 0) return { where: 'wall', index: i, inst: s.wall[i] };
  return null;
}

function remove(s, uid) {
  const f = find(s, uid);
  if (!f) return null;
  if (f.where === 'table') s.table.splice(f.index, 1);
  else s.wall[f.index] = null;
  return f;
}

// ---------------------------------------------------------------- shop

export function availablePacks(s) {
  const list = [...BASE_PACKS];
  for (const t of TRACKS) {
    if (s.bound && s.bound !== t.id) continue;
    if (s.fed[t.id] >= TRACK_STEPS[0]) list.push(t.packs[0]);
    if (s.fed[t.id] >= TRACK_STEPS[1]) list.push(t.packs[1]);
  }
  return list;
}

export function rollShop(s) {
  const r = rng(s);
  const pool = [];
  for (const id of BASE_UNITS) pool.push([id, 2]);
  for (const ing of INGREDIENTS) if (ing.day <= s.day) pool.push([ing.id, 1]);
  // Once the shrine is bound, the shop leans toward that land: its resource
  // turns up often, and so do the units from its open packs.
  const track = s.bound && TRACKS.find((t) => t.id === s.bound);
  // Before binding, it leans toward whatever you've been feeding the most.
  if (!track) {
    const lead = TRACKS.reduce((a, t) => (s.fed[t.id] > (a ? s.fed[a.id] : 0) ? t : a), null);
    if (lead && unlockedIngredient(s, lead.feed)) pool.push([lead.feed, 3]);
  }
  if (track) {
    pool.push([track.feed, 5]);
    for (const packId of availablePacks(s).filter((id) => track.packs.includes(id))) {
      for (const [id] of PACKS[packId].pool) if (CARDS[id].kind === 'unit' && !pool.some(([x]) => x === id)) pool.push([id, 3]);
    }
  }
  const n = RULES.shopSlots + ownedSum(s, 'shopSlot');
  s.shop = Array.from({ length: n }, () => {
    const id = r.weighted(pool);
    return { id, price: CARDS[id].kind === 'unit' ? RULES.singlePrice : RULES.ingredientPrice };
  });
  r.done();
}

export function reroll(s) {
  if (s.gold < RULES.rerollPrice) return { ok: false, reason: 'Not enough gold' };
  s.gold -= RULES.rerollPrice;
  rollShop(s);
  return { ok: true };
}

export function buySingle(s, index) {
  const offer = s.shop[index];
  if (!offer) return { ok: false, reason: 'Sold out' };
  if (s.gold < offer.price) return { ok: false, reason: 'Not enough gold' };
  if (tableFull(s)) return { ok: false, reason: 'Table is full (10 cards)' };
  s.gold -= offer.price;
  s.shop[index] = null;
  const inst = makeInst(s, offer.id);
  s.table.push(inst);
  return { ok: true, inst };
}

export function buyPack(s, packId) {
  const pack = PACKS[packId];
  if (!availablePacks(s).includes(packId)) return { ok: false, reason: 'Locked' };
  if (s.gold < pack.price) return { ok: false, reason: 'Not enough gold' };
  s.gold -= pack.price;
  const r = rng(s);
  const pool = pack.pool.filter(([id]) => unlockedIngredient(s, id));
  const cards = Array.from({ length: pack.size }, () => r.weighted(pool));
  if (pack.rare && r.chance(TRACK_RARE_CHANCE)) cards[r.int(cards.length)] = pack.rare;
  r.done();
  const p = { uid: s.uid++, pack: packId, cards };
  s.packs.push(p);
  return { ok: true, pack: p };
}

export function openOne(s, packUid) {
  const p = s.packs.find((x) => x.uid === packUid);
  if (!p) return { ok: false, reason: 'Gone' };
  if (tableFull(s)) return { ok: false, reason: 'Table is full (10 cards)' };
  const id = p.cards.shift();
  const inst = makeInst(s, id);
  s.table.push(inst);
  if (!p.cards.length) s.packs = s.packs.filter((x) => x !== p);
  return { ok: true, inst, empty: !p.cards.length };
}

// Modifiers from the trinkets on the rack.
export const trinketMods = (s) => aggregate((s.trinkets || []).filter(Boolean).map((t) => t.id));
export const stackOf = (inst) => inst.stack || 1;
// Attunement: a bound shrine boosts the numbers of its track's units.
export const attuneOf = (s, id) => attuneFor(s.bound, s.fed, id);

// Traders and sell trinkets add gold to only the first few sales each day.
export const bonusSalesLeft = (s) => Math.max(0, RULES.sellBonusPerDay - (s.bonusSales || 0));

function sellParts(s, inst) {
  const def = CARDS[inst.id];
  const base = sellValue(def, inst) * stackOf(inst);
  const per = ownedCount(s, 'sellBonus') - (def.sellBonus ? 1 : 0) + (trinketMods(s).sellBonus || 0);
  const n = per > 0 ? Math.min(stackOf(inst), bonusSalesLeft(s)) : 0;
  return { base, bonus: per * n, n };
}

export function sellPrice(s, inst) {
  const { base, bonus } = sellParts(s, inst);
  return base + bonus;
}

export function sell(s, uid) {
  const f = find(s, uid);
  if (!f) return { ok: false };
  const { base, bonus, n } = sellParts(s, f.inst);
  remove(s, uid);
  s.gold += base + bonus;
  if (bonus) s.bonusSales = (s.bonusSales || 0) + n;
  return { ok: true, price: base + bonus };
}

export function feedTrack(id) {
  return TRACKS.find((t) => t.feed === id) || null;
}

export function feed(s, uid) {
  const f = find(s, uid);
  if (!f) return { ok: false };
  const track = feedTrack(f.inst.id);
  if (!track) return { ok: false, reason: 'The shrine only takes Ember, Bone, Berry, Coin, Stone or Ice' };
  if (s.bound && s.bound !== track.id) return { ok: false, reason: `The shrine is bound to ${TRACKS.find((t) => t.id === s.bound).name}. Other tracks are sealed this run.` };
  remove(s, uid);
  s.fed[track.id] += stackOf(f.inst);
  const n = s.fed[track.id];
  const before = n - stackOf(f.inst);
  const crossed = (step) => before < step && n >= step;
  const unlocked = crossed(TRACK_STEPS[1]) ? track.packs[1] : crossed(TRACK_STEPS[0]) ? track.packs[0] : null;
  // Opening a track binds the shrine to it for the rest of the run, and the
  // land takes on its look.
  if (unlocked) { s.theme = track.id; s.bound = track.id; }
  // Completing a track: the shrine hands over its rare.
  let gift = null;
  if (crossed(TRACK_STEPS[1]) && PACKS[track.packs[1]].rare) {
    gift = makeInst(s, PACKS[track.packs[1]].rare);
    s.table.push(gift);
  }
  return { ok: true, track, count: n, unlocked, gift };
}

// ---------------------------------------------------------------- combining

export function rareBonus(s) {
  let bonus = ownedSum(s, 'rareOdds') + (trinketMods(s).rareOdds || 0);
  if (!s.oracleUsed && ownedCount(s, 'oracle')) bonus += 20;
  return bonus;
}

export function combineInfo(s, aId, bId) {
  const r = recipeFor(aId, bId);
  if (!r) return null;
  const chance = r.rare ? Math.min(RULES.rareCap, r.chance + rareBonus(s)) : 0;
  return { ...r, chance, cost: Math.max(0, combineCost(r.result) - (trinketMods(s).combineDiscount || 0)) };
}

export function combine(s, aUid, bUid, { prepaid = false } = {}) {
  const a = find(s, aUid);
  const b = find(s, bUid);
  if (!a || !b || a === b) return { ok: false };
  if (stackOf(a.inst) > 1 || stackOf(b.inst) > 1) return { ok: false, reason: 'Bundles only go to the trinket rack' };
  const info = combineInfo(s, a.inst.id, b.inst.id);
  if (!info) return { ok: false, reason: 'Nothing happens' };
  if (!prepaid) {
    if (s.gold < info.cost) return { ok: false, reason: `Combining costs ${info.cost} gold` };
    s.gold -= info.cost;
  }
  let id = info.result;
  let rare = false;
  if (info.rare) {
    const r = rng(s);
    rare = r.chance(info.chance / 100);
    r.done();
    if (rare) id = info.rare;
    if (!s.oracleUsed && ownedCount(s, 'oracle')) s.oracleUsed = true;
  }
  const inst = makeInst(s, id, { perm: a.inst.perm + b.inst.perm });
  // Result appears where the target card was.
  remove(s, aUid);
  const target = find(s, bUid);
  if (target.where === 'wall' && CARDS[id].kind === 'unit') {
    s.wall[target.index] = inst;
  } else {
    remove(s, bUid);
    s.table.push(inst);
  }
  const key = `${info.a}+${info.b}`;
  const firstTime = !s.discovered.includes(key) || (rare && !s.discovered.includes(`${key}!`));
  if (!s.discovered.includes(key)) s.discovered.push(key);
  if (rare && !s.discovered.includes(`${key}!`)) s.discovered.push(`${key}!`);
  return { ok: true, inst, rare, info, firstTime };
}

// ---------------------------------------------------------------- stars

// Merging a unit with a copy of itself adds a star (up to 3).
export function starInfo(s, aUid, bUid) {
  const a = find(s, aUid);
  const b = find(s, bUid);
  if (!a || !b || a === b || a.inst.id !== b.inst.id || CARDS[a.inst.id].kind !== 'unit') return null;
  const stars = (a.inst.stars || 0) + (b.inst.stars || 0) + 1;
  if (stars > 3) return { ok: false, stars, reason: 'Already at ★★★ (3 stars max)' };
  const cost = Math.max(0, starCost(CARDS[a.inst.id], stars) - (trinketMods(s).combineDiscount || 0));
  return { ok: true, stars, cost };
}

export function starUp(s, aUid, bUid) {
  const info = starInfo(s, aUid, bUid);
  if (!info || !info.ok) return { ok: false, reason: info?.reason || 'Nothing happens' };
  if (s.gold < info.cost) return { ok: false, reason: `Starring up costs ${info.cost} gold` };
  s.gold -= info.cost;
  const a = find(s, aUid).inst;
  const b = find(s, bUid).inst;
  remove(s, aUid);
  b.stars = info.stars;
  b.perm += a.perm;
  b.meals = Math.max(b.meals || 0, a.meals || 0);
  b.owned = Math.max(b.owned || 0, a.owned || 0);
  return { ok: true, inst: b, stars: info.stars, cost: info.cost };
}

// ---------------------------------------------------------------- bundles and trinkets

// Stacking an ingredient on the same ingredient makes a bundle (up to 5).
export function bundleInfo(s, aUid, bUid) {
  const a = find(s, aUid);
  const b = find(s, bUid);
  if (!a || !b || a.inst.id !== b.inst.id || CARDS[a.inst.id].kind !== 'ingredient') return null;
  const n = stackOf(a.inst) + stackOf(b.inst);
  if (n > MAX_STACK) return { ok: false, n, reason: `Bundles hold at most ${MAX_STACK}` };
  return { ok: true, n };
}

export function bundle(s, aUid, bUid) {
  const info = bundleInfo(s, aUid, bUid);
  if (!info || !info.ok) return { ok: false, reason: info?.reason || 'Nothing happens' };
  const b = find(s, bUid).inst;
  remove(s, aUid);
  b.stack = info.n;
  return { ok: true, inst: b };
}

export function forgeCost(s, size) {
  return trinketMods(s).freeForge ? 0 : FORGE_COST[size];
}

// Forge a bundle into a random trinket of its size, in rack slot `slot`
// (replacing whatever was there).
export function forge(s, uid, slot) {
  const f = find(s, uid);
  if (!f) return { ok: false };
  const size = stackOf(f.inst);
  if (size < 2) return { ok: false, reason: 'Stack 2 or more of one resource to forge a trinket' };
  const cost = forgeCost(s, size);
  if (s.gold < cost) return { ok: false, reason: `Forging costs ${cost} gold` };
  s.gold -= cost;
  const have = new Set(s.trinkets.filter(Boolean).map((t) => t.id));
  const all = TK_BY[f.inst.id][size];
  const fresh = all.filter((id) => !have.has(id));
  const r = rng(s);
  const id = r.pick(fresh.length ? fresh : all);
  r.done();
  remove(s, uid);
  const replaced = s.trinkets[slot];
  const t = { uid: s.uid++, id };
  s.trinkets[slot] = t;
  return { ok: true, trinket: t, replaced, cost };
}

export function moveTrinket(s, from, to) {
  if (from === to) return { ok: true };
  [s.trinkets[from], s.trinkets[to]] = [s.trinkets[to], s.trinkets[from]];
  return { ok: true };
}

export function sellTrinket(s, slot) {
  const t = s.trinkets[slot];
  if (!t) return { ok: false };
  const price = trinketSellValue(t);
  s.trinkets[slot] = null;
  s.gold += price;
  return { ok: true, price };
}

// ---------------------------------------------------------------- eating

export function eatInfo(eaterId, meals = 0) {
  const d = CARDS[eaterId];
  if (!d.eats) return null;
  const ev = d.eats.evolve;
  return { foods: d.eats.foods, next: ev ? ev[0] : null, into: ev ? ev[1] : null, left: ev ? Math.max(0, ev[0] - meals) : null };
}

export function eat(s, foodUid, eaterUid) {
  const food = find(s, foodUid);
  const eater = find(s, eaterUid);
  if (!food || !eater || !eats(eater.inst.id, food.inst.id) || stackOf(food.inst) > 1) return { ok: false };
  remove(s, foodUid);
  const inst = eater.inst;
  inst.meals = (inst.meals || 0) + 1;
  const per = CARDS[inst.id].eats.per || 1;
  if (inst.meals % per === 0) inst.perm += 1;
  const ev = CARDS[inst.id].eats.evolve;
  let evolved = null;
  if (ev && inst.meals >= ev[0]) {
    evolved = ev[1];
    inst.id = ev[1];
  }
  return { ok: true, inst, evolved };
}

// ---------------------------------------------------------------- placement

export function toWall(s, uid, slot) {
  const f = find(s, uid);
  if (!f) return { ok: false };
  if (CARDS[f.inst.id].kind !== 'unit') return { ok: false, reason: 'Only units can stand on the wall' };
  if (slot >= slotsToday(s)) return { ok: false, reason: `Slot unlocks on day ${slot === 4 ? 4 : 7}` };
  const occupant = s.wall[slot];
  if (f.where === 'wall') {
    s.wall[f.index] = occupant;
    s.wall[slot] = f.inst;
    return { ok: true, swapped: occupant };
  }
  s.table.splice(f.index, 1);
  if (occupant) s.table.push(occupant);
  s.wall[slot] = f.inst;
  return { ok: true, swapped: occupant };
}

export function toTable(s, uid) {
  const f = find(s, uid);
  if (!f) return { ok: false };
  if (f.where === 'table') return { ok: true };
  if (tableFull(s)) return { ok: false, reason: 'Table is full (10 cards)' };
  s.wall[f.index] = null;
  s.table.push(f.inst);
  return { ok: true };
}

// ---------------------------------------------------------------- fights

export function snapshot(s, name = 'You') {
  return {
    name,
    day: s.day,
    wins: s.wins,
    losses: s.losses,
    hp: fortressHp(s.day),
    gold: s.gold,
    slots: slotsToday(s),
    wall: s.wall.slice(0, slotsToday(s)).map((c) => (c ? { id: c.id, perm: c.perm, meals: c.meals || 0, owned: c.owned || 0, stars: c.stars || 0, att: attuneOf(s, c.id) } : null)),
    trinkets: (s.trinkets || []).filter(Boolean).map((t) => t.id),
    tableCount: s.table.length,
  };
}

export function finishFight(s, won, opponentName) {
  const lines = [];
  if (won) s.wins += 1;
  else s.losses += 1;
  s.history.push({ day: s.day, won, vs: opponentName });

  // "+N after each fight" scaling for units that fought.
  const tombKing = s.wall.some((c) => c && CARDS[c.id].tombKing);
  for (const c of s.wall) {
    if (!c) continue;
    const d = CARDS[c.id];
    const grow = (d.perm || 0) + (won ? d.permWin || 0 : d.permLoss || 0);
    if (grow) c.perm += grow * (tombKing ? 2 : 1);
  }

  // Trinkets that work between fights.
  const tk = trinketMods(s);
  const grow = (won ? tk.permOnWin || 0 : 0) + (tk.permAfter || 0);
  if (grow) {
    const r = rng(s);
    const wall = s.wall.filter(Boolean);
    for (let i = 0; i < grow && wall.length; i++) r.pick(wall).perm += 1;
    r.done();
  }

  lines.push(['Daily wage', RULES.dayGold]);
  // Interest on what you're holding: +1 per 10 gold, up to +3.
  const interest = Math.min(RULES.interestMax, Math.floor(s.gold / RULES.interestPer));
  if (interest) lines.push(['Interest', interest]);
  // A Caravan-bound shrine pays a wage: +2 gold a day per shrine step.
  const caravanSteps = s.bound === 'caravan' ? TRACK_STEPS.filter((n) => s.fed.caravan >= n).length : 0;
  if (caravanSteps) lines.push(['Caravan shrine', 2 * caravanSteps]);
  if (tk.gold) lines.push(['Trinkets', tk.gold]);
  if (tk.interest) {
    const g = Math.min(tk.interest, Math.floor(s.gold / 5));
    if (g) lines.push(['Interest Ledger', g]);
  }
  if (won) lines.push(['Victory bonus', RULES.winGold]);
  for (const c of owned(s)) {
    const d = CARDS[c.id];
    if (d.gold) lines.push([d.name, Math.round(d.gold * starMult(d, c.stars, attuneOf(s, c.id)))]);
    if (d.banker) {
      const g = Math.min(4, Math.floor(s.gold / 5));
      if (g) lines.push([d.name, g]);
    }
    c.owned += 1;
  }
  const total = lines.reduce((a, [, g]) => a + g, 0);
  s.gold += total;

  const over = s.wins >= RULES.winsToFinish || s.losses >= RULES.lives;
  if (!over) {
    s.day += 1;
    s.oracleUsed = false;
    s.bonusSales = 0;
    rollShop(s);
  }
  return { won, lines, total, over };
}
