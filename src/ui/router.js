/* Escolhe a tela pelo estado e repassa os eventos da área principal para ela.
   Cada tela é um módulo com: view() → html, e opcionalmente mount(), click(btn, data, e),
   input(e), change(e), leave(). */
import { $ } from '../lib/dom.js';
import { S } from '../state/store.js';
import { renderConnection } from './connection.js';
import criar from './screens/criar.js';
import preset from './screens/preset.js';
import library from './screens/library.js';
import song from './screens/song.js';
import live from './screens/live.js';
import settings from './screens/settings.js';

let current = null;

export function screenFor() {
  if (S.tab === 'timbre') return S.step === 2 && S.preset ? preset : criar;
  if (S.tab === 'lib') return S.songId ? song : library;
  if (S.tab === 'live') return live;
  return settings;
}
/** redesenha só a área principal */
export function renderMain() {
  const next = screenFor();
  if (current && current !== next && current.leave) current.leave();
  current = next;
  $('#main').innerHTML = next.view();
  if (next.mount) next.mount($('#main'));
}
/** redesenha abas, faixa de conexão e tela */
export function renderAll() {
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  renderConnection(); renderMain(); window.scrollTo(0, 0);
}
export function go(tab, extra = {}) { Object.assign(S, { tab }, extra); renderAll(); }

export function initRouter() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab, { songId: null }); });
  $('#gear').addEventListener('click', () => go('set'));
  const main = $('#main');
  main.addEventListener('click', e => {
    const btn = e.target.closest('button,[data-act]'); if (!btn || btn.disabled) return;
    if (btn.dataset.step) { S.step = +btn.dataset.step; renderMain(); return; }
    if (current && current.click) current.click(btn, btn.dataset, e);
  });
  main.addEventListener('input', e => current && current.input && current.input(e));
  main.addEventListener('change', e => current && current.change && current.change(e));
}
