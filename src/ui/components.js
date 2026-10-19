/* Peças de interface reutilizadas: aviso, folha inferior, confirmação e progresso. */
import { $, esc } from '../lib/dom.js';

export function toast(msg, bad = false) {
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 5200 : 2600);
}
/** executa e mostra o erro como aviso; devolve undefined se falhar */
export async function guard(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { console.error(e); toast(e.message || String(e), true); }
}
/** folha que sobe de baixo; onMount(el, close) monta o conteúdo */
export function sheet(html, onMount) {
  const sc = document.createElement('div'); sc.className = 'scrim';
  sc.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => sc.remove();
  sc.addEventListener('click', e => { if (e.target === sc) close(); });
  sc.close = close; $('#layer').appendChild(sc);
  if (onMount) onMount(sc.firstElementChild, close);
  return sc;
}
export function confirmBox(title, html, okLabel = 'Confirmar') {
  return new Promise(res => {
    sheet(`<h2>${esc(title)}</h2><p class="muted">${html}</p><div class="row" style="margin-top:14px"><button class="btn ghost grow" data-x="no">Cancelar</button><button class="btn pri grow" data-x="ok">${esc(okLabel)}</button></div>`, (el, close) => {
      el.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; close(); res(x.dataset.x === 'ok'); });
    });
  });
}
export function progressSheet(title) {
  let bar, txt;
  const sc = sheet(`<h2>${esc(title)}</h2><p class="muted" data-p="t">Não desconecte a pedaleira.</p><div class="prog"><i data-p="b"></i></div>`, el => { bar = el.querySelector('[data-p=b]'); txt = el.querySelector('[data-p=t]'); });
  return { set(v, t) { bar.style.width = Math.round(v * 100) + '%'; if (t) txt.textContent = t; }, close: () => sc.close() };
}
/** roda uma operação longa com a folha de progresso e a leitura periódica pausada */
export async function withProgress(S, title, fn) {
  S.busy = true; const pg = progressSheet(title);
  try { return await fn(pg); }
  catch (e) { toast(e.message || String(e), true); }
  finally { pg.close(); S.busy = false; }
}
