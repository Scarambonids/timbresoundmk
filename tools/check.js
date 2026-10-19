/* Confere a estrutura: todo import relativo existe, e todo arquivo do app está na lista
   offline do service worker (e nada sobra nela). Uso: npm run check */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const appFiles = ['index.html', 'manifest.webmanifest', ...['src', 'css', 'assets'].flatMap(d => walk(join(root, d)).map(p => relative(root, p)))];
let errors = 0;

for (const f of appFiles.filter(f => f.endsWith('.js'))) {
  const src = readFileSync(join(root, f), 'utf8');
  for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
    if (!existsSync(resolve(root, dirname(f), m[1]))) { console.error(`✗ ${f}: import não encontrado ${m[1]}`); errors++; }
  }
}
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
for (const f of appFiles) if (!listed.includes(f)) { console.error(`✗ sw.js: falta ${f} na lista ASSETS`); errors++; }
for (const f of listed) if (!appFiles.includes(f)) { console.error(`✗ sw.js: ${f} está na lista mas não existe`); errors++; }

if (errors) { console.error(`\n${errors} problema(s).`); process.exit(1); }
console.log(`✓ ${appFiles.length} arquivos, imports e lista offline em ordem.`);
