// Async PvP: opponents are "ghosts" — wall snapshots from other runs.
// For now the pool lives in localStorage (your own past runs) and is topped up
// by a bot that builds a plausible wall for the day. Swap `fetchGhost` and
// `submitGhost` for a server call later; both are already async.
import { CARDS, fortressHp, wallSlots } from './content.js';
import { TK_BY } from './trinkets.js';
import { createRng } from './rng.js';

const KEY = 'stackbrawl.ghosts.v1';
const MAX = 200;

const ARCHETYPES = {
  burn: ['fireMage', 'pyromancer', 'hellhound', 'cerberus', 'fireArcher', 'flameDancer', 'infernoMage', 'wisp', 'willOWisp', 'bonfireKeeper', 'fireScorpion', 'flameKnight'],
  poison: ['scorpion', 'scorpionSwarm', 'hexer', 'necromancer', 'fungalNest', 'deathstalker', 'scorpionNest', 'tombStalker', 'sporeScorpion', 'druid', 'myconid'],
  fortress: ['guard', 'knight', 'paladin', 'treant', 'elderTreant', 'shaman', 'healer', 'champion', 'warden', 'alchemist', 'bulwark'],
  pack: ['wolf', 'wolfPack', 'hunter', 'beastmaster', 'alpha', 'griffin', 'skyGriffin', 'wolfRider', 'direWolf', 'frostWolf'],
  bones: ['skeleton', 'boneKnight', 'graveWolf', 'necromancer', 'boneHound', 'ashCaller', 'tombStalker'],
  desperado: ['werewolf', 'warlock', 'moonhowler', 'moonFairy', 'nightScorpion', 'mage'],
  frost: ['iceMage', 'frostFairy', 'trapper', 'snowQueen', 'warden', 'frostArcher', 'archmage', 'mage'],
  luck: ['fairyRing', 'fairyCourt', 'luckyFairy', 'gambler', 'rogue', 'wishSprite', 'cloverSprite', 'archer', 'scout'],
  sand: ['sandcaster', 'jackal', 'dustSprite', 'duneGuard', 'stormCaller', 'sandScorpion', 'duneStalker'],
  clockwork: ['hourglass', 'sandClock', 'timekeeper', 'stallWarden', 'doomsdayClock', 'guard', 'treant', 'healer', 'paladin'],
  relay: ['relayRunner', 'courier', 'drummer', 'conductor', 'archer', 'scout', 'hunter', 'knight'],
  ice: ['snowSprite', 'penguin', 'yetiCub', 'iceFisher', 'frostBat', 'icicleThrower', 'blizzardSprite', 'snowballGolem', 'penguinColony', 'yeti', 'frostGiant', 'cryomancer', 'mammoth', 'shardstorm'],
};

const NAMES = ['Bramble', 'Thistle', 'Oakhart', 'Pebbles', 'Mossbeard', 'Juniper', 'Wicklow', 'Fennimore', 'Quill', 'Hazel',
  'Rook', 'Sorrel', 'Barnaby', 'Clementine', 'Dunmore', 'Ember Lou', 'Gristle', 'Marigold', 'Pip', 'Tansy', 'Wren', 'Ashby'];

function loadPool() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function savePool(pool) {
  try { localStorage.setItem(KEY, JSON.stringify(pool.slice(-MAX))); } catch { /* storage unavailable */ }
}

export async function submitGhost(snap, runSeed) {
  const pool = loadPool();
  pool.push({ ...snap, runSeed, at: Date.now() });
  savePool(pool);
}

export async function fetchGhost({ day, wins, losses, runSeed, seed }) {
  const r = createRng(seed);
  const pool = loadPool().filter((g) => g.day === day && g.runSeed !== runSeed && g.wall.some(Boolean));
  if (pool.length && r.chance(0.5)) {
    const g = r.pick(pool);
    return { ...g, name: `Ghost of ${g.name === 'You' ? 'a past you' : g.name}`, past: true };
  }
  return botGhost(day, wins, losses, r);
}

// Matches the player's economy: 5 gold a day and paid combines mean
// tier III arrives around day 5-6 and tier IV only late.
const TIER_BY_DAY = (day) => {
  if (day <= 1) return [[1, 4], [2, 1]];
  if (day <= 2) return [[1, 3], [2, 2]];
  if (day <= 3) return [[1, 2], [2, 4]];
  if (day <= 5) return [[2, 4], [3, 1]];
  if (day <= 7) return [[2, 3], [3, 2]];
  if (day <= 9) return [[2, 1], [3, 3], [4, 1]];
  return [[3, 3], [4, 1]];
};

export function botGhost(day, wins = 0, losses = 0, r = createRng(day * 7919)) {
  const slots = wallSlots(day);
  const fill = Math.min(slots, day <= 1 ? 2 + r.int(2) : day <= 3 ? 3 + r.int(2) : slots - r.int(2));
  const meals = (def) => (def.eats ? Math.min(14, day) : 0);
  const arch = r.pick(Object.keys(ARCHETYPES));
  const units = Object.values(CARDS).filter((c) => c.kind === 'unit' && !(c.track && day < 4) && !(c.rare && day < 8) && c.id !== 'mirror' && !c.chest && !c.shopSlot);
  const wall = Array(slots).fill(null);
  for (let i = 0; i < fill; i++) {
    const tier = r.weighted(TIER_BY_DAY(day));
    const themed = ARCHETYPES[arch].map((id) => CARDS[id]).filter((c) => c.tier === tier);
    const pool = themed.length && r.chance(0.65) ? themed : units.filter((c) => c.tier === tier);
    const def = r.pick(pool.length ? pool : units);
    const m = meals(def);
    wall[i] = { id: def.id, perm: (def.perm ? Math.floor((day - 1) / 2) : 0) + Math.floor(m / (def.eats?.per || 1)), meals: m, owned: Math.floor(day / 2) };
  }
  // Shuffle into slots so empty spaces vary.
  for (let i = wall.length - 1; i > 0; i--) {
    const j = r.int(i + 1);
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  // Trinkets grow with the day: bigger stacks and more of them.
  const sizes = day >= 11 ? [5, 4, 3] : day >= 9 ? [4, 3, 3] : day >= 7 ? [3, 3, 2] : day >= 5 ? [3, 2] : day >= 3 ? [2] : [];
  const resources = Object.keys(TK_BY);
  const trinkets = [];
  for (const n of sizes) {
    const opts = TK_BY[r.pick(resources)][n].filter((id) => !trinkets.includes(id));
    if (opts.length) trinkets.push(r.pick(opts));
  }
  return {
    name: `Ghost of ${r.pick(NAMES)}`,
    trinkets,
    tableCount: 2 + r.int(7),
    day, wins, losses,
    hp: fortressHp(day),
    gold: 5 + day * 2,
    slots,
    wall,
    archetype: arch,
  };
}
