/* Biblioteca: salvar a música atual, backing track, BPM e tom, carregar áudio, lista. */
import { $, esc, download, fileName, pickFile } from '../../lib/dom.js';
import { S } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { DB } from '../../lib/db.js';
import { keyLabel } from '../../domain/music.js';
import { lookupSong } from '../../engine/knowledge.js';
import { analyzeAudio } from '../../engine/audio/analysis.js';
import * as lib from '../../services/library.js';
import { toast, guard } from '../components.js';
import { renderMain } from '../router.js';

function backingInfo() {
  const typed = (($('#btq') || {}).value || '').trim();
  const q = typed || [S.meta.artist, S.meta.song].filter(Boolean).join(' ');
  const s = lookupSong(q);
  return { q, bpm: (s && s.bpm) || (!typed && S.meta.bpm) || null, key: (s && s.key) || (!typed && S.meta.key) || null };
}
function updateBackingInfo() {
  const i = backingInfo(); const el = $('#btinfo');
  if (el) el.innerHTML = i.q ? `♩ ${i.bpm ? i.bpm + ' BPM' : 'BPM —'} · ${i.key ? 'tom ' + esc(keyLabel(i.key)) : 'tom —'}` : '';
}

function view() {
  const cur = [S.meta.artist, S.meta.song].filter(Boolean).join(' · ');
  return `<div class="card">
    <span class="lbl">Biblioteca de músicas</span>
    <div class="row" style="margin-top:10px"><button class="btn pri grow" data-act="savecur" ${S.preset ? '' : 'disabled'}>＋ Salvar música atual</button><button class="btn grow" data-act="bt">Backing track</button></div>
    ${cur ? `<p class="small muted hint">Atual: ${esc(cur)}${S.preset ? ' · ' + esc(S.preset.name) : ''}</p>` : ''}
    <input type="search" id="btq" style="margin-top:12px" placeholder="Buscar backing track · artista e música" aria-label="Buscar backing track">
    <div id="btinfo" class="small muted" style="margin-top:8px"></div>
    <button class="btn full" style="margin-top:8px" data-act="sendbpm" ${pedal.connected ? '' : 'disabled'}>Mandar o BPM para a pedaleira</button>
    <button class="btn full" style="margin-top:8px" data-act="loadmp3">♫ Carregar MP3 / WAV</button>
  </div>
  <div class="card"><div class="row"><span class="lbl grow">Músicas</span><button class="btn sm" data-act="export">Exportar</button><button class="btn sm" data-act="import">Importar</button></div><div class="list" id="liblist"><p class="muted">Carregando…</p></div></div>`;
}
async function mount() {
  updateBackingInfo();
  const songs = await lib.listSongs(); const el = $('#liblist'); if (!el) return;
  el.innerHTML = songs.length ? songs.map(s => `<button class="item" data-song="${s.id}"><div class="t1">${esc(s.song || s.audioName || 'Sem nome')}</div><div class="t2">${esc(s.artist || '')}${s.slot ? ' · slot ' + s.slot : ''}${s.preset ? ' · timbre' : ''}${s.hasAudio ? ' · ♫ áudio' : ''}${s.bpm ? ' · ' + s.bpm + ' BPM' : ''}</div></button>`).join('')
    : '<p class="muted">Nenhuma música ainda. Gere um timbre e toque em Salvar música atual, ou carregue um MP3.</p>';
}

export default {
  view, mount,
  input(e) { if (e.target.id === 'btq') updateBackingInfo(); },
  async click(t, d) {
    if (d.song) { S.songId = d.song; renderMain(); return; }
    if (d.act === 'bt') { const i = backingInfo(); if (!i.q) return toast('Escreva artista e música na busca.', true); window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(i.q + ' backing track guitar'), '_blank', 'noopener'); }
    if (d.act === 'sendbpm') { const i = backingInfo(); if (!i.bpm) return toast('Sem BPM para esta música. Carregue o áudio para medir.', true); guard(() => pedal.setBpm(i.bpm), `BPM ${i.bpm} enviado. O delay com Sync e a bateria seguem esse andamento.`); }
    if (d.act === 'savecur') {
      const audio = S.form.audioName ? (S.form.audioBlob || await DB.get('kv', 'sessionAudio').catch(() => null)) : null;
      await lib.putSong(lib.songFromTone({ preset: S.preset, explain: S.explain, meta: S.meta, slot: S.slot, audio, audioName: S.form.audioName }));
      toast('Música salva com o timbre e o slot ' + S.slot + '.'); mount();
    }
    if (d.act === 'loadmp3') {
      const f = await pickFile('audio/*,.mp3,.wav'); if (!f) return;
      toast('Medindo BPM e tom…');
      const an = await analyzeAudio(await f.arrayBuffer()).catch(() => null);
      const s = lib.songFromFile(f, an); await lib.putSong(s); S.songId = s.id; renderMain();
    }
    if (d.act === 'export') { download(fileName('biblioteca-tonematch', 'json'), JSON.stringify(await lib.exportLibrary(), null, 2), 'application/json'); toast('Biblioteca exportada (sem os áudios).'); }
    if (d.act === 'import') { const f = await pickFile('.json'); if (f) guard(async () => { await lib.importLibrary(JSON.parse(await f.text())); mount(); }, 'Biblioteca importada.'); }
  },
};
