import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, RECIPES, recipeFor, fortressHp } from '../src/content.js';
import { createBattle } from '../src/sim.js';
import { botGhost } from '../src/ghosts.js';
import * as run from '../src/run.js';

const side = (wall, extra = {}) => ({ name: 'x', hp: 100, gold: 0, slots: 6, wall: wall.map((id) => (id ? { id } : null)), ...extra });

test('every unit fights without throwing', () => {
  for (const def of Object.values(CARDS)) {
    if (def.kind !== 'unit') continue;
    const b = createBattle({ left: side([def.id, 'villager', 'scorpion']), right: side(['knight', 'wisp', 'sandcaster']), seed: 3 });
    b.runToEnd();
    assert.ok(b.over, def.id);
  }
});

test('battles are deterministic for a seed', () => {
  const mk = () => createBattle({ left: side(['gambler', 'rogue', 'luckyFairy']), right: side(['jackal', 'stormCaller', 'duneGuard']), seed: 42 });
  const a = mk(); a.runToEnd();
  const b = mk(); b.runToEnd();
  assert.equal(a.t, b.t);
  assert.equal(a.sides[0].hp, b.sides[0].hp);
});

test('villager deals 2 damage every 2s', () => {
  const b = createBattle({ left: side(['villager']), right: side([]), seed: 1 });
  while (b.t < 2.01) b.step();
  assert.equal(b.sides[1].hp, 98);
});

test('shield absorbs damage, poison ignores it', () => {
  const b = createBattle({ left: side(['villager', 'scorpion']), right: side(['direWolf']), seed: 1 });
  while (b.t < 2.01) b.step();
  assert.equal(b.sides[1].hp, 100);
  assert.equal(b.sides[1].shield, 8);
});

test('sudden death ends stalled fights', () => {
  const b = createBattle({ left: side(['guard']), right: side(['guard']), seed: 1 });
  b.runToEnd();
  assert.ok(b.t < 50);
});

test('recipes are symmetric', () => {
  assert.equal(recipeFor('wood', 'villager').result, 'archer');
  assert.equal(recipeFor('villager', 'wood').result, 'archer');
  assert.ok(RECIPES.size > 100);
});

test('run: pack, open, combine, wall, fight', () => {
  const s = run.newRun(123);
  assert.equal(s.gold, 10);
  const p = run.buyPack(s, 'village');
  assert.ok(p.ok);
  assert.equal(s.gold, 7);
  while (s.packs.length) run.openOne(s, s.packs[0].uid);
  assert.equal(s.table.length, 3);
  const v = run.makeInst(s, 'villager'); s.table.push(v);
  const w = run.makeInst(s, 'wood'); s.table.push(w);
  const c = run.combine(s, w.uid, v.uid);
  assert.ok(c.ok);
  assert.equal(c.inst.id, 'archer');
  assert.ok(run.toWall(s, c.inst.uid, 0).ok);
  const res = run.finishFight(s, true, 'bot');
  assert.equal(s.day, 2);
  assert.equal(res.total, 10);
});

test('scaling carries over when combined', () => {
  const s = run.newRun(5);
  const sk = run.makeInst(s, 'skeleton'); s.wall[0] = sk;
  run.finishFight(s, false, 'bot');
  assert.equal(sk.perm, 1);
  const bone = run.makeInst(s, 'bone'); s.table.push(bone);
  const r = run.combine(s, bone.uid, sk.uid);
  assert.equal(r.inst.id, 'necromancer');
  assert.equal(r.inst.perm, 1);
});

test('bot ghosts fill a sensible wall', () => {
  for (let day = 1; day <= 12; day++) {
    const g = botGhost(day);
    assert.equal(g.hp, fortressHp(day));
    assert.ok(g.wall.filter(Boolean).length >= 2);
  }
});
