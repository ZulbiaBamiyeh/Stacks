import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/sim.js';
import { TRINKETS, TK_BY, TRINKET_IDS, aggregate } from '../src/trinkets.js';
import { INGREDIENTS } from '../src/content.js';
import * as run from '../src/run.js';

const side = (wall, trinkets = [], extra = {}) => ({ name: 'x', hp: 100, gold: 0, slots: 6, wall: wall.map((id) => (id ? { id } : null)), trinkets, ...extra });

test('every resource has 3 trinkets at each stack size 2-5', () => {
  for (const ing of INGREDIENTS) for (let n = 2; n <= 5; n++) assert.equal(TK_BY[ing.id]?.[n]?.length, 3, `${ing.id} x${n}`);
  assert.equal(TRINKET_IDS.length, INGREDIENTS.length * 12);
  for (const t of Object.values(TRINKETS)) assert.ok(t.name && t.text, t.id);
});

test('aggregate adds numbers and keeps the strongest of exclusive keys', () => {
  const m = aggregate(['whittledArrowhead', 'heartwoodBow', 'lichPhylactery', 'deathlessSigil']);
  assert.equal(m.add.dmg, 1);
  assert.equal(m.leftAdd.dmg, 2);
  assert.equal(m.revive, Math.max(TRINKETS.lichPhylactery.m.revive, TRINKETS.deathlessSigil.m.revive));
});

test('start-of-fight trinkets apply', () => {
  const b = createBattle({ left: side(['villager'], ['riverStone', 'tinderbox']), right: side(['villager']), seed: 1 });
  assert.equal(b.sides[0].shield, 15);
  assert.equal(b.sides[1].burn, 4);
});

test('a revive trinket brings a fortress back once', () => {
  const left = side(['villager'], ['deathlessSigil'], { hp: 10 });
  const b = createBattle({ left, right: side(['hunter', 'hunter', 'hunter']), seed: 2 });
  b.runToEnd();
  assert.ok(b.events.some((e) => e.type === 'revive' && e.side === 0 && e.by === 'trinket'));
});

test('confusion turns enemy actions on themselves', () => {
  const b = createBattle({ left: side(['villager'], ['ruinedKingCrown']), right: side(['archer', 'archer']), seed: 3 });
  for (let i = 0; i < 600; i++) b.step();
  assert.ok(b.events.some((e) => e.type === 'confused' && e.side === 1));
  assert.ok(b.events.some((e) => e.type === 'dmg' && e.side === 1 && e.src?.side === 1));
});

test('every trinket survives full fights', () => {
  for (const id of TRINKET_IDS) {
    const b = createBattle({ left: side(['knight', 'fireMage', 'scorpionSwarm', 'healer', 'frostFairy'], [id]), right: side(['archer', 'guard', 'druid', 'sandcaster'], ['mirrorOfEternity']), seed: 4 });
    b.runToEnd();
    assert.ok(b.over, id);
  }
});

test('ingredients bundle up to 5 and forge into a trinket of that size', () => {
  const s = run.newRun(42);
  s.table = [];
  s.gold = 20;
  const berries = Array.from({ length: 6 }, () => { const c = run.makeInst(s, 'berry'); s.table.push(c); return c; });
  for (let i = 1; i < 4; i++) assert.ok(run.bundle(s, berries[i].uid, berries[0].uid).ok);
  assert.equal(berries[0].stack, 4);
  assert.equal(run.bundle(s, berries[4].uid, berries[0].uid).ok, true);
  assert.equal(run.bundleInfo(s, berries[5].uid, berries[0].uid).ok, false); // would be 6
  assert.equal(run.sellPrice(s, berries[0]), 5);
  const res = run.forge(s, berries[0].uid, 2);
  assert.ok(res.ok);
  assert.equal(TRINKETS[s.trinkets[2].id].res, 'berry');
  assert.equal(TRINKETS[s.trinkets[2].id].size, 5);
  assert.equal(s.gold, 20 - 4);
  assert.deepEqual(run.snapshot(s).trinkets, [s.trinkets[2].id]);
  assert.equal(run.combine(s, berries[5].uid, berries[5].uid).ok, false);
});

test('coin trinkets pay out after a fight', () => {
  const s = run.newRun(7);
  s.trinkets[0] = { uid: 999, id: 'gildedRing' };
  const g = s.gold;
  const r = run.finishFight(s, false, 'x');
  assert.ok(r.lines.some(([l, n]) => l === 'Trinkets' && n === 2));
  assert.equal(s.gold, g + r.total);
});

test('opening a track binds the shrine and seals the others', () => {
  const s = run.newRun(5);
  s.table = [];
  const feed = (id) => { const c = run.makeInst(s, id); s.table.push(c); return run.feed(s, c.uid); };
  for (let i = 0; i < 3; i++) assert.ok(feed('bone').ok); // can sample before committing
  for (let i = 0; i < 4; i++) assert.ok(feed('ice').ok);
  const r = feed('ice');
  assert.equal(r.unlocked, 'frost');
  assert.equal(s.bound, 'frost');
  assert.equal(feed('bone').ok, false);
  assert.ok(feed('ice').ok);
  assert.ok(run.availablePacks(s).includes('frost'));
});

test('holding gold earns interest, +1 per 10 up to +3', () => {
  for (const [held, want] of [[9, 0], [10, 1], [27, 2], [80, 3]]) {
    const s = run.newRun(3);
    s.gold = held;
    const r = run.finishFight(s, false, 'x');
    assert.equal(r.lines.find(([l]) => l === 'Interest')?.[1] || 0, want, `holding ${held}`);
  }
});

test('completing a track at 10 opens its second pack and gifts its rare', () => {
  const s = run.newRun(9);
  s.table = [];
  let last;
  for (let i = 0; i < 10; i++) { const c = run.makeInst(s, 'ember'); s.table.push(c); last = run.feed(s, c.uid); }
  assert.equal(last.unlocked, 'inferno');
  assert.equal(last.gift?.id, 'ifrit');
  assert.ok(s.table.some((c) => c.id === 'ifrit'));
  assert.ok(run.availablePacks(s).includes('inferno'));
});

test('merging copies of a unit adds stars (max 3) and multiplies its numbers', () => {
  const s = run.newRun(4);
  s.table = []; s.gold = 30;
  const k = () => { const c = run.makeInst(s, 'archer'); s.table.push(c); return c; };
  const a = k();
  assert.ok(run.starUp(s, k().uid, a.uid).ok);
  assert.equal(a.stars, 1);
  assert.ok(run.starUp(s, k().uid, a.uid).ok);
  assert.ok(run.starUp(s, k().uid, a.uid).ok);
  assert.equal(a.stars, 3);
  assert.equal(run.starInfo(s, k().uid, a.uid).ok, false);
  assert.equal(s.gold, 30 - 2 - 4 - 6);
  const mk = (stars) => createBattle({ left: side(['archer'], [], { wall: [{ id: 'archer', stars }], slots: 1 }), right: side(['villager']), seed: 1 });
  assert.ok(mk(3).liveStats(mk(3).sides[0].units[0]).dmg > mk(0).liveStats(mk(0).sides[0].units[0]).dmg * 2.5);
});

test('trader sell bonus only counts for 3 sales a day', () => {
  const s = run.newRun(6);
  s.table = []; s.wall = s.wall.map(() => null);
  s.wall[0] = run.makeInst(s, 'trader');
  s.wall[1] = run.makeInst(s, 'trader');
  const sellOne = () => { const c = run.makeInst(s, 'wood'); s.table.push(c); return run.sell(s, c.uid).price; };
  assert.deepEqual([sellOne(), sellOne(), sellOne(), sellOne(), sellOne()], [3, 3, 3, 1, 1]);
  run.finishFight(s, true, 'x');
  assert.equal(sellOne(), 3);
});

test("stars multiply gold-scaled hits like Dragon's Hoard", () => {
  const dealt = (stars) => {
    const b = createBattle({ left: side([], [], { gold: 60, wall: [{ id: 'dragonsHoard', stars }], slots: 1 }), right: side(['villager'], [], { hp: 10000 }), seed: 1 });
    while (b.t < 20) b.step();
    return b.roster[0][0].dealt;
  };
  assert.ok(dealt(3) >= dealt(0) * 4, `${dealt(3)} vs ${dealt(0)}`);
});

test('a bound shrine tilts the shop toward its resource and units', () => {
  const count = (bound) => {
    let coins = 0, track = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = run.newRun(seed);
      if (bound) { s.bound = 'caravan'; s.fed.caravan = 5; }
      run.rollShop(s);
      for (const o of s.shop) { if (o.id === 'coin') coins++; if (o.id === 'camel' || o.id === 'trader') track++; }
    }
    return { coins, track };
  };
  const a = count(false), b = count(true);
  assert.ok(b.coins > a.coins * 2, `${b.coins} vs ${a.coins}`);
  assert.ok(b.track > a.track, `${b.track} vs ${a.track}`);
});

test('a bound shrine attunes its family: bigger numbers, more at step 2', async () => {
  const { ATTUNE } = await import('../src/content.js');
  const s = run.newRun(8);
  s.table = [];
  assert.equal(run.attuneOf(s, 'golem'), 1);
  for (let i = 0; i < 5; i++) { const c = run.makeInst(s, 'stone'); s.table.push(c); run.feed(s, c.uid); }
  assert.equal(run.attuneOf(s, 'golem'), ATTUNE.forge[0]);
  assert.equal(run.attuneOf(s, 'trebuchet'), ATTUNE.forge[0]); // combines from the family count too
  assert.equal(run.attuneOf(s, 'archer'), 1);
  for (let i = 0; i < 5; i++) { const c = run.makeInst(s, 'stone'); s.table.push(c); run.feed(s, c.uid); }
  assert.equal(run.attuneOf(s, 'golem'), ATTUNE.forge[1]);
  const dmg = (att) => { const b = createBattle({ left: side([], [], { wall: [{ id: 'catapult', att }], slots: 1 }), right: side(['villager']), seed: 1 }); return b.liveStats(b.sides[0].units[0]).dmg; };
  assert.ok(dmg(1.8) > dmg(1) * 1.6);
});

test('a Caravan-bound shrine pays a daily wage', () => {
  const s = run.newRun(2);
  s.table = [];
  for (let i = 0; i < 5; i++) { const c = run.makeInst(s, 'coin'); s.table.push(c); run.feed(s, c.uid); }
  const r = run.finishFight(s, false, 'x');
  assert.ok(r.lines.some(([l, n]) => l === 'Caravan shrine' && n === 2));
});

test('forging takes the pick, and more of the resource upgrades a trinket a tier', () => {
  const s = run.newRun(12);
  s.table = []; s.gold = 50;
  const bundleOf = (res, n) => { const c = run.makeInst(s, res, { stack: n }); s.table.push(c); return c; };
  const opts = run.forgeOptions('ember', 2);
  assert.equal(opts.length, 3);
  assert.ok(run.forge(s, bundleOf('ember', 2).uid, 0, opts[2]).ok);
  assert.equal(s.trinkets[0].id, opts[2]);
  // one more ember: x3, pick from the x3 ember trinkets, pay the cost difference
  const one = bundleOf('ember', 1);
  const info = run.upgradeInfo(s, one.uid, 0);
  assert.equal(info.size, 3);
  assert.deepEqual(info.options, run.forgeOptions('ember', 3));
  const g = s.gold;
  const up = run.upgradeTrinket(s, one.uid, 0, info.options[1]);
  assert.ok(up.ok);
  assert.equal(s.trinkets[0].id, info.options[1]);
  assert.equal(s.gold, g - info.cost);
  assert.ok(!s.table.includes(one));
  // a x2 bundle jumps two tiers, capped at x5
  const two = bundleOf('ember', 2);
  assert.equal(run.upgradeInfo(s, two.uid, 0).size, 5);
  assert.ok(run.upgradeTrinket(s, two.uid, 0).ok);
  assert.equal(run.upgradeInfo(s, bundleOf('ember', 1).uid, 0).ok, false);
  // a different resource doesn't upgrade it
  assert.equal(run.upgradeInfo(s, bundleOf('bone', 1).uid, 0), null);
});
