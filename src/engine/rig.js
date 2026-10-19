/* "Rig" = descrição do equipamento (referências reais + valores). Aqui ele é
   ajustado pela intenção e pelo áudio, e convertido num preset da MK-300. */
import { BLOCK_ID, BLOCKS } from '../domain/blocks.js';
import { blockCat, modelOf, modelByName, defaultsFor } from '../domain/catalog.js';
import { emptyPreset } from '../domain/preset.js';
import { noteMs } from '../domain/music.js';
import { CAB_FAMILY } from '../data/cabFamily.js';
import { resolveRef } from './resolver.js';
import { clamp } from '../lib/text.js';

const copy = o => JSON.parse(JSON.stringify(o));

export function deepMerge(a, b) {
  if (b === null) return null; if (b === undefined) return a;
  if (typeof b !== 'object' || Array.isArray(b) || !a || typeof a !== 'object') return copy(b);
  const o = { ...a }; for (const k of Object.keys(b)) o[k] = deepMerge(a[k], b[k]); return o;
}
/** aplica um ajuste; se ele troca o amp sem dizer a caixa, a caixa volta a ser escolhida pela família do amp */
export function overlay(rig, o) {
  const r = deepMerge(rig, o);
  if (o && o.amp && o.amp.ref && !o.cab) delete r.cab;
  return r;
}

export function applyIntent(rig, intents) {
  rig = copy(rig); const has = i => intents.includes(i);
  if (has('solo')) {
    if (rig.amp) { rig.amp.gain = clamp((rig.amp.gain || 50) + 8, 0, 100); rig.amp.mid = clamp((rig.amp.mid || 50) + 6, 0, 100); }
    if (rig.ds) rig.ds.on = true;
    rig.dly = rig.dly || { model: 'Analog', note: 'q', fb: 25, mix: 18 };
    rig.dly.mix = clamp((rig.dly.mix || 18) + 6, 0, 60); rig.dly.on = true;
  }
  if (has('ritmo')) {
    if (rig.dly && !has('ambient')) rig.dly.mix = Math.round((rig.dly.mix || 15) * 0.5);
    if (rig.ds && rig.ds.gain > 40 && !has('solo')) rig.ds.gain -= 8;
  }
  if (has('ambient')) {
    rig.dly = { model: 'Clean Stereo', note: 'd8', fb: 42, mix: 32 };
    rig.rev = { model: 'Hall stereo', vals: { Decay: 65, Mix: 32 } };
    rig.mod = rig.mod || { model: 'Chorus Stereo', vals: { Speed: 6, Depth: 40, Mix: 22 } };
  }
  if (has('seco')) { rig.dly = null; rig.rev = null; rig.mod = null; }
  return rig;
}

/** mistura as medidas do áudio; peso maior quando não há referência da música */
export function applyAnalysis(rig, an, strong) {
  if (!an) return rig; rig = copy(rig); const w = strong ? 0.6 : 0.25;
  const mix = (v, h) => Math.round((v ?? 50) * (1 - w) + h * w);
  if (rig.amp) {
    if (an.gainHint != null) rig.amp.gain = mix(rig.amp.gain, an.gainHint);
    if (an.brightHint != null) { rig.amp.treble = mix(rig.amp.treble, an.brightHint); rig.amp.pres = mix(rig.amp.pres, an.brightHint); }
    if (an.bassHint != null) rig.amp.bass = mix(rig.amp.bass, an.bassHint);
  }
  if (an.roomHint != null && rig.rev && rig.rev.vals) rig.rev.vals.Mix = mix(rig.rev.vals.Mix ?? 20, an.roomHint);
  if (strong && an.gainHint > 70 && !rig.gate) rig.gate = { model: 'AI Gate', vals: { Gate: 50 } };
  if (strong && an.width > 0.35 && !rig.mod) rig.mod = { model: 'Chorus Stereo', vals: { Speed: 6, Depth: 35, Mix: 18 } };
  return rig;
}

/** rig → preset + notas explicando cada bloco */
export function rigToPreset(rig, { name, vol, bpm, namSlot }) {
  const p = emptyPreset(name); p.vol = vol; p.bpm = bpm || 120;
  const notes = [];
  const setBlock = (blk, model, vals, on = true) => {
    const b = BLOCK_ID[blk]; const bl = p.blocks[b];
    bl.model = model.index; bl.knobs = defaultsFor(b, model.index); bl.on = on;
    if (vals) model.params.forEach((pr, k) => { if (vals[pr.name] !== undefined) bl.knobs[k] = clamp(Math.round(vals[pr.name]), pr.min, pr.max); });
    return bl;
  };
  const tone = (blk, spec) => {
    const m = (blk === 'AMP' && namSlot && modelOf('AMP', namSlot - 1)) || resolveRef(blk, spec.ref);
    if (!m) return null;
    const vals = { Gain: spec.gain, Level: spec.level ?? 70, Bass: spec.bass, Middle: spec.mid, Treble: spec.treble, Pres: spec.pres };
    Object.keys(vals).forEach(k => vals[k] === undefined && delete vals[k]);
    setBlock(blk, m, vals, spec.on !== false); return m;
  };
  const byName = (blk, spec) => {
    if (!spec) return null; const m = modelByName(blk, spec.model) || blockCat(blk).models[0];
    setBlock(blk, m, spec.vals, spec.on === undefined ? true : spec.on); return m;
  };
  const off = s => (s && s.on === false ? ' — pronto, desligado' : '');

  const amp = tone('AMP', rig.amp);
  if (amp) notes.push(`AMP · ${amp.name}${amp.ref ? ' (base: ' + amp.ref + ')' : ''}${namSlot ? ' — slot de captura importada' : ''}`);
  if (rig.ds) { const m = tone('DS', rig.ds); if (m) notes.push(`DS · ${m.name} (${m.ref})${off(rig.ds)}`); }
  let cabRef = rig.cab && rig.cab.ref;
  if (!cabRef && amp) { const f = CAB_FAMILY.find(([r]) => r.test(amp.ref + ' ' + amp.name)); cabRef = f ? f[1] : 'Marshall 1960 (Standard)'; }
  const cab = resolveRef('CAB', cabRef);
  if (cab) { setBlock('CAB', cab, { Level: 70, 'Low Cut': 80, 'High Cut': rig.cabHigh || 65 }); notes.push(`CAB · ${cab.name} (${cab.ref})`); }
  if (rig.gate) notes.push(`GATE · ${byName('GATE', rig.gate).name}`);
  if (rig.fx) notes.push(`FX · ${byName('FX', rig.fx).name}${off(rig.fx)}`);
  if (rig.wah) { const m = byName('WAH', rig.wah); notes.push(rig.wah.fixed ? `WAH · ${m.name} parado no meio (Value 50)` : `WAH · ${m.name} — use o pedal de expressão`); }
  if (rig.eq) { const m = modelByName('EQ', rig.eq.model); const bl = setBlock('EQ', m, null, true); rig.eq.vals.forEach((v, k) => (bl.knobs[k] = clamp(v, -12, 12))); notes.push(`EQ · ${m.name}`); }
  if (rig.mod) notes.push(`MOD · ${byName('MOD', rig.mod).name}${off(rig.mod)}`);
  if (rig.dly) {
    let ms = rig.dly.ms || noteMs(bpm, rig.dly.note);
    while (ms > 1200) ms /= 2; while (ms < 100) ms *= 2;
    const m = byName('DLY', { model: rig.dly.model, vals: { Time: ms, Fb: rig.dly.fb, Mix: rig.dly.mix }, on: rig.dly.on });
    const fig = rig.dly.ms ? '' : rig.dly.note === 'd8' ? ' (colcheia pontuada)' : rig.dly.note === 'q' ? ' (semínima)' : '';
    notes.push(`DLY · ${m.name} ${Math.round(ms)} ms${fig}`);
  }
  if (rig.rev) notes.push(`REV · ${byName('REV', rig.rev).name}`);
  const volBlock = p.blocks[BLOCK_ID.VOL]; volBlock.on = true; volBlock.knobs[0] = 100;
  return { preset: p, notes };
}
export { BLOCKS };
