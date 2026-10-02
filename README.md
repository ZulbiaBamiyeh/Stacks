# Stackbrawl

An async PvP autobattler on a Stacklands-style tabletop, rendered with three.js.
Buy packs, stack cards to combine them, put units on your wall, then fight a
ghost of another player's fortress. Reach 10 wins before 3 losses.

The original design doc is [`docs/card-roster.md`](docs/card-roster.md). The
live roster (every card, recipe and pack as the code has them) is generated into
[`docs/roster-generated.md`](docs/roster-generated.md) by `node tools/roster.mjs`.

Changes from the design doc so far:

- **Burn halves each tick** (rounded up) instead of losing 1 stack, so stacking
  burn grows linearly instead of snowballing.
- **Track packs hold only tier-1 base creatures** plus ingredients. Each base
  (Flame Imp, Salamander, Plague Rat, Smith, ...) has its own upgrade routes.
- **Eaters**: Cinder Maw (fire), Bog Maw (poison), Sapling (heal) and Goldbug
  (gold) grow when you drop their food on them and evolve after 5 and 12 meals.
- **Neighbour auras** (Smith, Torchbearer, Vineling, ...) buff the units either
  side of them on the wall.
- **Detonate and convert**: Pyre Keeper and Fester deal damage equal to enemy
  burn or poison; Plague Doctor turns enemy burn into poison.

## Run it

No build step. Serve the folder with any static server:

```sh
npm start            # npx http-server on http://localhost:8080
# or: python3 -m http.server 8080
```

Then open `http://localhost:8080`. Run the rules tests with `npm test`.

## Adding card art

Everything except the card art is drawn in code. To give a card art:

1. Put the image in `art/cards/` (square works best, e.g. 512×512; it is
   cover-fitted into the rounded art window).
2. Add a line to `art/cards/manifest.json`: `"cardId": "file.png"`.

Card ids are the keys in `src/content.js` (e.g. `fireMage`, `scorpionQueen`).
Open `tools/card-sheet.html` to see every card, its id, and whether it has art.
Cards without art fall back to placeholder doodles.

## Layout

| Path | What |
| --- | --- |
| `src/content.js` | The whole roster: ingredients, units, recipes, packs, tracks, rules |
| `src/sim.js` | Deterministic battle simulation (pure JS, no DOM) |
| `src/run.js` | Run state: gold, shop, packs, combining, wall, day flow |
| `src/ghosts.js` | Async opponents: local ghost pool + bot builder. Swap for a server here |
| `src/main.js` | Game controller: input, shop actions, combine timing, battle playback |
| `src/ui.js` | HTML HUD, hover info, toasts, modals, fortress bars |
| `src/audio.js` | Synthesized sound effects |
| `src/gfx/world.js` | Scene, camera, board, towers, wall, shop tiles, layout constants |
| `src/gfx/card.js` | Card mesh, spring motion, tilt, flip, bars; art loading |
| `src/gfx/draw.js` | Canvas drawing: card faces, icons, packs, board and forest textures |
| `src/gfx/fx.js` | Particles, projectiles, floating numbers, shield domes |
| `vendor/three/` | three.js r186, loaded through an import map |
| `test/` | Node tests for the sim and run rules |

Runs are saved in `localStorage`, along with discovered recipes and the ghost
pool (your own past walls, which later runs can face).
