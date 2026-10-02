// Builds the single-page version published as a claude.ai artifact.
// Every module URL gets ?v=<stamp> through the import map, so a republish
// never mixes cached old scripts with new ones.
// Run: node tools/build-artifact.mjs <out.html> [stamp]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const out = process.argv[2];
const stamp = process.argv[3] || execSync('git rev-parse --short HEAD').toString().trim() + Date.now().toString(36);
const root = new URL('..', import.meta.url).pathname;

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) files.push(relative(root, p));
  }
})(join(root, 'src'));

const imports = { three: `./vendor/three/three.module.js?v=${stamp}` };
for (const f of files) imports[`./${f}`] = `./${f}?v=${stamp}`;
imports['./vendor/three/three.core.js'] = `./vendor/three/three.core.js?v=${stamp}`;

let html = readFileSync(join(root, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/\s*<meta[^>]*>/g, '');
let body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n</script>`;
const page = head.replace(/<script type="importmap">[\s\S]*?<\/script>/, map)
  .replace('href="styles.css"', `href="styles.css?v=${stamp}"`).trim()
  + '\n' + body.replace('src="src/main.js"', `src="src/main.js?v=${stamp}"`).trim() + '\n';
writeFileSync(out, page);
console.log(`wrote ${out} (stamp ${stamp}, ${files.length} modules)`);
