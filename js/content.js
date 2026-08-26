/** V0 content. Numbers live here so they can be retuned without touching sim code. */

export const TICK_RATE = 60;
export const DAY_TICKS = 7200; // 120s
export const GATHER_TICKS = 600; // 10s per resource
export const FOOD_PER_UNIT = 1;
export const FLINT_PITY = 5;
export const POP_CAP = [0, 2, 4, 6];

export const CARDS = {
  wood: { name: "Wood", kind: "resource", icon: "wood" },
  berries: { name: "Berries", kind: "resource", icon: "berries" },
  stone: { name: "Stone", kind: "resource", icon: "stone" },
  flint: { name: "Flint", kind: "resource", icon: "flint" },
  string: { name: "String", kind: "resource", icon: "string" },
  spear: { name: "Spear", kind: "equipment", icon: "spear" },
  bow: { name: "Bow", kind: "equipment", icon: "bow" },
  villager: { name: "Villager", kind: "villager", icon: "villager", worker: true, eats: true, fights: true },
  armed_villager: { name: "Armed Villager", kind: "unit", icon: "armed", worker: true, eats: true, fights: true },
  spearman: { name: "Spearman", kind: "unit", icon: "spearman", worker: false, eats: true, fights: true },
  archer: { name: "Archer", kind: "unit", icon: "archer", worker: false, eats: true, fights: true },
  tree: { name: "Tree", kind: "node", icon: "tree", yield: "wood" },
  berry_bush: { name: "Berry Bush", kind: "node", icon: "berrybush", yield: "berries" },
  rock: { name: "Rock", kind: "node", icon: "rock", yield: "rock" },
  town_centre: { name: "Town Centre", kind: "building", icon: "towncentre" },
  barracks: { name: "Barracks", kind: "building", icon: "barracks" },
  wolf: { name: "Wolf", kind: "enemy", icon: "wolf" },
};

export const UNITS = {
  villager: { hp: 6, atk: 1, interval: 30, range: "front", counter: null },
  armed_villager: { hp: 10, atk: 2, interval: 24, range: "front", counter: null },
  spearman: { hp: 20, atk: 5, interval: 20, range: "front", counter: "cavalry" },
  archer: { hp: 14, atk: 4, interval: 24, range: "any", counter: "spearman" },
  wolf: { hp: 8, atk: 2, interval: 30, range: "front", counter: null },
};

export const RECIPES = [
  {
    id: "spearman",
    name: "Spearman",
    inputs: { spear: 1 },
    worker: true,
    catalyst: "barracks",
    workerTypes: ["villager", "armed_villager"],
    workTicks: 180,
    effect: "promote",
    output: "spearman",
  },
  {
    id: "archer",
    name: "Archer",
    inputs: { bow: 1 },
    worker: true,
    catalyst: "barracks",
    workerTypes: ["villager", "armed_villager"],
    workTicks: 180,
    effect: "promote",
    output: "archer",
  },
  {
    id: "armed_villager",
    name: "Armed Villager",
    inputs: { spear: 1 },
    worker: true,
    workerTypes: ["villager"],
    workTicks: 60,
    effect: "promote",
    output: "armed_villager",
  },
  {
    id: "upgrade_tc_2",
    name: "Town Centre Lv.2",
    inputs: { wood: 6, stone: 3 },
    worker: true,
    catalyst: "town_centre",
    requireTc: 1,
    workTicks: 240,
    effect: "upgrade_tc",
    toLevel: 2,
  },
  {
    id: "upgrade_tc_3",
    name: "Town Centre Lv.3",
    inputs: { wood: 12, stone: 8 },
    worker: true,
    catalyst: "town_centre",
    requireTc: 2,
    workTicks: 360,
    effect: "upgrade_tc",
    toLevel: 3,
  },
  {
    id: "recruit",
    name: "Recruit Villager",
    inputs: { berries: 4 },
    catalyst: "town_centre",
    workTicks: 180,
    effect: "recruit",
    output: "villager",
  },
  {
    id: "barracks",
    name: "Barracks",
    inputs: { wood: 8, stone: 4 },
    workTicks: 240,
    effect: "spawn",
    output: "barracks",
  },
  {
    id: "spear",
    name: "Spear",
    inputs: { wood: 2, flint: 1 },
    workTicks: 120,
    effect: "spawn",
    output: "spear",
  },
  {
    id: "bow",
    name: "Bow",
    inputs: { wood: 3, string: 1 },
    workTicks: 120,
    effect: "spawn",
    output: "bow",
  },
  {
    id: "string",
    name: "String",
    inputs: { wood: 1 },
    worker: true,
    workTicks: 90,
    effect: "spawn",
    output: "string",
  },
];

export const OPENING = [
  { type: "town_centre", fx: 0.4, fy: 0.7, rot: -0.7 },
  { type: "villager", fx: 0.12, fy: 0.52, rot: -1.7 },
  { type: "villager", fx: 0.26, fy: 0.54, rot: 2.1 },
  { type: "tree", fx: 0.1, fy: 0.1, rot: -2.4 },
  { type: "tree", fx: 0.28, fy: 0.08, rot: 1.4 },
  { type: "rock", fx: 0.58, fy: 0.28, rot: -1.2 },
  { type: "berry_bush", fx: 0.72, fy: 0.48, rot: 0.9 },
];

export const DAYS = [
  {
    day: 1,
    enemy: null,
    nightText: "The village sleeps.",
  },
  {
    day: 2,
    enemy: [{ type: "wolf", row: 0, col: 1 }],
    nightText: "A wolf at the treeline.",
  },
  {
    day: 3,
    enemy: [
      { type: "spearman", row: 0, col: 1 },
      { type: "spearman", row: 0, col: 2 },
    ],
    nightText: "Armed strangers on the road.",
  },
  {
    day: 4,
    enemy: [
      { type: "spearman", row: 0, col: 0 },
      { type: "spearman", row: 0, col: 1 },
      { type: "archer", row: 1, col: 2 },
      { type: "archer", row: 1, col: 3 },
    ],
    nightText: "A real warband.",
  },
  {
    day: 5,
    enemy: [
      { type: "spearman", row: 0, col: 0 },
      { type: "spearman", row: 0, col: 1 },
      { type: "spearman", row: 0, col: 2 },
      { type: "archer", row: 1, col: 1 },
      { type: "archer", row: 1, col: 2 },
      { type: "archer", row: 1, col: 3 },
    ],
    nightText: "They mean to end the village.",
  },
];

export const RECIPE_BOOK = [
  { id: "string", name: "String", need: "1 Wood + Villager", out: "String" },
  { id: "spear", name: "Spear", need: "2 Wood + 1 Flint", out: "Spear" },
  { id: "bow", name: "Bow", need: "3 Wood + 1 String", out: "Bow" },
  { id: "armed_villager", name: "Armed Villager", need: "Villager + Spear", out: "Armed Villager" },
  { id: "upgrade_tc_2", name: "Town Centre Lv.2", need: "6 Wood + 3 Stone", out: "Pop cap 4" },
  { id: "upgrade_tc_3", name: "Town Centre Lv.3", need: "12 Wood + 8 Stone", out: "Pop cap 6" },
  { id: "recruit", name: "Recruit", need: "4 Berries", out: "Villager" },
  { id: "barracks", name: "Barracks", need: "8 Wood + 4 Stone", out: "Barracks" },
  { id: "spearman", name: "Spearman", need: "Villager + Spear + Barracks", out: "Spearman" },
  { id: "archer", name: "Archer", need: "Villager + Bow + Barracks", out: "Archer" },
];
