/* Busca na base de músicas, artistas e estilos (com tolerância a erro de digitação). */
import { ARTISTS } from '../data/artists.js';
import { SONGS } from '../data/songs.js';
import { sim, norm } from '../lib/text.js';

export function findArtist(name) {
  if (!name) return null; let best = null, bs = 0;
  for (const ar of ARTISTS) for (const n of [ar[0], ...ar[3]]) { const s = sim(name, n); if (s > bs) { bs = s; best = ar; } }
  return bs >= 0.72 ? { name: best[0], style: best[1], rig: best[2] } : null;
}
export function findSong(artist, title) {
  if (!title) return null; let best = null, bs = 0;
  const ar = artist ? findArtist(artist) : null;
  for (const s of SONGS) {
    let sc = sim(title, s.t); if (sc < 0.6) continue;
    if (artist) sc = sc * 0.75 + (ar && ar.name === s.a ? 0.25 : sim(artist, s.a) * 0.25);
    if (sc > bs) { bs = sc; best = s; }
  }
  return bs >= 0.7 ? best : null;
}
/** busca livre "artista música" para BPM e tom do backing track */
export function lookupSong(query) {
  if (!query) return null;
  let best = null, bs = 0;
  for (const s of SONGS) { const sc = Math.max(sim(query, s.a + ' ' + s.t), sim(query, s.t)); if (sc > bs) { bs = sc; best = s; } }
  return bs > 0.6 ? best : null;
}
export function guessStyle(text) {
  const t = norm(text);
  const rules = [[/metal|thrash|djent|death|hardcore/, 'metal'], [/blues/, 'blues'], [/jazz|bossa/, 'jazz'], [/funk|disco|soul/, 'wahfunk'], [/ambient|worship|post rock|shoegaze/, 'ambient'], [/punk|emo/, 'punk'], [/grunge/, 'grunge'], [/country/, 'country'], [/indie|britpop/, 'indie'], [/pop|sertanejo|mpb|pagode/, 'pop']];
  for (const [r, s] of rules) if (r.test(t)) return s;
  return null;
}
export const artistNames = () => ARTISTS.map(a => a[0]);
export const songsOf = artist => SONGS.filter(s => !artist || sim(artist, s.a) > 0.6).map(s => s.t);
