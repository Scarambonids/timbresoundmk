/* Ajustes: IA online, nomes dos modelos, catálogo, demonstração, instalação e dados. */
import { $, esc, pickFile } from '../../lib/dom.js';
import { lsGet, lsSet, lsClear, KEYS } from '../../lib/storage.js';
import { norm } from '../../lib/text.js';
import { DB } from '../../lib/db.js';
import { saveApiKey, aiConfig } from '../../lib/secret.js';
import { S } from '../../state/store.js';
import { pedal } from '../../state/pedal.js';
import { BLOCKS } from '../../domain/blocks.js';
import { blockCat, buildCatalog, rawFromStudioJson } from '../../domain/catalog.js';
import { CATALOG_NOTE } from '../../data/catalog.js';
import { toast, guard, confirmBox } from '../components.js';
import { renderMain, go } from '../router.js';
import { connect } from '../connection.js';

let nameBlock = 'AMP';
const MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'];

function view() {
  const ai = aiConfig(); const nCache = Object.keys(lsGet(KEYS.aiCache, {})).length;
  return `<div class="row" style="margin-top:12px"><button class="btn sm" data-act="back">‹ Voltar</button><h2 class="grow right">AJUSTES</h2></div>
  <div class="card"><div class="row"><span class="lbl grow">IA online · opcional</span><span class="small"><span class="dot inline ${S.aiOn ? 'on' : ''}"></span> ${S.aiOn ? 'ativa' : 'desligada'}</span></div>
    <p class="small muted hint">O app já cria timbres sozinho. Com uma chave da Anthropic (sk-ant-…) ou da OpenAI (sk-…), a IA escolhe os modelos pelo catálogo da MK-300. O custo é cobrado pelo provedor, na sua conta.</p>
    <div class="stack" style="margin-top:10px">
      <input type="password" id="aikey" placeholder="${S.aiOn ? 'Chave salva · cole outra para trocar' : 'Chave da API · sk-…'}" autocomplete="off" aria-label="Chave da API">
      <input type="text" id="aimodel" list="dlModels" placeholder="Modelo" value="${esc(ai.model || '')}" aria-label="Modelo">
      <datalist id="dlModels">${MODELS.map(m => `<option value="${m}">`).join('')}</datalist>
      <div class="row"><button class="btn pri grow" data-act="aisave">Salvar chave</button><button class="btn grow" data-act="aioff" ${S.aiOn ? '' : 'disabled'}>Voltar ao motor do app</button></div>
      <button class="btn" data-act="aiclear">Limpar timbres guardados (${nCache})</button>
    </div>
    <p class="small muted hint">A chave fica cifrada, só neste celular. Para a IA vão só o texto do pedido e medidas numéricas do áudio; o arquivo de áudio nunca sai do celular. Cada resposta fica guardada: o mesmo pedido sai de novo na hora, sem custo.</p>
  </div>
  <div class="card"><span class="lbl">Nomes dos modelos</span>
    <p class="small muted hint">${esc(CATALOG_NOTE)} Se um nome no visor for diferente, corrija aqui; a pedaleira usa a posição do modelo, então o som não muda.</p>
    <div class="row" style="margin-top:8px"><select id="nblk" class="w110" aria-label="Bloco">${BLOCKS.map(b => `<option ${b === nameBlock ? 'selected' : ''}>${b}</option>`).join('')}</select><input type="search" id="nq" class="grow" placeholder="Filtrar" aria-label="Filtrar modelos"></div>
    <div id="nlist" class="scrollbox"></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="nreset">Restaurar nomes</button><button class="btn sm" data-act="catimp">Importar catálogo .json</button><button class="btn sm" data-act="catdef">Catálogo padrão</button></div>
  </div>
  <div class="card"><span class="lbl">Modo demonstração</span>
    <p class="small muted hint">Uma MK-300 simulada responde como a pedaleira, para conhecer o app sem cabo. Nada sai do celular.</p>
    <button class="btn" style="margin-top:8px" data-act="demo">${pedal.kind === 'Demo' ? 'Sair da demonstração' : 'Conectar a MK-300 simulada'}</button></div>
  <div class="card"><span class="lbl">Instalar no celular</span>
    <p class="small muted hint">No Chrome, abra o menu ⋮ e toque em Adicionar à tela inicial (ou Instalar app). O app abre em tela cheia e funciona sem internet depois de aberto uma vez; a IA online e o YouTube precisam de internet.</p></div>
  <div class="card"><span class="lbl">Sobre</span>
    <p class="small muted hint">ToneMatch MK-300, versão pessoal. Conversa com a M-VAVE MK-300 pelo mesmo protocolo do editor M-EFCS, medido no firmware V73 e conferido numa V75. Antes de salvar, o app lê o slot, troca só nome, volume, BPM, ordem, modelos, controles e liga/desliga, e mantém o resto (footswitches, expressão). Sem anúncios, sem conta, sem coleta: tudo fica neste celular.</p>
    <button class="btn sm danger" style="margin-top:10px" data-act="wipe">Apagar dados do app</button></div>`;
}

function drawNames() {
  nameBlock = $('#nblk').value; const q = norm($('#nq').value); const ov = lsGet(KEYS.nameOverrides, {});
  $('#nlist').innerHTML = blockCat(nameBlock).models.filter(m => !q || norm(m.name + ' ' + m.ref).includes(q)).map(m => `<div class="slotrow two"><span class="num muted">${m.index + 1}</span><div><input type="text" class="slim ${ov[nameBlock] && ov[nameBlock][m.index] ? 'edited' : ''}" data-nm="${m.index}" value="${esc(m.name)}" aria-label="Nome do modelo ${m.index + 1}">${m.ref ? `<div class="small muted">${esc(m.ref)}</div>` : ''}</div></div>`).join('');
}

export default {
  view,
  mount() { drawNames(); },
  input(e) { if (e.target.id === 'nq') drawNames(); },
  change(e) {
    if (e.target.id === 'nblk') return drawNames();
    const i = e.target.dataset.nm; if (i === undefined) return;
    const ov = lsGet(KEYS.nameOverrides, {}); ov[nameBlock] = ov[nameBlock] || {};
    const orig = blockCat(nameBlock).models.find(m => m.index === +i).original; const v = e.target.value.trim();
    if (!v || v === orig) delete ov[nameBlock][i]; else ov[nameBlock][i] = v;
    lsSet(KEYS.nameOverrides, ov); buildCatalog(); e.target.classList.toggle('edited', !!ov[nameBlock][i]); toast('Nome salvo.');
  },
  async click(t, d) {
    if (d.act === 'back') go('timbre');
    if (d.act === 'aisave') {
      const key = $('#aikey').value.trim(); const cur = aiConfig();
      if (!key && !cur.ct) return toast('Cole a chave da API.', true);
      const provider = key ? (key.startsWith('sk-ant') ? 'anthropic' : 'openai') : cur.provider;
      const model = $('#aimodel').value.trim() || (provider === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-4.1-mini');
      if (key) await saveApiKey(key);
      lsSet(KEYS.ai, { ...aiConfig(), provider, model }); S.aiOn = true;
      toast(`IA online ativa (${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} · ${model}).`); renderMain();
    }
    if (d.act === 'aioff') { await saveApiKey(''); S.aiOn = false; toast('Voltou ao motor do app. A chave foi apagada.'); renderMain(); }
    if (d.act === 'aiclear') { lsSet(KEYS.aiCache, {}); toast('Timbres guardados apagados.'); renderMain(); }
    if (d.act === 'nreset' && await confirmBox('Restaurar nomes?', 'Os nomes que você corrigiu voltam aos do catálogo.', 'Restaurar')) { lsSet(KEYS.nameOverrides, {}); buildCatalog(); renderMain(); }
    if (d.act === 'catdef') { lsSet(KEYS.catalogRaw, null); buildCatalog(); toast('Catálogo padrão em uso.'); renderMain(); }
    if (d.act === 'catimp') {
      const f = await pickFile('.json'); if (!f) return;
      guard(async () => {
        const raw = rawFromStudioJson(JSON.parse(await f.text()));
        if (raw.length !== 11 || raw.some((b, i) => b.name !== BLOCKS[i])) throw new Error('O catálogo precisa ter os 11 blocos da MK-300 na ordem WAH, FX, GATE, DS, AMP, CAB, EQ, MOD, DLY, REV, VOL.');
        lsSet(KEYS.catalogRaw, raw); buildCatalog(); renderMain();
      }, 'Catálogo importado.');
    }
    if (d.act === 'demo') { await connect('Demo'); renderMain(); }
    if (d.act === 'wipe' && await confirmBox('Apagar tudo?', 'Biblioteca, gravações, chave da IA, nomes corrigidos e sessão saem deste celular. Os presets na pedaleira não mudam.', 'Apagar tudo')) {
      lsClear(); await DB.wipe(); location.reload();
    }
  },
};
