// Unit battle prototype: spawner cards on each wall send 3D units across the field.
import * as THREE from 'three';
import { CARDS, dmg } from '../content.js';
import { createWorld } from '../gfx/world.js';
import { CardView, loadArt, setAnisotropy } from '../gfx/card.js';
import { createFx } from '../gfx/fx.js';
import * as D from '../gfx/draw.js';
import { sfx } from '../audio.js';
import { createLaneBattle, UNIT_TYPES, FIELD, slotZ, DT, SIEGE_AT } from './lanes.js';
import { makeUnitModel, animateUnit } from './models.js';

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

// Field lives off to the side of the normal board, in the forest.
const O = new THREE.Vector3(40, 0, -10);
const W = (x, z, y = 0) => new THREE.Vector3(O.x + x, y, O.z + z);
world.makeBoard(O.x, O.z, FIELD.half * 2 + 3, FIELD.depth + 1.5, D.drawGrass({ base: '#b9cf92', tuft: 'rgba(90,110,55,0.4)', seed: 21 }));
const towers = [
  world.makeTower(O.x - FIELD.castleX - 0.4, O.z, '#d06a5a', '#f2c64a'),
  world.makeTower(O.x + FIELD.castleX + 0.4, O.z, '#6f6ba6', '#e9e3d0'),
];
for (const t of towers) t.scale.setScalar(1.05);
const TEAM = ['#d9644f', '#6c68ad'];

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
    const x = (side === 0 ? -1 : 1) * (FIELD.castleX - 2.3);
    const p = W(x, slotZ(i));
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

// ------------------------------------------------------------------ units

const units = new Map(); // sim id -> view
const arrows = new Map();
const hpGeo = new THREE.PlaneGeometry(1, 1);
const arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5).rotateZ(Math.PI / 2);
const arrowMat = new THREE.MeshBasicMaterial({ color: '#4a3826' });

function makeView(u) {
  const { root, rig } = makeUnitModel(u.type, TEAM[u.side]);
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(hpGeo, new THREE.MeshBasicMaterial({ color: '#2a241c', depthTest: false }));
  bg.scale.set(0.62, 0.11, 1);
  const fill = new THREE.Mesh(hpGeo.clone().translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: u.side === 0 ? '#7ccf6a' : '#e8695d', depthTest: false }));
  fill.position.x = -0.29;
  fill.scale.set(0.58, 0.07, 1);
  bg.renderOrder = 40;
  fill.renderOrder = 41;
  bar.add(bg, fill);
  bar.position.y = 1.45;
  bar.visible = false;
  root.add(bar);
  scene.add(root);
  const p = W(u.x, u.z);
  root.position.copy(p);
  return { root, rig, bar, fill, atkT: 9, deadT: 0, t: Math.random() * 3, hitT: 0, pos: p.clone() };
}

function clearUnits() {
  for (const v of units.values()) scene.remove(v.root);
  units.clear();
  for (const a of arrows.values()) scene.remove(a);
  arrows.clear();
}

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
  clearUnits();
  $('btn-fight').disabled = false;
  $('banner').hidden = true;
  $('clock').textContent = 'Set up both walls';
  $('clock').style.background = '';
  for (const side of [0, 1]) for (const v of cardViews[side]) v?.setBar(null);
  updateHud();
}

function handle(e) {
  switch (e.type) {
    case 'spawn': {
      const cv = cardViews[e.side][e.slot];
      if (cv) { cv.hop(2); cv.kick(0.08); }
      const u = battle.units.find((x) => x.id === e.id);
      if (u) {
        const v = makeView(u);
        units.set(u.id, v);
        fx.puffs(v.pos, { n: 4, s: 0.25, spread: 0.5 });
      }
      break;
    }
    case 'attack': {
      const v = units.get(e.id);
      if (v) v.atkT = 0;
      if (!e.ranged) sfx.hit();
      break;
    }
    case 'shoot': {
      const a = new THREE.Mesh(arrowGeo, arrowMat);
      scene.add(a);
      arrows.set(e.id, a);
      sfx.shoot();
      break;
    }
    case 'land': {
      const a = arrows.get(e.id);
      if (a) { scene.remove(a); arrows.delete(e.id); }
      break;
    }
    case 'hit': {
      const v = units.get(e.id);
      if (v) { v.hitT = 0.15; v.bar.visible = true; }
      break;
    }
    case 'death': {
      const v = units.get(e.id);
      if (v) { v.bar.visible = false; fx.puffs(v.pos, { n: 5, s: 0.3, spread: 0.6 }); }
      break;
    }
    case 'castle': {
      const t = towers[e.side];
      const p = t.position.clone().setY(2.2);
      if (!e.siege) {
        fx.number(p, `-${e.amount}`, 'dmg', { dx: (Math.random() - 0.5) * 1.5 });
        fx.puffs(p.clone().setY(1.2), { n: 2, s: 0.3, spread: 0.8 });
        t.userData.kick = 1;
        sfx.hit();
      }
      break;
    }
    case 'end': {
      ended = true;
      const won = e.winner === 0;
      banner(won ? 'Victory!' : 'Defeat', true);
      if (won) sfx.win(); else sfx.lose();
      fx.puffs(towers[1 - e.winner].position.clone().setY(1.5), { n: 20, spread: 2.2, s: 0.6 });
      $('btn-fight').disabled = false;
      $('btn-fight').textContent = 'Fight again';
      battle.done = true;
      break;
    }
    default:
  }
}

function syncUnits(dt) {
  const cam = world.camera;
  const seen = new Set();
  for (const u of battle.units) {
    let v = units.get(u.id);
    if (!v) { v = makeView(u); units.set(u.id, v); }
    seen.add(u.id);
    const target = W(u.x, u.z);
    v.pos.lerp(target, 1 - Math.exp(-dt * 18));
    v.root.position.copy(v.pos);
    v.root.rotation.y = u.facing > 0 ? 0 : Math.PI;
    v.t += dt * (u.state === 'walk' ? u.T.speed / 1.6 : 1);
    v.atkT += dt;
    if (u.state === 'dead') v.deadT += dt;
    v.hitT = Math.max(0, v.hitT - dt);
    animateUnit(v.rig, { state: u.state, t: v.t, attackT: v.atkT, deadT: v.deadT, ranged: u.T.range > 1 });
    v.rig.body.scale.setScalar((u.type === 'warrior' ? 1.12 : 1) * 1.35 * (1 + v.hitT * 0.8));
    v.fill.scale.x = 0.58 * Math.max(0, u.hp / u.max);
    v.bar.quaternion.copy(cam.quaternion);
    if (u.state === 'dead' && v.deadT > 1.6) v.root.visible = false;
  }
  for (const [id, v] of units) if (!seen.has(id)) { scene.remove(v.root); units.delete(id); }
  for (const p of battle.projectiles) {
    const a = arrows.get(p.id);
    if (!a) continue;
    const k = Math.min(1, p.t / p.dur);
    a.position.copy(W(p.x, p.z, 0.75 + Math.sin(Math.PI * k) * 1.2));
    const dx = p.tx - p.sx;
    a.rotation.set(0, dx > 0 ? 0 : Math.PI, (Math.cos(Math.PI * k) * 0.9) * (dx > 0 ? 1 : 1));
  }
  for (const side of [0, 1]) battle.spawners[side].forEach((sp, i) => {
    const cv = cardViews[side][i];
    if (cv && sp) cv.setBar(sp.timer / UNIT_TYPES[sp.type].spawn);
  });
}

// ------------------------------------------------------------------ loop

window.addEventListener('resize', () => world.resize());
world.resize();
view.tilt = 0.72; // lower camera so units read side-on
world.frame(O.x, O.z + 1.2, FIELD.half * 2 + 3, FIELD.depth + 4);
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
  if (battle) syncUnits(dt * (battle.done ? 1 : speed));
  for (const t of towers) {
    t.userData.kick = Math.max(0, (t.userData.kick || 0) - dt * 4);
    const k = t.userData.kick;
    t.scale.set(1.05 * (1 + k * 0.04), 1.05 * (1 - k * 0.07), 1.05 * (1 + k * 0.04));
  }
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
