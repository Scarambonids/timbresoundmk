import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLocal } from '../src/engine/localEngine.js';
import { presetFromAi } from '../src/engine/aiEngine.js';
import { modelOf } from '../src/domain/catalog.js';
import { BLOCK_ID } from '../src/domain/blocks.js';
import { fichaText } from '../src/engine/ficha.js';
import { keyLabel } from '../src/domain/music.js';

const req = o => ({ artist: '', song: '', intents: [], style: null, vol: 50, base: 'amp', namSlot: 0, analysis: null, ...o });
const amp = r => modelOf('AMP', r.preset.blocks[BLOCK_ID.AMP].model);
const cab = r => modelOf('CAB', r.preset.blocks[BLOCK_ID.CAB].model);

test('acha a música mesmo com erro de digitação', () => {
  const r = generateLocal(req({ artist: 'metalica', song: 'enter sandman' }));
  assert.match(r.explain.how, /Metallica · Enter Sandman/); assert.equal(r.bpm, 123); assert.equal(r.key, 'Em');
  assert.match(amp(r).ref, /Mesa/);
});
test('caixa acompanha a família do amp trocado pelo artista', () => {
  const r = generateLocal(req({ artist: 'Pink Floyd', song: 'Comfortably Numb' }));
  assert.match(amp(r).ref, /Fender Twin/); assert.match(cab(r).ref, /Fender Twin/);
  assert.ok(r.preset.blocks[BLOCK_ID.DS].on);
});
test('estilo sozinho gera preset', () => {
  const r = generateLocal(req({ style: 'metal' }));
  assert.match(r.explain.how, /Metal/); assert.ok(r.preset.blocks[BLOCK_ID.GATE].on);
});
test('intenção seco desliga delay e reverb', () => {
  const r = generateLocal(req({ artist: 'U2', song: 'With or Without You', intents: ['seco'] }));
  assert.ok(!r.preset.blocks[BLOCK_ID.DLY].on); assert.ok(!r.preset.blocks[BLOCK_ID.REV].on);
});
test('captura NAM usa o slot escolhido', () => {
  const r = generateLocal(req({ style: 'rock70', base: 'nam', namSlot: 119 }));
  assert.equal(r.preset.blocks[BLOCK_ID.AMP].model, 118);
});
test('resposta da IA com índice inválido e controle fora da faixa é corrigida', () => {
  const { preset } = presetFromAi({ name: 'x', blocks: { AMP: { on: true, model_index: 999, knobs: { Gain: 500 } }, DLY: { on: true, model_index: 0, knobs: { Time: 50 } } } }, req({}));
  assert.equal(preset.blocks[BLOCK_ID.AMP].knobs[0], 100);
  assert.equal(preset.blocks[BLOCK_ID.DLY].knobs[0], 100);
});
test('ficha lista a cadeia ligada', () => {
  const r = generateLocal(req({ artist: 'Pink Floyd', song: 'Comfortably Numb' }));
  assert.match(fichaText(r.preset), /CADEIA[\s\S]*DS > AMP > CAB/);
});
test('rótulo do tom', () => assert.equal(keyLabel('Bm'), 'Bm (Si menor) · relativo D'));
