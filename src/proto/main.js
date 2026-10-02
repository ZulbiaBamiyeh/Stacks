// Unit battle prototype: spawner cards on each wall send 3D units across the field.
import * as THREE from 'three';
import { CARDS, dmg } from '../content.js';
import { createWorld } from '../gfx/world.js';
import { CardView, loadArt, setAnisotropy } from '../gfx/card.js';
import { createFx } from '../gfx/fx.js';
import * as D from '../gfx/draw.js';
import { sfx } from '../audio.js';
import { createLaneBattle, UNIT_TYPES, DT, SIEGE_AT } from './lanes.js';
import { createBattlefield } from '../gfx/battlefield.js';

const $ = (id) => document.getElementById(id);
await Promise.all(['900', '800', '700'].map((w) => document.fonts.load(`${w} 40px Nunito`)));
await loadArt();

// Spawner cards as card defs, so they render with the normal card faces.
const SPAWNER = { villager: 'pVillager', warrior: 'pWarrior', archer: 'pArcher' };
const ART_FAMILY = { villager: 'person', warrior: 'person', archer: 'person' };
for (const [type, id] of Object.entries(SPAWNER)) {
  const T = UNIT_TYPES[type];
  CARDS[id] = {
    id, name: T.name, tier: type === 'villager' ? 1 : 2, family: ART_FAMILY[type], kind: 'unit', tags: [], main: 'dmg',
    text: `Sends a ${T.name} every ${T.spawn}s. ${T.hp} HP, ${T.dmg} damage every ${T.cd}s${T.armor ? `, ${T.armor} armour` : ''}${T.range > 1 ? `, range ${T.range}` : ''}.`,
    t: [[T.spawn, dmg(T.dmg)]],
  };
}

const world = createWorld($('stage'));
setAnisotropy(world.anisotropy);
const { scene, view } = world;
const fx = createFx(scene);

const field = createBattlefield({ world, fx, sfx });
const W = field.W;
const towers = field.towers;

// ------------------------------------------------------------------ walls

const walls = [
  ['warrior', 'archer', 'villager', 'villager', 'archer', 'warrior'],
  ['villager', 'villager', 'warrior', 'warrior', 'villager', 'villager'],
];
const PRESETS = {
  Mixed: ['warrior', 'archer', 'villager', 'villager', 'archer', 'warrior'],
  Villagers: Array(6).fill('villager'),
  Warriors: Array(6).fill('warrior'),
  Archers: Array(6).fill('archer'),
  Empty: Array(6).fill(null),
};
const CYCLE = [null, 'villager', 'warrior', 'archer'];
let cardViews = [[], []];

function buildCards() {
  for (const side of [0, 1]) for (const v of cardViews[side]) v?.dispose(scene);
  cardViews = [0, 1].map((side) => walls[side].map((type, i) => {
    if (!type) return null;
    const v = new CardView(scene, { id: SPAWNER[type] });
    const p = field.cardPos(side, i);
    v.place(p.x, p.z);
    v.kick(0.1);
    return v;
  }));
}

function renderEditor() {
  for (const side of [0, 1]) {
    $(`slots-${side}`).innerHTML = walls[side].map((t, i) => `<button class="slot-btn ${t || ''}" data-side="${side}" data-i="${i}" type="button">${t ? UNIT_TYPES[t].name : '—'}<small>${t ? `every ${UNIT_TYPES[t].spawn}s` : 'empty'}</small></button>`).join('');
    $(`presets-${side}`).innerHTML = Object.keys(PRESETS).map((k) => `<button data-side="${side}" data-preset="${k}" type="button">${k}</button>`).join('');
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || battle) return;
  if (b.dataset.i != null) {
    const side = +b.dataset.side;
    const i = +b.dataset.i;
    walls[side][i] = CYCLE[(CYCLE.indexOf(walls[side][i]) + 1) % CYCLE.length];
    renderEditor();
    buildCards();
    sfx.pick();
  } else if (b.dataset.preset) {
    walls[+b.dataset.side] = [...PRESETS[b.dataset.preset]];
    renderEditor();
    buildCards();
    sfx.pop();
  }
});

// ------------------------------------------------------------------ battle

let battle = null;
let speed = 1;
let acc = 0;
let ended = false;

function castleHtml(side) {
  const c = battle ? battle.castles[side] : { hp: 400, max: 400 };
  const st = battle ? battle.stats[side] : { spawned: 0, lost: 0 };
  const aliveN = battle ? battle.units.filter((u) => u.side === side && u.state !== 'dead').length : 0;
  const p = Math.max(0, c.hp) / c.max;
  return `<div class="row"><span>${side === 0 ? 'Your castle' : 'Enemy castle'}</span><span>${Math.max(0, Math.ceil(c.hp))} / ${c.max}</span></div>
    <div class="bar"><div class="lag" style="width:${p * 100}%"></div><div class="fill" style="width:${p * 100}%"></div></div>
    <div class="sub">${aliveN} on the field · ${st.spawned} sent · ${st.lost} fallen</div>`;
}
function updateHud() {
  $('castle-0').innerHTML = castleHtml(0);
  $('castle-1').innerHTML = castleHtml(1);
  if (battle) {
    const siege = battle.t >= SIEGE_AT;
    $('clock').textContent = siege ? `Siege! ${battle.t.toFixed(0)}s` : `${battle.t.toFixed(1)}s`;
    $('clock').style.background = siege ? '#d65c4a' : '';
  }
}

function banner(html, hold = false) {
  const el = $('banner');
  el.innerHTML = html;
  el.hidden = false;
  el.className = '';
  void el.offsetWidth;
  el.className = hold ? 'hold' : 'show';
  if (!hold) setTimeout(() => { el.hidden = true; }, 1650);
}

$('btn-fight').addEventListener('click', () => {
  sfx.unlock();
  if (battle) return;
  reset();
  battle = createLaneBattle({ left: walls[0], right: walls[1], seed: (Math.random() * 1e9) | 0 });
  field.start(battle);
  acc = 0;
  ended = false;
  $('btn-fight').disabled = true;
  banner('Charge!');
  sfx.bigHit();
});
$('btn-reset').addEventListener('click', () => reset());
document.querySelectorAll('.speed').forEach((b) => b.addEventListener('click', () => {
  speed = +b.dataset.speed;
  document.querySelectorAll('.speed').forEach((x) => x.classList.toggle('on', x === b));
}));
document.querySelector('.speed[data-speed="1"]').classList.add('on');

function reset() {
  battle = null;
  field.clear();
  $('btn-fight').disabled = false;
  $('banner').hidden = true;
  $('clock').textContent = 'Set up both walls';
  $('clock').style.background = '';
  for (const side of [0, 1]) for (const v of cardViews[side]) v?.setBar(null);
  updateHud();
}

function handle(e) {
  field.handle(e, { onSpawn: (side, slot) => { const cv = cardViews[side][slot]; if (cv) { cv.hop(2); cv.kick(0.08); } } });
  if (e.type === 'end') {
    const won = e.winner === 0;
    banner(won ? 'Victory!' : 'Defeat', true);
    if (won) sfx.win(); else sfx.lose();
    $('btn-fight').disabled = false;
    $('btn-fight').textContent = 'Fight again';
    battle.done = true;
  }
}

function spawnBars() {
  for (const side of [0, 1]) battle.spawners[side].forEach((sp, i) => {
    const cv = cardViews[side][i];
    if (cv && sp) cv.setBar(sp.timer / sp.T.spawn);
  });
}

// ------------------------------------------------------------------ loop

window.addEventListener('resize', () => world.resize());
world.resize();
field.frame(view);
view.target.copy(view.goal);
view.dist = view.goalDist;
renderEditor();
buildCards();
updateHud();

let prev = performance.now();
let hudClock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  if (battle && !battle.done) {
    acc += dt * speed;
    let n = 0;
    while (acc >= DT && !battle.over && n < 200) { battle.step(); acc -= DT; n++; }
    for (const e of battle.events.splice(0)) handle(e);
  }
  field.sync(dt * (battle && !battle.done ? speed : 1));
  if (battle) spawnBars();
  for (const side of [0, 1]) for (const v of cardViews[side]) v?.update(dt);
  hudClock -= dt;
  if (hudClock <= 0) { updateHud(); hudClock = 0.1; }
  fx.update(dt);
  world.updateCamera(dt);
  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('loading').classList.add('gone');
window.proto = { get battle() { return battle; }, walls };
