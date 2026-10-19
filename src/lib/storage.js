/* localStorage com proteção: nunca lança, devolve o padrão quando falha. */
const has = () => { try { return typeof localStorage !== 'undefined'; } catch (e) { return false; } };

export function lsGet(key, fallback) {
  if (!has()) return fallback;
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
export function lsSet(key, value) {
  if (!has()) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* cheio ou bloqueado */ }
}
export function lsClear() { if (has()) try { localStorage.clear(); } catch (e) {} }

/* chaves usadas pelo app, num lugar só */
export const KEYS = {
  session: 'tm.session', slotNames: 'tm.slotNames', midiCh: 'tm.midiCh',
  ai: 'tm.ai', aiCache: 'tm.aicache', nameOverrides: 'tm.nameOverrides', catalogRaw: 'tm.catalogRaw',
  inputDevice: 'tm.indev', btVolume: 'tm.btvol',
};
