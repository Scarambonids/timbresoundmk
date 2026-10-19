/* Quadros conferidos byte a byte contra as capturas do editor M-EFCS (docs/PROTOCOLO.md). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/device/protocol.js';

const hex = a => a.map(x => x.toString(16).padStart(2, '0')).join(' ').toUpperCase();
const GOLDEN = [
  ['Preset Vol = 60', P.writeU16(0x18, 60), 'F0 00 32 09 51 00 00 00 02 18 00 00 00 21 00 00 00 3C 00 54 04 F7'],
  ['BPM = 133', P.writeU16(0x1A, 133), 'F0 00 32 09 51 00 00 00 02 1A 00 00 00 21 00 00 00 05 01 28 02 F7'],
  ['WAH knob 0 = 70', P.writeU16(0x42, 70), 'F0 00 32 09 51 00 00 00 02 42 00 00 00 21 00 00 00 46 00 04 03 F7'],
  ['WAH model = 1', P.writeU8(0x36, 1), 'F0 00 32 09 49 00 00 00 02 36 00 00 00 11 00 00 00 01 66 02 F7'],
  ['FX off', P.writeU8(0x2C, 0), 'F0 00 32 09 49 00 00 00 02 2C 00 00 00 11 00 00 00 00 7C 02 F7'],
  ['carregar [003]', P.loadFrame(2), 'F0 00 32 09 49 00 00 00 02 02 00 00 00 1E 00 00 00 01 2E 00 F7'],
  ['carregar [160]', P.loadFrame(159), 'F0 00 32 09 49 00 00 00 02 1F 01 00 00 1E 00 00 00 01 74 01 F7'],
  ['ler buffer', P.READ_BUFFER, 'F0 00 32 0D 41 00 00 00 02 00 00 00 00 01 38 00 00 2A 00 F7'],
  ['status', P.POLL, 'F0 00 32 0D 41 00 00 00 02 00 00 00 00 62 0A 00 00 05 01 F7'],
  ['ler controles do WAH', P.readFrame(0x42, 24), 'F0 00 32 0D 41 00 00 00 02 42 00 00 00 01 03 00 00 11 01 F7'],
  ['commit', P.COMMIT, 'F0 00 32 09 41 00 00 00 02 00 00 00 00 0F 00 00 00 0B 00 F7'],
  ['RCH = Dry (global)', P.writeU8(0x3C, 1, P.SPACE.STATUS), 'F0 00 32 09 49 00 00 00 02 3C 00 00 00 12 00 00 00 01 3A 02 F7'],
];
for (const [name, got, want] of GOLDEN) test(name, () => assert.equal(hex(got), want));

test('pack7/unpack7 ida e volta', () => {
  const data = Array.from({ length: 449 }, (_, i) => (i * 37) & 255);
  assert.deepEqual(P.unpack7(P.pack7(data)), data);
});
test('parseFrame recupera campo, tamanho, espaço e checksum', () => {
  const f = P.parseFrame(P.writeU16(0x42, 70));
  assert.equal(f.field, 0x42); assert.equal(f.len, 2); assert.equal(f.space, 1);
  assert.deepEqual(f.payload, [70, 0]); assert.ok(P.validFrame(f));
});
test('confirmação curta é reconhecida', () => assert.ok(P.isAck([0xF0, 0, 0x32, 1, 8, 0, 0, 0, 0, 0x7F, 1, 0xF7])));
test('escrita no banco: CMD com 448/16 no segundo dígito', () => {
  const f = P.bankWriteFrame(149, new Uint8Array(448));
  assert.equal(f[4], 0x41); assert.equal(f[5], 28);
  assert.equal(P.parseFrame(f).field, 149 * 448);
});
