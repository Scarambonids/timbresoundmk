/* Fluxos completos contra a MK-300 simulada. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pedal } from '../src/device/pedal.js';
import { EmulatorTransport, makeState } from '../src/device/transports/emulator.js';
import { decodePreset, PRESET_SIZE } from '../src/domain/preset.js';
import { generateLocal } from '../src/engine/localEngine.js';
import { toBlePackets, BleMidiParser } from '../src/device/transports/bleMidi.js';
import { writeU16 } from '../src/device/protocol.js';

async function connected() {
  const state = makeState();
  const pedal = new Pedal({ transports: { USB: class extends EmulatorTransport { constructor() { super(state); } } } });
  await pedal.connect('USB');
  return { pedal, state };
}
const tone = generateLocal({ artist: 'Pink Floyd', song: 'Comfortably Numb', intents: ['solo'], style: null, vol: 60, base: 'amp', namSlot: 0, analysis: null });

test('ouvir sem salvar escreve no buffer e não toca no banco', async () => {
  const { pedal, state } = await connected();
  const before = state.bank.slice();
  const n = await pedal.audition(tone.preset);
  assert.ok(n > 0);
  const buf = decodePreset(state.buffer);
  assert.equal(buf.name, 'COMFORTABLY NUMB'); assert.equal(buf.vol, 60);
  assert.deepEqual(buf.blocks.map(b => b.model), tone.preset.blocks.map(b => b.model));
  assert.deepEqual(state.bank, before);
  assert.equal(await pedal.audition(tone.preset), 0, 'segunda vez não manda nada');
});
test('salvar grava o slot, mantém footswitches e carrega', async () => {
  const { pedal, state } = await connected();
  await pedal.save(149, tone.preset);
  const slot = state.bank.slice(149 * PRESET_SIZE, 150 * PRESET_SIZE);
  assert.equal(decodePreset(slot).name, 'COMFORTABLY NUMB');
  assert.equal(slot[0x14A], 0x09);
  assert.equal(state.status[0], 149);
  assert.ok(state.log.includes('COMMIT'));
});
test('lê os nomes dos 160 slots', async () => {
  const { pedal } = await connected();
  const names = await pedal.readAllNames();
  assert.equal(names.length, 160); assert.equal(names[0], 'FACTORY 1'); assert.equal(names[100], '');
});
test('control change no canal escolhido', async () => {
  const { pedal, state } = await connected();
  pedal.channel = 2; await pedal.cc(21, 127);
  assert.equal(state.log.at(-1), 'CC 177,21,127');
});
test('BLE MIDI: SysEx dividido em pacotes é remontado igual', () => {
  const msg = writeU16(0x42, 70); const big = [0xF0, ...Array.from({ length: 300 }, (_, i) => i & 0x7F), 0xF7];
  for (const m of [msg, big]) {
    const got = []; const parser = new BleMidiParser(x => got.push(x));
    const pkts = toBlePackets(m); assert.ok(pkts.every(p => p.length <= 20));
    pkts.forEach(p => parser.push(p));
    assert.deepEqual(got[0], m);
  }
});
