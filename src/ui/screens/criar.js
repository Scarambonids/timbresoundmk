/* Timbre › 1 · Criar: o pedido. */
import { $, esc, pickFile, debounce } from '../../lib/dom.js';
import { lsGet, lsSet, KEYS } from '../../lib/storage.js';
import { aiConfig, loadApiKey } from '../../lib/secret.js';
import { S, saveSession, setSessionAudio, setTone } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { blockCat } from '../../domain/catalog.js';
import { STYLES } from '../../data/styles.js';
import { artistNames, songsOf } from '../../engine/knowledge.js';
import { generateLocal } from '../../engine/localEngine.js';
import { generateAI, cacheKey } from '../../engine/aiEngine.js';
import { analyzeAudio } from '../../engine/audio/analysis.js';
import { toast, sheet, progressSheet } from '../components.js';
import { renderMain, go } from '../router.js';

const INTENTS = [['solo', 'Solo'], ['ritmo', 'Ritmo'], ['ambient', 'Ambient'], ['seco', 'Seco']];
const STYLE_CHIPS = ['blues', 'rock70', 'metal', 'ambient', 'jazz', 'wahfunk'];

export const stepTabs = () => `<div class="seg"><button data-step="1" class="${S.step === 1 ? 'on' : ''}">1 · CRIAR</button><button data-step="2" class="${S.step === 2 ? 'on' : ''}" ${S.preset ? '' : 'disabled'}>2 · PRESET</button></div>`;
const songOptions = () => songsOf(S.form.artist).map(t => `<option value="${esc(t)}">`).join('');

function view() {
  const f = S.form; const an = f.analysis;
  const ai = S.aiOn ? `IA: ONLINE · ${esc(aiConfig().model || '')} ›` : 'IA: MOTOR DO APP ›';
  return `${stepTabs()}
  <div class="card">
    <div class="row"><span class="lbl grow">Base do timbre</span><button class="linkbtn small" data-act="baseinfo" aria-label="Sobre a base">ⓘ</button></div>
    <div class="chips c2" style="margin-top:8px">
      <button class="chip ${f.base === 'amp' ? 'on' : ''}" data-base="amp">Amp da pedaleira</button>
      <button class="chip ${f.base === 'nam' ? 'on' : ''}" data-base="nam">Captura NAM importada</button>
    </div>
    ${f.base === 'nam' ? `<div class="field"><span class="lbl">Slot AMP</span><select id="namSlot">${blockCat('AMP').models.map(m => `<option value="${m.index + 1}" ${m.index + 1 === +f.namSlot ? 'selected' : ''}>${m.index + 1} · ${esc(m.name)}</option>`).join('')}</select></div>
      <p class="muted small hint">Escolha o slot onde você importou a captura pelo M-EFCS. O resto da cadeia é montado em volta dela.</p>` : ''}
    <div class="stack" style="margin-top:12px">
      <input type="text" id="artist" placeholder="Artista · ex.: David Gilmour" value="${esc(f.artist)}" list="dlArtists" autocomplete="off">
      <input type="text" id="song" placeholder="Música · ex.: Comfortably Numb" value="${esc(f.song)}" list="dlSongs" autocomplete="off">
      <datalist id="dlArtists">${artistNames().map(a => `<option value="${esc(a)}">`).join('')}</datalist>
      <datalist id="dlSongs">${songOptions()}</datalist>
    </div>
    <div class="field"><span class="lbl">Áudio</span><div class="row"><button class="btn sm grow" data-act="audio">♫ ${f.audioName ? esc(f.audioName) : 'Escolher MP3 / WAV · opcional'}</button>${f.audioName ? '<button class="btn sm" data-act="noaudio" aria-label="Tirar áudio">✕</button>' : ''}</div></div>
    ${an ? `<p class="muted small hint indent">♩ ${an.bpm} BPM · tom ${esc(an.key)} · ganho sugerido ${an.gainHint} · brilho ${an.brightHint} · ambiência ${an.roomHint}</p>` : ''}
    <div class="field"><span class="lbl">Intenção</span><div class="chips c4">${INTENTS.map(([k, l]) => `<button class="chip ${f.intents.includes(k) ? 'on' : ''}" data-intent="${k}">${l}</button>`).join('')}</div></div>
    <div class="field top"><span class="lbl">Estilo</span><div class="chips c3">${STYLE_CHIPS.map(k => `<button class="chip ${f.style === k ? 'on' : ''}" data-style="${k}">${STYLES[k].label}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Patch vol</span><div class="row"><input type="range" id="vol" min="0" max="100" value="${f.vol}" class="grow"><b class="num val" id="volv">${f.vol}</b></div></div>
    <button class="btn pri full" style="margin-top:14px" data-act="gen">✦ Gerar timbre inteligente</button>
    <div class="row" style="margin-top:8px"><button class="linkbtn small" data-act="aiset">${ai}</button></div>
  </div>
  <div class="card"><span class="lbl">Como funciona</span><p class="small muted hint">Escreva artista e música (ou só toque num estilo, ou escolha um áudio). O app escolhe os modelos da MK-300 pela referência de cada um, monta a cadeia e abre o passo Preset. Lá você ouve na pedaleira sem gravar, ajusta e salva no slot que quiser.</p></div>`;
}

async function chooseAudio() {
  const f = await pickFile('audio/*,.mp3,.wav'); if (!f) return;
  S.form.audioName = f.name; S.form.audioBlob = f; renderMain(); toast('Analisando o áudio…');
  try { S.form.analysis = await analyzeAudio(await f.arrayBuffer()); await setSessionAudio(f); saveSession(); renderMain(); }
  catch (e) { S.form.audioName = ''; S.form.audioBlob = null; renderMain(); toast('Não consegui ler esse arquivo de áudio. Use MP3 ou WAV.', true); }
}

async function generate() {
  const f = S.form;
  if (!f.artist && !f.song && !f.analysis && !f.style) return toast('Escreva artista e música, escolha um áudio ou toque num estilo.', true);
  const req = { artist: f.artist.trim(), song: f.song.trim(), intents: [...f.intents], style: f.style, vol: f.vol, base: f.base, namSlot: f.namSlot, analysis: f.analysis };
  let res = null;
  if (S.aiOn) {
    const cache = lsGet(KEYS.aiCache, {}); const ck = cacheKey(req);
    if (cache[ck]) { res = cache[ck]; res.preset.vol = req.vol; toast('Timbre guardado da IA (sem custo).'); }
    else {
      const pg = progressSheet('Perguntando à IA online'); pg.set(0.3, 'Pode levar alguns segundos.');
      try { const key = await loadApiKey(); if (!key) throw new Error('chave não encontrada'); res = await generateAI(req, { ...aiConfig(), key }); cache[ck] = res; lsSet(KEYS.aiCache, cache); }
      catch (e) { toast('IA online falhou (' + e.message + '). Montei pelo motor do app.', true); }
      pg.close();
    }
  }
  if (!res) res = generateLocal(req);
  setTone({ preset: res.preset, explain: res.explain, meta: { artist: req.artist, song: req.song, key: res.key, bpm: res.bpm } });
  S.form.vol = res.preset.vol; S.step = 2; renderMain(); window.scrollTo(0, 0);
}

export default {
  view,
  click(t, d) {
    if (d.base) { S.form.base = d.base; saveSession(); renderMain(); }
    if (d.intent) { const i = S.form.intents.indexOf(d.intent); i >= 0 ? S.form.intents.splice(i, 1) : S.form.intents.push(d.intent); t.classList.toggle('on'); saveSession(); }
    if (d.style) { S.form.style = S.form.style === d.style ? null : d.style; saveSession(); renderMain(); }
    if (d.act === 'audio') chooseAudio();
    if (d.act === 'noaudio') { Object.assign(S.form, { audioName: '', analysis: null, audioBlob: null }); setSessionAudio(null); saveSession(); renderMain(); }
    if (d.act === 'gen') generate();
    if (d.act === 'aiset') go('set');
    if (d.act === 'baseinfo') sheet(`<h2>Base do timbre</h2><p class="muted"><b>Amp da pedaleira</b>: o app escolhe entre os amps da MK-300 o que tem a referência mais próxima do equipamento da gravação.</p><p class="muted"><b>Captura NAM importada</b>: desde o firmware V73 a MK-300 aceita capturas NAM A2 nos slots de AMP. Se você importou uma pelo M-EFCS, escolha o slot e o app monta drive, caixa e efeitos em volta dela.</p>`);
  },
  input(e) {
    const id = e.target.id;
    if (id === 'vol') { S.form.vol = +e.target.value; $('#volv').textContent = S.form.vol; if (S.liveEdit && pedal.connected) debounce('vol', () => pedal.setVol(S.form.vol).catch(() => {}), 120); }
    if (id === 'artist') S.form.artist = e.target.value;
    if (id === 'song') S.form.song = e.target.value;
  },
  change(e) {
    if (e.target.id === 'namSlot') { S.form.namSlot = +e.target.value; saveSession(); }
    if (e.target.id === 'artist') $('#dlSongs').innerHTML = songOptions();
  },
};
