/* Protocolo SysEx do editor M-EFCS da M-VAVE, usado pela MK-300.
   Engenharia reversa do projeto aberto jpfaria/mvave (MIT), medido no firmware V73.

   Quadro: F0 00 32 | CLS | CMD(4) | 02 | CAMPO(4) | SUB(4) | pack7(payload + ck8) | F7
   - CAMPO = deslocamento em bytes dentro do espaço de memória
   - SUB   = (tamanho << 4) | espaço, em dígitos de 7 bits little-endian
   - ck8   = 0xFB − (Σpayload + Σbytes(CAMPO) + Σbytes((tam << 8) | (espaço << 4))) mod 256
   A pedaleira confere o ck8: quadro com checksum errado não recebe resposta. */
import { PRESET_SIZE } from '../domain/preset.js';

export const CLS = { WRITE: 0x09, READ: 0x0D, ACK: 0x01 };
export const CMD = { READ: 0x41, U8: 0x49, U16: 0x51 };
export const SPACE = { BANK: 0x0, PRESET: 0x1, STATUS: 0x2, COMMAND: 0xE, COMMIT: 0xF };
export const STATUS_SIZE = 86;

export function pack7(data) {
  const out = []; let bits = 0, n = 0;
  for (const b of data) { bits |= b << n; n += 8; while (n >= 7) { out.push(bits & 0x7F); bits >>>= 7; n -= 7; } }
  if (n) out.push(bits & 0x7F);
  return out;
}
export function unpack7(data) {
  const out = []; let bits = 0, n = 0;
  for (const b of data) { bits |= (b & 0x7F) << n; n += 7; while (n >= 8) { out.push(bits & 0xFF); bits >>>= 8; n -= 8; } }
  return out;
}
const u32_7 = v => [v & 0x7F, (v >>> 7) & 0x7F, (v >>> 14) & 0x7F, (v >>> 21) & 0x7F];
const from7 = b => b[0] | (b[1] << 7) | (b[2] << 14) | (b[3] << 21);
const bsum32 = v => (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255) + ((v >>> 24) & 255);

export function checksum(field, len, space, payload) {
  let t = bsum32(field) + bsum32((len << 8) | (space << 4));
  for (const b of payload) t += b;
  return (0xFB - t) & 0xFF;
}
export function frame(cls, cmd, field, len, space, payload = []) {
  const ck = checksum(field, len, space, payload);
  return [0xF0, 0x00, 0x32, cls, ...u32_7(cmd), 0x02, ...u32_7(field), ...u32_7((len << 4) | space), ...pack7([...payload, ck]), 0xF7];
}
export const isOurs = m => m[0] === 0xF0 && m[1] === 0x00 && m[2] === 0x32;
/** a confirmação é um quadro curto fixo: F0 00 32 01 08 00 00 00 00 7F 01 F7 */
export const isAck = m => isOurs(m) && m[3] === CLS.ACK;

export function parseFrame(f) {
  if (f.length < 18 || !isOurs(f) || f[f.length - 1] !== 0xF7) return null;
  const body = f.slice(3, -1), hdr = body.slice(0, 14);
  const sub = from7(hdr.slice(10, 14)), dec = unpack7(body.slice(14));
  return { cls: hdr[0], cmd: from7(hdr.slice(1, 5)), field: from7(hdr.slice(6, 10)), len: sub >> 4, space: sub & 15, payload: dec.slice(0, -1), ck: dec[dec.length - 1] };
}
export const validFrame = f => !!f && f.ck === checksum(f.field, f.len, f.space, f.payload);

/* construtores dos quadros usados pelo app */
export const readFrame = (field, len, space = SPACE.PRESET) => frame(CLS.READ, CMD.READ, field, len, space);
export const writeU8 = (field, v, space = SPACE.PRESET) => frame(CLS.WRITE, CMD.U8, field, 1, space, [v & 255]);
export const writeU16 = (field, v, space = SPACE.PRESET) => frame(CLS.WRITE, CMD.U16, field, 2, space, [v & 255, (v >> 8) & 255]);
/** carrega o preset (0 = [001]) */
export const loadFrame = slot0 => frame(CLS.WRITE, CMD.U8, slot0, 1, SPACE.COMMAND, [1]);
/** "Save to" do editor: imagem inteira no slot; segundo dígito do CMD = tamanho / 16 */
export const bankWriteFrame = (slot0, img) => frame(CLS.WRITE, CMD.READ | ((img.length / 16) << 7), slot0 * img.length, img.length, SPACE.BANK, Array.from(img));
export const COMMIT = frame(CLS.WRITE, CMD.READ, 0, 0, SPACE.COMMIT);
export const POLL = readFrame(0, STATUS_SIZE, SPACE.STATUS);
export const READ_BUFFER = readFrame(0, PRESET_SIZE, SPACE.PRESET);
