/* Transporte USB: Web MIDI com SysEx (Chrome no Android com cabo OTG, ou no computador). */
export class UsbMidiTransport {
  constructor() { this.kind = 'USB'; this.name = ''; }

  async open(onMessage, onClose) {
    if (!navigator.requestMIDIAccess) throw new Error('Este navegador não tem MIDI por USB. Use o Chrome, aberto por um endereço https.');
    const acc = await navigator.requestMIDIAccess({ sysex: true });
    const pick = list => list.find(p => /mk.?300|m-?vave|composite/i.test(p.name)) || list[0];
    const out = pick([...acc.outputs.values()]), inp = pick([...acc.inputs.values()]);
    if (!out || !inp) throw new Error('Nenhuma porta MIDI encontrada. Ligue a MK-300 no cabo USB OTG e tente de novo.');
    this.out = out; this.inp = inp; this.name = out.name;
    inp.onmidimessage = e => onMessage(Array.from(e.data));
    acc.onstatechange = e => { if (e.port.state === 'disconnected' && (e.port.id === out.id || e.port.id === inp.id)) onClose(); };
  }
  async send(bytes) { this.out.send(bytes); }
  close() { try { if (this.inp) this.inp.onmidimessage = null; } catch (e) {} this.inp = this.out = null; }
}
