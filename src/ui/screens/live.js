/* Ao vivo: o celular vira o controle da MK-300. */
import { $, $$, esc, debounce } from '../../lib/dom.js';
import { lsGet, lsSet, KEYS } from '../../lib/storage.js';
import { clamp } from '../../lib/text.js';
import { S } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { BLOCKS, BLOCK_ID } from '../../domain/blocks.js';
import { SLOTS, decodePreset } from '../../domain/preset.js';
import { CC } from '../../device/midiMap.js';
import { toast, guard } from '../components.js';
import { renderMain } from '../router.js';
import { slotLabel } from '../connection.js';

const FOOTSWITCHES = [['FS1', 'FS1'], ['FS2', 'FS2'], ['CTRL A', 'CTRL_A'], ['CTRL B', 'CTRL_B']];

function view() {
  const on = pedal.connected; const L = S.live; const cur = pedal.current; const mods = L.mods; const dis = on ? '' : 'disabled';
  return `${on ? '' : '<div class="notice">Conecte a MK-300 acima. Pelo USB tudo funciona; pelo Bluetooth, looper, bateria e footswitches usam MIDI e os demais comandos são experimentais.</div>'}
  <div class="card">
    <span class="lbl">Preset (1–160)</span>
    <div class="row" style="margin-top:8px"><button class="btn pri" data-act="prev" ${dis} aria-label="Preset anterior">◀</button>
      <input type="number" id="lnum" class="grow num bignum" min="1" max="160" value="${cur != null ? cur + 1 : ''}" placeholder="Nº" aria-label="Número do preset">
      <button class="btn" data-act="go" ${dis}>Ir</button><button class="btn pri" data-act="next" ${dis} aria-label="Próximo preset">▶</button></div>
    <div class="disp current">${cur != null ? esc(slotLabel(cur)) : '—'}</div>
    <div class="field"><label class="lbl" for="lvol">Volume</label><div class="row"><input type="range" id="lvol" min="0" max="100" value="${mods ? mods.vol : 50}" class="grow" ${dis}><b class="num val" id="lvolv">${mods ? mods.vol : '—'}</b></div></div>
    <div class="field"><label class="lbl" for="lvf">Vol final</label><div class="row"><input type="range" id="lvf" min="0" max="100" value="${mods ? mods.volBlock : 100}" class="grow" ${dis}><b class="num val" id="lvfv">${mods ? mods.volBlock : '—'}</b></div></div>
  </div>
  <div class="card"><span class="lbl">Módulos</span>
    <div class="mods" style="margin-top:8px">${BLOCKS.map((n, b) => `<button class="mod ${mods && mods.on[b] ? 'on' : ''}" data-mod="${b}" ${on && mods ? '' : 'disabled'} aria-pressed="${!!(mods && mods.on[b])}">${n}</button>`).join('')}</div>
  </div>
  <div class="card">
    <div class="row"><span class="lbl grow">Tempo</span><span class="big num" id="lbpm">${L.bpm}</span><span class="muted">BPM</span></div>
    <div class="row" style="margin-top:8px"><button class="btn pri grow" data-act="tap" ${dis}>Tap tempo</button><button class="btn" data-act="bpm120" ${dis}>120 BPM</button></div>
  </div>
  <div class="card"><span class="lbl">Looper</span>
    <button class="btn amber full" style="margin-top:8px" data-cc="${CC.LOOPER_TOGGLE}" data-v="127" ${dis}>● Rec / Play / Overdub</button>
    <div class="row" style="margin-top:8px"><button class="btn grow" data-cc="${CC.LOOPER_STOP}" data-v="127" ${dis}>■ Parar</button><button class="btn grow" data-cc="${CC.LOOPER_UNDO}" data-v="127" ${dis}>Desfazer / apagar</button><button class="btn grow" data-act="looppos" ${dis}>${L.loopTail ? 'Pós-efeitos' : 'Pré-efeitos'}</button></div>
  </div>
  <div class="card"><span class="lbl">Bateria</span>
    <div class="row" style="margin-top:8px"><button class="btn ${L.drum ? 'pri' : ''} grow" data-act="drum" ${dis}>${L.drum ? '■ Parar bateria' : '▶ Play bateria'}</button><button class="btn ${L.follow ? 'pri' : ''} grow" data-act="follow" ${dis}>Seguir BPM</button></div>
    <p class="small muted hint">O ritmo e o volume da bateria se escolhem na pedaleira; a MK-300 não recebe esses dois por MIDI.</p>
  </div>
  <div class="card"><span class="lbl">Footswitches virtuais</span>
    <div class="mods" style="margin-top:8px">${FOOTSWITCHES.map(([n, k]) => `<button class="mod" data-fs="${k}" ${dis}>${n}</button>`).join('')}</div>
    <p class="small muted hint">Toque = pisada curta; segure = pisada longa. Fazem o que estiver configurado em cada footswitch na pedaleira.</p>
  </div>
  <div class="card"><span class="lbl">Saída e áudio</span>
    <div class="field"><span class="small muted">Saída R</span><div class="chips c3">${['Normal', 'Seco', 'Sem CAB'].map((n, i) => `<button class="chip" data-cc="${CC.OUTPUT_R}" data-v="${i}" ${dis}>${n}</button>`).join('')}</div></div>
    <div class="field"><span class="small muted">Áudio USB</span><div class="chips c2">${['Nor', 'Não', 'Resample', 'Seco'].map((n, i) => `<button class="chip" data-cc="${CC.USB_AUDIO}" data-v="${i}" ${dis}>${n}</button>`).join('')}</div></div>
    <div class="field"><label class="small muted" for="lbtv">Vol BT/USB</label><input type="range" id="lbtv" min="0" max="100" value="${lsGet(KEYS.btVolume, 70)}" ${dis}></div>
  </div>`;
}

async function refresh() {
  if (!pedal.connected || S.busy) return;
  try {
    if (pedal.current == null) await pedal.status();
    const p = decodePreset(await pedal.readBuffer());
    S.live.mods = { on: p.blocks.map(b => b.on), vol: p.vol, volBlock: p.blocks[BLOCK_ID.VOL].knobs[0] };
    S.live.bpm = p.bpm || S.live.bpm;
    if (pedal.current != null && p.name) S.slotNames[pedal.current] = p.name;
  } catch (e) {}
  if (S.tab === 'live') renderMain();
}
async function goTo(i) { S.busy = true; await guard(() => pedal.load((i + SLOTS) % SLOTS)); S.busy = false; refresh(); }

let fsTimer = null, fsLong = false;
function onDown(e) { const b = e.target.closest('[data-fs]'); if (!b || b.disabled) return; fsLong = false; fsTimer = setTimeout(() => { fsLong = true; pedal.cc(CC.FS_LONG[b.dataset.fs], 127).then(() => toast('Pisada longa')).catch(er => toast(er.message, true)); }, 600); }
function onUp(e) { clearTimeout(fsTimer); const b = e.target.closest('[data-fs]'); if (!b || b.disabled || fsLong) return; pedal.cc(CC.FS_SHORT[b.dataset.fs], 127).catch(er => toast(er.message, true)); }
const onPedalPreset = () => refresh();

export default {
  view,
  mount(root) {
    root.addEventListener('pointerdown', onDown); root.addEventListener('pointerup', onUp);
    document.addEventListener('pedal:preset', onPedalPreset);
    if (pedal.connected && !S.live.mods) refresh();
  },
  leave() { const root = $('#main'); root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointerup', onUp); document.removeEventListener('pedal:preset', onPedalPreset); },
  input(e) {
    const { id, value } = e.target; const L = S.live;
    if (id === 'lvol') { $('#lvolv').textContent = value; if (L.mods) L.mods.vol = +value; debounce('lvol', () => pedal.setVol(+value).catch(() => {}), 80); }
    if (id === 'lvf') { $('#lvfv').textContent = value; if (L.mods) L.mods.volBlock = +value; debounce('lvf', () => pedal.setKnob(BLOCK_ID.VOL, 0, +value).catch(() => {}), 80); }
    if (id === 'lbtv') { lsSet(KEYS.btVolume, +value); debounce('lbtv', () => pedal.cc(CC.PLAYBACK_VOL, +value).catch(() => {}), 120); }
  },
  async click(t, d) {
    const L = S.live;
    if (d.act === 'prev') goTo((pedal.current ?? 0) - 1);
    if (d.act === 'next') goTo((pedal.current ?? -1) + 1);
    if (d.act === 'go') { const n = +$('#lnum').value; if (n >= 1 && n <= SLOTS) goTo(n - 1); else toast('Digite um número de 1 a 160.', true); }
    if (d.mod !== undefined && L.mods) { const b = +d.mod; L.mods.on[b] = !L.mods.on[b]; t.classList.toggle('on', L.mods.on[b]); t.setAttribute('aria-pressed', L.mods.on[b]); guard(() => pedal.setOn(b, L.mods.on[b])); }
    if (d.act === 'tap') {
      const now = performance.now(); L.taps = L.taps.filter(x => now - x < 2500); L.taps.push(now);
      if (L.taps.length >= 2) {
        const iv = L.taps.slice(1).map((x, i) => x - L.taps[i]).slice(-4);
        L.bpm = clamp(Math.round(60000 / (iv.reduce((a, b) => a + b) / iv.length)), 40, 300);
        $('#lbpm').textContent = L.bpm; debounce('tap', () => pedal.setBpm(L.bpm).catch(() => {}), 150);
      }
    }
    if (d.act === 'bpm120') { L.bpm = 120; $('#lbpm').textContent = 120; guard(() => pedal.setBpm(120)); }
    if (d.cc) { guard(() => pedal.cc(+d.cc, +d.v)); if (+d.cc === CC.OUTPUT_R || +d.cc === CC.USB_AUDIO) $$(`[data-cc="${d.cc}"]`).forEach(x => x.classList.toggle('on', x === t)); }
    if (d.act === 'looppos') { L.loopTail = !L.loopTail; await guard(() => pedal.cc(CC.LOOPER_POSITION, L.loopTail ? 127 : 0)); renderMain(); }
    if (d.act === 'drum') { L.drum = !L.drum; await guard(() => pedal.cc(CC.DRUM_PLAY, L.drum ? 127 : 0)); renderMain(); }
    if (d.act === 'follow') { L.follow = !L.follow; await guard(() => pedal.cc(CC.DRUM_FOLLOW_BPM, L.follow ? 127 : 0)); renderMain(); }
  },
};
