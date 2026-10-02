// Writes docs/roster-generated.md from src/content.js: every card, recipe and pack.
// Run: node tools/roster.mjs
import { writeFileSync } from 'node:fs';
import { CARDS, RECIPES, PACKS, TRACKS } from '../src/content.js';

const name = (id) => CARDS[id].name;
const madeFrom = new Map();
for (const r of RECIPES.values()) {
  const line = `${name(r.a)} + ${name(r.b)}${r.rare ? ` (${r.chance}%: ${name(r.rare)})` : ''}`;
  for (const id of [r.result, r.rare].filter(Boolean)) {
    if (!madeFrom.has(id)) madeFrom.set(id, []);
    madeFrom.get(id).push(id === r.rare ? `${name(r.a)} + ${name(r.b)} (${r.chance}%)` : line);
  }
}
for (const c of Object.values(CARDS)) {
  if (c.eats?.evolve) {
    const into = c.eats.evolve[1];
    if (!madeFrom.has(into)) madeFrom.set(into, []);
    madeFrom.get(into).push(`${c.name} after ${c.eats.evolve[0]} meals`);
  }
}
const packOf = new Map();
for (const p of Object.values(PACKS)) for (const [id] of p.pool) if (CARDS[id].kind === 'unit') packOf.set(id, p.name);

const section = (title, filter) => {
  const list = Object.values(CARDS).filter(filter);
  const rows = list.map((c) => `| ${c.name} | ${c.rare ? 'Rare' : c.tier} | ${c.text} | ${packOf.get(c.id) || (madeFrom.get(c.id) || []).join('<br>') || '—'} |`);
  return `## ${title} (${list.length})\n\n| Card | Tier | Effect | From |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
};

let md = `# Stackbrawl roster (generated)\n\nGenerated from \`src/content.js\` by \`node tools/roster.mjs\`. Do not edit by hand.\n\n`;
md += `${Object.values(CARDS).filter((c) => c.kind === 'unit').length} units, ${RECIPES.size} recipes.\n\n`;
md += `## Packs\n\n| Pack | Price | Unlock | Contents |\n| --- | --- | --- | --- |\n`;
for (const p of Object.values(PACKS)) {
  const t = TRACKS.find((x) => x.id === p.track);
  const unlock = t ? `Feed ${t.packs.indexOf(p.id) ? 12 : 5} ${name(t.feed)}` : 'Start';
  md += `| ${p.name} | ${p.price} | ${unlock} | ${p.pool.map(([id]) => name(id)).join(', ')}${p.rare ? `; 10% ${name(p.rare)}` : ''} |\n`;
}
md += '\n';
md += section('Base game units', (c) => c.kind === 'unit' && !c.track && !c.rare);
md += '\n' + section('Track units', (c) => c.track);
md += '\n' + section('Rares', (c) => c.rare);
writeFileSync(new URL('../docs/roster-generated.md', import.meta.url), md);
console.log('wrote docs/roster-generated.md');
