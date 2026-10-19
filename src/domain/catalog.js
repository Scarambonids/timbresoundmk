/* Catálogo em uso: o padrão (planilha V75) ou um importado, com os nomes corrigidos pelo usuário. */
import { CATALOG_DEFAULT } from '../data/catalog.js';
import { BLOCK_ID } from './blocks.js';
import { lsGet, KEYS } from '../lib/storage.js';
import { norm } from '../lib/text.js';

let CATALOG = null;

export function buildCatalog(raw = lsGet(KEYS.catalogRaw, null) || CATALOG_DEFAULT, overrides = lsGet(KEYS.nameOverrides, {})) {
  CATALOG = raw.map(b => ({
    id: b.id, name: b.name,
    models: b.models.map(([index, name, ref, params]) => ({
      index, name: (overrides[b.name] && overrides[b.name][index]) || name, original: name, ref,
      params: params.map(([pn, min, max, def, scale, unit]) => ({ name: pn, min, max, def, scale, unit })),
    })),
  }));
  return CATALOG;
}
export function catalog() { return CATALOG || buildCatalog(); }
export function blockCat(b) { return catalog()[typeof b === 'number' ? b : BLOCK_ID[b]]; }
export function modelOf(b, idx) { const bc = blockCat(b); return bc.models.find(m => m.index === idx) || bc.models[0]; }
export function modelByName(b, name) {
  const bc = blockCat(b); const n = norm(name);
  return bc.models.find(m => norm(m.name) === n || norm(m.original) === n) || bc.models.find(m => norm(m.name).includes(n));
}
/** modelos de guitarra (exclui baixo e violão nos blocos AMP/CAB/DS) */
export function isGuitarModel(m) { const n = m.original || m.name; return !/^\d*\s*(bass|ac-)/i.test(n); }
export function modelGroup(m, blockName) {
  const n = m.original;
  if (/^\d*Bass/i.test(n)) return 'Baixo';
  if (/^\d*AC-/i.test(n)) return blockName === 'AMP' ? 'Violão' : 'Acústico';
  if (/^MW-/.test(n)) return 'Modelos MW';
  return 'Guitarra';
}
export function defaultsFor(b, idx) { const m = modelOf(b, idx); const k = new Array(12).fill(0); m.params.forEach((p, i) => (k[i] = p.def)); return k; }
/** valor bruto → texto com escala e unidade (Speed x10, kHz, dB…) */
export function fmtParam(p, raw) {
  if (p.name === 'Sync' && p.max === 1) return raw ? 'on' : 'off';
  const v = raw * p.scale; const s = p.scale < 1 ? v.toFixed(1) : String(Math.round(v));
  return p.unit ? `${s} ${p.unit}` : s;
}
/** converte um catalog.json no formato do MK300 Studio para o formato interno */
export function rawFromStudioJson(j) {
  const blocks = j.blocks || j;
  return blocks.map(b => ({
    id: b.id, name: b.name,
    models: b.models.map(m => [m.index, m.name, m.reference || m.ref || '',
      (m.parameters || m.params || []).map(p => [p.name, p.min, p.max, p.default ?? p.def, p.scale ?? 1, p.unit || ''])]),
  }));
}
