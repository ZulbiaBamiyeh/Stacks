# Balance and archetypes

Measured with `node tools/balance.mjs`: random walls drawn from each archetype's
card pool at equal tier budgets (early day 3, mid day 6, late day 9), played
round-robin with shuffled slot order. Numbers are each archetype's average win
rate against the other nine. `npm test` fails if any archetype leaves 20–80%
mid or late game.

| Archetype | Early | Mid | Late | Wins by | Beats | Struggles against |
| --- | --- | --- | --- | --- | --- | --- |
| Burn | 64% | 39% | 50% | Fast stacking burn that halves each tick | Poison, Heal, Luck | Attack, Bones, Desperado |
| Poison | 55% | 51% | 45% | Stacks that never fade; healing can't remove them | Heal (98%), Desperado | Burn, Attack, Bones |
| Freeze | 51% | 43% | 59% | Locking the enemy's best units, then punishing frozen ones | Heal, Desperado, Wolves | Sand, Bones |
| Heal | 38% | 40% | 46% | Out-sustaining, with damage riders (Grove Spirit, Sun Sprite, Paladin) | Attack, Wolves, Desperado | Poison, Freeze, Bones |
| Attack | 50% | 59% | 58% | Reliable direct damage; shield breakers and executes | Burn, Poison, Desperado | Heal, Sand |
| Wolves | 66% | 42% | 34% | Early pack tempo; Alpha rallies, Wolf Pack bites per wolf | Poison, Burn | Bones, Attack, Sand |
| Luck | 70% | 59% | 44% | Crits; Gambler and High Roller feed on Luck | Heal, Sand, Wolves | Attack, Bones |
| Sand | 22% | 52% | 57% | Misses (2% per stack, max 30%) that ramp up, Sandworm cash-in | Freeze, Burn, Wolves | Luck, Heal |
| Bones | 19% | 67% | 53% | Units that grow after every fight | Wolves, Burn, Poison | Attack, Desperado (mid), Sand |
| Desperado | 54% | 50% | 40% | Damage that doubles below 50% HP; Warlock pays HP | Bones, Wolves, Poison | Heal, Attack |

Early game, Bones and Sand are deliberately weak: both ramp (permanent bonuses,
Sand stacks), so taking them is a bet on the long game. Wolves and Luck are the
strong openers that fall off.

## Rules tuned in this pass

- Burn halves each tick (`RULES.burnDecay`).
- Luck: 2% crit per stack, max 60% (`RULES.luckCrit`).
- Sand: 2% miss per stack, max 30% (`RULES.sandMiss`, `RULES.sandCap`).
- "Per ally" and "per enemy stack" bonuses have caps, so no synergy grows
  without limit (Wolf, Scorpion Swarm, Plague Rat, Storm Caller, Sandworm ...).

## Tools

- `node tools/balance.mjs [samples]` — archetype round-robin (edit `POOLS` to
  change which cards define a build).
- `node tools/power.mjs [tier]` — each card's solo output per second.
- `node tools/audit.mjs` — cards that are just plain numbers sharing a shape.
