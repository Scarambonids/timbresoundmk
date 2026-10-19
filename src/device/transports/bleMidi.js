/* Transporte Bluetooth: BLE MIDI pelo Web Bluetooth. Experimental na MK-300
   (o protocolo foi medido pelo USB). Faz o empacotamento BLE MIDI com timestamps. */
export const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
export const BLE_MIDI_CHAR = '7772e5db-3868-4112-a1a9-f2669d106bf3';
const MAX_PACKET = 20;   // MTU padrão (23) menos 3

/** mensagem MIDI → pacotes BLE MIDI (SysEx longo vira vários pacotes) */
export function toBlePackets(bytes) {
  const hdr = 0x80, ts = 0x80;
  if (bytes[0] !== 0xF0) return [[hdr, ts, ...bytes]];
  const pkts = []; let cur = [hdr, ts];
  for (const b of bytes) {
    if (b === 0xF7) { if (cur.length + 2 > MAX_PACKET) { pkts.push(cur); cur = [hdr]; } cur.push(ts, 0xF7); break; }
    if (cur.length >= MAX_PACKET) { pkts.push(cur); cur = [hdr]; }
    cur.push(b);
  }
  pkts.push(cur);
  return pkts;
}

/** remonta mensagens a partir de pacotes BLE MIDI; guarda SysEx incompleto entre pacotes */
export class BleMidiParser {
  constructor(onMessage) { this.onMessage = onMessage; this.sys = null; }
  push(d) {
    let i = 1;
    while (i < d.length) {
      const b = d[i];
      if (this.sys) {
        if (b & 0x80) {
          const nx = d[i + 1];
          if (nx === 0xF7) { this.sys.push(0xF7); this.onMessage(this.sys); this.sys = null; i += 2; continue; }
          if (nx >= 0xF8) { i += 2; continue; }
          i++; continue;
        }
        this.sys.push(b); i++; continue;
      }
      if (b & 0x80) {
        const st = d[i + 1]; if (st === undefined) break;
        if (st === 0xF0) { this.sys = [0xF0]; i += 2; continue; }
        const len = (st & 0xF0) === 0xC0 || (st & 0xF0) === 0xD0 ? 1 : st >= 0xF8 ? 0 : 2;
        this.onMessage([st, ...d.slice(i + 2, i + 2 + len)]); i += 2 + len; continue;
      }
      i++;
    }
  }
}

export class BleMidiTransport {
  constructor() { this.kind = 'Bluetooth'; this.name = ''; }

  async open(onMessage, onClose) {
    if (!navigator.bluetooth) throw new Error('Este navegador não tem Bluetooth web. Use o Chrome no Android, aberto por um endereço https.');
    const dev = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_MIDI_SERVICE] }, { namePrefix: 'MK' }, { namePrefix: 'M-VAVE' }, { namePrefix: 'M-V' }],
      optionalServices: [BLE_MIDI_SERVICE],
    });
    const gatt = await dev.gatt.connect();
    const chr = await (await gatt.getPrimaryService(BLE_MIDI_SERVICE)).getCharacteristic(BLE_MIDI_CHAR);
    const parser = new BleMidiParser(onMessage);
    await chr.startNotifications();
    chr.addEventListener('characteristicvaluechanged', e => parser.push(new Uint8Array(e.target.value.buffer)));
    dev.addEventListener('gattserverdisconnected', onClose);
    this.dev = dev; this.chr = chr; this.name = dev.name || 'MK-300';
  }
  async send(bytes) {
    for (const p of toBlePackets(bytes)) {
      const u = new Uint8Array(p);
      if (this.chr.writeValueWithoutResponse) await this.chr.writeValueWithoutResponse(u); else await this.chr.writeValue(u);
    }
  }
  close() { try { if (this.dev && this.dev.gatt.connected) this.dev.gatt.disconnect(); } catch (e) {} this.dev = this.chr = null; }
}
