/* Preset da MK-300: estrutura de 448 bytes (buffer de edição e cada slot do banco). */
import { BLOCKS, BLOCK_ID } from './blocks.js';
import { blockCat, modelOf, defaultsFor } from './catalog.js';
import { ascii20 } from '../lib/text.js';

export const PRESET_SIZE = 448;
export const SLOTS = 160;
export const OFF = { NAME: 0x00, VOL: 0x18, BPM: 0x1A, PAN: 0x1C, CHAIN: 0x20, EN: 0x2B, MODEL: 0x36, KNOBS: 0x42 };
export const knobOff = (block, knob) => OFF.KNOBS + 24 * block + 2 * knob;

const i16 = (img, o) => { const v = img[o] | (img[o + 1] << 8); return v & 0x8000 ? v - 0x10000 : v; };
export const nameFromBytes = bytes => String.fromCharCode(...Array.from(bytes).slice(0, 20).filter(c => c >= 32 && c < 127)).trim();
export const validChain = c => c.length === 11 && new Set(c).size === 11 && c.every(x => x >= 0 && x < 11);

/** bytes → { name, vol, bpm, pan, chain[11], blocks[11]{on, model, knobs[12]} } */
export function decodePreset(img) {
  const p = { name: nameFromBytes(img), vol: i16(img, OFF.VOL), bpm: i16(img, OFF.BPM), pan: i16(img, OFF.PAN), chain: Array.from(img.slice(OFF.CHAIN, OFF.CHAIN + 11)), blocks: [] };
  if (!validChain(p.chain)) p.chain = BLOCKS.map((_, i) => i);
  for (let b = 0; b < 11; b++) {
    const knobs = []; for (let k = 0; k < 12; k++) knobs.push(i16(img, knobOff(b, k)));
    p.blocks.push({ on: !!img[OFF.EN + b], model: img[OFF.MODEL + b], knobs });
  }
  return p;
}
/** grava os campos conhecidos sobre uma imagem existente; o resto (footswitches, expressão) fica intacto */
export function encodeInto(base, p) {
  const img = Uint8Array.from(base);
  const nm = ascii20(p.name); for (let i = 0; i < 20; i++) img[i] = i < nm.length ? nm.charCodeAt(i) : 0;
  const w16 = (o, v) => { v = Math.round(v) & 0xFFFF; img[o] = v & 255; img[o + 1] = v >> 8; };
  w16(OFF.VOL, p.vol); w16(OFF.BPM, p.bpm); w16(OFF.PAN, p.pan || 0);
  p.chain.forEach((b, i) => (img[OFF.CHAIN + i] = b));
  p.blocks.forEach((bl, b) => {
    img[OFF.EN + b] = bl.on ? 1 : 0; img[OFF.MODEL + b] = bl.model;
    modelOf(b, bl.model).params.forEach((_, k) => w16(knobOff(b, k), bl.knobs[k]));
  });
  return img;
}
export function emptyPreset(name = 'NOVO TIMBRE') {
  return {
    name, vol: 50, bpm: 120, pan: 0, chain: BLOCKS.map((_, i) => i),
    blocks: BLOCKS.map((n, b) => { const idx = blockCat(b).models[0].index; return { on: ['AMP', 'CAB', 'VOL'].includes(n), model: idx, knobs: defaultsFor(b, idx) }; }),
  };
}
export const clonePreset = p => JSON.parse(JSON.stringify(p));
export const isPreset = p => !!(p && Array.isArray(p.blocks) && p.blocks.length === 11 && Array.isArray(p.chain));
export { BLOCK_ID };
