/* Acha o modelo da MK-300 cuja referência mais combina com um equipamento real. */
import { blockCat, isGuitarModel } from '../domain/catalog.js';
import { TONE_BLOCKS } from '../domain/blocks.js';
import { norm } from '../lib/text.js';

export function resolveRef(block, ref) {
  if (!ref) return null;
  const toks = norm(ref).split(' ').filter(t => t.length > 1);
  let best = null, bestScore = 0;
  for (const m of blockCat(block).models) {
    if (TONE_BLOCKS.includes(block) && !isGuitarModel(m)) continue;
    if (norm(m.ref) === norm(ref)) return m;
    const hay = norm(m.ref + ' ' + m.name); const padded = ' ' + hay + ' ';
    let s = 0;
    for (const t of toks) if (padded.includes(' ' + t + ' ')) s += t.length > 3 ? 2 : 1; else if (hay.includes(t)) s += 0.5;
    s -= Math.abs(hay.split(' ').length - toks.length) * 0.05;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}
