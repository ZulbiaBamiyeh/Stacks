// DOM overlay: HUD chips, hover info, drag hint, toasts, banners, modals,
// and the fortress bars during a fight.
import { CARDS, PACKS, RECIPES, RULES, fortressHp, wallSlots } from './content.js';
import { iconURL, ROMAN, cardStats } from './gfx/draw.js';
import { castleHpFor, unitTypeFor } from './proto/army.js';
import { UNIT_TYPES } from './proto/lanes.js';

const $ = (id) => document.getElementById(id);
const ico = (name) => `<i class="ico" style="background-image:url(${iconURL(name)})"></i>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (id) => CARDS[id]?.name || id;

export const CODEX_KEY = 'stackbrawl.codex.v1';
export function loadCodex() {
  try { return new Set(JSON.parse(localStorage.getItem(CODEX_KEY)) || []); } catch { return new Set(); }
}
export function saveCodex(set) {
  try { localStorage.setItem(CODEX_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

export function createUI() {
  document.querySelectorAll('[data-icon]').forEach((el) => { el.style.backgroundImage = `url(${iconURL(el.dataset.icon)})`; });

  function hud(s, codex) {
    $('hud-day').textContent = `Day ${s.day}`;
    const g = $('hud-gold');
    if (g.textContent !== String(s.gold)) {
      g.textContent = s.gold;
      g.parentElement.classList.remove('bump');
      void g.parentElement.offsetWidth;
      g.parentElement.classList.add('bump');
    }
    $('hud-wins').innerHTML = `<span class="pips">${Array.from({ length: RULES.winsToFinish }, (_, i) => `<i class="pip ${i < s.wins ? 'on' : ''}"></i>`).join('')}</span>`;
    $('hud-lives').innerHTML = Array.from({ length: RULES.lives }, (_, i) => `<i class="ico heart ${i < RULES.lives - s.losses ? '' : 'off'}" style="background-image:url(${iconURL('heal')})"></i>`).join('');
    const found = new Set([...codex].map((k) => k.replace('!', ''))).size;
    $('ideas-count').textContent = `${found}/${RECIPES.size}`;
    const onWall = s.wall.slice(0, wallSlots(s.day)).filter(Boolean).length;
    $('fight-sub').innerHTML = `${ico('heal')} ${castleHpFor(s.day)} castle · ${onWall}/${wallSlots(s.day)} on wall`;
  }

  function cardInfo(id, { inst = null, price = null, sell = null, codex = new Set(), extra = '' } = {}) {
    const d = CARDS[id];
    const tag = d.kind === 'ingredient'
      ? 'Ingredient'
      : `${d.rare ? '<span class="rare-tag">★ Rare</span> · ' : ''}Tier ${ROMAN[d.tier]} ${d.track ? 'track unit' : 'unit'}${d.tags?.includes('creature') ? ' · creature' : ''}`;
    const stats = d.kind === 'unit' ? cardStats(d, inst?.perm || 0).map((st) => `<span>${ico(st.k)}${esc(st.n)}</span>`).join('') : '';
    const meals = inst?.meals || 0;
    const ev = d.eats?.evolve;
    const eater = d.eats ? `<p><b>Eats</b> ${d.eats.foods.map((f) => `${ico(f)} ${esc(nameOf(f))}`).join(', ')} (drop them on it). Eaten ${meals}${ev ? `, evolves into <b>${esc(nameOf(ev[1]))}</b> at ${ev[0]}` : ''}.</p>` : '';
    const grown = (inst?.perm || 0) - Math.floor(meals / (d.eats?.per || 1));
    const perm = (grown > 0 ? `<p class="muted">Grown +${grown} from past fights.</p>` : '') + eater;
    const uses = [...RECIPES.values()].filter((r) => r.a === id || r.b === id);
    const known = uses.filter((r) => codex.has(`${r.a}+${r.b}`));
    const recipes = uses.length
      ? `<div class="recipes">${known.map((r) => {
        const other = r.a === id ? r.b : r.a;
        return `<div>+ ${esc(nameOf(other))} → <b>${esc(nameOf(r.result))}</b>${r.rare ? ` <span class="muted">(${r.chance}% ${codex.has(`${r.a}+${r.b}!`) ? esc(nameOf(r.rare)) : '★'})</span>` : ''}</div>`;
      }).join('')}${uses.length > known.length ? `<div class="muted">${known.length ? '+ ' : ''}${uses.length - known.length} undiscovered combination${uses.length - known.length > 1 ? 's' : ''}</div>` : ''}</div>`
      : '';
    const right = price != null ? `<span class="sell">${ico('coin')} ${price}</span>` : sell != null ? `<span class="sell muted">sells ${ico('coin')} ${sell}</span>` : '';
    const unit = d.kind === 'unit' ? `<p class="muted">In battle: sends a <b>${UNIT_TYPES[unitTypeFor(d)].name.toLowerCase()}</b> (placeholder until this card gets its own unit).</p>` : '';
    return `<h3>${esc(d.name)}</h3><span class="tag">${tag}</span>${right}<div class="stats">${stats}</div><p>${esc(d.text)}</p>${unit}${perm}${extra}${recipes}`;
  }

  function packInfo(packId, { price = true } = {}) {
    const p = PACKS[packId];
    const total = p.pool.reduce((a, [, w]) => a + w, 0);
    const lines = p.pool.map(([id, w]) => `<div>${esc(nameOf(id))} <span class="muted">${Math.round((w / total) * 100)}%</span></div>`).join('');
    return `<h3>${esc(p.name)}</h3><span class="tag">${p.size} cards${p.rare ? ` · 10% ${esc(nameOf(p.rare))}` : ''}</span>${price ? `<span class="sell">${ico('coin')} ${p.price}</span>` : ''}<p>${price ? 'Click to buy. Click the pack on the table to open it.' : 'Click to pop out a card.'}</p><div class="recipes">${lines}</div>`;
  }

  function info(html) {
    const el = $('info');
    if (!html) { el.hidden = true; return; }
    el.innerHTML = html;
    el.hidden = false;
  }

  function hint(html, x, y, bad = false) {
    const el = $('hint');
    if (!html) { el.hidden = true; return; }
    el.innerHTML = html;
    el.classList.toggle('bad', bad);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.hidden = false;
  }

  function toast(text, kind = '', icon = null) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon ? ico(icon) : ''}<span>${text}</span>`;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.remove(), 2700);
  }

  function banner(html, { hold = false } = {}) {
    const el = $('banner');
    el.innerHTML = html;
    el.hidden = false;
    el.className = '';
    void el.offsetWidth;
    el.className = hold ? 'hold' : 'show';
    if (!hold) {
      clearTimeout(banner.t);
      banner.t = setTimeout(() => { el.hidden = true; }, 1650);
    }
  }
  const hideBanner = () => { $('banner').hidden = true; };

  function modal(html, wide = false) {
    const el = $('modal');
    if (!html) { el.hidden = true; el.innerHTML = ''; return null; }
    el.innerHTML = `<div class="dialog paper ${wide ? 'wide' : ''}">${html}</div>`;
    el.hidden = false;
    return el;
  }

  // ---------------------------------------------------------------- battle hud

  const forts = { 0: $('fort-player'), 1: $('fort-enemy') };
  function battleStart(left, right) {
    for (const [i, snap] of [[0, left], [1, right]]) {
      forts[i].innerHTML = `
        <div class="who">${i ? 'Enemy fortress' : 'Your fortress'}</div>
        <div class="row"><span class="name">${esc(snap.name)}${snap.wins != null ? ` <span class="muted" style="opacity:.6">${snap.wins}–${snap.losses}</span>` : ''}</span><span class="hp-num"></span></div>
        <div class="bar"><div class="lag"></div><div class="fill"></div><div class="shield"></div></div>
        <div class="statuses"></div>`;
    }
    $('battle-hud').hidden = false;
  }
  const STATUS_KEYS = [['burn', 'burn'], ['poison', 'poison'], ['sand', 'sand'], ['cold', 'cold'], ['heat', 'heat'], ['luck', 'luck']];
  const lastStatus = { 0: '', 1: '' };
  function battleUpdate(b) {
    for (const S of b.sides) {
      const el = forts[S.idx];
      const p = Math.max(0, S.hp) / S.maxHp;
      el.querySelector('.fill').style.width = `${p * 100}%`;
      el.querySelector('.lag').style.width = `${p * 100}%`;
      el.querySelector('.shield').style.width = `${Math.min(1, S.shield / S.maxHp) * 100}%`;
      el.querySelector('.hp-num').innerHTML = `${S.shield > 0 ? `${ico('shield')}${S.shield}` : ''} ${ico('heal')}${Math.max(0, Math.ceil(S.hp))}/${S.maxHp}`;
      // Status chips say what the stacks will do, not just how many there are.
      const tip = {
        burn: () => `<small>−${S.burn} next s</small>`,
        poison: () => `<small>−${S.poison} / 2s</small>`,
        sand: () => `<small>${Math.min(45, S.sand * 3)}% miss</small>`,
        cold: () => `<small>−${Math.min(50, S.cold * 2)}% speed</small>`,
        heat: () => `<small>+${Math.min(50, S.heat * 2)}% speed</small>`,
        luck: () => `<small>${Math.min(60, S.luck * 2)}% crit</small>`,
      };
      const recent = S.dmgLog.filter(([t]) => t > b.t - 3).reduce((a, [, n]) => a + n, 0) / Math.min(3, Math.max(1, b.t));
      const st = STATUS_KEYS.filter(([k]) => S[k] > 0).map(([k, icon]) => `<span class="status s-${k}">${ico(icon)}${S[k]} ${tip[k]()}</span>`).join('');
      const html = st + (recent >= 1 ? `<span class="status rate">taking ${Math.round(recent)}/s</span>` : '');
      if (html !== lastStatus[S.idx]) {
        el.querySelector('.statuses').innerHTML = html;
        lastStatus[S.idx] = html;
      }
    }
    const c = $('battle-clock');
    const sudden = b.t >= RULES.suddenDeath;
    c.textContent = sudden ? `Sudden death ${b.suddenK}` : `${b.t.toFixed(1)}s`;
    c.classList.toggle('sudden', sudden);
  }
  // Unit fights: castle HP plus how each army is doing.
  function laneUpdate(b) {
    for (const side of [0, 1]) {
      const el = forts[side];
      const c = b.castles[side];
      const p = Math.max(0, c.hp) / c.max;
      el.querySelector('.fill').style.width = `${p * 100}%`;
      el.querySelector('.lag').style.width = `${p * 100}%`;
      el.querySelector('.shield').style.width = '0%';
      el.querySelector('.hp-num').innerHTML = `${ico('heal')}${Math.max(0, Math.ceil(c.hp))}/${c.max}`;
      const alive = b.units.filter((u) => u.side === side && u.state !== 'dead').length;
      const st = b.stats[side];
      const html = `<span class="status">${alive} on the field</span><span class="status">${st.spawned} sent</span><span class="status">${st.lost} fallen</span>`;
      if (html !== lastStatus[side]) {
        el.querySelector('.statuses').innerHTML = html;
        lastStatus[side] = html;
      }
    }
    const clock = $('battle-clock');
    const siege = b.t >= 60;
    clock.textContent = siege ? `Siege! ${b.t.toFixed(0)}s` : `${b.t.toFixed(1)}s`;
    clock.classList.toggle('sudden', siege);
  }

  function flashStatus(side, kind) {
    const chip = forts[side].querySelector(`.s-${kind}`);
    if (!chip) return;
    chip.classList.remove('flash');
    void chip.offsetWidth;
    chip.classList.add('flash');
  }

  // Post-fight: who did the damage, on both sides.
  function breakdown(bd) {
    if (!bd) return '';
    const col = (side, title) => {
      const d = bd[side];
      const max = Math.max(1, ...d.units.map((u) => u.dealt));
      const rows = d.units.map((u) => `<div class="dmg-row"><span class="nm">${esc(nameOf(u.id))}${u.kills != null ? ` <span class="muted">· ${u.n} sent, ${u.kills} kills</span>` : u.n > 1 ? ` ×${u.n}` : ''}</span><span class="bar-mini"><i style="width:${(u.dealt / max) * 100}%"></i></span><b>${Math.round(u.dealt)}</b></div>`).join('');
      const t = bd[1 - side].taken;
      const ticks = [['burn', t.burn], ['poison', t.poison], ['thorns', t.thorns]].filter(([, n]) => n > 0).map(([k, n]) => `${k === 'thorns' ? 'thorns' : ico(k)} ${Math.round(n)}`).join(' · ');
      return `<div class="dmg-col"><h4>${title}</h4>${rows || '<div class="muted">No damage</div>'}${ticks ? `<div class="muted small">of which ticks: ${ticks}</div>` : ''}</div>`;
    };
    return `<div class="dmg-cols">${col(0, 'Your damage')}${col(1, 'Their damage')}</div><p class="muted small">Fight lasted ${bd[0].time.toFixed(1)}s. Damage includes hits on enemy units and on the castle.</p>`;
  }

  function battleEnd() {
    $('battle-hud').hidden = true;
  }
  function setSpeed(n) {
    document.querySelectorAll('.speed').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === n));
  }

  function setSound(muted) {
    $('btn-sound').innerHTML = muted ? '<span style="opacity:.5">♪</span>' : '♪';
  }

  function ideas(codex) {
    const rows = [...RECIPES.values()].filter((r) => codex.has(`${r.a}+${r.b}`)).map((r) => {
      const rare = r.rare && codex.has(`${r.a}+${r.b}!`) ? ` <span class="rare">★ ${esc(nameOf(r.rare))}</span>` : r.rare ? ' <span class="rare">★ ?</span>' : '';
      return `<div>${esc(nameOf(r.a))} + ${esc(nameOf(r.b))} → <b>${esc(nameOf(r.result))}</b>${rare}</div>`;
    });
    return modal(`
      <h2>Ideas</h2>
      <p class="muted">${rows.length} of ${RECIPES.size} combinations discovered. Drag a card onto another to try a recipe.</p>
      <div class="ideas">${rows.join('') || '<div class="muted">Nothing yet. Try a Villager on some Wood.</div>'}</div>
      <div class="actions"><button class="big-btn" data-close>Close</button></div>`, true);
  }

  function help() {
    return modal(`
      <h2>How to play</h2>
      <p>Build a wall of units, then fight a ghost of another player's fortress. You earn 5 gold a day (+2 for a win), so choose what to buy and what to upgrade. First fortress to 0 HP loses. Reach <b>10 wins</b> before <b>3 losses</b>.</p>
      <h4>Each day</h4>
      <ul>
        <li><b>Buy packs</b> from the top row, then click a pack on the table to pop its cards.</li>
        <li><b>Combine</b>: drag a card onto another. If a recipe exists they merge for gold: 1 for a tier II result, 3 for tier III, 5 for tier IV or a rare. A ★ means a rare can drop.</li>
        <li><b>Eaters</b> (cards with an "ate 0/5" tag) grow when you drop their food on them, and evolve after enough meals.</li>
        <li><b>Wall</b>: drag units into the slots at the bottom. Only wall units fight. Slots grow on days 4 and 7.</li>
        <li><b>Market</b> on the right sells singles. <b>Sell</b> cards top-left. Feed Ember, Bone, Berry, Coin or Stone to the <b>Shrine</b> to unlock track packs.</li>
      </ul>
      <h4>Fights</h4>
      <p>Units act on their own cooldowns. Shield absorbs damage. Burn deals its stacks every 1.5s, then halves. Poison deals its stacks every 3s and never fades; healing doesn't remove either. Freeze pauses a unit. From 45s, sudden death hurts both sides more and more.</p>
      <h4>Controls</h4>
      <p>Drag cards. Drag empty table to pan, scroll to zoom, double-click to reset the view. Hover anything for details.</p>
      <div class="actions"><button class="big-btn ghost" data-newrun>Abandon run</button><button class="big-btn" data-close>Got it</button></div>`);
  }

  return { hud, cardInfo, packInfo, info, hint, toast, banner, hideBanner, modal, battleStart, battleUpdate, laneUpdate, battleEnd, flashStatus, breakdown, setSpeed, setSound, ideas, help, ico, esc };
}
