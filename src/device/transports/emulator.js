/* MK-300 simulada: responde ao protocolo como a pedaleira (lê, grava, confirma, carrega).
   Usada nos testes e no modo demonstração (Ajustes), para usar o app sem a pedaleira. */
import { parseFrame, validFrame, frame, CLS, CMD, SPACE, STATUS_SIZE } from '../protocol.js';
import { PRESET_SIZE, SLOTS } from '../../domain/preset.js';

export const ACK = [0xF0, 0x00, 0x32, 0x01, 0x08, 0, 0, 0, 0, 0x7F, 0x01, 0xF7];

export function makeState() {
  const bank = new Uint8Array(SLOTS * PRESET_SIZE), status = new Uint8Array(STATUS_SIZE);
  for (let s = 0; s < SLOTS; s++) {
    const o = s * PRESET_SIZE; const n = s < 80 ? 'FACTORY ' + (s + 1) : '';
    for (let i = 0; i < n.length; i++) bank[o + i] = n.charCodeAt(i);
    for (let i = 0; i < 11; i++) bank[o + 0x20 + i] = i;
    bank[o + 0x18] = 50; bank[o + 0x1A] = 120; bank[o + 0x14A] = 0x09; bank[o + 0x14B] = 0x0B; // controles de footswitch
  }
  const buffer = bank.slice(0, PRESET_SIZE);
  return { bank, buffer, status, log: [] };
}

export class EmulatorTransport {
  constructor(state = makeState()) { this.kind = 'Demo'; this.name = 'MK-300 simulada'; this.state = state; }
  async open(onMessage) { this.onMessage = onMessage; }
  close() {}
  reply(bytes) { setTimeout(() => this.onMessage && this.onMessage(bytes), 1); }
  async send(bytes) {
    const st = this.state; bytes = Array.from(bytes);
    if (bytes[0] !== 0xF0) { st.log.push('CC ' + bytes.join(',')); return; }
    const f = parseFrame(bytes);
    if (!validFrame(f)) { st.log.push('checksum errado'); return; }       // a pedaleira real não responde
    if (f.cls === CLS.READ) {
      const src = f.space === SPACE.STATUS ? st.status : f.space === SPACE.PRESET ? st.buffer : st.bank;
      this.reply(frame(CLS.READ, CMD.READ, f.field, f.len, f.space, Array.from(src.slice(f.field, f.field + f.len))));
      return;
    }
    if (f.space === SPACE.PRESET) st.buffer.set(f.payload, f.field);
    else if (f.space === SPACE.COMMAND) { st.buffer.set(st.bank.slice(f.field * PRESET_SIZE, (f.field + 1) * PRESET_SIZE)); st.status[0] = f.field; }
    else if (f.space === SPACE.BANK) st.bank.set(f.payload, f.field);
    st.log.push(['BANK', 'BUF', 'STATUS'][f.space] || (f.space === SPACE.COMMIT ? 'COMMIT' : 'LOAD'));
    this.reply(ACK);
  }
}
