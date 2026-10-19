/* Servidor local para testar no computador: npm start → http://localhost:5173
   (localhost conta como seguro, então USB MIDI funciona no Chrome do computador). */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = +process.env.PORT || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, path || 'index.html');
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file.endsWith('/') ? file + 'index.html' : file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body); }
  catch (e) { res.writeHead(404).end('não encontrado'); }
}).listen(port, () => console.log(`ToneMatch em http://localhost:${port}`));
