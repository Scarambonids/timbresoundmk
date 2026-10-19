import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPreset, encodeInto, decodePreset, PRESET_SIZE } from '../src/domain/preset.js';
import { modelOf, fmtParam } from '../src/domain/catalog.js';
import { BLOCK_ID } from '../src/domain/blocks.js';

test('codifica e decodifica o preset sem perder campos', () => {
  const p = emptyPreset('Meu Timbre Ç');
  p.vol = 77; p.bpm = 133; p.chain = [0, 1, 2, 3, 4, 5, 6, 7, 9, 8, 10];
  p.blocks[BLOCK_ID.GATE] = { on: true, model: 1, knobs: [-60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const d = decodePreset(encodeInto(new Uint8Array(PRESET_SIZE), p));
  assert.equal(d.name, 'MEU TIMBRE C'); assert.equal(d.vol, 77); assert.equal(d.bpm, 133);
  assert.deepEqual(d.chain, p.chain);
  assert.equal(d.blocks[BLOCK_ID.GATE].knobs[0], -60);       // dB negativo em complemento de dois
});
test('mantém bytes desconhecidos (footswitches) da imagem original', () => {
  const base = new Uint8Array(PRESET_SIZE); base[0x14A] = 9; base[0x1BF] = 0x45;
  const img = encodeInto(base, emptyPreset());
  assert.equal(img[0x14A], 9); assert.equal(img[0x1BF], 0x45);
});
test('formata escala e unidade', () => {
  const cab = modelOf('CAB', 0).params;
  assert.equal(fmtParam(cab[2], 65), '6.5 kHz');
  assert.equal(fmtParam(cab[1], 80), '80 Hz');
});
