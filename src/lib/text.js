/* Texto: normalização, semelhança e utilidades numéricas. */
export function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function lev(a, b) {
  if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
/** 0..1; tolera erros de digitação e prefixos */
export function sim(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return 0; if (a === b) return 1;
  let s = 1 - lev(a, b) / Math.max(a.length, b.length);
  if (b.startsWith(a) || a.startsWith(b)) s = Math.max(s, 0.85);
  return s;
}
/** nome de preset aceito pelo visor: ASCII, maiúsculo, até 20 caracteres */
export function ascii20(s) { return norm(s).toUpperCase().replace(/ +/g, ' ').slice(0, 20) || 'TONEMATCH'; }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
