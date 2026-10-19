/* Faixa de conexão (abas Timbre e Ao vivo), leitura dos presets e acompanhamento da pedaleira. */
import { $, esc } from '../lib/dom.js';
import { lsSet, KEYS } from '../lib/storage.js';
import { S, saveSlotNames, setTone } from '../state/store.js';
import { pedal } from '../state/pedal.js';
import { SLOTS, decodePreset } from '../domain/preset.js';
import { toast, guard, sheet, confirmBox, withProgress } from './components.js';
import { renderMain, go } from './router.js';

export const slotLabel = i0 => `${String(i0 + 1).padStart(3, '0')}${S.slotNames[i0] ? ' · ' + S.slotNames[i0] : ''}`;

export function renderConnection() {
  const c = $('#conn'); c.hidden = !(S.tab === 'timbre' || S.tab === 'live');
  const on = pedal.connected; const n = S.slotNames.filter(Boolean).length;
  c.innerHTML = `<div class="st"><span class="dot ${on ? 'on' : ''}"></span><span class="grow">${on ? `MK-300 conectada via ${pedal.kind === 'Demo' ? 'demonstração' : pedal.kind}` : 'MK-300 desconectada'}</span>
    <button class="linkbtn small" data-c="slots">${n ? `${n} presets lidos ›` : 'Presets ›'}</button></div>
    <div class="btns">
      <button class="btn sm ${pedal.kind === 'USB' ? 'pri' : ''}" data-c="USB">USB</button>
      <button class="btn sm ${pedal.kind === 'Bluetooth' ? 'pri' : ''}" data-c="Bluetooth">Bluetooth</button>
      <button class="btn sm" data-c="read" ${on ? '' : 'disabled'}>Ler pedaleira</button>
      <button class="btn sm" data-c="ch" title="Canal MIDI do controle ao vivo">Canal ${pedal.channel}</button>
    </div>`;
}

export async function connect(kind) {
  if (pedal.kind === kind) { pedal.disconnect(); return; }
  if (kind === 'Bluetooth' && !(await confirmBox('Bluetooth (experimental)', 'O protocolo da MK-300 foi medido pelo USB. Pelo Bluetooth o app usa o mesmo protocolo via BLE MIDI, mas isso ainda não foi conferido numa pedaleira. Para enviar e salvar presets, o cabo USB OTG é o caminho garantido. Looper, bateria e footswitches usam MIDI comum e também funcionam pelo Bluetooth.', 'Procurar pedaleira'))) return;
  const label = { USB: 'pelo USB', Bluetooth: 'pelo Bluetooth', Demo: 'em modo demonstração' }[kind];
  const ok = await guard(async () => { await pedal.connect(kind); return true; }, `MK-300 conectada ${label}`);
  if (ok) { if (!S.slotNames.filter(Boolean).length) readAll(); else if (S.tab === 'live') renderMain(); }
}

export async function readAll() {
  if (!pedal.connected) return toast('Conecte a pedaleira primeiro.', true);
  await withProgress(S, 'Lendo a pedaleira', async pg => {
    await pedal.status();
    S.slotNames = await pedal.readAllNames((i, n) => i % 4 === 0 && pg.set(i / n, `Preset ${i} de ${n}`));
    saveSlotNames();
    toast(`${S.slotNames.filter(Boolean).length} presets lidos. Preset atual: ${slotLabel(pedal.current)}`);
  });
  renderConnection(); renderMain();
}

function slotsSheet() {
  const on = pedal.connected;
  const rows = Array.from({ length: SLOTS }, (_, i) => `<div class="slotrow"><span class="num muted">${String(i + 1).padStart(3, '0')}</span><span>${esc(S.slotNames[i] || '—')}${pedal.current === i ? ' <span class="lbl ok">atual</span>' : ''}</span>
    <span class="row"><button class="btn sm" data-load="${i}" ${on ? '' : 'disabled'}>Tocar</button><button class="btn sm" data-open="${i}" ${on ? '' : 'disabled'}>Editar</button></span></div>`).join('');
  sheet(`<h2>Presets da pedaleira</h2><p class="muted small">Os nomes vêm da última leitura. O visor da MK-300 só mostra um nome novo depois de desligar e ligar.</p><div>${rows}</div>`, (el, close) => {
    el.addEventListener('click', async e => {
      const l = e.target.closest('[data-load]'), o = e.target.closest('[data-open]');
      if (l) { await guard(() => pedal.load(+l.dataset.load), 'Preset carregado: ' + slotLabel(+l.dataset.load)); close(); }
      if (o) {
        const i = +o.dataset.open;
        await guard(async () => {
          setTone({ preset: decodePreset(await pedal.readSlot(i)), explain: { how: `Preset lido do slot ${i + 1} da pedaleira.`, notes: [], engine: 'Pedaleira' } });
          S.slot = i + 1; close(); go('timbre', { step: 2 });
        });
      }
    });
  });
}

export function initConnection() {
  pedal.onState = () => { if (!pedal.connected) S.liveEdit = false; renderConnection(); if (S.tab === 'live') renderMain(); };
  $('#conn').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b || b.disabled) return;
    const c = b.dataset.c;
    if (c === 'USB' || c === 'Bluetooth') connect(c);
    if (c === 'read') readAll();
    if (c === 'slots') slotsSheet();
    if (c === 'ch') { pedal.channel = pedal.channel % 16 + 1; lsSet(KEYS.midiCh, pedal.channel); renderConnection(); }
  });
  /* acompanha troca de preset feita nos footswitches */
  setInterval(async () => {
    if (!pedal.connected || S.busy || document.hidden) return;
    const before = pedal.current;
    try { await pedal.status(); } catch (e) { return; }
    if (pedal.current !== before && S.tab === 'live') document.dispatchEvent(new CustomEvent('pedal:preset'));
  }, 2000);
}
