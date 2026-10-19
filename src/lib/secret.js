/* Chave da API cifrada com AES-GCM. A chave AES é do aparelho, não exportável, e fica no IndexedDB. */
import { DB } from './db.js';
import { lsGet, lsSet, KEYS } from './storage.js';

async function deviceKey() {
  let k = await DB.get('kv', 'aeskey').catch(() => null);
  if (!k) {
    k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await DB.put('kv', k, 'aeskey');
  }
  return k;
}
/** salva a chave cifrada; vazio apaga a configuração da IA */
export async function saveApiKey(plain) {
  if (!plain) { lsSet(KEYS.ai, null); return; }
  const k = await deviceKey(); const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(plain)));
  const cfg = lsGet(KEYS.ai, {}) || {}; cfg.iv = Array.from(iv); cfg.ct = Array.from(ct); lsSet(KEYS.ai, cfg);
}
export async function loadApiKey() {
  const cfg = lsGet(KEYS.ai, null); if (!cfg || !cfg.ct) return '';
  try {
    const k = await deviceKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(cfg.iv) }, k, new Uint8Array(cfg.ct));
    return new TextDecoder().decode(pt);
  } catch (e) { return ''; }
}
export function aiConfig() { return lsGet(KEYS.ai, null) || {}; }
export function aiEnabled() { return !!aiConfig().ct; }
