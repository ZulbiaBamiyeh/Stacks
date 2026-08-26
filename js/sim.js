/**
 * Headless integer sim. No DOM, no rAF, no Math.random.
 * View may import this; Node tests may too.
 */
import {
  CARDS,
  UNITS,
  RECIPES,
  OPENING,
  DAYS,
  DAY_TICKS,
  GATHER_TICKS,
  FOOD_PER_UNIT,
  FLINT_PITY,
  POP_CAP,
} from "./content.js";

function nextU32(rng) {
  let x = rng.s | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rng.s = x | 0;
  return x >>> 0;
}

function nextInt(rng, n) {
  return nextU32(rng) % n;
}

function nid(state) {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function emptyGrid() {
  return [
    [null, null, null, null],
    [null, null, null, null],
  ];
}

function addCard(state, type) {
  const id = nid(state);
  state.cards[id] = { id, type };
  return id;
}

function addStack(state, cardIds) {
  const id = nid(state);
  state.stacks[id] = { id, cards: cardIds.slice() };
  return id;
}

function cardType(state, id) {
  return state.cards[id].type;
}

function def(type) {
  return CARDS[type];
}

function isWorker(type) {
  return !!def(type).worker;
}

function isEater(type) {
  return !!def(type).eats;
}

function isFighter(type) {
  return !!def(type).fights;
}

function countsOf(state, cardIds) {
  const m = Object.create(null);
  for (const id of cardIds) {
    const t = cardType(state, id);
    m[t] = (m[t] || 0) + 1;
  }
  return m;
}

function workerCount(counts) {
  let n = 0;
  for (const t of Object.keys(counts)) {
    if (isWorker(t)) n += counts[t];
  }
  return n;
}

function findCardOf(state, cardIds, type) {
  return cardIds.find((id) => cardType(state, id) === type);
}

function consume(state, stack, type, n) {
  for (let i = stack.cards.length - 1; i >= 0 && n > 0; i--) {
    if (cardType(state, stack.cards[i]) === type) {
      const id = stack.cards[i];
      stack.cards.splice(i, 1);
      delete state.cards[id];
      n -= 1;
    }
  }
}

function consumeOneWorker(state, stack, types) {
  for (let i = stack.cards.length - 1; i >= 0; i--) {
    const t = cardType(state, stack.cards[i]);
    if (types.includes(t)) {
      const id = stack.cards[i];
      stack.cards.splice(i, 1);
      delete state.cards[id];
      return t;
    }
  }
  return null;
}

function recipeFits(recipe, counts, tcLevel) {
  if (recipe.worker && workerCount(counts) < 1) return false;
  if (recipe.catalyst && !counts[recipe.catalyst]) return false;
  if (recipe.requireTc != null && tcLevel !== recipe.requireTc) return false;
  if (recipe.workerTypes) {
    const has = recipe.workerTypes.some((t) => counts[t] > 0);
    if (!has) return false;
  }
  for (const [t, n] of Object.entries(recipe.inputs || {})) {
    if ((counts[t] || 0) < n) return false;
  }
  return true;
}

function matchRecipe(state, stack) {
  const counts = countsOf(state, stack.cards);
  for (const recipe of RECIPES) {
    if (recipeFits(recipe, counts, state.tcLevel)) return recipe;
  }
  return null;
}

function gatherNode(state, stack) {
  if (workerCount(countsOf(state, stack.cards)) < 1) return null;
  for (const id of stack.cards) {
    const t = cardType(state, id);
    const d = def(t);
    if (d.kind === "node" && d.yield) return { cardId: id, type: t, yield: d.yield };
  }
  return null;
}

function workKey(stack, recipe, node) {
  if (recipe) return `craft:${recipe.id}:${stack.id}`;
  if (node) return `gather:${node.cardId}:${stack.id}`;
  return null;
}

export function rescanWork(state) {
  const next = Object.create(null);
  for (const stack of Object.values(state.stacks)) {
    const recipe = matchRecipe(state, stack);
    const node = recipe ? null : gatherNode(state, stack);
    const key = workKey(stack, recipe, node);
    if (!key) continue;
    const prev = state.work[stack.id];
    const total = recipe ? recipe.workTicks : GATHER_TICKS;
    const progress = prev && prev.key === key ? prev.progress : 0;
    next[stack.id] = {
      stackId: stack.id,
      key,
      progress,
      total,
      label: recipe ? recipe.name : `Gather ${def(node.yield === "rock" ? "stone" : node.yield).name}`,
      recipeId: recipe ? recipe.id : null,
      nodeCardId: node ? node.cardId : null,
    };
  }
  state.work = next;
}

function popUsed(state) {
  let n = 0;
  for (const c of Object.values(state.cards)) {
    if (isEater(c.type)) n += 1;
  }
  return n;
}

function berryCount(state) {
  let n = 0;
  for (const c of Object.values(state.cards)) {
    if (c.type === "berries") n += 1;
  }
  return n;
}

function yieldRock(state) {
  state.rockYields += 1;
  let out = nextInt(state.rng, 10) < 7 ? "stone" : "flint";
  if (state.flintSeen === 0 && state.rockYields >= FLINT_PITY) out = "flint";
  if (out === "flint") state.flintSeen += 1;
  return out;
}

function attachedStack(state, parentCardId) {
  const sid = state.attachments[parentCardId];
  if (sid && state.stacks[sid]) return state.stacks[sid];
  return null;
}

function emitOntoAttachment(state, parentCardId, type) {
  const cardId = addCard(state, type);
  let stack = attachedStack(state, parentCardId);
  if (!stack) {
    const sid = addStack(state, [cardId]);
    state.attachments[parentCardId] = sid;
    return sid;
  }
  stack.cards.push(cardId);
  return stack.id;
}

function emitOntoStack(state, stack, type) {
  const cardId = addCard(state, type);
  stack.cards.push(cardId);
  return cardId;
}

function finishCraft(state, stack, recipe) {
  if (recipe.effect === "spawn") {
    for (const [t, n] of Object.entries(recipe.inputs)) consume(state, stack, t, n);
    emitOntoStack(state, stack, recipe.output);
  } else if (recipe.effect === "promote") {
    for (const [t, n] of Object.entries(recipe.inputs)) consume(state, stack, t, n);
    consumeOneWorker(state, stack, recipe.workerTypes || ["villager"]);
    emitOntoStack(state, stack, recipe.output);
  } else if (recipe.effect === "upgrade_tc") {
    for (const [t, n] of Object.entries(recipe.inputs)) consume(state, stack, t, n);
    state.tcLevel = recipe.toLevel;
  } else if (recipe.effect === "recruit") {
    if (popUsed(state) >= POP_CAP[state.tcLevel]) return;
    for (const [t, n] of Object.entries(recipe.inputs)) consume(state, stack, t, n);
    const parent = findCardOf(state, stack.cards, "town_centre");
    emitOntoAttachment(state, parent, "villager");
  }
}

function processWork(state) {
  const workers = Object.values(state.work);
  for (const job of workers) {
    const stack = state.stacks[job.stackId];
    if (!stack) continue;
    job.progress += 1;
    if (job.progress < job.total) continue;
    job.progress = 0;
    if (job.recipeId) {
      const recipe = RECIPES.find((r) => r.id === job.recipeId);
      if (recipe) finishCraft(state, stack, recipe);
    } else if (job.nodeCardId) {
      const node = state.cards[job.nodeCardId];
      if (!node) continue;
      const y = def(node.type).yield;
      const type = y === "rock" ? yieldRock(state) : y;
      emitOntoAttachment(state, job.nodeCardId, type);
    }
  }
  rescanWork(state);
}

function eaters(state) {
  return Object.values(state.cards).filter((c) => isEater(c.type));
}

function unitStat(c) {
  return UNITS[c.type] || { hp: 1, atk: 0 };
}

function killCard(state, id) {
  delete state.cards[id];
  for (const stack of Object.values(state.stacks)) {
    const i = stack.cards.indexOf(id);
    if (i >= 0) stack.cards.splice(i, 1);
  }
  for (const row of state.formation) {
    for (let c = 0; c < 4; c++) {
      if (row[c] === id) row[c] = null;
    }
  }
  for (const [parent, sid] of Object.entries(state.attachments)) {
    const stack = state.stacks[sid];
    if (stack && stack.cards.length === 0) {
      delete state.stacks[sid];
      delete state.attachments[parent];
    }
  }
}

function consumeBerries(state, n) {
  let left = n;
  for (const stack of Object.values(state.stacks)) {
    for (let i = stack.cards.length - 1; i >= 0 && left > 0; i--) {
      if (cardType(state, stack.cards[i]) === "berries") {
        const id = stack.cards[i];
        stack.cards.splice(i, 1);
        delete state.cards[id];
        left -= 1;
      }
    }
  }
  return n - left;
}

function starve(state, count) {
  const list = eaters(state).slice();
  list.sort((a, b) => {
    const ua = unitStat(a);
    const ub = unitStat(b);
    if (ua.atk !== ub.atk) return ua.atk - ub.atk;
    if (ua.hp !== ub.hp) return ua.hp - ub.hp;
    return a.id - b.id;
  });
  const dead = [];
  for (let i = 0; i < count && i < list.length; i++) {
    dead.push(list[i].id);
    killCard(state, list[i].id);
  }
  return dead;
}

function runFood(state) {
  const need = eaters(state).length * FOOD_PER_UNIT;
  const have = berryCount(state);
  const eaten = consumeBerries(state, Math.min(need, have));
  const short = need - eaten;
  const dead = short > 0 ? starve(state, short) : [];
  return { need, have, short, dead };
}

function makeCombatant(id, type, side, row, col) {
  const u = UNITS[type];
  return {
    id,
    type,
    side,
    row,
    col,
    hp: u.hp,
    hpMax: u.hp,
    atk: u.atk,
    interval: u.interval,
    cooldown: u.interval,
    range: u.range,
    counter: u.counter,
  };
}

function living(side) {
  return side.filter((u) => u.hp > 0);
}

function isFront(unit, allies) {
  return !living(allies).some((a) => a.col === unit.col && a.row < unit.row);
}

function canStrike(unit, allies) {
  if (unit.range === "any") return true;
  return isFront(unit, allies);
}

function occupants(units, col) {
  return living(units)
    .filter((u) => u.col === col)
    .sort((a, b) => a.row - b.row);
}

function pickTarget(attacker, defenders) {
  const same = occupants(defenders, attacker.col);
  if (same.length) return same[0];
  let best = null;
  let bestD = 99;
  for (let col = 0; col < 4; col++) {
    const d = col > attacker.col ? col - attacker.col : attacker.col - col;
    if (d === 0) continue;
    const occ = occupants(defenders, col);
    if (occ.length && d < bestD) {
      bestD = d;
      best = occ[0];
    }
  }
  return best;
}

function dmgTo(attacker, defender) {
  let dmg = attacker.atk;
  if (attacker.counter && UNITS[defender.type] && attacker.counter === defender.type) {
    dmg = (dmg * 7) / 4;
  }
  return dmg;
}

function stepCombat(state) {
  const c = state.combat;
  c.tick += 1;
  const player = living(c.player);
  const enemy = living(c.enemy);
  const strikes = [];
  for (const u of player) {
    if (u.cooldown > 0) u.cooldown -= 1;
    if (u.cooldown === 0 && canStrike(u, c.player)) {
      const t = pickTarget(u, c.enemy);
      if (t) strikes.push({ from: u, to: t });
    }
  }
  for (const u of enemy) {
    if (u.cooldown > 0) u.cooldown -= 1;
    if (u.cooldown === 0 && canStrike(u, c.enemy)) {
      const t = pickTarget(u, c.player);
      if (t) strikes.push({ from: u, to: t });
    }
  }
  for (const s of strikes) {
    if (s.to.hp <= 0) continue;
    s.to.hp -= dmgTo(s.from, s.to);
    s.from.cooldown = s.from.interval;
  }
  const pAlive = living(c.player);
  const eAlive = living(c.enemy);
  if (eAlive.length === 0) {
    endCombat(state, true);
  } else if (pAlive.length === 0) {
    endCombat(state, false);
  } else if (c.tick >= 1200) {
    endCombat(state, false);
  }
}

function endCombat(state, won) {
  if (won) state.wins += 1;
  else state.losses += 1;
  const c = state.combat;
  const deadIds = new Set();
  for (const u of c.player) {
    if (u.hp <= 0) deadIds.add(u.id);
  }
  for (const id of deadIds) killCard(state, id);
  for (const row of state.formation) {
    for (let col = 0; col < 4; col++) {
      const id = row[col];
      if (id == null) continue;
      row[col] = null;
      if (!state.cards[id]) continue;
      addStack(state, [id]);
    }
  }
  state.combat = null;
  state.phase = "resolve";
  state.lastResult = won ? "win" : "loss";
  if (state.losses >= 3 || state.day >= 5) state.runOver = true;
}

function enterDusk(state) {
  state.phase = "dusk";
  state.food = runFood(state);
  rescanWork(state);
  const spec = DAYS[state.day - 1];
  if (!spec.enemy) {
    state.phase = "resolve";
    state.lastResult = "sleep";
  }
}

function startNight(state) {
  const spec = DAYS[state.day - 1];
  const player = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const id = state.formation[r][c];
      if (id == null || !state.cards[id]) continue;
      const t = cardType(state, id);
      if (!isFighter(t)) continue;
      player.push(makeCombatant(id, t, "player", r, c));
    }
  }
  const enemy = [];
  let e = -1;
  for (const u of spec.enemy || []) {
    enemy.push(makeCombatant(e, u.type, "enemy", u.row, u.col));
    e -= 1;
  }
  state.combat = { tick: 0, player, enemy };
  state.phase = "night";
}

function pruneEmpty(state) {
  for (const [id, stack] of Object.entries(state.stacks)) {
    if (stack.cards.length === 0) {
      delete state.stacks[id];
      for (const [p, sid] of Object.entries(state.attachments)) {
        if (Number(sid) === Number(id)) delete state.attachments[p];
      }
    }
  }
}

function findAvailable(state, type, used) {
  let best = null;
  let bestSize = Infinity;
  for (const stack of Object.values(state.stacks)) {
    if (stack.cards.length >= bestSize) continue;
    for (const id of stack.cards) {
      if (used.has(id)) continue;
      if (cardType(state, id) === type) {
        best = id;
        bestSize = stack.cards.length;
        break;
      }
    }
  }
  return best;
}

function autoCraft(state, recipeId) {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, reason: "unknown_recipe" };
  if (recipe.requireTc != null && state.tcLevel !== recipe.requireTc) {
    return { ok: false, reason: "wrong_tc" };
  }
  const used = new Set();
  let destStack = null;
  if (recipe.catalyst) {
    destStack = Object.values(state.stacks).find((s) =>
      s.cards.some((id) => cardType(state, id) === recipe.catalyst)
    );
    if (!destStack) return { ok: false, reason: "no_catalyst" };
    for (const id of destStack.cards) used.add(id);
  }
  const gathered = [];
  for (const [type, n] of Object.entries(recipe.inputs || {})) {
    for (let i = 0; i < n; i++) {
      const id = findAvailable(state, type, used);
      if (id == null) return { ok: false, reason: `missing_${type}` };
      used.add(id);
      gathered.push(id);
    }
  }
  if (recipe.worker) {
    const types = recipe.workerTypes || ["villager", "armed_villager"];
    let workerId = null;
    for (const t of types) {
      workerId = findAvailable(state, t, used);
      if (workerId != null) break;
    }
    if (workerId == null) return { ok: false, reason: "missing_worker" };
    used.add(workerId);
    gathered.push(workerId);
  }
  for (const id of gathered) {
    for (const stack of Object.values(state.stacks)) {
      const i = stack.cards.indexOf(id);
      if (i >= 0) {
        stack.cards.splice(i, 1);
        break;
      }
    }
  }
  if (destStack) {
    destStack.cards.push(...gathered);
  } else {
    addStack(state, gathered);
  }
  pruneEmpty(state);
  rescanWork(state);
  return { ok: true };
}

export function createSim(seed) {
  const s = seed >>> 0 || 1;
  const state = {
    seed: s,
    rng: { s },
    nextId: 1,
    day: 1,
    phase: "dawn",
    tick: 0,
    tcLevel: 1,
    wins: 0,
    losses: 0,
    rockYields: 0,
    flintSeen: 0,
    cards: Object.create(null),
    stacks: Object.create(null),
    attachments: Object.create(null),
    work: Object.create(null),
    formation: emptyGrid(),
    combat: null,
    food: null,
    lastResult: null,
    runOver: false,
    log: [],
  };
  for (const item of OPENING) {
    addStack(state, [addCard(state, item.type)]);
  }
  rescanWork(state);
  return state;
}

function stamp(state, cmd) {
  const t = state.phase === "day" || state.phase === "night" ? state.tick : 0;
  state.log.push({ ...cmd, tick: t, day: state.day, phase: state.phase });
}

const LEGAL = {
  dawn: new Set(["begin_day", "split", "merge", "detach"]),
  day: new Set(["split", "merge", "detach", "auto_craft"]),
  dusk: new Set(["split", "merge", "detach", "place_unit", "unplace_unit", "confirm_formation"]),
  night: new Set([]),
  resolve: new Set(["continue"]),
};

export function apply(state, cmd) {
  if (state.runOver && cmd.kind !== "continue") return { ok: false, reason: "run_over" };
  const legal = LEGAL[state.phase];
  if (!legal || !legal.has(cmd.kind)) return { ok: false, reason: "illegal" };

  if (cmd.kind === "begin_day") {
    state.phase = "day";
    state.tick = 0;
    state.food = null;
    state.lastResult = null;
    rescanWork(state);
    stamp(state, cmd);
    return { ok: true };
  }

  if (cmd.kind === "auto_craft") {
    const r = autoCraft(state, cmd.recipeId);
    if (r.ok) stamp(state, cmd);
    return r;
  }

  if (cmd.kind === "split") {
    const stack = state.stacks[cmd.stackId];
    if (!stack || cmd.index <= 0 || cmd.index >= stack.cards.length) {
      return { ok: false, reason: "bad_split" };
    }
    const taken = stack.cards.splice(cmd.index);
    const newStackId = addStack(state, taken);
    if (state.attachments) {
      for (const [p, sid] of Object.entries(state.attachments)) {
        if (Number(sid) === Number(cmd.stackId)) {
          delete state.attachments[p];
        }
      }
    }
    pruneEmpty(state);
    rescanWork(state);
    stamp(state, cmd);
    return { ok: true, newStackId };
  }

  if (cmd.kind === "merge") {
    const from = state.stacks[cmd.fromId];
    const onto = state.stacks[cmd.ontoId];
    if (!from || !onto || from === onto) return { ok: false, reason: "bad_merge" };
    onto.cards.push(...from.cards);
    delete state.stacks[from.id];
    for (const [p, sid] of Object.entries(state.attachments)) {
      if (Number(sid) === Number(from.id) || Number(sid) === Number(onto.id)) {
        delete state.attachments[p];
      }
    }
    pruneEmpty(state);
    rescanWork(state);
    stamp(state, cmd);
    return { ok: true };
  }

  if (cmd.kind === "detach") {
    for (const [p, sid] of Object.entries(state.attachments)) {
      if (Number(sid) === Number(cmd.stackId)) delete state.attachments[p];
    }
    stamp(state, cmd);
    return { ok: true };
  }

  if (cmd.kind === "place_unit") {
    const { cardId, row, col } = cmd;
    if (!state.cards[cardId] || !isFighter(cardType(state, cardId))) {
      return { ok: false, reason: "not_unit" };
    }
    if (row < 0 || row > 1 || col < 0 || col > 3) return { ok: false, reason: "slot" };
    const occ = state.formation[row][col];
    for (const r of state.formation) {
      for (let c = 0; c < 4; c++) if (r[c] === cardId) r[c] = null;
    }
    if (occ != null && occ !== cardId) {
      const dest = findStackOf(state, cardId);
      if (dest) {
        const i = dest.cards.indexOf(cardId);
        if (i >= 0) dest.cards.splice(i, 1);
      }
      addStack(state, [occ]);
    } else {
      const dest = findStackOf(state, cardId);
      if (dest) {
        const i = dest.cards.indexOf(cardId);
        if (i >= 0) dest.cards.splice(i, 1);
      }
    }
    state.formation[row][col] = cardId;
    pruneEmpty(state);
    rescanWork(state);
    stamp(state, cmd);
    return { ok: true };
  }

  if (cmd.kind === "unplace_unit") {
    let found = false;
    for (const r of state.formation) {
      for (let c = 0; c < 4; c++) {
        if (r[c] === cmd.cardId) {
          r[c] = null;
          found = true;
        }
      }
    }
    if (!found || !state.cards[cmd.cardId]) return { ok: false, reason: "not_placed" };
    addStack(state, [cmd.cardId]);
    stamp(state, cmd);
    return { ok: true };
  }

  if (cmd.kind === "confirm_formation") {
    startNight(state);
    stamp(state, cmd);
    return { ok: true };
  }

  if (cmd.kind === "continue") {
    if (state.runOver) {
      stamp(state, cmd);
      return { ok: true, restart: true };
    }
    state.day += 1;
    if (state.day > 5) {
      state.runOver = true;
      stamp(state, cmd);
      return { ok: true };
    }
    state.phase = "dawn";
    state.tick = 0;
    state.formation = emptyGrid();
    state.combat = null;
    rescanWork(state);
    stamp(state, cmd);
    return { ok: true };
  }

  return { ok: false, reason: "unknown" };
}

function findStackOf(state, cardId) {
  for (const stack of Object.values(state.stacks)) {
    if (stack.cards.includes(cardId)) return stack;
  }
  return null;
}

export function step(state, ticks) {
  const n = ticks | 0;
  for (let i = 0; i < n; i++) {
    if (state.phase === "day") {
      state.tick += 1;
      processWork(state);
    } else if (state.phase === "night") {
      stepCombat(state);
    }
  }
}

export function getSnapshot(state) {
  const stacks = Object.values(state.stacks).map((s) => ({
    id: s.id,
    cards: s.cards.map((id) => ({
      id,
      type: state.cards[id].type,
      name: def(state.cards[id].type).name,
      kind: def(state.cards[id].type).kind,
      icon: def(state.cards[id].type).icon,
    })),
  }));
  const work = Object.values(state.work).map((w) => {
    return {
      stackId: w.stackId,
      progress: w.progress,
      total: w.total,
      label: w.label,
    };
  });
  const parentOf = Object.create(null);
  for (const [p, sid] of Object.entries(state.attachments)) {
    parentOf[sid] = Number(p);
  }
  return {
    seed: state.seed,
    day: state.day,
    phase: state.phase,
    tick: state.tick,
    dayTicks: DAY_TICKS,
    tcLevel: state.tcLevel,
    popUsed: popUsed(state),
    popCap: POP_CAP[state.tcLevel],
    berries: berryCount(state),
    wins: state.wins,
    losses: state.losses,
    food: state.food,
    lastResult: state.lastResult,
    runOver: state.runOver,
    nightText: DAYS[state.day - 1] ? DAYS[state.day - 1].nightText : "",
    enemyPreview: DAYS[state.day - 1] ? DAYS[state.day - 1].enemy : null,
    stacks,
    work,
    parentOf,
    formation: state.formation.map((row) => row.slice()),
    combat: state.combat
      ? {
          tick: state.combat.tick,
          player: state.combat.player.map((u) => ({ ...u })),
          enemy: state.combat.enemy.map((u) => ({ ...u })),
        }
      : null,
  };
}

export function replay(seed, commands) {
  const state = createSim(seed);
  let i = 0;
  const cmds = commands.slice();
  while (i < cmds.length || state.phase === "day" || state.phase === "night") {
    while (i < cmds.length) {
      const c = cmds[i];
      const at = c.tick | 0;
      if (c.day !== state.day) break;
      if ((state.phase === "day" || state.phase === "night") && state.tick < at) break;
      apply(state, c);
      i += 1;
    }
    if (state.phase === "day" || state.phase === "night") step(state, 1);
    else break;
  }
  return state;
}
