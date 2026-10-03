// Full-run balance: a heuristic player plays whole runs (packs, combines, stars,
// shrine, trinkets) against the day's bots until 10 wins or 3 losses.
// Run: node tools/autoplay.mjs [runs] [track|all]
import * as R from '../src/run.js';
import { createBattle } from '../src/sim.js';
import { botGhost } from '../src/ghosts.js';
import { createRng } from '../src/rng.js';
import { CARDS, PACKS, TRACKS, RULES, BASE_PACKS, recipeFor, eats, starMult } from '../src/content.js';
import { power } from './power.mjs';

// Solo output per unit, cached: the player's sense of how good a card is.
const POW = new Map();
let CUR = null; // the run being played, for attunement
export function value(inst) {
  const d = CARDS[inst.id];
  if (d.kind !== 'unit') return 0;
  if (!POW.has(inst.id)) POW.set(inst.id, Math.max(1, power(inst.id, { secs: 20 }).value / 20));
  const grow = d.perm || d.permWin || d.permLoss ? 1 + 0.08 * (inst.perm || 0) : 1;
  return POW.get(inst.id) * starMult(d, inst.stars || 0, CUR ? R.attuneOf(CUR, inst.id) : 1) * grow + (d.gold ? 2 : 0);
}

const all = (s) => [...s.table, ...s.wall.filter(Boolean)];

// What the best wall you could field is worth, plus a little for spare units.
function wallScore(s) {
  const v = all(s).filter((c) => CARDS[c.id].kind === 'unit').map(value).sort((a, b) => b - a);
  const n = R.slotsToday(s);
  return v.slice(0, n).reduce((a, x) => a + x, 0) + v.slice(n).reduce((a, x) => a + x, 0) * 0.15;
}

function bestCombine(s) {
  let best = null;
  const base = wallScore(s);
  const cards = all(s).filter((c) => R.stackOf(c) === 1);
  const seen = new Set();
  for (let i = 0; i < cards.length; i++) {
    for (let j = 0; j < cards.length; j++) {
      if (i === j) continue;
      const a = cards[i], b = cards[j];
      const k = a.id + '|' + b.id;
      if (seen.has(k)) continue;
      seen.add(k);
      let kind = null, cost = 0;
      const st = R.starInfo(s, a.uid, b.uid);
      if (st) { if (!st.ok) continue; kind = 'star'; cost = st.cost; }
      else if (eats(b.id, a.id)) kind = 'eat';
      else { const info = R.combineInfo(s, a.id, b.id); if (!info) continue; kind = 'combine'; cost = info.cost; }
      if (s.gold < cost) continue;
      const c = structuredClone(s);
      const ok = kind === 'star' ? R.starUp(c, a.uid, b.uid) : kind === 'eat' ? R.eat(c, a.uid, b.uid) : R.combine(c, a.uid, b.uid);
      if (!ok.ok) continue;
      // gold matters less as the run goes on
      const gain = wallScore(c) - base - cost * 0.3 + (kind === 'eat' ? 0.3 : 0);
      if (gain > 0.2 && (!best || gain > best.gain)) best = { kind, a, b, gain };
    }
  }
  return best;
}

function arrangeWall(s) {
  const slots = R.slotsToday(s);
  const pool = all(s);
  const units = pool.filter((c) => CARDS[c.id].kind === 'unit').sort((x, y) => value(y) - value(x)).slice(0, slots);
  s.wall = Array(6).fill(null);
  units.forEach((c, i) => { s.wall[i] = c; });
  s.table = pool.filter((c) => !units.includes(c));
}

function tidy(s, policy) {
  // Keep room: sell the weakest table cards that aren't food for the shrine.
  const feed = policy.track && TRACKS.find((t) => t.id === policy.track).feed;
  while (s.table.length > 8) {
    const junk = [...s.table].sort((x, y) => value(x) - value(y) + (x.id === feed ? 1 : 0) - (y.id === feed ? 1 : 0))[0];
    R.sell(s, junk.uid);
  }
}

function forgeTrinkets(s, policy) {
  const feed = policy.track && TRACKS.find((t) => t.id === policy.track).feed;
  const groups = new Map();
  for (const c of s.table) if (CARDS[c.id].kind === 'ingredient' && c.id !== feed) groups.set(c.id, [...(groups.get(c.id) || []), c]);
  for (const [, cs] of groups) {
    if (cs.length < 2) continue;
    let base = cs[0];
    for (const c of cs.slice(1)) if (R.stackOf(base) < policy.forgeAt && R.bundle(s, c.uid, base.uid).ok) base = R.find(s, base.uid).inst;
    if (R.stackOf(base) < policy.forgeAt) continue;
    const empty = s.trinkets.findIndex((t) => !t);
    if (empty >= 0 && s.gold >= R.forgeCost(s, R.stackOf(base))) R.forge(s, base.uid, empty);
  }
}

function buyPhase(s, policy, r) {
  const feed = policy.track && TRACKS.find((t) => t.id === policy.track).feed;
  for (let guard = 0; guard < 20; guard++) {
    if (s.table.length >= 9) return;
    const reserve = policy.saveFor(s);
    // cheap shrine food from the shop
    if (feed && !s.bound || s.bound === policy.track) {
      const i = s.shop.findIndex((o) => o && o.id === feed);
      if (feed && i >= 0 && s.gold - s.shop[i].price >= reserve) { R.buySingle(s, i); continue; }
    }
    // ingredients that complete a combine worth making
    const ii = s.shop.findIndex((o) => {
      if (!o || CARDS[o.id].kind !== 'ingredient' || s.gold - o.price < reserve) return false;
      const c = structuredClone(s);
      c.gold -= o.price;
      c.table.push(R.makeInst(c, o.id));
      return bestCombine(c)?.gain > 0.5 && bestCombine(c).a.id === o.id || bestCombine(c)?.b.id === o.id;
    });
    if (ii >= 0) { R.buySingle(s, ii); continue; }
    // shop singles that copy a unit we own (for stars) or are strong
    const own = new Set(all(s).map((c) => c.id));
    const si = s.shop.findIndex((o) => o && CARDS[o.id].kind === 'unit' && (own.has(o.id) || value({ id: o.id }) > policy.singleBar(s)));
    if (si >= 0 && s.gold - s.shop[si].price >= reserve) { R.buySingle(s, si); continue; }
    if (policy.rerolls && (s.rerolled || 0) < policy.rerolls && s.gold - RULES.rerollPrice >= reserve + 3) {
      s.rerolled = (s.rerolled || 0) + 1;
      R.reroll(s);
      continue;
    }
    const packs = R.availablePacks(s);
    const track = packs.filter((p) => !BASE_PACKS.includes(p));
    const feedPack = feed && BASE_PACKS.find((p) => PACKS[p].pool.some(([id]) => id === feed));
    const pick = track.length && r.chance(0.7) ? r.pick(track) : feedPack && r.chance(0.7) ? feedPack : r.pick(BASE_PACKS);
    if (s.gold - PACKS[pick].price < reserve) return;
    R.buyPack(s, pick);
  }
}

function playDay(s, policy, r) {
  CUR = s;
  s.rerolled = 0;
  const feed = policy.track && TRACKS.find((t) => t.id === policy.track).feed;
  for (let round = 0; round < 3; round++) {
    buyPhase(s, policy, r);
    for (const p of [...s.packs]) while (s.packs.includes(p) && !R.tableFull(s)) R.openOne(s, p.uid);
    if (feed) for (const c of [...s.table]) if (c.id === feed) R.feed(s, c.uid);
    for (let k = 0; k < 30; k++) {
      const b = bestCombine(s);
      if (!b) break;
      if (b.kind === 'star') R.starUp(s, b.a.uid, b.b.uid);
      else if (b.kind === 'eat') R.eat(s, b.a.uid, b.b.uid);
      else R.combine(s, b.a.uid, b.b.uid);
    }
    if (feed) for (const c of [...s.table]) if (c.id === feed) R.feed(s, c.uid);
    forgeTrinkets(s, policy);
    tidy(s, policy);
  }
  arrangeWall(s);
}

export function playRun(seed, policy) {
  const s = R.newRun(seed);
  const r = createRng(seed * 7 + 1);
  const days = [];
  for (;;) {
    const g0 = s.gold;
    playDay(s, policy, r);
    policy.onDay?.(s);
    if (policy.log) console.log(`day ${s.day} ${s.wins}-${s.losses} gold ${g0}->${s.gold} table ${s.table.map((c) => c.id + (c.stack > 1 ? 'x' + c.stack : '')).join(',')} | wall ${s.wall.filter(Boolean).map((c) => c.id + '*'.repeat(c.stars || 0)).join(',')} | tk ${s.trinkets.filter(Boolean).map((t) => t.id).join(',')} fed ${JSON.stringify(s.fed)}`);
    const ghost = (policy.ghost || botGhost)(s.day, s.wins, s.losses, createRng((seed ^ (s.day * 2654435761)) >>> 0));
    const b = createBattle({ left: R.snapshot(s), right: ghost, seed: (seed * 31 + s.day) >>> 0 });
    while (!b.over) b.step();
    policy.onFight?.(s, b);
    const won = b.winner === 0;
    days.push(won);
    const res = R.finishFight(s, won, ghost.name);
    if (res.over) break;
  }
  return { wins: s.wins, losses: s.losses, days, stars: all(s).reduce((a, c) => a + (c.stars || 0), 0), trinkets: s.trinkets.filter(Boolean).length, bound: s.bound || null, wall: s.wall.filter(Boolean).map((c) => c.id + '★'.repeat(c.stars || 0)) };
}

export const POLICY = (track, level = 'strong') => level === 'strong' ? {
  track,
  forgeAt: 2,
  rerolls: 2,
  saveFor: (s) => (s.day >= 3 && s.gold >= 10 ? 10 : 0),
  singleBar: (s) => 4 + s.day * 0.8,
} : {
  track,
  forgeAt: 3,
  rerolls: 0,
  saveFor: () => 0,
  singleBar: (s) => 4 + s.day * 0.8,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const runs = Number(process.argv[2] || 100);
  const which = process.argv[3] || 'all';
  const level = process.argv[4] || 'strong';
  const tracks = which === 'all' ? [null, ...TRACKS.map((t) => t.id)] : [which === 'none' ? null : which];
  for (const track of tracks) {
    const res = [];
    for (let i = 0; i < runs; i++) res.push(playRun(1000 + i, POLICY(track, level)));
    const dist = Array(11).fill(0);
    for (const x of res) dist[x.wins]++;
    const byDay = [];
    for (const x of res) x.days.forEach((w, d) => { byDay[d] = byDay[d] || [0, 0]; byDay[d][0] += w; byDay[d][1]++; });
    const avg = res.reduce((a, x) => a + x.wins, 0) / runs;
    console.log(`\n== ${track || 'no shrine'}: avg wins ${avg.toFixed(2)}, 10-win ${(dist[10] / runs * 100).toFixed(0)}%, stars ${(res.reduce((a, x) => a + x.stars, 0) / runs).toFixed(1)}, trinkets ${(res.reduce((a, x) => a + x.trinkets, 0) / runs).toFixed(1)}`);
    console.log('  wins dist', dist.join(' '));
    console.log('  win% by fight #', byDay.map(([w, n]) => Math.round(w / n * 100)).join(' '));
    const champ = res.find((x) => x.wins === 10) || res.sort((a, b) => b.wins - a.wins)[0];
    console.log('  sample best wall', champ.wall.join(', '));
  }
}
