// DOM overlay: HUD chips, hover info, drag hint, toasts, banners, modals,
// and the fortress bars during a fight.
import { CARDS, PACKS, RECIPES, RULES, TRACKS, TRACK_FAMILY, fortressHp, wallSlots, combineCost, starMult } from './content.js';
import { iconURL, ROMAN, cardStats, TRINKET_METAL } from './gfx/draw.js';
import { TRINKETS, TK_BY } from './trinkets.js';

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
    $('fight-sub').innerHTML = `${ico('heal')} ${fortressHp(s.day)} fortress · ${onWall}/${wallSlots(s.day)} on wall`;
  }

  function cardInfo(id, { inst = null, price = null, sell = null, codex = new Set(), extra = '', att = inst?.att || 1, bound = null } = {}) {
    const d = CARDS[id];
    const tag = d.kind === 'ingredient'
      ? 'Ingredient'
      : `${d.rare ? '<span class="rare-tag">★ Rare</span> · ' : ''}Tier ${ROMAN[d.tier]} ${d.track ? 'track unit' : 'unit'}${d.tags?.includes('creature') ? ' · creature' : ''}`;
    const stats = d.kind === 'unit' ? cardStats(d, inst?.perm || 0, null, inst?.stars || 0, att).map((st) => `<span>${ico(st.k)}${esc(st.n)}</span>`).join('') : '';
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
    const stars = inst?.stars || 0;
    const starLine = d.kind !== 'unit' ? '' : stars
      ? `<p><span class="rare">${'★'.repeat(stars)}</span> All numbers ×${starMult(d, stars)}, ${Math.round(stars * RULES.starHaste * 100)}% faster.${stars < 3 ? ' Merge another copy for more.' : ''}</p>`
      : '<p class="muted small">Drop a copy of this unit on it to add a ★ (up to ★★★).</p>';
    const fam = Object.keys(TRACK_FAMILY).find((k) => TRACK_FAMILY[k].has(id));
    const shrine = TRACKS.find((t) => t.id === (att > 1 ? bound : fam))?.name;
    const attLine = d.kind !== 'unit' || !fam ? ''
      : att > 1 ? `<p><span class="attuned">◆ Attuned</span> to your ${esc(shrine)} shrine: numbers ×${+att.toFixed(2)}.</p>`
      : `<p class="muted small">${esc(shrine)} family: attuned (stronger) when your shrine is bound to ${esc(shrine)}.</p>`;
    return `<h3>${esc(d.name)}${stars ? ` <span class="rare">${'★'.repeat(stars)}</span>` : ''}</h3><span class="tag">${tag}</span>${right}<div class="stats">${stats}</div><p>${esc(d.text)}</p>${starLine}${attLine}${perm}${extra}${recipes}`;
  }

  // Right-click popover: what this card combines with. Partners you own are
  // lit; results stay hidden until discovered.
  function combos(id, { codex = new Set(), owned = new Set(), artURL = () => null, x = 0, y = 0 } = {}) {
    const el = $('combos');
    if (id == null) { el.hidden = true; return; }
    const d = CARDS[id];
    const thumb = (cid, cls = '') => {
      const url = artURL(cid);
      return url ? `<i class="cb-thumb ${cls}" style="background-image:url(${url})"></i>` : `<i class="cb-thumb icon ${cls}" style="background-image:url(${iconURL(cid)})"></i>`;
    };
    const uses = [...RECIPES.values()].filter((r) => r.a === id || r.b === id)
      .map((r) => ({ r, other: r.a === id ? r.b : r.a, known: codex.has(`${r.a}+${r.b}`) }))
      .sort((p, q) => (owned.has(q.other) - owned.has(p.other)) || (q.known - p.known) || (CARDS[p.r.result].tier - CARDS[q.r.result].tier));
    const MAX = 8;
    const rows = uses.slice(0, MAX).map(({ r, other, known }) => {
      const res = known
        ? `${thumb(r.result)}<span class="cb-name">${esc(nameOf(r.result))}</span>`
        : `<i class="cb-thumb unknown">?</i><span class="cb-name muted">Tier ${ROMAN[CARDS[r.result].tier]}</span>`;
      const cost = combineCost(r.result);
      return `<div class="cb-row${owned.has(other) ? ' have' : ''}" data-result="${r.result}" data-known="${known ? 1 : 0}"${r.rare ? ` data-rare="${r.rare}" data-chance="${r.chance}"` : ''}>${thumb(other)}<span class="cb-name">${esc(nameOf(other))}</span><span class="cb-arrow">→</span>${res}${cost ? `<span class="cb-cost">${ico('coin')}${cost}</span>` : '<span class="cb-cost"></span>'}${r.rare && known ? `<span class="cb-rare" title="${r.chance}% rare">★</span>` : ''}</div>`;
    }).join('') + (uses.length > MAX ? `<div class="cb-more">+${uses.length - MAX} more combinations</div>` : '');
    const from = [...RECIPES.values()].filter((r) => r.result === id);
    const madeOf = from.length ? `<div class="cb-foot">Made from ${from.map((r) => `${esc(nameOf(r.a))} + ${esc(nameOf(r.b))}`).join(' or ')}</div>` : '';
    const eats = d.eats ? `<div class="cb-foot">Eats ${d.eats.foods.map((f) => `${ico(f)}${esc(nameOf(f))}`).join(' ')}${d.eats.evolve ? ` · evolves at ${d.eats.evolve[0]}` : ''}</div>` : '';
    const eaters = d.kind === 'ingredient' ? Object.values(CARDS).filter((c) => c.eats?.foods.includes(id)) : [];
    const forge = d.kind === 'ingredient' && TK_BY[id] ? `<div class="cb-foot">Bundle ×2–×5 on the rack: ${[2, 3, 4, 5].map((n) => `${TRINKET_METAL[n].name.toLowerCase()} ×${n}`).join(', ')} trinkets</div>` : '';
    const fedTo = eaters.length ? `<div class="cb-foot">Food for ${eaters.map((c) => esc(c.name)).join(', ')}</div>` : '';
    el.innerHTML = `<div class="cb-head">${thumb(id, 'big')}<div><b>${esc(d.name)}</b><span class="muted">${uses.length ? `combines with ${uses.length}` : 'no combinations'}</span></div></div>${rows ? `<div class="cb-list">${rows}</div>` : ''}${eats}${fedTo}${forge}${madeOf}`;
    el.hidden = false;
    el.style.left = '0px';
    el.style.top = '0px';
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.min(window.innerWidth - r.width - 10, Math.max(10, x + 14))}px`;
    el.style.top = `${Math.max(10, Math.min(window.innerHeight - r.height - 24, y - 20))}px`;
  }

  // Floating card preview: what a combine or a meal turns into.
  function preview(p, x = 0, y = 0, { side = 'right', avoid = null } = {}) {
    const el = $('preview');
    if (!p) { el.hidden = true; el.dataset.key = ''; return; }
    if (el.dataset.key !== p.key) {
      el.dataset.key = p.key;
      if (p.cards) {
        el.classList.add('multi');
        el.innerHTML = `<div class="pv-label">${p.label}</div><div class="pv-grid">${p.cards.map((c) => `<div class="pv-opt"><img class="pv-card" src="${c.img}" width="400" height="544" alt="${esc(c.name)}"><b>${esc(c.name)}</b><span>${esc(c.text)}</span></div>`).join('')}</div>`;
      } else {
        el.classList.remove('multi');
        const d = CARDS[p.id] || TRINKETS[p.id];
        el.innerHTML = `<div class="pv-label">${p.label}</div><img class="pv-card" src="${p.img}" width="400" height="544" alt="${esc(d.name)}"><p class="pv-text">${esc(d.text)}</p>${p.note ? `<div class="pv-note">${p.note}</div>` : ''}`;
      }
    }
    el.hidden = false;
    const r = el.getBoundingClientRect();
    let left = side === 'left' ? x - r.width - 18 : x + 26;
    let top = y - r.height / 2;
    // keep clear of the drag hint: sit to its right, or below it
    const a = avoid && !avoid.hidden ? avoid.getBoundingClientRect() : null;
    if (a) {
      left = Math.max(left, a.right + 12);
      if (left + r.width > window.innerWidth - 8) { left = x - r.width / 2; top = a.bottom + 12; }
    }
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, left))}px`;
    el.style.top = `${Math.max(8, Math.min(window.innerHeight - r.height - 8, top))}px`;
  }

  function trinketInfo(id, { sell = null } = {}) {
    const t = TRINKETS[id];
    const M = TRINKET_METAL[t.size];
    const right = sell != null ? `<span class="sell muted">sells ${ico('coin')} ${sell}</span>` : '';
    return `<h3>${esc(t.name)}</h3><span class="tag">${M.name} trinket · ${ico(t.res)} ×${t.size}</span>${right}<p>${esc(t.text)}</p><p class="muted small">Trinkets on the rack work in every fight. Drag to rearrange, or onto Sell.</p>`;
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
  function flashStatus(side, kind) {
    const chip = forts[side].querySelector(`.s-${kind}`);
    if (!chip) return;
    chip.classList.remove('flash');
    void chip.offsetWidth;
    chip.classList.add('flash');
  }

  // Post-fight: who did the damage, on both sides.
  // End-of-round summary: a damage donut per side (normal / burn / poison),
  // crit and miss rates, peak statuses, and a per-unit board table on demand.
  const DMG_TYPES = [
    ['normal', 'Normal', '#3d74b8', 'dmg'],
    ['burn', 'Burn', '#e8892a', 'burn'],
    ['poison', 'Poison', '#2f7d33', 'poison'],
  ];
  function donut(parts, total) {
    const R = 46;
    const C = 2 * Math.PI * R;
    const gap = total > 0 && parts.filter((p) => p.v > 0).length > 1 ? 2.5 : 0;
    let off = 0;
    const segs = parts.filter((p) => p.v > 0).map((p) => {
      const len = (p.v / total) * C;
      const seg = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${p.color}" stroke-width="18" stroke-dasharray="${Math.max(0.01, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${p.label}: ${p.v} (${Math.round((p.v / total) * 100)}%)</title></circle>`;
      off += len;
      return seg;
    }).join('');
    const empty = total > 0 ? '' : `<circle r="${R}" cx="60" cy="60" fill="none" stroke="rgba(42,36,28,0.12)" stroke-width="18"/>`;
    return `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Damage by type">${empty}${segs}<text x="60" y="58" text-anchor="middle" class="d-num">${total}</text><text x="60" y="76" text-anchor="middle" class="d-sub">damage</text></svg>`;
  }

  function breakdown(bd, { artURL = () => null } = {}) {
    if (!bd) return '';
    const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');
    const col = (side, title) => {
      const d = bd[side];
      const t = bd[1 - side].taken;
      const vals = { normal: Math.round(t.dmg + t.thorns), burn: Math.round(t.burn), poison: Math.round(t.poison) };
      const total = vals.normal + vals.burn + vals.poison;
      const parts = DMG_TYPES.map(([k, label, color]) => ({ k, label, color, v: vals[k] }));
      const legend = DMG_TYPES.map(([k, label, color, icon]) => `<div class="lg${vals[k] ? '' : ' zero'}"><i class="sw" style="background:${color}"></i>${ico(icon)}<span>${label}</span><b>${vals[k]}</b><span class="muted">${total ? pct(vals[k], total) : ''}</span></div>`).join('');
      const healed = Math.round(d.units.reduce((a, u) => a + u.st.heal, 0));
      const shielded = Math.round(d.units.reduce((a, u) => a + u.st.shield, 0));
      const chips = [
        `<span class="sc" title="${d.crits} of ${d.attacks} attacks">${ico('luck')}<b>${pct(d.crits, d.attacks)}</b> crit</span>`,
        d.misses ? `<span class="sc" title="${d.misses} attacks missed">${ico('sand')}<b>${pct(d.misses, d.attacks + d.misses)}</b> missed</span>` : '',
        healed ? `<span class="sc">${ico('heal')}<b>${healed}</b> healed</span>` : '',
        shielded ? `<span class="sc">${ico('shield')}<b>${shielded}</b> shield</span>` : '',
      ].join('');
      const peaks = [['burn', 'burn'], ['poison', 'poison'], ['sand', 'sand'], ['luck', 'luck'], ['heat', 'heat'], ['cold', 'cold']]
        .filter(([k]) => d.peak[k] > 0)
        .map(([k, icon]) => `<span class="pk" title="Most ${k} on ${side ? 'them' : 'you'} this fight">${ico(icon)}${Math.round(d.peak[k])}</span>`).join('');
      return `<div class="sum-col"><h4>${title}</h4>
        <div class="pie-wrap">${donut(parts, total)}<div class="legend">${legend}</div></div>
        <div class="sum-chips">${chips}</div>
        ${peaks ? `<div class="peaks"><span class="muted">Peak on ${side ? 'them' : 'you'}</span>${peaks}</div>` : ''}</div>`;
    };
    const COLS = [
      ['hit', 'dmg', 'Damage'], ['burn', 'burn', 'Burn'], ['poison', 'poison', 'Poison'], ['freeze', 'freeze', 'Freeze'],
      ['heal', 'heal', 'Heal'], ['shield', 'shield', 'Shield'],
    ];
    const board = (side, title) => {
      const d = bd[side];
      const cols = COLS.filter(([k]) => d.units.some((u) => u.st[k] >= 0.5));
      const anyCrit = d.units.some((u) => u.st.attacks > 0);
      const fmt = (k, v) => (k === 'freeze' ? `${v.toFixed(1)}s` : Math.round(v));
      const head = `<tr><th></th>${cols.map(([, icon, label]) => `<th title="${label}">${ico(icon)}<span>${label}</span></th>`).join('')}${anyCrit ? `<th title="Crits / attacks">${ico('luck')}<span>Crit</span></th>` : ''}</tr>`;
      const rows = d.units.map((u) => {
        const url = artURL(u.id);
        const th = url ? `<i class="bt-thumb" style="background-image:url(${url})"></i>` : `<i class="bt-thumb icon" style="background-image:url(${iconURL(u.id)})"></i>`;
        const cells = cols.map(([k]) => `<td class="${u.st[k] >= 0.5 ? '' : 'z'}">${u.st[k] >= 0.5 ? fmt(k, u.st[k]) : '·'}</td>`).join('');
        const crit = anyCrit ? `<td class="${u.st.crits ? '' : 'z'}">${u.st.attacks ? `${u.st.crits}/${u.st.attacks}` : '·'}</td>` : '';
        const applied = [u.st.burnApplied ? `${ico('burn')}${Math.round(u.st.burnApplied)}` : '', u.st.poisonApplied ? `${ico('poison')}${Math.round(u.st.poisonApplied)}` : ''].filter(Boolean).join(' ');
        return `<tr><td class="nm"><div>${th}<span>${esc(nameOf(u.id))}${u.n > 1 ? ` ×${u.n}` : ''}${applied ? `<small title="Stacks applied">applied ${applied}</small>` : ''}</span></div></td>${cells}${crit}</tr>`;
      }).join('');
      return `<div class="bt"><h4>${title}</h4>${d.units.length ? `<table>${head}${rows}</table>` : '<div class="muted">No units</div>'}</div>`;
    };
    return `<div class="sum-cols">${col(0, 'You')}${col(1, esc(bd[1].name || 'Them'))}</div>
      <div class="sum-foot"><span class="muted small">Fight lasted ${bd[0].time.toFixed(1)}s.</span><button class="link-btn" data-board>See board summary</button></div>
      <div class="board-sum" hidden>${board(0, 'Your board')}${board(1, 'Their board')}<p class="muted small">Burn and poison damage is credited to the units that applied the stacks.</p></div>`;
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

  // First launch: one short card, then the hands-on tutorial.
  function intro() {
    return modal(`
      <h2>Stackbrawl</h2>
      <p>Build a wall of card units and fight other players' walls. Win <b>10</b> fights before you lose <b>3</b>.</p>
      <div class="actions"><button class="big-btn ghost-dark" data-skip-tut>Skip tutorial</button><button class="big-btn red" data-start-tut>Start</button></div>`);
  }

  // Tutorial bubble: text near a screen point, with a pulsing ring on the target.
  function coach(step, at) {
    const el = $('coach');
    const ring = $('coach-ring');
    if (!step) { el.hidden = true; ring.hidden = true; el.dataset.key = ''; return; }
    if (el.dataset.key !== step.key) {
      el.dataset.key = step.key;
      el.innerHTML = `<div class="co-n">${step.n}/${step.of}</div><p>${step.text}</p><div class="co-actions">${step.next ? '<button class="co-next" data-co-next>Got it</button>' : ''}<button class="co-skip" data-co-skip>Skip tutorial</button></div>`;
    }
    el.hidden = false;
    ring.hidden = !at;
    if (!at) {
      el.style.left = '50%';
      el.style.top = '96px';
      el.style.transform = 'translateX(-50%)';
      return;
    }
    ring.style.left = `${at.x}px`;
    ring.style.top = `${at.y}px`;
    const r = el.getBoundingClientRect();
    const below = at.y < window.innerHeight * 0.45;
    const x = Math.max(12, Math.min(window.innerWidth - r.width - 12, at.x - r.width / 2));
    const y = below ? at.y + 54 : at.y - r.height - 54;
    el.style.transform = 'none';
    el.style.left = `${x}px`;
    el.style.top = `${Math.max(64, Math.min(window.innerHeight - r.height - 12, y))}px`;
  }

  function help() {
    return modal(`
      <h2>How to play</h2>
      <ul class="tight">
        <li><b>Packs</b> cost gold; click one on the table to open it. Saving earns interest: +1 per 10 gold held, up to +3.</li>
        <li><b>Combine</b> by dragging a card onto another.</li>
        <li><b>Wall</b> units fight. Press <b>Fight!</b> when ready.</li>
        <li>Stack the same resource and drop it on the <b>rack</b> for a trinket. Feed the <b>shrine</b> to open a themed track.</li>
        <li>Hover or right-click anything for details.</li>
      </ul>
      <div class="actions"><button class="big-btn" data-close>Got it</button></div>`);
  }

  function menu(s, { muted = false, midFight = false } = {}) {
    return modal(`
      <h2>Menu</h2>
      <p class="muted">Day ${s.day} · ${s.wins} wins, ${s.losses} losses · ${s.gold} gold</p>
      <div class="menu-list">
        <button class="big-btn" data-close type="button">Resume</button>
        <button class="big-btn red" data-newgame type="button">New game</button>
        <button class="big-btn ghost-dark" data-help type="button">How to play</button>
        <button class="big-btn ghost-dark" data-ideas type="button">Ideas</button>
        <button class="big-btn ghost-dark" data-sound type="button">Sound: ${muted ? 'off' : 'on'}</button>
      </div>`);
  }

  function confirmNewGame(s, { midFight = false } = {}) {
    return modal(`
      <h2>Start a new game?</h2>
      <p>Your current run (day ${s.day}, ${s.wins}–${s.losses}) will be lost${midFight ? ', and this fight ends now' : ''}. Recipes you've discovered are kept.</p>
      <div class="actions"><button class="big-btn ghost" data-close type="button">Cancel</button><button class="big-btn red" data-confirm-new type="button">Start new game</button></div>`);
  }

  return { menu, confirmNewGame, intro, coach, hud, cardInfo, trinketInfo, combos, preview, packInfo, info, hint, toast, banner, hideBanner, modal, battleStart, battleUpdate, battleEnd, flashStatus, breakdown, setSpeed, setSound, ideas, help, ico, esc };
}
