/* A MK-300 vista pelo app: conecta por um transporte, serializa pedidos,
   espera confirmação/resposta e oferece as operações de alto nível. */
import * as P from './protocol.js';
import { PRESET_SIZE, SLOTS, OFF, knobOff, decodePreset, encodeInto, nameFromBytes } from '../domain/preset.js';
import { modelOf } from '../domain/catalog.js';
import { ascii20, clamp } from '../lib/text.js';
import { UsbMidiTransport } from './transports/usbMidi.js';
import { BleMidiTransport } from './transports/bleMidi.js';
import { EmulatorTransport } from './transports/emulator.js';

const TRANSPORTS = { USB: UsbMidiTransport, Bluetooth: BleMidiTransport, Demo: EmulatorTransport };
const wait = ms => new Promise(r => setTimeout(r, ms));

export class Pedal {
  constructor({ channel = 1, transports = TRANSPORTS } = {}) {
    this.t = null; this.channel = channel; this.transports = transports;
    this.waiters = []; this.queue = Promise.resolve(); this.current = null;
    this.onState = () => {};
  }
  get connected() { return !!this.t; }
  get kind() { return this.t ? this.t.kind : null; }
  get portName() { return this.t ? this.t.name : ''; }

  async connect(kind) {
    const T = this.transports[kind]; if (!T) throw new Error('Conexão desconhecida: ' + kind);
    const t = new T();
    await t.open(m => this._rx(m), () => this.disconnect());
    this.disconnect(true); this.t = t;
    try { await this.status(); }
    catch (e) {
      this.disconnect(true);
      throw new Error(kind === 'USB'
        ? `A porta "${t.name}" não respondeu como MK-300. Confira se o cabo é OTG e se o M-EFCS não está usando a pedaleira.`
        : 'A pedaleira conectou, mas não respondeu pelo Bluetooth. Use o cabo USB OTG.');
    }
    this.onState(this);
  }
  disconnect(silent) {
    if (this.t) this.t.close();
    this.t = null; this.fullNameRead = false;
    this.waiters.forEach(w => { clearTimeout(w.timer); w.reject(new Error('Pedaleira desconectada.')); }); this.waiters = [];
    if (!silent) this.onState(this);
  }

  _rx(msg) {
    if (!P.isOurs(msg)) return;
    const f = P.isAck(msg) ? { cls: P.CLS.ACK } : P.parseFrame(msg);
    if (!f) return;
    const i = this.waiters.findIndex(w => w.match(f));
    if (i >= 0) { const w = this.waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(f); }
  }

  /** envia um quadro e espera a resposta que casa com `match`; pedidos saem um por vez */
  request(bytes, match, timeout = 1500) {
    const run = () => new Promise((resolve, reject) => {
      if (!this.t) return reject(new Error('Pedaleira desconectada.'));
      const w = { match, resolve, reject };
      w.timer = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); reject(new Error('A pedaleira não respondeu.')); }, timeout);
      this.waiters.push(w);
      this.t.send(bytes).catch(e => { clearTimeout(w.timer); this.waiters = this.waiters.filter(x => x !== w); reject(e); });
    });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
  async write(bytes, tries = 2) {
    for (let i = 0; ; i++) {
      try { return await this.request(bytes, f => f.cls === P.CLS.ACK); }
      catch (e) { if (i >= tries - 1 || !this.t) throw e; }
    }
  }
  async read(field, len, space, timeout) {
    const f = await this.request(P.readFrame(field, len, space), f => f.cls === P.CLS.READ && f.payload.length === len, timeout || (len > 100 ? 3000 : 1500));
    return Uint8Array.from(f.payload);
  }

  /* leitura */
  async status() { const s = await this.read(0, P.STATUS_SIZE, P.SPACE.STATUS); this.current = s[0]; return s; }
  readBuffer() { return this.read(0, PRESET_SIZE, P.SPACE.PRESET); }
  readSlot(slot0) { return this.read(slot0 * PRESET_SIZE, PRESET_SIZE, P.SPACE.BANK, 4000); }
  async readSlotName(slot0) {
    if (!this.fullNameRead) {
      try { return nameFromBytes(await this.read(slot0 * PRESET_SIZE, 20, P.SPACE.BANK)); }
      catch (e) { if (!this.t) throw e; this.fullNameRead = true; }   // firmware sem leitura parcial
    }
    return nameFromBytes(await this.readSlot(slot0));
  }
  async readAllNames(onProgress = () => {}) {
    const names = [];
    for (let i = 0; i < SLOTS; i++) { names[i] = await this.readSlotName(i); onProgress(i + 1, SLOTS); }
    return names;
  }

  /* escrita no buffer de edição (toca na hora, não grava) */
  async load(slot0) { await this.write(P.loadFrame(slot0)); await this.write(P.loadFrame(slot0)).catch(() => {}); this.current = slot0; }
  setOn(b, on) { return this.write(P.writeU8(OFF.EN + b, on ? 1 : 0)); }
  setModel(b, idx) { return this.write(P.writeU8(OFF.MODEL + b, idx)); }
  setKnob(b, k, v) { return this.write(P.writeU16(knobOff(b, k), v)); }
  setVol(v) { return this.write(P.writeU16(OFF.VOL, v)); }
  setBpm(v) { return this.write(P.writeU16(OFF.BPM, v)); }
  setChainAt(i, b) { return this.write(P.writeU8(OFF.CHAIN + i, b)); }
  async setName(name) { const nm = ascii20(name); for (let i = 0; i < 20; i++) await this.write(P.writeU8(OFF.NAME + i, i < nm.length ? nm.charCodeAt(i) : 0)); }
  /** troca o modelo e regrava os controles (a pedaleira volta os controles ao padrão do modelo) */
  async setModelWithKnobs(b, idx, knobs) { await this.setModel(b, idx); for (const [k] of modelOf(b, idx).params.entries()) await this.setKnob(b, k, knobs[k]); }

  /** toca o preset no buffer de edição mandando só o que mudou */
  async audition(p, onProgress = () => {}) {
    const cur = decodePreset(await this.readBuffer());
    const ops = [];
    const nm = ascii20(p.name);
    if (nm !== cur.name) for (let i = 0; i < 20; i++) ops.push(P.writeU8(OFF.NAME + i, i < nm.length ? nm.charCodeAt(i) : 0));
    if (p.vol !== cur.vol) ops.push(P.writeU16(OFF.VOL, p.vol));
    if (p.bpm !== cur.bpm) ops.push(P.writeU16(OFF.BPM, p.bpm));
    if (p.chain.join() !== cur.chain.join()) p.chain.forEach((b, i) => ops.push(P.writeU8(OFF.CHAIN + i, b)));
    p.blocks.forEach((bl, b) => {
      const c = cur.blocks[b]; const changed = bl.model !== c.model;
      if (changed) ops.push(P.writeU8(OFF.MODEL + b, bl.model));
      modelOf(b, bl.model).params.forEach((_, k) => { if (changed || bl.knobs[k] !== c.knobs[k]) ops.push(P.writeU16(knobOff(b, k), bl.knobs[k])); });
      if (bl.on !== c.on) ops.push(P.writeU8(OFF.EN + b, bl.on ? 1 : 0));
    });
    for (let i = 0; i < ops.length; i++) { await this.write(ops[i]); onProgress((i + 1) / ops.length); }
    return ops.length;
  }

  /** grava no slot: lê a imagem atual, troca só os campos conhecidos, grava, confirma pela releitura e carrega */
  async save(slot0, p, onProgress = () => {}) {
    onProgress(0.05);
    const img = encodeInto(await this.readSlot(slot0), p);
    onProgress(0.25);
    await this.write(P.bankWriteFrame(slot0, img), 1).catch(() => {});
    await this.write(P.COMMIT, 1).catch(() => {});
    onProgress(0.4);
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      await wait(900);
      try { const back = await this.readSlot(slot0); if (back.every((v, i) => v === img[i])) { await this.load(slot0); onProgress(1); return; } } catch (e) {}
      onProgress(0.4 + 0.5 * Math.min(1, (Date.now() - t0) / 15000));
    }
    throw new Error('A gravação não foi confirmada pela pedaleira. Nada foi carregado; tente de novo com o cabo USB.');
  }

  /** Control Change no canal configurado */
  async cc(num, val) {
    if (!this.t) throw new Error('Pedaleira desconectada.');
    await this.t.send([0xB0 | (clamp(this.channel, 1, 16) - 1), num & 127, val & 127]);
  }
}
