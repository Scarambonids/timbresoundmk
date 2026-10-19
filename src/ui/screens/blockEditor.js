/* Folha de edição de um bloco: liga/desliga, troca o efeito e ajusta cada controle.
   Com a edição ao vivo ligada, cada mudança vai na hora para a pedaleira. */
import { esc, debounce } from '../../lib/dom.js';
import { S, saveSession } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { BLOCKS, BLOCK_INFO, TONE_BLOCKS } from '../../domain/blocks.js';
import { blockCat, modelOf, modelGroup, defaultsFor, fmtParam } from '../../domain/catalog.js';
import { clamp } from '../../lib/text.js';
import { toast, sheet } from '../components.js';
import { renderMain } from '../router.js';

export function openBlockEditor(b) {
  const bl = S.preset.blocks[b]; const name = BLOCKS[b];
  const live = () => S.liveEdit && pedal.connected;
  const render = el => {
    const m = modelOf(b, bl.model); const groups = {};
    blockCat(b).models.forEach(x => (groups[modelGroup(x, name)] = groups[modelGroup(x, name)] || []).push(x));
    el.innerHTML = `<div class="row"><h2 class="grow">${name} <span class="muted small body">${BLOCK_INFO[name].pt}</span></h2><button class="btn sm" data-x="close">Pronto</button></div>
      <div class="switch ${bl.on ? 'on' : ''}" data-x="toggle" role="switch" aria-checked="${bl.on}" tabindex="0"><i></i><span>${bl.on ? 'Ligado' : 'Desligado'}</span></div>
      <div style="margin-top:12px"><label class="lbl" for="msel">Efeito</label><select id="msel" style="margin-top:6px">${Object.entries(groups).map(([g, list]) => `<optgroup label="${g}">${list.map(x => `<option value="${x.index}" ${x.index === bl.model ? 'selected' : ''}>${x.index + 1} · ${esc(x.name)}${x.ref ? ' — ' + esc(x.ref) : ''}</option>`).join('')}</optgroup>`).join('')}</select></div>
      ${m.params.map((pr, k) => `<div class="prm"><div class="h"><span>${esc(pr.name)}</span><b class="num" data-pv="${k}">${esc(fmtParam(pr, bl.knobs[k]))}</b></div><input type="range" data-k="${k}" min="${pr.min}" max="${pr.max}" step="1" value="${clamp(bl.knobs[k], pr.min, pr.max)}" aria-label="${esc(pr.name)}"></div>`).join('') || '<p class="muted">Este efeito não tem controles.</p>'}
      ${live() ? '<div class="notice">Ao vivo: as mudanças já tocam na pedaleira.</div>' : ''}`;
  };
  sheet('', (el, close) => {
    render(el);
    const toggle = () => { bl.on = !bl.on; render(el); saveSession(); if (live()) pedal.setOn(b, bl.on).catch(er => toast(er.message, true)); };
    el.addEventListener('click', e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'close') { close(); renderMain(); }
      if (x.dataset.x === 'toggle') toggle();
    });
    el.addEventListener('keydown', e => { if (e.target.dataset.x === 'toggle' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggle(); } });
    el.addEventListener('change', async e => {
      if (e.target.id !== 'msel') return;
      bl.model = +e.target.value;
      if (!TONE_BLOCKS.includes(name)) bl.knobs = defaultsFor(b, bl.model);   // DS/AMP/CAB mantêm os valores
      render(el); saveSession();
      if (live()) await pedal.setModelWithKnobs(b, bl.model, bl.knobs).catch(er => toast(er.message, true));
    });
    el.addEventListener('input', e => {
      const k = e.target.dataset.k; if (k === undefined) return;
      const pr = modelOf(b, bl.model).params[k]; bl.knobs[k] = +e.target.value;
      el.querySelector(`[data-pv="${k}"]`).textContent = fmtParam(pr, bl.knobs[k]); saveSession();
      if (live()) debounce(`k${b}_${k}`, () => pedal.setKnob(b, +k, bl.knobs[k]).catch(() => {}), 90);
    });
  });
}
