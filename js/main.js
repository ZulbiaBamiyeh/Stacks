import { CARDS, RECIPES, RECIPE_BOOK, TICK_RATE } from "./content.js";
import { ART } from "./icons.js";
import { createSim, apply, step, getSnapshot } from "./sim.js";
import { createView } from "./view.js";

const board = document.getElementById("board");
const hud = {
  day: document.getElementById("hud-day"),
  clock: document.getElementById("hud-clock"),
  stats: document.getElementById("hud-stats"),
  pause: document.getElementById("btn-pause"),
  speed: document.getElementById("btn-speed"),
  book: document.getElementById("btn-book"),
  seed: document.getElementById("hud-seed"),
};
const overlay = document.getElementById("overlay");
const bookEl = document.getElementById("book");
const battlefieldEl = document.getElementById("battlefield");

let sim = createSim((Math.random() * 0xffffffff) >>> 0);
apply(sim, { kind: "begin_day" });
let paused = false;
let speed = 1;
let acc = 0;
let last = performance.now();
let bookOpen = false;
let duskArmed = false;

let battleState = null;
let benchSelected = null;
const unitEls = new Map();
const unitPrev = new Map();
let lastCombatSnap = null;

const view = createView({
  board,
  onCommit(cmd) {
    return apply(sim, cmd);
  },
});

view.seedOpening(getSnapshot(sim));


function globalCounts(snap) {
  const counts = Object.create(null);
  for (const s of snap.stacks) for (const c of s.cards) counts[c.type] = (counts[c.type] || 0) + 1;
  return counts;
}

function canCraft(snap, recipe) {
  const counts = globalCounts(snap);
  if (recipe.requireTc != null && snap.tcLevel !== recipe.requireTc) return false;
  if (recipe.catalyst && !counts[recipe.catalyst]) return false;
  if (recipe.worker) {
    const types = recipe.workerTypes || ["villager", "armed_villager"];
    if (!types.some((t) => counts[t] > 0)) return false;
  }
  for (const [t, n] of Object.entries(recipe.inputs || {})) {
    if ((counts[t] || 0) < n) return false;
  }
  return true;
}

let recipeRowEls = [];

function paintRecipes() {
  bookEl.innerHTML = "<h2>Recipes</h2>";
  recipeRowEls = [];
  for (const r of RECIPE_BOOK) {
    const row = document.createElement("button");
    row.className = "recipe";
    row.innerHTML = `<strong></strong><span></span><em></em>`;
    row.querySelector("strong").textContent = r.name;
    row.querySelector("span").textContent = r.need;
    row.querySelector("em").textContent = r.out;
    row.addEventListener("click", () => {
      apply(sim, { kind: "auto_craft", recipeId: r.id });
      refreshRecipeStates();
      renderHud(getSnapshot(sim));
    });
    bookEl.appendChild(row);
    recipeRowEls.push({ id: r.id, el: row });
  }
  refreshRecipeStates();
}

function refreshRecipeStates() {
  if (!recipeRowEls.length) return;
  const snap = getSnapshot(sim);
  for (const { id, el } of recipeRowEls) {
    const recipe = RECIPES.find((x) => x.id === id);
    el.disabled = !(snap.phase === "day" && recipe && canCraft(snap, recipe));
  }
}

function showOverlay(htmlBuild) {
  overlay.classList.remove("hidden");
  overlay.innerHTML = "";
  htmlBuild(overlay);
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlay.innerHTML = "";
}

function dawnUI(snap) {
  showOverlay((root) => {
    const h = document.createElement("h2");
    h.textContent = `Dawn — Day ${snap.day}`;
    const p = document.createElement("p");
    p.textContent = "Arrange freely, then begin the day when you're ready.";
    const go = document.createElement("button");
    go.className = "btn-go";
    go.textContent = "Begin Day";
    go.addEventListener("click", () => {
      apply(sim, { kind: "begin_day" });
      hideOverlay();
      renderHud(getSnapshot(sim));
    });
    root.appendChild(h);
    root.appendChild(p);
    root.appendChild(go);
  });
}

function autoDeploy(snap) {
  const ids = [];
  for (const s of snap.stacks) {
    for (const c of s.cards) {
      if (CARDS[c.type] && CARDS[c.type].fights) ids.push(c.id);
    }
  }
  let i = 0;
  for (let r = 0; r < 2 && i < ids.length; r++) {
    for (let c = 0; c < 4 && i < ids.length; c++) {
      if (snap.formation[r][c] == null) {
        apply(sim, { kind: "place_unit", cardId: ids[i], row: r, col: c });
        i += 1;
      }
    }
  }
}

function duskUI(snap) {
  if (snap.phase === "resolve" && snap.lastResult === "sleep") {
    showOverlay((root) => {
      const h = document.createElement("h2");
      h.textContent = "Night";
      const p = document.createElement("p");
      p.textContent = snap.nightText;
      const food = document.createElement("p");
      food.className = "food-line";
      if (snap.food) {
        food.textContent =
          snap.food.short > 0
            ? `The village ate ${snap.food.need - snap.food.short} berries. ${snap.food.short} went hungry.`
            : `The village ate ${snap.food.need} berries.`;
      }
      const go = document.createElement("button");
      go.className = "btn-go";
      go.textContent = "Sleep";
      go.addEventListener("click", () => {
        apply(sim, { kind: "continue" });
        hideOverlay();
        renderHud(getSnapshot(sim));
      });
      root.appendChild(h);
      root.appendChild(p);
      root.appendChild(food);
      root.appendChild(go);
    });
    return;
  }

  if (snap.phase === "dusk") {
    showOverlay((root) => {
      const h = document.createElement("h2");
      h.textContent = "Dusk";
      const p = document.createElement("p");
      p.textContent = snap.nightText + " Deploy units on the field, then fight.";
      const food = document.createElement("p");
      food.className = "food-line";
      if (snap.food) {
        food.textContent =
          snap.food.short > 0
            ? `Ate ${snap.food.need - snap.food.short} berries. ${snap.food.dead.length} starved.`
            : `Ate ${snap.food.need} berries.`;
      }
      const go = document.createElement("button");
      go.className = "btn-go";
      go.textContent = "Fight";
      go.addEventListener("click", () => {
        apply(sim, { kind: "confirm_formation" });
        hideOverlay();
        renderHud(getSnapshot(sim));
      });
      root.appendChild(h);
      root.appendChild(p);
      root.appendChild(food);
      root.appendChild(go);
    });
    paintDuskField(snap);
    return;
  }
}

function buildBattlefield() {
  battlefieldEl.innerHTML = "";
  const title = document.createElement("div");
  title.className = "bf-title";
  battlefieldEl.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "bf-grid";

  const mkSide = (rowOrder) => {
    const side = document.createElement("div");
    side.className = "bf-side";
    const rows = {};
    for (const r of rowOrder) {
      const row = document.createElement("div");
      row.className = "bf-row";
      rows[r] = [];
      for (let c = 0; c < 4; c++) {
        const slot = document.createElement("div");
        slot.className = "bf-slot";
        row.appendChild(slot);
        rows[r].push(slot);
      }
      side.appendChild(row);
    }
    return { side, rows };
  };

  const playerSide = mkSide([1, 0]);
  const vs = document.createElement("div");
  vs.className = "bf-vs";
  vs.textContent = "VS";
  const enemySide = mkSide([0, 1]);

  grid.appendChild(playerSide.side);
  grid.appendChild(vs);
  grid.appendChild(enemySide.side);
  battlefieldEl.appendChild(grid);

  const bench = document.createElement("div");
  bench.className = "bf-bench";
  battlefieldEl.appendChild(bench);

  battleState = { title, playerSlots: playerSide.rows, enemySlots: enemySide.rows, bench };
}

function mkBfCard({ type, hp, hpMax, enemy }) {
  const d = CARDS[type];
  const el = document.createElement("div");
  el.className = "bf-card";
  el.dataset.kind = enemy ? "enemy" : d.kind;
  const src = ART[d.icon];
  el.innerHTML = `
    ${src ? `<img class="card-face" src="${src}" alt="" draggable="false">` : ""}
    <div class="bf-hp"><i></i></div>
    <div class="bf-name"></div>
  `;
  el.querySelector(".bf-name").textContent = d.name;
  const hpEl = el.querySelector(".bf-hp");
  if (hp != null && hpMax != null) {
    setHp(el, hp, hpMax);
  } else {
    hpEl.style.display = "none";
  }
  return el;
}

function setHp(el, hp, hpMax) {
  const pct = Math.max(0, (100 * hp) / hpMax);
  el.querySelector(".bf-hp i").style.width = `${pct}%`;
  el.classList.toggle("low", pct <= 50 && pct > 25);
  el.classList.toggle("crit", pct <= 25);
}

function paintDuskField(snap) {
  battleState.title.textContent = snap.nightText || "";

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const slot = battleState.playerSlots[r][c];
      slot.innerHTML = "";
      slot.onclick = null;
      const cardId = snap.formation[r][c];
      if (cardId != null) {
        const card = sim.cards[cardId];
        const el = mkBfCard({ type: card.type, enemy: false });
        el.onclick = () => {
          apply(sim, { kind: "unplace_unit", cardId });
          renderHud(getSnapshot(sim));
        };
        slot.appendChild(el);
      } else {
        slot.classList.add("clickable");
        slot.onclick = () => {
          if (benchSelected != null) {
            apply(sim, { kind: "place_unit", cardId: benchSelected, row: r, col: c });
            benchSelected = null;
            renderHud(getSnapshot(sim));
          }
        };
      }
    }
  }

  const enemySpec = snap.enemyPreview || [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const slot = battleState.enemySlots[r][c];
      slot.innerHTML = "";
      const spec = enemySpec.find((u) => u.row === r && u.col === c);
      if (spec) slot.appendChild(mkBfCard({ type: spec.type, enemy: true }));
    }
  }

  battleState.bench.innerHTML = "";
  const fighters = [];
  for (const s of snap.stacks) {
    for (const c of s.cards) {
      if (CARDS[c.type] && CARDS[c.type].fights) fighters.push(c);
    }
  }
  if (fighters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bf-bench-empty";
    empty.textContent = "Everyone is either placed or working the fields.";
    battleState.bench.appendChild(empty);
  }
  for (const c of fighters) {
    const d = CARDS[c.type];
    const btn = document.createElement("button");
    btn.className = "bf-bench-card";
    btn.dataset.kind = d.kind;
    const src = ART[d.icon];
    btn.innerHTML = src ? `<img class="card-face" src="${src}" alt="" draggable="false">` : "";
    btn.classList.toggle("selected", benchSelected === c.id);
    btn.onclick = () => {
      benchSelected = benchSelected === c.id ? null : c.id;
      renderHud(getSnapshot(sim));
    };
    battleState.bench.appendChild(btn);
  }
}

function paintNightField(snap) {
  battleState.title.textContent = snap.nightText || "Battle";
  const combat = snap.combat || lastCombatSnap;
  if (!combat) return;
  if (snap.combat) lastCombatSnap = snap.combat;

  battleState.bench.innerHTML = "";

  const seen = new Set();
  const place = (u, side) => {
    const key = `u${u.id}`;
    seen.add(key);
    const slotsObj = side === "player" ? battleState.playerSlots : battleState.enemySlots;
    const slot = slotsObj[u.row][u.col];
    let el = unitEls.get(key);
    const prev = unitPrev.get(key);
    if (!el) {
      slot.innerHTML = "";
      el = mkBfCard({ type: u.type, hp: u.hp, hpMax: u.hpMax, enemy: side === "enemy" });
      slot.appendChild(el);
      unitEls.set(key, el);
    } else {
      setHp(el, Math.max(0, u.hp), u.hpMax);
    }
    if (prev) {
      if (u.hp < prev.hp && u.hp > 0) {
        el.classList.remove("hurt");
        void el.offsetWidth;
        el.classList.add("hurt");
      }
      if (prev.cooldown === 0 && u.cooldown === u.interval) {
        const cls = side === "player" ? "attack-r" : "attack-l";
        el.classList.remove("attack-r", "attack-l");
        void el.offsetWidth;
        el.classList.add(cls);
      }
      if (prev.hp > 0 && u.hp <= 0) {
        el.classList.add("dying");
        setTimeout(() => {
          const dead = unitEls.get(key);
          if (dead) {
            dead.remove();
            unitEls.delete(key);
          }
        }, 600);
      }
    }
    unitPrev.set(key, { hp: u.hp, cooldown: u.cooldown });
  };

  for (const u of combat.player) place(u, "player");
  for (const u of combat.enemy) place(u, "enemy");

  for (const [key, el] of unitEls) {
    if (!seen.has(key) && !el.classList.contains("dying")) {
      el.remove();
      unitEls.delete(key);
      unitPrev.delete(key);
    }
  }
}

function resolveUI(snap) {
  showOverlay((root) => {
    const h = document.createElement("h2");
    const p = document.createElement("p");
    if (snap.runOver) {
      h.textContent = snap.losses >= 3 ? "The village fell." : "Five days held.";
      p.textContent = `${snap.wins} wins · ${snap.losses} losses`;
    } else if (snap.lastResult === "win") {
      h.textContent = "Held.";
      p.textContent = "The field is yours.";
    } else if (snap.lastResult === "loss") {
      h.textContent = "Driven back.";
      p.textContent = "The village still stands — for now.";
    } else {
      h.textContent = "Dawn soon.";
      p.textContent = snap.nightText;
    }
    const go = document.createElement("button");
    go.className = "btn-go";
    go.textContent = snap.runOver ? "New run" : "Continue";
    go.addEventListener("click", () => {
      const r = apply(sim, { kind: "continue" });
      if (r && r.restart) location.reload();
      hideOverlay();
      renderHud(getSnapshot(sim));
    });
    root.appendChild(h);
    root.appendChild(p);
    root.appendChild(go);
  });
}

function renderHud(snap) {
  hud.day.textContent = "Sandbox";
  hud.seed.textContent = `seed ${snap.seed}`;
  hud.stats.textContent = `Pop ${snap.popUsed}/${snap.popCap} · Hall ${snap.tcLevel}`;
  hud.clock.textContent = "";
  hud.pause.textContent = paused ? "Resume" : "Pause";
  hud.speed.textContent = speed === 1 ? "2×" : "1×";
  hud.speed.classList.toggle("on", speed !== 1);
  hud.pause.classList.toggle("on", paused);
  if (bookOpen) refreshRecipeStates();

  view.setInteractive(snap.phase === "dawn" || snap.phase === "day");
  view.reconcile(snap);

  if (snap.phase === "dusk" && !duskArmed) {
    duskArmed = true;
    buildBattlefield();
    unitEls.clear();
    unitPrev.clear();
    lastCombatSnap = null;
    benchSelected = null;
    autoDeploy(snap);
    snap = getSnapshot(sim);
    view.reconcile(snap);
  }
  if (snap.phase !== "dusk") duskArmed = false;

  if (snap.phase === "dawn") dawnUI(snap);
  else if (snap.phase === "dusk") duskUI(snap);
  else if (snap.phase === "resolve") resolveUI(snap);
  else if (snap.phase === "day") hideOverlay();

  const onBattleMap =
    snap.phase === "dusk" ||
    snap.phase === "night" ||
    (snap.phase === "resolve" && (snap.lastResult === "win" || snap.lastResult === "loss"));
  board.classList.toggle("hidden", onBattleMap);
  battlefieldEl.classList.toggle("hidden", !onBattleMap);
  if (onBattleMap && battleState) {
    if (snap.phase === "dusk") paintDuskField(snap);
    else paintNightField(snap);
  }

}

hud.pause.addEventListener("click", () => {
  paused = !paused;
  renderHud(getSnapshot(sim));
});
hud.speed.addEventListener("click", () => {
  speed = speed === 1 ? 2 : 1;
  renderHud(getSnapshot(sim));
});
hud.book.addEventListener("click", () => {
  bookOpen = !bookOpen;
  bookEl.classList.toggle("hidden", !bookOpen);
  if (bookOpen) paintRecipes();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    paused = !paused;
    renderHud(getSnapshot(sim));
  }
  if (e.key === "2") {
    speed = speed === 1 ? 2 : 1;
    renderHud(getSnapshot(sim));
  }
  if (e.key === "d" || e.key === "D") {
    const snap = getSnapshot(sim);
    navigator.clipboard?.writeText(JSON.stringify({ seed: snap.seed, log: sim.log }));
  }
});

window.__holdfast = {
  get sim() {
    return sim;
  },
  apply,
  step,
  snap() {
    return getSnapshot(sim);
  },
  view,
};

paintRecipes();
renderHud(getSnapshot(sim));

function frame(now) {
  view.pump(now);
  const snap0 = getSnapshot(sim);
  if ((snap0.phase === "day" || snap0.phase === "night") && !paused) {
    acc += (now - last) * speed;
    const stepMs = 1000 / TICK_RATE;
    let n = 0;
    while (acc >= stepMs && n < 8 * speed) {
      acc -= stepMs;
      step(sim, 1);
      n += 1;
    }
  }
  last = now;
  const snap = getSnapshot(sim);
  view.reconcile(snap);
  if (snap.phase === "day") {
    hud.stats.textContent = `Pop ${snap.popUsed}/${snap.popCap} · Hall ${snap.tcLevel}`;
    if (bookOpen) refreshRecipeStates();
  }
  if (snap.phase === "night" && battleState) paintNightField(snap);
  if (snap.phase === "dusk" || snap.phase === "resolve") {
    if (overlay.classList.contains("hidden")) renderHud(snap);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
