/* Tela da música: carregar timbre, BPM e tom, tocar junto e gravar junto. */
import { $, $$, esc, download, fileName } from '../../lib/dom.js';
import { lsGet, lsSet, KEYS } from '../../lib/storage.js';
import { clamp } from '../../lib/text.js';
import { S, setTone } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { clonePreset } from '../../domain/preset.js';
import { keyLabel } from '../../domain/music.js';
import * as lib from '../../services/library.js';
import { Player, fmtTime } from '../../services/player.js';
import { Recorder, audioInputs } from '../../services/recorder.js';
import { toast, guard, sheet, confirmBox } from '../components.js';
import { renderMain, go } from '../router.js';

let song = null, player = null, recorder = null;

const view = () => `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="back">‹ Biblioteca</button><span class="grow"></span><button class="btn sm danger" data-act="delsong">Apagar</button></div>
  <div class="card" id="songcard"><p class="muted">Carregando…</p></div>`;

function cardHtml(s) {
  return `<h2 class="title">${esc(s.song || s.audioName)}</h2><div class="muted">${esc(s.artist || '')}${s.slot ? ' · slot ' + s.slot : ''}</div>
    ${s.preset ? `<button class="btn pri full" style="margin-top:10px" data-act="loadtone">Carregar timbre${s.slot ? ' · slot ' + s.slot : ''}</button>` : '<button class="btn full" style="margin-top:10px" data-act="maketone">Criar timbre para esta música</button>'}
    <div class="row" style="margin-top:14px"><span class="disp num big2">♩ <span id="sbpm">${s.bpm || '—'}</span> BPM</span><span class="muted">Tom: ${esc(s.key ? keyLabel(s.key) : '—')}</span></div>
    <div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="half">BPM ÷2</button><button class="btn sm grow" data-act="double">BPM ×2</button><button class="btn sm grow" data-act="fix">Corrigir</button></div>
    <p class="small muted hint">O app mede pelo áudio. O andamento pode sair na metade ou no dobro, e o tom no relativo (mesmas notas) ou num tom vizinho; se sair errado, use Corrigir.</p>
    ${s.hasAudio ? `<div class="player"><span class="lbl">Tocar junto</span>
      <button class="btn pri" data-act="play" id="playbtn">▶ Tocar</button>
      <input type="range" id="seek" min="0" max="1000" value="0" aria-label="Posição"><div class="small muted num" id="ptime">0:00 / 0:00</div>
      <div class="chips c3">${[50, 75, 100].map(v => `<button class="chip ${v === 100 ? 'on' : ''}" data-speed="${v}">${v}%</button>`).join('')}</div>
      <div class="chips c3"><button class="chip" data-act="ptA" id="ptA">Início (A)</button><button class="chip" data-act="ptB" id="ptB">Fim (B)</button><button class="chip" data-act="ptClear">Limpar</button></div>
      <p class="small muted hint">Repetir trecho: com a música tocando, toque em Início (A) e depois em Fim (B).</p>
      <div class="switch" data-act="mono" id="monosw" role="switch" aria-checked="false" tabindex="0"><i></i><span>Reduzir guitarra (experimental)</span></div>
      <p class="small muted hint">Deixa só o centro do estéreo, tirando o que está aberto para os lados, onde costumam ficar as guitarras. Guitarra gravada no centro não sai, e o som fica mono.</p>
    </div>` : '<p class="muted" style="margin-top:12px">Sem áudio nesta música. Carregue um MP3 ou WAV na Biblioteca para tocar junto.</p>'}
    <div style="margin-top:16px"><span class="lbl">Gravar junto</span>
      <div class="field narrow"><label class="small muted" for="indev">Entrada</label><select id="indev"><option value="">Padrão do celular</option></select></div>
      <div class="row" style="margin-top:8px"><button class="btn grow" data-act="recA" id="recA">● Gravar áudio</button><button class="btn grow" data-act="recV" id="recV">● Gravar vídeo</button></div>
      <video id="vprev" muted playsinline hidden></video>
      <p class="small muted hint">Com a MK-300 no cabo USB, escolha a entrada USB para gravar o som dela; sem cabo, grava pelo microfone. Para gravar o som da pedaleira, deixe o Áudio USB em Nor (aba Ao vivo).</p>
    </div>
    <div id="recs" class="list"></div>`;
}

async function mount() {
  song = await lib.getSong(S.songId);
  if (!song) { S.songId = null; return renderMain(); }
  $('#songcard').innerHTML = cardHtml(song);
  const sel = $('#indev'); const saved = lsGet(KEYS.inputDevice, '');
  (await audioInputs()).forEach((d, i) => sel.add(new Option(d.label || 'Entrada ' + (i + 1), d.deviceId, false, d.deviceId === saved)));
  renderRecs();
  if (song.hasAudio) {
    player = new Player(song.audio, {
      onEnd: () => { const b = $('#playbtn'); if (b) b.textContent = '▶ Tocar'; },
      onTick: (t, d, p) => {
        const sk = $('#seek'), pt = $('#ptime');
        if (sk && document.activeElement !== sk) sk.value = d ? Math.round(t / d * 1000) : 0;
        if (pt) pt.textContent = `${fmtTime(t)} / ${fmtTime(d)}${p.a != null ? ` · A ${fmtTime(p.a)}` : ''}${p.b != null ? ` · B ${fmtTime(p.b)}` : ''}`;
      },
    });
  }
}

function leave() { if (recorder && recorder.active) recorder.stop(); recorder = null; if (player) player.destroy(); player = null; song = null; }

async function renderRecs() {
  const el = $('#recs'); if (!el || !song) return;
  const recs = await lib.listRecordings(song.id);
  el.innerHTML = recs.length ? '<span class="lbl" style="margin-top:8px">Gravações</span>' + recs.map(r => `<div class="item"><div class="t1">${r.kind === 'video' ? 'Vídeo' : 'Áudio'} · ${new Date(r.date).toLocaleString('pt-BR')}</div><div class="rbox"></div><div class="row" style="margin-top:8px"><button class="btn sm" data-rplay="${r.id}">▶ Play</button><button class="btn sm" data-rsave="${r.id}">Salvar em…</button><button class="btn sm" data-rshare="${r.id}">Compartilhar</button><button class="btn sm danger" data-rdel="${r.id}">Apagar</button></div></div>`).join('') : '';
}

function setRecButtons(kind) {
  [['#recA', 'audio', '● Gravar áudio'], ['#recV', 'video', '● Gravar vídeo']].forEach(([s, k, label]) => {
    const b = $(s); if (!b) return; const on = kind === k; b.textContent = on ? '■ Parar gravação' : label; b.classList.toggle('danger', on); b.disabled = !!kind && !on;
  });
}
async function toggleRec(kind) {
  if (recorder && recorder.active) {
    const r = await recorder.stop(); recorder = null; setRecButtons(null);
    const v = $('#vprev'); if (v) { v.hidden = true; v.srcObject = null; }
    if (player) { player.pause(); $('#playbtn').textContent = '▶ Tocar'; }
    if (r) { await lib.putRecording({ id: 'r' + Date.now(), songId: song.id, kind: r.kind, blob: r.blob, name: fileName(`${song.song || 'gravacao'}-${r.kind}`, r.ext), date: Date.now() }); renderRecs(); toast('Gravação salva.'); }
    return;
  }
  try {
    recorder = new Recorder();
    const stream = await recorder.start({ kind, deviceId: $('#indev').value, player });
    if (kind === 'video') { const v = $('#vprev'); v.hidden = false; v.srcObject = stream; v.play().catch(() => {}); }
    if (player && !player.playing) { await player.play(); $('#playbtn').textContent = '❚❚ Pausar'; }
    setRecButtons(kind);
  } catch (e) { recorder = null; toast('Não consegui abrir o microfone ou a câmera: ' + e.message, true); }
}

async function shareRecording(id) {
  const r = await lib.getRecording(id); const file = new File([r.blob], r.name, { type: r.blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: r.name }).catch(() => {});
  else { download(r.name, r.blob); toast('Este celular não compartilha arquivos pelo navegador; salvei em Downloads.'); }
}

export default {
  view, mount, leave,
  change(e) { if (e.target.id === 'indev') lsSet(KEYS.inputDevice, e.target.value); },
  input(e) { if (e.target.id === 'seek' && player) player.seekFraction(e.target.value / 1000); },
  async click(t, d) {
    const s = song; if (!s) return;
    if (d.act === 'back') { S.songId = null; renderMain(); return; }
    if (d.act === 'delsong') { if (await confirmBox('Apagar esta música?', 'A música, o timbre guardado e as gravações dela saem da biblioteca. O preset na pedaleira não muda.', 'Apagar')) { await lib.deleteSong(s.id); S.songId = null; renderMain(); } return; }
    if (d.act === 'loadtone') {
      setTone({ preset: clonePreset(s.preset), explain: s.explain || { how: 'Timbre da biblioteca.', notes: [] }, meta: { artist: s.artist, song: s.song, key: s.key, bpm: s.bpm } });
      if (s.slot) S.slot = s.slot;
      if (pedal.connected && s.slot) await guard(() => pedal.load(s.slot - 1), `Timbre carregado e slot ${s.slot} ativo na pedaleira.`); else toast('Timbre carregado no passo Preset.');
      go('timbre', { step: 2, songId: null }); return;
    }
    if (d.act === 'maketone') {
      Object.assign(S.form, { artist: s.artist || '', song: s.song || '' });
      if (s.analysis) Object.assign(S.form, { analysis: s.analysis, audioName: s.audioName, audioBlob: s.audio });
      go('timbre', { step: 1, songId: null }); return;
    }
    if (d.act === 'half' || d.act === 'double') { if (!s.bpm) return; s.bpm = Math.round(d.act === 'half' ? s.bpm / 2 : s.bpm * 2); await lib.putSong(s); $('#sbpm').textContent = s.bpm; }
    if (d.act === 'fix') sheet(`<h2>Corrigir BPM e tom</h2><div class="field"><label class="lbl" for="fxb">BPM</label><input type="number" id="fxb" value="${s.bpm || ''}" min="30" max="300"></div><div class="field"><label class="lbl" for="fxk">Tom</label><input type="text" id="fxk" value="${esc(s.key || '')}" placeholder="ex.: Em, D, F#m"></div><button class="btn pri full" style="margin-top:14px" data-x="ok">Salvar</button>`, (el, close) => {
      el.addEventListener('click', async e => { if (!e.target.closest('[data-x]')) return; s.bpm = clamp(+el.querySelector('#fxb').value || s.bpm || 120, 30, 300); s.key = el.querySelector('#fxk').value.trim(); await lib.putSong(s); close(); leave(); mount(); });
    });
    if (d.act === 'recA' || d.act === 'recV') toggleRec(d.act === 'recV' ? 'video' : 'audio');
    if (d.rplay) { const r = await lib.getRecording(d.rplay); const box = t.closest('.item').querySelector('.rbox'); const url = URL.createObjectURL(r.blob); box.innerHTML = r.kind === 'video' ? `<video src="${url}" controls playsinline autoplay></video>` : `<audio src="${url}" controls autoplay></audio>`; }
    if (d.rsave) { const r = await lib.getRecording(d.rsave); download(r.name, r.blob); }
    if (d.rshare) shareRecording(d.rshare);
    if (d.rdel) { await lib.deleteRecording(d.rdel); renderRecs(); }
    if (!player) return;
    if (d.act === 'play') t.textContent = (await player.toggle()) ? '❚❚ Pausar' : '▶ Tocar';
    if (d.speed) { player.speed(+d.speed); $$('[data-speed]').forEach(x => x.classList.toggle('on', x === t)); }
    if (d.act === 'ptA') { if (!player.playing) return toast('Toque a música e marque o início enquanto ela toca.', true); player.markA(); t.classList.add('on'); $('#ptB').classList.remove('on'); }
    if (d.act === 'ptB') { if (player.a == null) return toast('Marque o Início (A) primeiro.', true); if (!player.markB()) return toast('O fim precisa vir depois do início.', true); t.classList.add('on'); }
    if (d.act === 'ptClear') { player.clearAB(); $('#ptA').classList.remove('on'); $('#ptB').classList.remove('on'); }
    if (d.act === 'mono') { player.setMono(!player.monoOn); t.classList.toggle('on', player.monoOn); t.setAttribute('aria-checked', player.monoOn); }
  },
};
