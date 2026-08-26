# Working title: HOLDFAST
### A card-stacking, pauseable-realtime, async PvP autobattler

---

## 1. Pitch

**The fun part of an RTS build order, without the hands.**

You have five in-game days to turn a patch of dirt into an army. You assign villagers, discover recipes, pick a tech path, and decide — over and over — whether to spend this day on economy or on soldiers. Then the day ends, a ghost army from another player's run marches in, and you watch it resolve.

Cozy to play. Vicious to solve.

---

## 2. Design pillars

These are the tiebreakers. When a feature conflicts with one of these, the feature loses.

1. **The decision is the timing, not the clicking.** Every point of tension should come from *when* you commit a resource, never from how fast you can drag a card.
2. **Deterministic fights.** The player must always be able to reconstruct why they lost. No combat dice, ever.
3. **Visible depth, not hidden depth.** All recipes are public from turn one. Difficulty comes from what you can *afford*, not what you've *found*.
4. **No solved build order.** Every run must inject enough variance that yesterday's optimal line is wrong today.
5. **Cozy surface, competitive core.** It should look like a game you play in bed. It should be a game you can be genuinely good at.

---

## 3. Core loop

```
DAY (real-time, pauseable, ~90s)
  assign villagers to nodes
  stack cards to craft
  spend on tech / buildings
  ↓
DUSK
  freeze board, arrange formation
  ↓
NIGHT
  deterministic battle vs. ghost
  ↓
resolve → reward/penalty → next day
```

Five days, five fights. Run ends at 5 wins or 3 losses.

Short runs are non-negotiable. A run must fit in 15 minutes or the async structure never gets tested properly.

---

## 4. Time, interaction, and population

### 4.1 Assignment persistence — the most important rule in the document

**A villager assigned to a node keeps working that node until reassigned.**

This is the single biggest departure from Stacklands, and it's the thing that makes the game chill. In Stacklands a villager completes one task and stops, which is where 90% of the tedium complaints come from. Here, drop a villager on a berry bush and they produce berries every N ticks forever.

The player's unit of interaction becomes *"who is assigned where"* — a decision you revisit maybe 4–6 times per day, not 40.

### 4.2 Pause, and free reassignment

Space bar pauses. You can rearrange freely while paused, **and you can reassign villagers at any point during the day.** Nothing is locked.

**Pause must not be a skill expression.** Because assignments persist, there is no advantage to pause-scrubbing — there's nothing to micro. If playtesting reveals players pausing every two seconds to squeeze value out, something has leaked into the design that violates Pillar 1 and must be cut.

*Fallback if it does leak:* lock villager assignment at dawn (commit for the whole day) while leaving crafting free. Crafting can't be scrubbed for advantage — wood+flint at tick 10 and tick 80 make the same spear — so this kills the exploit without making the day passive. Hold this in reserve; don't build it until the problem shows up.

### 4.3 Output collection

Produced cards spawn in a tidy stack attached to the node. **They do not scatter.** Board entropy is a bug, not a feature.

### 4.4 Day length

Two constraints fight here: the day must be long enough to feel unhurried, short enough that a full run fits in one sitting.

**Starting numbers: 60-second days, gather rate 1 resource per 10s per villager.**

The number that actually matters is **resources per day**, not seconds — tune whichever is convenient:

```
resources/day = (day_length / gather_rate) × villagers
day 1:  (60 / 10) × 2 = 12
day 3:  (60 / 10) × 4 = 24
day 5:  (60 / 10) × 6 = 36
```

Each day is preceded by an **untimed dawn phase** — board frozen, plan as long as you like, press *Begin Day* when ready. This is where the cosy lives. The 60s is the part where you watch the plan land, not the part where you think.

Full run at 5 days: ~5 min of day time, plus dawn planning, plus five ~20s fights ≈ **12–15 minutes**. That is the target. If runs creep past 20 minutes, cut days before you cut day length.

### 4.5 Population and the Town Centre

The Town Centre is a card on the board with levels. It is the **only** source of population cap, and cap covers villagers *and* soldiers.

| TC level | Cost to upgrade | Pop cap |
|---|---|---|
| 1 (start) | — | 2 |
| 2 | 6 Wood, 3 Stone | 4 |
| 3 | 12 Wood, 8 Stone | 6 |
| 4 | 20 Wood, 15 Stone | 8 |

**A new villager costs 4 Berries** and requires a free cap slot. So growth has two gates — a materials gate (the TC) and a food gate (berries) — and they pull on different resources, which keeps the decision from collapsing into "just get wood."

**Upgrading takes labour.** A villager must be attached to the TC for the duration of the upgrade and produces nothing while doing it. That third cost is the important one: it's what makes "grow now or grow later" a genuine build-order question rather than an arithmetic one.

**Soldiers are converted villagers.** Every soldier is a villager who stopped gathering, still eats, and still occupies a cap slot. This makes the economy-versus-army choice literal rather than thematic, and it's the spine of the whole game.

**Food drain scales with pop:** 1 Berry per unit per night, soldiers included. This is the natural brake on villager spam — no separate mechanic needed.

---

## 5. Resources and crafting

### 5.1 Recipes are public

Full recipe book from the first run, including recipes you can't make yet, greyed out with missing ingredients highlighted.

Rationale: Sokpop tried hidden recipes three separate ways in Stacklands and abandoned all of them — rediscovery made runs sluggish, and gating combos behind Idea cards felt arbitrary. Discovery is also a one-time resource that gets wiki'd in a week, which is fatal for a game meant to be replayed hundreds of times.

Depth comes from *combinatorics under scarcity*, Backpack Battles style: you can see all twelve things you could build, you have materials for two, and the choice is a real one every single time.

### 5.2 Crafting is stacking

Drag cards onto each other. Valid combinations resolve after a short work timer if a villager is attached. Same tactile grammar as Stacklands — this part is proven, don't reinvent it.

### 5.3 Chain depth

Keep it shallow: raw → refined → equipment. Three tiers max.

```
Tree      → Wood     → Spear (Wood + Flint)
Rock      → Flint    → Shield (Wood + Hide)
Boar      → Hide     → Bow (Wood + Sinew)
          → Sinew
Berry Bush→ Berries  (food, no refinement)
```

Deep chains look impressive in a design doc and feel like homework in play.

---

## 6. Anti-solve: randomness injection

Without this the production tree has one perfect sequence, everyone finds it, and matches are decided by who executes it faster. This is a load-bearing system, not flavour.

Three injection points, in priority order:

**A. Starting biome (highest impact).** Each run rolls one of a small set of biomes that determine which resource nodes exist. Forest is wood-rich and hide-poor; steppe has horses and no timber. This reshapes the whole tech path before the player makes a single decision.

**B. Daily offer.** At dawn, three cards are offered, pick one. Mix of resource nodes, villagers, equipment, and tech unlocks. This is the tuning dial — it's how you keep runs varied without touching the biome table.

**C. Node yield variance (lowest impact).** A tree usually gives wood, occasionally an acorn or a sapling. Small, cosmetic-ish, adds texture. Do *not* let this decide games.

Note that A and B are variance in *what you can build*. Nothing here is variance in *whether your plan works* — that's Pillar 2's job to prevent.

---

## 7. Combat

### 7.1 Model

Deterministic, tick-based, no RNG. Given two loadouts, the outcome is fixed.

- Battlefield is **two rows × four columns** per side.
- Each unit has: `hp`, `atk`, `interval` (ticks between attacks), `range` (front/any), `type`.
- Every tick, units whose cooldown has elapsed strike their current target.
- Front row is targeted first; back row only when its column's front slot is empty.
- Simultaneous resolution — no initiative order, so no hidden turn-order rules to learn.

### 7.2 Counter triangle

Straight from Age of Empires, because it's decades-balanced and every player already knows it:

| Unit | Beats | Loses to |
|---|---|---|
| Spearman | Cavalry | Archer |
| Archer | Spearman | Cavalry |
| Cavalry | Archer | Spearman |

Counter multiplier: **×1.75 damage**. Big enough to matter, small enough that mass isn't worthless.

Mechanics aren't copyrightable and this one is universally legible. Free lunch — take it.

### 7.3 Formation is the pre-battle decision

At dusk, drag units into the 2×4 grid. This is the last decision before resolution and it should feel like the payoff for the whole day.

Two hard requirements, both learned from watching a competitor fail them:
- Units must be **individually removable** from the grid, not clear-all-and-restart.
- **Stats visible on deployed units**, on hover, without picking them up.

### 7.4 The differentiator: Priests

Everyone's autobattler has a counter triangle. The thing worth building the game around is **conversion**.

A Priest does no damage. Every N ticks it converts the lowest-HP enemy unit to your side, permanently, for the rest of the fight. Slow, unreliable against a wide board, devastating against a stacked one.

Why this earns its place:
- Creates a win condition that isn't "have more stats."
- Punishes the dominant strategy of dumping everything into one super-unit.
- Makes tech choice matter more than tech *volume*.

**Prototype this early, not as a tier-3 unlock.** If conversion isn't fun, the game is a counter-triangle autobattler like every other one, and you should know that in week two rather than month five.

---

## 8. Async ghosts

- On finishing a day, snapshot the player's formation + unit stats. That's the ghost.
- Ghosts are matched on `(run_day, win_count)` so a day-3 player at 2 wins faces another day-3 player at 2 wins.
- Ghosts are **static**. No opponent AI. The recorded formation fights exactly as it was arranged.
- Seed the pool with a few hundred hand-built ghosts so day-one players aren't fighting emptiness.

**Ghosts are compared, not simulated live.** Store the loadout, run the sim locally, both sides get the same answer because the sim is deterministic.

---

## 9. V0 prototype scope

The one question V0 exists to answer:

> **Is "third villager or first spearman?" a tense decision when I can watch the fight resolve?**

If yes, the game works and everything else is content. If no, no amount of biomes or artifacts will rescue it.

### Ship exactly this

- **1 biome** (forest). No biome roll.
- **3 node types**: Berry Bush → Berries. Tree → Wood. Rock → Stone (70%) / Flint (30%).
- **Town Centre**, levels 1–3 only.
- **1 building**: Barracks (8 Wood, 4 Stone).
- **3 unit types**: Villager, Spearman, Archer. (Cavalry the moment the triangle proves out — a triangle needs three legs. Priest right after.)
- **2 equipment recipes**: Spear (2 Wood + 1 Flint), Bow (3 Wood + 1 Flint).
- **5 days**, fixed hand-built opponents. **No matchmaking, no networking, no ghost recording.**
- Food check at dusk: 1 Berry per unit. Shortfall = lose a unit.
- Full recipe book visible.
- Pause, and 2× speed.

### The two-tier military ladder

This is what makes an early fight survivable without a Barracks:

| | Recipe | HP | ATK | Interval | Counters? |
|---|---|---|---|---|---|
| Villager | — | 6 | 1 | 30t | no |
| Armed Villager | Villager + Spear | 10 | 2 | 24t | no |
| Spearman | Villager + Spear, **at Barracks** | 20 | 5 | 20t | yes |
| Archer | Villager + Bow, **at Barracks** | 14 | 4 | 24t | yes |

Anyone can pick up a spear and swing it badly. The Barracks is what turns a farmhand into a soldier who understands the counter triangle. Cheap fights are winnable on day 2 without committing 12 resources to a building; real fights are not.

### The opening, day by day

Days 1–2 are PvE nibbles. **Day 3 is the first player ghost.** Combat shows up early enough to teach the rhythm, but the stakes don't.

**Day 1 — 2 villagers, ~12 resources. No combat.**
Dawn offer is three resource nodes, pick one. Two live lines:
- *Eco:* upgrade TC to Lv2 (6 Wood, 3 Stone) with a villager tied up building it. Leaves ~1 spare after the 2-berry food check. Tight on purpose.
- *Rush:* bank wood toward a day-2 Barracks, stay at cap 2, be poor but armed early.

Night text: *the village sleeps.* No fight. Let the first day be entirely about watching the board fill.

**Day 2 — 2–4 villagers, ~12–24 resources. First combat: 1 Wolf (HP 8, ATK 2).**
Beatable by a single Armed Villager, i.e. 2 Wood + 1 Flint. The lesson is *a small threat has a small answer* — you do not need to panic-build.
Eco player recruits 2 villagers (8 Berries) and arms one. Rush player already has three armed villagers and coasts.

**Day 3 — first ghost. Expect ~4 villagers, a Barracks, 2 real units.**
Seed opponent: 2 Spearmen, front row, nothing else. Loseable to an all-eco player, comfortably beaten by anyone who built a Barracks. That asymmetry is the whole point of the run — day 3 is where the day-1 choice gets its verdict.

Days 4–5 escalate to 4-unit and 6-unit formations with mixed types, so the counter triangle starts mattering.

**What to watch in the first playtest:** whether the day-1 eco line is simply correct. If nobody ever rushes, the day-3 opponent is too weak and needs to be stronger. If everyone rushes, the TC upgrade costs too much. That single dial is most of your early balancing.

### Explicitly NOT in V0

Archaeology · artifacts · spells · mages · biomes · randomised research · shops · hidden recipes · meta-progression · matchmaking · networking · sound · art beyond coloured rectangles with text.

Every one of these is a real idea worth building **after** the core decision proves tense. Building any of them first is how the project dies.

---

## 10. Engine notes

You're writing the engine, so these constraints matter more than the content above — they're expensive to retrofit.

### 10.1 Hard separation: sim and view

The simulation must run headless with no reference to rendering, input, or engine timing. If you can't run a full 5-day match in a unit test in under a millisecond, the architecture is wrong.

This buys you: replays, ghost verification, automated balance sweeps, and the ability to run ten thousand matchups overnight to find degenerate builds.

### 10.2 Fixed-point or integer math only

No floats in the sim. Floats drift across platforms and browsers, and a ghost that resolves differently on the opponent's machine than on yours is a class of bug you will never enjoy debugging. Damage, HP, and cooldowns are all integers. The ×1.75 counter multiplier is `(dmg * 7) / 4`.

### 10.3 Fixed tick rate

Sim advances at a fixed rate (60 ticks/sec is fine). Rendering interpolates. Pause stops tick accumulation and nothing else. 2× speed doubles ticks consumed per frame — it never changes tick size.

### 10.4 Everything is seeded

One RNG stream per run, seeded explicitly, threaded through the sim state — never a global. `run_seed` alone should reproduce a full run given the same inputs.

### 10.5 Days are command logs

Store a day as `(seed, ordered list of player commands with tick stamps)`. This gives you free replays, free bug reports ("send me your run seed"), and a cheap ghost format.

### 10.6 Content is data, not code

Cards, recipes, units, and biomes live in a data file the sim loads. You will retune numbers hundreds of times; recompiling for each is a tax you'll pay every day of the project.

---

## 11. Open questions for V0 to answer

1. Is the economy-vs-army timing decision tense, or is there an obvious dominant line?
2. Does assignment persistence make it too passive? (Risk: you assign four villagers on day one and have nothing to do.)
3. Is 90 seconds per day right? Too short and it's frantic; too long and it's idle.
4. Do fights read? Can a player watch a loss and articulate why?
5. Is losing a fight interesting, or does it just feel like falling behind?

Question 5 is the sleeper. Most economy-plus-PvP games snowball — one loss compounds into three. If that shows up in V0, the run structure needs a catch-up valve before anything else gets built.
