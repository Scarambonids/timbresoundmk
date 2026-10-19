/* Timbre › 2 · Preset: cadeia, bloco, ouvir, baixar, enviar e salvar. */
import { $, esc, download, fileName, pickFile } from '../../lib/dom.js';
import { ascii20, clamp } from '../../lib/text.js';
import { S, saveSession, saveSlotNames, setTone } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { BLOCKS, BLOCK_INFO } from '../../domain/blocks.js';
import { modelOf, fmtParam } from '../../domain/catalog.js';
import { decodePreset, isPreset } from '../../domain/preset.js';
import { fichaText } from '../../engine/ficha.js';
import { toast, guard, sheet, confirmBox, withProgress } from '../components.js';
import { renderMain } from '../router.js';
import { stepTabs } from './criar.js';
import { openBlockEditor } from './blockEditor.js';

const summary = b => {
  const bl = S.preset.blocks[b]; const m = modelOf(b, bl.model);
  return m.params.map((pr, k) => `${esc(pr.name)} <b class="num">${esc(fmtParam(pr, bl.knobs[k]))}</b>`).join(' · ') || '<span class="muted">sem controles</span>';
};
const slotInfo = () => S.slotNames[S.slot - 1] ? `No slot ${S.slot} hoje: ${esc(S.slotNames[S.slot - 1])}` : '';

function view() {
  const p = S.preset; const sel = S.sel; const bl = p.blocks[sel]; const m = modelOf(sel, bl.model); const pos = p.chain.indexOf(sel);
  const ex = S.explain || {};
  const tiles = p.chain.map(b => { const on = p.blocks[b].on; return `<button class="blk ${on ? 'on' : ''} ${b === sel ? 'sel' : ''}" data-blk="${b}" aria-label="${BLOCKS[b]}${on ? ' ligado' : ' desligado'}"><span class="t" style="${on ? `background:${BLOCK_INFO[BLOCKS[b]].color}` : ''}">${BLOCKS[b]}</span></button>`; }).join('');
  return `${stepTabs()}
  <div class="card">
    <div class="row"><input type="text" id="pname" class="grow disp name" maxlength="20" value="${esc(p.name)}" aria-label="Nome do preset"><button class="iconbtn" data-act="info" aria-label="Sobre o timbre">ⓘ</button></div>
    <div class="row small muted" style="margin-top:8px">
      <label for="pbpm">BPM</label><input type="number" id="pbpm" min="40" max="300" value="${p.bpm}" class="w84">
      <label for="pvol">Vol</label><input type="number" id="pvol" min="0" max="100" value="${p.vol}" class="w76">
      ${S.meta.key ? `<span>Tom <b class="fg">${esc(S.meta.key)}</b></span>` : ''}
    </div>
    <div class="chain">${tiles}</div>
    <div class="detail">
      <div class="row"><h3 class="grow"><span class="dot ${bl.on ? 'on' : ''}"></span>${BLOCKS[sel]} · ${esc(m.name)}</h3><button class="btn sm" data-act="edit">Editar</button></div>
      ${m.ref ? `<div class="small muted">Referência: ${esc(m.ref)}</div>` : ''}
      <div class="kv">${summary(sel)}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm grow" data-act="mvL" ${pos <= 0 ? 'disabled' : ''}>◀ Mover</button><button class="btn sm grow" data-act="mvR" ${pos >= 10 ? 'disabled' : ''}>Mover ▶</button></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn grow" data-act="hear">♪ Ouvir sem salvar</button><button class="btn" data-act="dl">⬇ Baixar</button></div>
    <div class="row" style="margin-top:8px"><label class="lbl" for="pslot">Slot</label><input type="number" id="pslot" min="1" max="160" value="${S.slot}" class="w84"><button class="btn pri grow" data-act="save">Enviar e salvar</button></div>
    <div class="small muted" style="margin-top:6px" id="slotinfo">${slotInfo()}</div>
    ${S.liveEdit ? '<div class="notice">Edição ao vivo ligada: cada mudança vai na hora para a pedaleira. Para gravar no slot, toque em Enviar e salvar de novo.</div>' : ''}
  </div>
  <div class="card"><div class="row"><span class="lbl grow">Sobre este timbre</span><span class="small muted">${esc(ex.engine || '')}</span></div>
    <div class="explain">${esc(ex.how || '')}${ex.songNote ? '<br>' + esc(ex.songNote) : ''}<ul>${(ex.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="openjson">Abrir .json</button><button class="btn sm" data-act="readbuf" ${pedal.connected ? '' : 'disabled'}>Trazer o preset atual da pedaleira</button></div>
  </div>`;
}

function infoSheet() {
  const p = S.preset; const ex = S.explain || {};
  const rows = p.chain.filter(b => p.blocks[b].on).map(b => { const m = modelOf(b, p.blocks[b].model); return `<li><b>${BLOCKS[b]}</b> (${BLOCK_INFO[BLOCKS[b]].pt}): ${esc(m.name)}${m.ref ? ' — ' + esc(m.ref) : ''}</li>`; }).join('');
  sheet(`<h2>${esc(p.name)}</h2><p class="muted">${esc(ex.how || '')}</p>${ex.songNote ? `<p>${esc(ex.songNote)}</p>` : ''}<span class="lbl">Blocos ligados, na ordem do sinal</span><ul class="explain">${rows}</ul><p class="muted small">Os nomes seguem o catálogo em uso; confira no visor. O que a pedaleira usa é a posição do modelo, não o nome.</p>`);
}

async function move(dir) {
  const p = S.preset; const i = p.chain.indexOf(S.sel), j = i + dir; if (j < 0 || j > 10) return;
  [p.chain[i], p.chain[j]] = [p.chain[j], p.chain[i]]; saveSession(); renderMain();
  if (S.liveEdit) { await pedal.setChainAt(i, p.chain[i]).catch(() => {}); await pedal.setChainAt(j, p.chain[j]).catch(() => {}); }
}

async function hear() {
  if (!pedal.connected) return toast('Conecte a MK-300 (USB ou Bluetooth) para ouvir.', true);
  await withProgress(S, 'Tocando na pedaleira', async pg => {
    const n = await pedal.audition(S.preset, v => pg.set(v, 'Enviando blocos…'));
    S.liveEdit = true; toast(n ? 'Tocando no preset ativo, sem gravar.' : 'A pedaleira já está com este timbre.');
  });
  renderMain();
}

async function save() {
  if (!pedal.connected) return toast('Conecte a MK-300 para salvar no slot. Sem pedaleira, use Baixar.', true);
  const p = S.preset; const slot0 = S.slot - 1;
  S.busy = true;
  try { S.slotNames[slot0] = await pedal.readSlotName(slot0); } catch (e) {}
  S.busy = false;
  const cur = S.slotNames[slot0];
  const ok = await confirmBox(`Salvar no slot ${S.slot}?`, cur ? `O slot ${S.slot} tem hoje <b>${esc(cur)}</b>. Ele será substituído por <b>${esc(p.name)}</b>. Os controles de footswitch e expressão desse slot são mantidos.` : `O slot ${S.slot} será gravado com <b>${esc(p.name)}</b>.`, 'Substituir e salvar');
  if (!ok) return;
  await withProgress(S, `Salvando no slot ${S.slot}`, async pg => {
    await pedal.save(slot0, p, v => pg.set(v, v < 0.4 ? 'Gravando…' : 'Conferindo a gravação…'));
    S.slotNames[slot0] = ascii20(p.name); saveSlotNames(); S.liveEdit = true;
    toast(`Salvo e carregado no slot ${S.slot}. O nome novo aparece no visor depois de religar a pedaleira.`);
  });
  renderMain();
}

function saveFiles() {
  const p = S.preset;
  download(fileName(p.name, 'txt'), fichaText(p, { ...S.meta, explain: S.explain }));
  download(fileName(p.name, 'json'), JSON.stringify({ app: 'tonematch-mk300', version: 1, preset: p, meta: S.meta, explain: S.explain }, null, 2), 'application/json');
  toast('Ficha (.txt) e preset (.json) salvos em Downloads.');
}

async function openJson() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  await guard(async () => {
    const j = JSON.parse(await f.text()); const p = j.preset || j;
    if (!isPreset(p)) throw new Error('Esse arquivo não é um preset do ToneMatch MK-300.');
    setTone({ preset: p, meta: j.meta || {}, explain: j.explain || { how: 'Preset aberto de arquivo.', notes: [] } }); renderMain();
  }, 'Preset aberto.');
}

export default {
  view,
  async click(t, d) {
    if (d.blk !== undefined) { S.sel = +d.blk; renderMain(); return; }
    if (d.act === 'mvL') move(-1);
    if (d.act === 'mvR') move(1);
    if (d.act === 'edit') openBlockEditor(S.sel);
    if (d.act === 'info') infoSheet();
    if (d.act === 'hear') hear();
    if (d.act === 'dl') saveFiles();
    if (d.act === 'save') save();
    if (d.act === 'openjson') openJson();
    if (d.act === 'readbuf') guard(async () => {
      setTone({ preset: decodePreset(await pedal.readBuffer()), explain: { how: 'Preset lido do buffer de edição da pedaleira.', notes: [], engine: 'Pedaleira' } });
      S.liveEdit = true; renderMain();
    }, 'Preset atual trazido da pedaleira.');
  },
  change(e) {
    const p = S.preset; const { id, value } = e.target;
    if (id === 'pname') { p.name = ascii20(value); e.target.value = p.name; if (S.liveEdit) pedal.setName(p.name).catch(() => {}); }
    if (id === 'pbpm') { p.bpm = clamp(+value || 120, 40, 300); if (S.liveEdit) pedal.setBpm(p.bpm).catch(() => {}); }
    if (id === 'pvol') { p.vol = clamp(+value || 0, 0, 100); if (S.liveEdit) pedal.setVol(p.vol).catch(() => {}); }
    if (id === 'pslot') { S.slot = clamp(+value || 1, 1, 160); e.target.value = S.slot; $('#slotinfo').innerHTML = slotInfo(); }
    saveSession();
  },
};
