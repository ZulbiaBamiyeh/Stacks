# Stackbrawl — Base Game Card Roster

Oct 2, 2026 · @Ash

## Design targets

The base game needs about 10 ingredients, 4 base units, about 110 combined units and 13 rares. That is enough that one run sees roughly a quarter to a third of the roster, and a player needs 20–30 runs to discover everything.

A run ends at 10 wins or 3 losses, so it lasts 10 to 12 days. Assuming 2–3 packs and a few singles per day, a player touches about 80–100 cards per run and builds 15–25 combined units. With about 110 to find, most runs uncover something new.

Goals for the roster:

- **6–8 viable archetypes**, each with a distinct win condition and a clear weakness.
- **Every unit branches.** Most tier-2 cards lead to 2–4 different tier-3 cards, so a combine is a choice, not a destination.
- **Rares bend a rule rather than multiply numbers.** No flat doublers.
- **New ingredients unlock mid-run** (days 3, 4, 5, 7), so late days feel different from early ones.
- **Some rares are only reachable from other rares**, so a lucky early roll can define a run.

## Core rules

Each player has a fortress. Units on its walls act on their own cooldowns, and the first fortress to reach 0 HP loses.

- **Fortress HP:** 40 + 20 × day (day 1 = 60, day 6 = 160, day 12 = 280).
- **Wall slots:** 4 on days 1–3, 5 from day 4, 6 from day 7. Unused cards wait on the table (limit 10).
- **Sudden death:** from 30s, both fortresses take 1 damage per second, rising by 1 each second, ignoring shield.
- **Combining:** drop a card on another. If a recipe exists, both are consumed and the result appears. If not, nothing happens. Rare odds are shown before you drop; a failed roll gives the common result.
- **Scaling carries over:** permanent bonuses ("+1 after each fight") stay when that unit is combined further.

| Keyword | Rule |
| --- | --- |
| Damage | Hits the enemy fortress. Shield absorbs it first. |
| Shield | Absorbs damage. Does not decay. |
| Heal | Restores fortress HP up to max. Each heal also removes 10% of the burn, poison, Sand and Cold on you (rounded up, min 1 of each). |
| Burn | Ticks every 1s for damage equal to its stacks, then loses 1 stack. Hits shield first. |
| Poison | Ticks every 2s for damage equal to its stacks. Never decays. Ignores shield. |
| Freeze | Pauses one enemy unit's cooldown for the duration. |
| Haste | Your units' cooldowns run faster. Total haste caps at +50%. |
| Gold | Paid out at the end of the day, win or lose. |

## New mechanics

These turn units from stat sticks into engines. Triggers and Charge create chains; Luck, Bless, Sand and Heat give whole builds a resource to stack.

| Mechanic | Side | Rule |
| --- | --- | --- |
| Luck | Yours | Each stack gives your units +2% crit chance (max 60%). A crit doubles that action's number. Lasts the fight |
| Bless | Yours | A random friendly unit gets +1 to its main number (damage, heal, shield, burn, poison or Sand) for this fight. Can land on summons |
| Sand | Enemy | Each stack gives enemy units a 3% chance to miss damage, burn, poison, Sand and freeze (max 45%). Never decays. Heals and shields never miss |
| Heat | Yours | Each stack makes your units 2% faster (max +50%, separate from the haste cap). Never decays. Cold cancels it stack for stack |
| Charge | Yours | Instantly advances a friendly unit's cooldown by the stated seconds |
| Trigger | Either | "Whenever" effects fire on events: an enemy unit is frozen, an enemy action misses, enemy burn ticks, you crit, you heal, your shield is hit, a unit is summoned |
| Neighbours | Yours | Wall slots form a row. "Neighbour" effects only touch the units directly left and right |
| Summon | Yours | Puts a temporary unit into an empty wall slot for this fight only |
| Self-poison | Yours | Some cards poison your own fortress in exchange for power |

Like Backpack Battles, stacks never decay on their own. They are controlled by caps, by healing, and by spending:

- **Cold (enemy debuff):** each stack makes enemy units 2% slower (max 50%). It cancels the enemy's Heat stack for stack. Ice Mage adds 2 Cold per action, and Frost Fairy and Snow Queen add 1.
- **Spending:** some cards consume your Heat, Luck or shield, or the enemy's Sand, for a big payoff. Keeping stacks and cashing them in should feel like a real choice.

**New ingredient: Sand** (unlocks day 2, appears in the Desert Pack). Its theme is misses and desert creatures.

Guard rails:

- A missed action can't crit.
- A unit can't be frozen again for 1s after a freeze ends.
- Mirror can't copy Mirror. Djinn can't copy Djinn or Mirror.
- Summons don't count toward "after each fight" scaling.

## Economy and shop

You start with 10 gold and earn 8 per day, plus 2 for a win. There is no free pack: each day you choose between random packs (cheap per card, good for discovery) and shop singles (pricier, good for finishing a build).

| Item | Cost |
| --- | --- |
| Pack (3 cards) | 3 gold |
| Single unit | 3 gold |
| Single ingredient | 1 gold |
| Reroll shop | 1 gold |
| Sell | 1 gold per tier (tier 3 sells for 3) |

**Starting packs:**

- **Village Pack:** Villager, Wood, Stone, Berry, Coin.
- **Wild Pack:** Wolf, Fairy, Berry, Wood, Feather (day 4+).
- **Desert Pack:** Scorpion, Bone, Ember, Mushroom (day 3+).

The shop shows 4 singles drawn from everything unlocked so far.

**Feeding the shop:** drop ingredients onto the shop card to unlock themed packs for the rest of the run. Fed cards are consumed.

| Track | Fed | 5 fed unlocks | 12 fed unlocks |
| --- | --- | --- | --- |
| Flame | Ember | Flame Pack (4 gold) | Inferno Pack (6 gold), Ifrit chance |
| Tomb | Bone | Tomb Pack (4 gold) | Crypt Pack (6 gold), Tomb King chance |
| Grove | Berry | Grove Pack (4 gold) | Oasis Pack (6 gold), Simurgh chance |
| Caravan | Coin | Caravan Pack (4 gold) | Treasury Pack (6 gold), Dragon's Hoard chance |
| Forge | Stone | Quarry Pack (4 gold) | Foundry Pack (6 gold), Titan chance |

Tier-2 track packs have a 10% chance per pack to contain the track's rare. Track units appear only in their packs, never as shop singles.

## Balance budget

Every unit is costed in damage-per-second equivalents (DPS-e). Each tier roughly doubles the last, because each tier costs roughly double the cards.

| Tier | Cards to make | Budget (DPS-e) |
| --- | --- | --- |
| 1 | 1 | ~1 |
| 2 | 2 | ~2.5 |
| 3 | 3–4 | ~4.5 |
| 4 and rares | 4–6 | ~6, plus a rule-bending effect |

| Effect | Worth about |
| --- | --- |
| 1 damage | 1 |
| 1 shield, or 1 heal against no debuffs (heal is worth about 1 once it's cleansing stacks) | 0.8 |
| 1 burn | 1.5 alone, more when stacked with other burn |
| 1 poison | 4 on average (about 7 early in a fight, 2 late) |
| 1s freeze on one enemy unit | 1.5 |
| +10% haste | 10% of your board's output |

Rules of thumb:

- **Economy units** (gold, rare odds) sit about one tier lower in combat value, since they pay off across the run.
- **Scaling units** ("+1 after each fight") start about 30% under budget and pass it by day 6–7.
- **Poison units get long cooldowns**, because poison's value is front-loaded and permanent.
- **Conditional units** ("below 50% HP") get about 50% over budget while active.

## Ingredients and base units

Ingredients never fight. Each one pushes a unit toward a theme, so players learn what an ingredient "means" after a few runs.

| Ingredient | Unlocks | Theme |
| --- | --- | --- |
| Wood | Day 1 | Ranged attacks, trees |
| Stone | Day 1 | Shield |
| Berry | Day 1 | Healing |
| Bone | Day 1 | Undead, scaling |
| Ember | Day 1 | Burn |
| Coin | Day 1 | Gold |
| Mushroom | Day 3 | Poison spread, heal and poison hybrids |
| Feather | Day 4 | Speed, haste, ignoring shield |
| Crystal | Day 5 | Freeze, magic, rare odds |
| Moonstone | Day 7 | Low-HP payoffs, night creatures |

| Base unit | Effect | Role |
| --- | --- | --- |
| Villager | 2 damage every 2s | The hub: combines with almost everything |
| Wolf | 3 damage every 2.5s | Fast creature damage |
| Scorpion | 1 poison every 3s | Poison |
| Fairy | 2 heal every 2s | Healing and support |

## Villager tree

The Villager is the hub of the game: 10 tier-2 branches and the most paths to rares. It should almost never be a dead draw.

**Tier 2**

| Recipe | Result | Effect |
| --- | --- | --- |
| Villager + Wood | Archer | 3 damage every 1.2s |
| Villager + Stone | Guard | 6 shield every 2s |
| Villager + Berry | Healer | 6 heal every 2s |
| Villager + Ember | Fire Mage | 3 burn every 2s |
| Villager + Bone | Skeleton | 3 damage every 2s. +1 damage permanently after each fight |
| Villager + Coin | Merchant | 1 damage every 2s. +2 gold per day |
| Villager + Wolf | Hunter | 5 damage every 2s |
| Villager + Mushroom | Druid | 3 heal and 1 poison every 3s |
| Villager + Feather | Scout | 2 damage every 0.8s |
| Villager + Crystal | Mage | 5 damage every 2s |

**Tier 3**

| Recipe | Result | Effect |
| --- | --- | --- |
| Archer + Ember | Fire Archer | 3 damage and 1 burn every 1.2s |
| Archer + Wood | Ranger | 8 damage every 1.8s |
| Archer + Feather | Sharpshooter | 3 damage every 1s. Every 4th shot deals triple |
| Archer + Crystal | Frost Archer | 4 damage every 1.2s. Each hit freezes a random enemy unit for 0.5s |
| Guard + Stone | Knight | 5 damage every 2s and 5 shield every 2.5s. **20%: Dark Knight** |
| Guard + Berry | Paladin | 7 shield and 5 heal every 2.5s |
| Guard + Wood | Spearman | 4 damage every 1.5s and 4 shield every 3s |
| Guard + Crystal | Warden | 8 shield every 2s. Your units can't be frozen while you have shield |
| Healer + Berry | Shaman | 10 heal every 2.2s |
| Healer + Bone | Alchemist | Alternates 8 heal and 8 shield every 2s |
| Healer + Crystal | Oracle | 4 heal every 2s. Once per day, your next combine gets +20% rare odds |
| Fire Mage + Ember | Pyromancer | 6 burn every 2.5s |
| Fire Mage + Feather | Flame Dancer | 1 burn every 0.6s |
| Fire Mage + Bone | Ash Caller | 2 damage and 2 burn every 2s. +1 burn permanently after each fight |
| Skeleton + Bone | Necromancer | 1 poison every 3s. +1 poison per hit permanently after each fight |
| Skeleton + Stone | Bone Knight | 4 damage and 4 shield every 2s. +1 damage permanently after each fight |
| Merchant + Coin | Banker | No attack. At day's end, +1 gold per 5 gold held (max +4) |
| Merchant + Stone | Mercenary | Every 2s, deals 2 damage plus 1 per 3 gold held |
| Hunter + Wolf | Beastmaster | 4 damage every 2s. Your creatures get +25% haste |
| Hunter + Wood | Trapper | 4 damage every 2s. Freezes a random enemy unit for 1s every 4s |
| Druid + Bone | Hexer | 2 poison every 3s. **25%: Witch** |
| Druid + Berry | Grove Keeper | 6 heal and 1 poison every 2.5s |
| Druid + Mushroom | Spore Druid | Every 3s, adds poison equal to 20% of the enemy's current poison (min 1) |
| Scout + Feather | Windrunner | 2 damage every 0.8s. All your units get +10% haste |
| Scout + Wolf | Wolf Rider | 4 damage every 1s |
| Mage + Crystal | Ice Mage | 3 damage every 2s. Freezes the enemy's highest-tier unit for 1.5s every 4s |
| Mage + Feather | Storm Mage | 3 damage every 0.7s |
| Mage + Moonstone | Warlock | 6 damage every 2s. Double damage while your fortress is below 50% |

**Tier 4**

| Recipe | Result | Effect |
| --- | --- | --- |
| Knight + Stone | Champion | 8 damage every 2.5s and 8 shield every 3s |
| Knight + Ember | Flame Knight | 5 damage and 2 burn every 2s, 5 shield every 2.5s |
| Dark Knight + Bone | Death Knight | Dark Knight's effect, and each hit also applies 1 poison. Only reachable through Dark Knight |
| Pyromancer + Ember | Inferno Mage | 9 burn every 3s |
| Ice Mage + Crystal | Archmage | 4 damage every 2s. Freezes the 2 highest-tier enemy units for 1.5s every 4s |
| Necromancer + Moonstone | Wraith | Freezes the enemy's fastest unit for 1s every 3s. **20%: Lich** |
| Ranger + Feather | Hawkeye | 10 damage every 2s, ignores shield |

## Wolf tree

Wolves are the tempo line: fast damage, creature synergies, and two of the most exciting rares (Roc and Manticore).

**Tier 2**

| Recipe | Result | Effect |
| --- | --- | --- |
| Wolf + Wolf | Wolf Pack | 3 damage every 1.1s |
| Wolf + Ember | Hellhound | 4 damage and 1 burn every 2.5s |
| Wolf + Stone | Dire Wolf | 5 damage every 2.5s. Starts each fight with 10 shield |
| Wolf + Feather | Griffin | 4 damage every 1.5s, ignores shield |
| Wolf + Bone | Grave Wolf | 3 damage every 2s. +1 damage permanently after each fight |
| Wolf + Scorpion | Sand Stalker | 3 damage and 1 poison every 3s |
| Wolf + Moonstone | Werewolf | 5 damage every 2s. Double damage while your fortress is below 50% |

**Tier 3**

| Recipe | Result | Effect |
| --- | --- | --- |
| Wolf Pack + Wolf | Alpha | 4 damage every 1s. Your other creatures deal +1 damage |
| Hellhound + Ember | Cerberus | Every 3s, attacks 3 times for 3 damage and 1 burn each |
| Dire Wolf + Crystal | Frost Wolf | 5 damage every 2s. Each hit freezes a random enemy unit for 1s |
| Griffin + Feather | Sky Griffin | 4 damage every 1s, ignores shield. **15%: Roc** |
| Grave Wolf + Bone | Bone Hound | 4 damage every 1.5s. +1 damage permanently after each fight |
| Sand Stalker + Scorpion | Desert Stalker | 4 damage and 2 poison every 3s. **20%: Manticore** |
| Werewolf + Moonstone | Moonhowler | 4 damage every 1.5s. While below 50%, your creatures get +25% haste |

## Scorpion tree

Scorpions are the poison line: slow cooldowns, permanent stacks, and a strong late game that loses to fast builds.

**Tier 2**

| Recipe | Result | Effect |
| --- | --- | --- |
| Scorpion + Scorpion | Scorpion Swarm | 1 poison every 1.5s. **10%: Scorpion Queen** |
| Scorpion + Bone | Deathstalker | 2 poison every 3.5s |
| Scorpion + Ember | Fire Scorpion | 1 poison and 2 burn every 3s |
| Scorpion + Stone | Armored Scorpion | 1 poison every 3s and 5 shield every 2.5s |
| Scorpion + Mushroom | Spore Scorpion | 1 poison every 2.5s. Each hit adds +1 more per 10 poison the enemy has |
| Scorpion + Moonstone | Night Scorpion | 2 poison every 3s. Double poison while your fortress is below 50% |

**Tier 3**

| Recipe | Result | Effect |
| --- | --- | --- |
| Scorpion Swarm + Scorpion | Scorpion Nest | 2 poison every 1.8s |
| Deathstalker + Bone | Tomb Stalker | 2 poison every 3s. +1 poison per hit permanently after each fight |
| Fire Scorpion + Ember | Lava Scorpion | 2 poison and 3 burn every 3s |
| Armored Scorpion + Stone | Shell Scorpion | 2 poison every 3s and 10 shield every 3s |
| Spore Scorpion + Mushroom | Fungal Nest | Every 3s, adds poison equal to 15% of the enemy's current poison (min 2, max 6) |

## Fairy tree

Fairies are support: healing, haste, freeze and luck. They make other builds work rather than winning alone, apart from the Djinn.

**Tier 2**

| Recipe | Result | Effect |
| --- | --- | --- |
| Fairy + Fairy | Fairy Ring | 3 heal every 1.2s |
| Fairy + Berry | Dryad | 4 heal every 1.5s |
| Fairy + Wood | Treant | 6 shield and 2 heal every 2.5s |
| Fairy + Ember | Wisp | 2 burn every 2s. Freezes a random enemy unit for 1s every 4s |
| Fairy + Feather | Pixie | 2 heal every 2s. All your units get +10% haste |
| Fairy + Crystal | Frost Fairy | 2 heal every 3s. Freezes the enemy's highest-tier unit for 1.5s every 4s |
| Fairy + Mushroom | Spore Fairy | 2 heal and 1 poison every 2.5s |
| Fairy + Coin | Lucky Fairy | 2 heal every 2s. +5% rare odds while you own it |
| Fairy + Moonstone | Moon Fairy | 3 heal every 2s. Triple heal while your fortress is below 30% |

**Tier 3**

| Recipe | Result | Effect |
| --- | --- | --- |
| Fairy Ring + Fairy | Fairy Court | 3 heal every 1s. Each heal also gives 1 shield |
| Dryad + Berry | Grove Spirit | 7 heal every 1.5s |
| Treant + Wood | Elder Treant | 10 shield and 4 heal every 2.5s |
| Wisp + Ember | Will-o'-Wisp | 3 burn every 2s. Freezes a random enemy unit for 1s every 3s |
| Pixie + Feather | Wind Sprite | 2 damage every 1s. All your units get +20% haste |
| Pixie + Crystal | Sylph | 3 heal every 1.5s. **15%: Djinn** |
| Spore Fairy + Mushroom | Myconid | 4 heal and 2 poison every 3s |
| Lucky Fairy + Coin | Fortune Fairy | 2 heal every 2s. +10% rare odds while you own it. +1 gold per day |
| Frost Fairy + Crystal | Snow Queen | Freezes the 2 highest-tier enemy units for 1.5s every 4s |

## Shop track units

Track units only come from track packs, which is what makes feeding the shop worth the ingredients. Each track supports one archetype and gives it a payoff the base trees can't reach.

| Track | Pack | Unit | Effect |
| --- | --- | --- | --- |
| Flame | Flame Pack | Flame Spirit | 1 burn every 0.8s |
| Flame | Flame Pack | Salamander | 1 burn every 1.5s. +1 burn per hit this fight (max +5) |
| Flame | Inferno Pack | Fire Elemental | 5 burn every 2s |
| Flame | Inferno Pack | Lava Golem | 8 shield every 2.5s. While you have shield, the enemy gains 1 burn every 1s |
| Tomb | Tomb Pack | Ghoul | 3 damage every 2s. Each hit heals you 1 |
| Tomb | Tomb Pack | Mummy | 2 poison and 8 shield every 4s |
| Tomb | Crypt Pack | Bone Golem | 12 shield every 3s. +2 shield permanently after each fight |
| Tomb | Crypt Pack | Ghast | 4 damage every 1.5s. Each hit heals you 2 |
| Grove | Grove Pack | Stag | 3 damage every 1s |
| Grove | Grove Pack | Thornbush | 6 shield every 3s. Each enemy hit on your shield deals 1 back |
| Grove | Oasis Pack | Unicorn | 4 damage and 6 heal every 2s |
| Grove | Oasis Pack | Ancient Tree | 12 shield and 6 heal every 3s |
| Caravan | Caravan Pack | Camel | No attack. +1 shop slot |
| Caravan | Caravan Pack | Trader | 2 damage every 2s. Selling a card gives +1 gold |
| Caravan | Caravan Pack | Treasure Chest | No attack. Sells for 3 gold plus 1 per day owned (max 10) |
| Caravan | Treasury Pack | Gold Golem | Every 2.5s, deals 3 damage plus 1 per 4 gold held |
| Forge | Quarry Pack | Golem | 10 shield every 3s |
| Forge | Quarry Pack | Catapult | 12 damage every 4s |
| Forge | Foundry Pack | Iron Golem | 12 shield every 3s. Each enemy hit on your shield deals 1 back |
| Forge | Foundry Pack | Siege Tower | 6 damage every 2s, ignores shield |

Track units also combine with the base ingredients, for example Flame Spirit + Ember → Fire Elemental, Ghoul + Bone → Ghast, and Golem + Stone → Iron Golem. That gives players a second route to tier-2 track units before they reach 12 fed.

## Rares

The base game has 13 rares. Each one is strong but answerable, and changes how a mechanic works rather than doubling it.

| Rare | How to get it | Chance | Effect |
| --- | --- | --- | --- |
| Dark Knight | Guard + Stone | 20% | 6 damage every 2s. +1 damage per 10 missing fortress HP |
| Death Knight | Dark Knight + Bone | 100% | Dark Knight's effect, and each hit also applies 1 poison |
| Witch | Druid + Bone | 25% | 2 poison every 3s. Every 6s, the enemy's poison ticks one extra time |
| Lich | Necromancer + Moonstone | 20% | 3 poison every 3s. Every 5s, instantly completes a random friendly unit's cooldown |
| Roc | Griffin + Feather | 15% | 6 damage every 1.5s, ignores shield. Once per fight, when your fortress would hit 0, it revives at 25% HP |
| Manticore | Sand Stalker + Scorpion | 20% | 8 damage and 2 poison every 2s |
| Scorpion Queen | Scorpion + Scorpion | 10% | 1 poison every 1.5s. All your poison applications get +1 |
| Djinn | Pixie + Crystal | 15% | Every 3s, copies the effect of a random friendly unit (never another Djinn) |
| Ifrit | Inferno Pack | 10% per pack | 6 burn every 3s. Enemy burn does not decay while Ifrit isn't frozen |
| Tomb King | Crypt Pack | 10% per pack | 4 damage every 2s. Your "after each fight" bonuses grow twice as fast |
| Simurgh | Oasis Pack | 10% per pack | 5 heal every 1.5s. Each heal also deals half its amount as damage |
| Dragon's Hoard | Treasury Pack | 10% per pack | Every 3s, deals damage equal to 25% of gold held (max 15). +2 gold per day |
| Titan | Foundry Pack | 10% per pack | 20 damage every 4s. Can't be frozen |

Rare odds can be raised by Lucky Fairy (+5%), Fortune Fairy (+10%) and Oracle (+20% once per day). Combined odds cap at 50%, so a rare is never guaranteed.

## Engines

Nine engines, each with enablers (make an event happen), payoffs (reward it) and a chase rare. Cards marked "rework" replace the version in the trees above.

| Engine | Recipe | Result | Effect |
| --- | --- | --- | --- |
| Luck | Fairy + Fairy | Fairy Ring (rework) | Bless a random friendly unit every 1.5s |
| Luck | Fairy Ring + Fairy | Fairy Court (rework) | Bless a random friendly unit every 1s. Every 5th Bless also gives +1 Luck |
| Luck | Fairy + Coin | Lucky Fairy (rework) | 2 heal every 2s. +4 Luck at fight start |
| Luck | Lucky Fairy + Coin | Fortune Fairy (rework) | +8 Luck at fight start. +5% rare odds while owned. +1 gold per day |
| Luck | Fairy Ring + Feather | Wish Sprite | Every 2s, Bless a random friendly unit and charge it 0.5s |
| Luck | Lucky Fairy + Berry | Clover Sprite | 2 heal every 2s. Whenever you crit, heal 2 |
| Luck | Archer + Coin | Gambler | 4 damage every 1.5s. Whenever you crit, +1 Luck |
| Luck | Scout + Coin | Rogue | 2 damage every 0.6s. Its crits deal triple instead of double |
| Luck | Lucky Fairy + Crystal | Crystal Fairy | 3 heal every 2s. +4 Luck at fight start. **15%: Four-Leaf Fairy** |
| Luck (rare) | — | Four-Leaf Fairy | At fight start, Bless 15 times and gain 6 Luck |
| Sand | Villager + Sand | Sandcaster | 2 damage and 2 Sand every 2s |
| Sand | Wolf + Sand | Jackal | 3 damage every 1.5s. Each hit adds 1 Sand |
| Sand | Scorpion + Sand | Sand Scorpion | 1 poison and 1 Sand every 2.5s |
| Sand | Fairy + Sand | Dust Sprite | 3 Sand every 2.5s |
| Sand | Guard + Sand | Dune Guard | 5 shield every 2s. Whenever an enemy action misses, gain 2 shield |
| Sand | Sandcaster + Sand | Storm Caller | 5 Sand every 3s |
| Sand | Dust Sprite + Crystal | Mirage | Whenever an enemy action misses, charge a random friendly unit 0.5s |
| Sand | Sand Scorpion + Sand | Dune Stalker | 2 poison and 2 Sand every 2.5s. **15%: Sandworm** |
| Sand (rare) | — | Sandworm | Every 4s, consumes all the enemy's Sand to deal 4 damage per stack, ignoring shield |
| Heat | Fire Mage + Wood | Bonfire Keeper | 2 burn every 2s. Gain 2 Heat each time it acts |
| Heat | Wisp + Wood | Hearth Spirit | Whenever enemy burn ticks, gain 1 Heat |
| Heat | Golem + Ember | Furnace | Every 2s, gain 2 Heat. At 20+ Heat, spends 10 to deal 30 damage |
| Shatter | Ice Mage + Stone | Shatter Golem | 6 shield every 3s. Whenever an enemy unit is frozen, deal 6 damage |
| Shatter | Snow Queen + Moonstone | Frost Wraith | Freezes a random enemy unit for 1s every 2.5s. **15%: Winter Djinn** |
| Shatter (rare) | — | Winter Djinn | Your freezes last 50% longer. Each freeze charges your highest-tier unit 1s |
| Blood Moon | Warlock + Scorpion | Venom Drinker | Every 3s, poisons your own fortress by 1. Your units deal +1 damage per poison on you (max +10) |
| Hoard | Gold Golem + Coin | Treasure Golem | Once per fight, at 8s, deals damage equal to double your gold |
| Echo | Sylph + Crystal | Mirror | Copies its left neighbour's effect at 75% strength |
| Echo | Lich (rework) | Lich | 3 poison every 3s. Every 5s, completes a neighbour's cooldown instantly |
| Swarm | Scorpion Nest (rework) | Scorpion Nest | 2 poison every 1.8s. When it acts, summons a Scorpion into an empty slot (max 2 per fight) |
| Swarm | Wolf Pack + Berry | Den Mother | 2 heal every 2s. Every 4s, summons a Wolf into an empty slot |
| Thornwall | Spearman + Stone | Bulwark | Every 3s, deals damage equal to half your current shield |

### Spenders and conversions

These cards cash in stacks or turn defence into damage. They give every resource a second use, and give Fortress and healing builds a way to win rather than stall.

| Converts | Recipe | Result | Effect |
| --- | --- | --- | --- |
| Heat → life | Ash Caller + Moonstone | Ashborn | 2 burn every 2s. Once per fight, when your fortress would hit 0, spends all Heat to revive with 4 HP per Heat |
| Sand → shield | Sandcaster + Ember | Glassmaker | Every 3s, removes 4 Sand from the enemy to gain 12 shield |
| Luck → Bless | Lucky Fairy + Stone | Wishing Well | Every 4s, spends 3 Luck to Bless 4 times |
| Luck → crit | Gambler + Coin | High Roller | 6 damage every 2s. Every 5s, spends 5 Luck so its next hit crits for triple |
| Shield → damage | Knight + Wood | Juggernaut | 4 shield every 2s. Every 5s, spends all your shield to deal that much damage |
| Heal → damage | Dryad + Ember | Sun Sprite | 4 heal every 1.5s. Whenever you heal, deal 2 damage |
| Heal → damage | Shaman + Ember | Sun Shaman | Every 4s, deals damage equal to half the healing you did in the last 4s |
| Overheal → shield | Grove Spirit + Stone | Oasis Spirit | 7 heal every 1.5s. Healing past full HP becomes shield |

Bulwark (half your shield as damage, keeps the shield) and Juggernaut (all your shield, spends it) are deliberately two sides of the same idea: steady pressure versus a big swing.

## Theorycrafted builds

Nine builds are possible with this card set, plus some cross-engine combos. Numbers assume a full 6-slot wall around day 8, where the enemy fortress has 200 HP.

### Clover Court (Luck)

- **Board:** Fairy Court, Fortune Fairy, Wish Sprite, Rogue, Gambler, Sharpshooter.
- **How it goes off:** It opens with 8 Luck, then gains more from Gambler crits and every 5th Bless. By 10s it sits near 15 Luck (30% crit), and the Rogue has been Blessed to about 5 damage. Rogue's triple crits put it near 13 DPS on its own, and the board passes 25 DPS while still climbing.
- **Chase:** Four-Leaf Fairy, which front-loads 15 Blesses so the board is at full power from second one.
- **Path:** Wild Packs early for two Fairies (Fairy Ring), Coin for Lucky Fairy, Feather on day 4 for Scout into Rogue.
- **Weak to:** Sand, since missed actions can't crit. Freeze on Rogue or Fairy Court also stalls it.

### Sandstorm (Sand)

- **Board:** Storm Caller, Dust Sprite, Jackal, Jackal, Dune Guard, Mirage.
- **How it goes off:** It applies about 4 Sand per second and hits the 45% miss cap within 4s. Against a busy enemy board that's 2–3 misses per second, so Dune Guard gains about 5 shield per second and Mirage keeps charging the Jackals.
- **Chase:** Sandworm, which cashes in 15 Sand for 60 damage through shield, at the cost of resetting the enemy's miss chance.
- **Weak to:** Fortress and heal builds. Heals and shields never miss, and Sandstorm's own damage is modest without Sandworm.

### Hearth Engine (Heat and burn)

- **Board:** Bonfire Keeper, Bonfire Keeper, Hearth Spirit, Flame Dancer, Pyromancer, Furnace.
- **How it goes off:** Every burn tick feeds Hearth Spirit, and every Bonfire Keeper action adds 2 Heat. That's about 3 Heat per second, so the board is 50% faster by 10s. Once Heat passes 20, Furnace cashes in 10 Heat for 30 damage every 3–4s, and the faster board stacks burn even faster.
- **Chase:** Ifrit, which stops burn decaying, so the stacks never come down.
- **Weak to:** Heavy healing, which cleanses burn and slows the Heat feed. Sand also makes burn applications miss.

### Shatter (Freeze)

- **Board:** Frost Archer, Frost Archer, Frost Wolf, Ice Mage, Frost Wraith, Shatter Golem.
- **How it goes off:** About 2.8 freezes per second, each worth 6 damage from Shatter Golem. That's around 17 DPS from freezing alone, while the enemy's best units barely act.
- **Chase:** Winter Djinn, whose freezes charge your strongest unit, turning lockdown into speed.
- **Weak to:** Warden, which makes the enemy immune to freeze while shielded and switches the engine off. Sand also makes freeze actions miss.

### Blood Moon (Self-poison)

- **Board:** Venom Drinker, Werewolf, Warlock, Moonhowler, Night Scorpion, Roc.
- **How it goes off:** Self-poison plus enemy damage drags your fortress below 50% around 12–15s. Then Werewolf, Warlock and Night Scorpion double up, Moonhowler adds 25% haste, and Venom Drinker adds up to +10 damage per hit. Peak output is around 40 DPS.
- **Chase:** Roc, whose revive means the dive into low HP is survivable once.
- **Weak to:** Fast burst that kills before the payoff starts, and freeze on Werewolf or Warlock.

### Hoard Breaker (Gold)

- **Board:** Merchant, Banker, Camel, Treasure Chest, Gold Golem, Treasure Golem.
- **How it goes off:** It loses some early days while banking. Holding 40 gold, Treasure Golem hits for 80 at 8s and Gold Golem adds about 5 DPS. Against 200 HP, the fight ends around 14s.
- **Chase:** Dragon's Hoard, which adds steady gold-scaled damage on top.
- **Weak to:** Sand, since the one big hit can miss. Thick shields also absorb it.

### Echo Cannon (Mirror)

- **Board, left to right:** Pyromancer, Mirror, Lich, Inferno Mage, Mirror, Hearth Spirit.
- **How it goes off:** Each Mirror repeats the burn mage to its left at 75%, and Lich completes a neighbour's cooldown every 5s. Two mages become nearly four.
- **Weak to:** Freeze on the mages, which silences their Mirrors too. Placement matters, so a bad draw order hurts.

### Scorpion Swarm (Summons and poison)

- **Board:** Scorpion Nest, Scorpion Nest, Scorpion Queen, Fairy Court, with two slots left empty.
- **How it goes off:** The Nests fill the empty slots with Scorpions, and Scorpion Queen adds +1 to every poison application, including the summons. That's about 6 poison per second, enough to kill 200 HP by around 12s. Fairy Court's Blesses land on the summons too.
- **Weak to:** Early burst before poison ramps, and Sand, which halves the applications.

### Thornwall (Shield)

- **Board:** Champion, Elder Treant, Iron Golem, Paladin, Bulwark, Dune Guard.
- **How it goes off:** About 13 shield per second piles up. By 10s it has around 100 shield, so Bulwark hits for 50 every 3s while Iron Golem reflects incoming hits.
- **Weak to:** Poison and shield-ignoring damage (Griffin, Hawkeye, Sandworm), which go straight past the wall.

### Cross-engine combos

- **Double Hoard:** Mirror to the right of Treasure Golem repeats the one-shot at 75%, so 80 + 60 damage at 8s.
- **Desert Lockdown:** Sand and Shatter together. Mirage charges your Frost Archers on every enemy miss, so misses become freezes.
- **Lucky Swarm:** Summoned Scorpions give Fairy Court more Bless targets, and Gambler crits on poison add Luck.
- **Mirrored Shatter:** Mirror beside Shatter Golem gives 4.5 extra damage per freeze.

## Archetypes and counters

The roster supports 8 archetypes. Each has a clear way to win and a clear weakness, so random ghost matchups stay tense.

| Archetype | Core cards | Track | Chase rare | Wins by | Weak to |
| --- | --- | --- | --- | --- | --- |
| Burn | Fire Mage, Pyromancer, Hellhound, Cerberus, Fire Archer | Flame | Ifrit | Fast, stacking damage in short fights | Heavy healing, which cleanses burn |
| Poison | Scorpion Swarm, Hexer, Necromancer, Fungal Nest | Tomb | Scorpion Queen, Witch | Unstoppable late damage through shield | Fast builds that win before poison ramps |
| Fortress | Guard, Knight, Paladin, Elder Treant, Shaman | Forge or Grove | Titan, Simurgh | Outlasting into sudden death | Poison and shield-ignoring damage |
| Pack | Wolf Pack, Hunter, Beastmaster, Alpha, Griffin | Grove | Roc, Manticore | Early tempo and high attack speed | Freeze on key units |
| Bones | Skeleton, Bone Knight, Grave Wolf, Necromancer | Tomb | Tomb King, Lich | Units that grow every fight | Strong early days before scaling kicks in |
| Desperado | Werewolf, Warlock, Moonhowler, Moon Fairy | none | Dark Knight, Roc | Exploding once the fortress drops below 50% | Burst that skips past the danger zone |
| Frost | Ice Mage, Frost Fairy, Trapper, Snow Queen, Warden | none | Archmage, Djinn | Shutting down the enemy's best units | Wide boards of many cheap units |
| Tycoon | Merchant, Banker, Mercenary, Treasure Chest | Caravan | Dragon's Hoard | A late spike bought with saved gold | Losing too many early days |

The counter web in short:

- Poison beats Fortress (ignores shield).
- Fortress beats Pack and Burn (shield and healing absorb tempo).
- Pack and Burn beat Poison and Bones (win before they ramp).
- Frost beats Pack and rare-centred builds (freezes key units).
- Wide builds beat Frost (too many units to freeze).

The Fairy line and Oracle support any archetype, especially players gambling for rares.

## Tuning notes and open questions

These are the numbers most likely to break first in playtesting.

- **Burn stacking:** several burn units can outpace decay and grow quadratically. If Burn dominates, make burn lose 2 stacks per tick, or 10% of its stacks.
- **Freeze lock:** Ice Mage, Snow Queen and Archmage together could freeze a board permanently. Rule: a unit can't be frozen again for 1s after a freeze ends.
- **Djinn copying rares:** copying Roc's revive or Ifrit's no-decay could be degenerate. Option: Djinn copies only the attack part of an effect.
- **Shield stall:** Fortress builds may lean entirely on sudden death to win. If fights feel slow, start sudden death at 25s.
- **Tycoon early losses:** with only 3 lives, saving gold may be too risky. Watch how often Tycoon reaches day 6.
- **Villager centrality:** if every build runs through Villagers, lower their pack weight and give creatures more tier-2 options.

Engine risks from the theorycrafting:

- **Sand may be a universal counter.** It weakens Luck, Hoard, Heat, Shatter and Swarm at once. Healing now cleanses 10% of Sand, which gives Fortress and Fairy builds an answer. If it still dominates, lower the cap to 30%.
- **Shatter looks strongest on paper.** 17 DPS plus lockdown is a lot. First knob: Shatter Golem deals 4 per freeze.
- **Swarm poison ramps quadratically.** Scorpion Queen on summons is the danger. Option: summons don't benefit from Queen.
- **Double Hoard is a 140-damage one-shot.** Fine if Sand and shields stay real answers; otherwise Mirror can't copy once-per-fight effects.

Open questions:

- [ ] Should recipes be order-dependent (Villager on Wood vs Wood on Villager)?
- [ ] Should hybrid packs (two tracks at 5 fed) be in the base game or an update?
- [ ] Can a failed rare roll be retried, for example with Oracle?
- [ ] Are 4 / 5 / 6 wall slots the right curve, or should slots be bought?
