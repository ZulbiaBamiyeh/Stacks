import { createSim, apply, step, getSnapshot } from "./sim.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stacksByType(snap) {
  const out = [];
  for (const s of snap.stacks) out.push(s.cards.map((c) => c.type));
  return out;
}

function countType(snap, type) {
  let n = 0;
  for (const s of snap.stacks) for (const c of s.cards) if (c.type === type) n += 1;
  return n;
}

function findStack(state, pred) {
  return Object.values(state.stacks).find(pred);
}

// gather: villager on bush for 600 ticks → 1 berry attached
{
  const sim = createSim(1);
  apply(sim, { kind: "begin_day" });
  const bush = findStack(sim, (s) => s.cards.some((id) => sim.cards[id].type === "berry_bush"));
  const vil = findStack(sim, (s) => s.cards.length === 1 && sim.cards[s.cards[0]].type === "villager");
  apply(sim, { kind: "merge", fromId: vil.id, ontoId: bush.id });
  step(sim, 600);
  const snap = getSnapshot(sim);
  assert(countType(snap, "berries") === 1, `expected 1 berry, got ${countType(snap, "berries")}`);
  const parent = Object.values(sim.attachments).length;
  assert(parent >= 1, "berry should be attached");
  console.log("ok gather");
}

// flint pity: 5 rock yields include flint
{
  const sim = createSim(1);
  apply(sim, { kind: "begin_day" });
  const rock = findStack(sim, (s) => s.cards.some((id) => sim.cards[id].type === "rock"));
  const vil = findStack(sim, (s) => s.cards.length === 1 && sim.cards[s.cards[0]].type === "villager");
  apply(sim, { kind: "merge", fromId: vil.id, ontoId: rock.id });
  step(sim, 600 * 5);
  const snap = getSnapshot(sim);
  const flint = countType(snap, "flint");
  assert(flint >= 1, `pity flint, got ${flint}`);
  assert(sim.flintSeen >= 1, "flintSeen");
  console.log("ok flint pity", flint, "flint in 5 yields");
}

// wolf vs armed villager: player wins
{
  const sim = createSim(1);
  sim.day = 2;
  sim.phase = "dusk";
  const types = Object.values(sim.cards);
  const v = types.find((c) => c.type === "villager");
  v.type = "armed_villager";
  apply(sim, { kind: "place_unit", cardId: v.id, row: 0, col: 1 });
  apply(sim, { kind: "confirm_formation" });
  step(sim, 200);
  assert(sim.phase === "resolve", `phase ${sim.phase}`);
  assert(sim.lastResult === "win", `result ${sim.lastResult}`);
  assert(sim.combat === null, "combat cleared");
  console.log("ok armed villager beats wolf");
}

// naked villager loses to wolf
{
  const sim = createSim(1);
  sim.day = 2;
  sim.phase = "dusk";
  const v = Object.values(sim.cards).find((c) => c.type === "villager");
  apply(sim, { kind: "place_unit", cardId: v.id, row: 0, col: 1 });
  apply(sim, { kind: "confirm_formation" });
  step(sim, 200);
  assert(sim.lastResult === "loss", `result ${sim.lastResult}`);
  console.log("ok naked villager loses to wolf");
}

// determinism: same seed + commands
{
  function run() {
    const sim = createSim(42);
    apply(sim, { kind: "begin_day" });
    const bush = findStack(sim, (s) => s.cards.some((id) => sim.cards[id].type === "berry_bush"));
    const vil = findStack(sim, (s) => s.cards.length === 1 && sim.cards[s.cards[0]].type === "villager");
    apply(sim, { kind: "merge", fromId: vil.id, ontoId: bush.id });
    step(sim, 1800);
    return JSON.stringify(getSnapshot(sim).stacks.map((s) => s.cards.map((c) => c.type).sort()));
  }
  assert(run() === run(), "determinism");
  console.log("ok determinism");
}

console.log("all sim tests passed");
