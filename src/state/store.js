/* Estado da sessão. O que precisa sobreviver ao fechar o app vai para o localStorage;
   o áudio da sessão vai para o IndexedDB. Artista e música abrem vazios, como no manual. */
import { lsGet, lsSet, KEYS } from '../lib/storage.js';
import { DB } from '../lib/db.js';
import { BLOCK_ID } from '../domain/blocks.js';
import { aiEnabled } from '../lib/secret.js';

const saved = lsGet(KEYS.session, {});

export const S = {
  tab: 'timbre',          // timbre | lib | live | set
  step: saved.preset ? 2 : 1,
  songId: null,           // música aberta na biblioteca
  preset: saved.preset || null,
  explain: saved.explain || null,
  meta: saved.meta || {}, // { artist, song, key, bpm }
  form: { base: 'amp', namSlot: 119, intents: [], style: null, vol: 50, audioName: '', analysis: null, ...(saved.form || {}), artist: '', song: '', audioBlob: null },
  slot: saved.slot || 150,
  sel: BLOCK_ID.AMP,      // bloco selecionado no Preset
  liveEdit: false,        // mudanças vão direto para a pedaleira
  busy: false,            // operação longa em andamento (pausa a leitura periódica)
  slotNames: lsGet(KEYS.slotNames, []),
  live: { bpm: 120, taps: [], drum: false, follow: false, loopTail: false, mods: null },
  aiOn: aiEnabled(),
};

export function saveSession() {
  const { audioBlob, artist, song, ...form } = S.form;
  lsSet(KEYS.session, { preset: S.preset, explain: S.explain, meta: S.meta, form, slot: S.slot });
}
export function saveSlotNames() { lsSet(KEYS.slotNames, S.slotNames); }

export async function setSessionAudio(blob) { if (blob) await DB.put('kv', blob, 'sessionAudio').catch(() => {}); else await DB.del('kv', 'sessionAudio').catch(() => {}); }
export async function restoreSessionAudio() {
  if (!S.form.audioName) return;
  S.form.audioBlob = await DB.get('kv', 'sessionAudio').catch(() => null);
  if (!S.form.audioBlob) { S.form.audioName = ''; S.form.analysis = null; }
}

/** aplica um resultado de geração ou de leitura como o timbre atual */
export function setTone({ preset, explain, meta = {} }) {
  S.preset = preset; S.explain = explain; S.meta = meta; S.liveEdit = false; S.sel = BLOCK_ID.AMP; saveSession();
}
