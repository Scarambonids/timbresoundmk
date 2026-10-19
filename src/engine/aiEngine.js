/* IA online (opcional): Anthropic ou OpenAI, com a chave do usuário. Recebe o catálogo
   real da MK-300 e devolve índices de modelo, que são validados antes de virar preset. */
import { BLOCKS, BLOCK_ID, TONE_BLOCKS } from '../domain/blocks.js';
import { catalog, blockCat, modelOf, defaultsFor, isGuitarModel } from '../domain/catalog.js';
import { emptyPreset, validChain } from '../domain/preset.js';
import { STYLES } from '../data/styles.js';
import { ascii20, clamp } from '../lib/text.js';

const fmtP = p => `${p.name} ${p.min}..${p.max}${p.unit ? ' ' + p.unit : ''}${p.scale !== 1 ? ' (valor x' + (1 / p.scale) + ')' : ''}`;

export function catalogForPrompt() {
  return catalog().map(b => {
    const tone = TONE_BLOCKS.includes(b.name);
    const ms = b.models.filter(m => !tone || isGuitarModel(m));
    const shared = tone ? ` controles: ${ms[0].params.map(fmtP).join(', ')}` : '';
    const lines = ms.map(m => `${m.index}: ${m.name}${m.ref ? ' = ' + m.ref : ''}${tone ? '' : ' [' + m.params.map(fmtP).join(', ') + ']'}`);
    return `## ${b.name} (id ${b.id})${shared}\n${lines.join('\n')}`;
  }).join('\n');
}

function prompts(req) {
  const system = `Você é um engenheiro de timbre de guitarra que monta presets para a pedaleira M-VAVE MK-300. Use SOMENTE modelos do catálogo abaixo, pelo índice (model_index). Valores de controle são números brutos dentro da faixa indicada (Speed é x10: 2.5 Hz = 25; Time em ms; EQ em dB de -12 a 12). Responda só com JSON válido, sem texto fora dele, no formato:
{"name":"NOME ATE 20 CHARS","bpm":120,"key":"Em","explanation":"pt-BR, curto: equipamento real da gravação e por que cada bloco","chain":["WAH","FX","GATE","DS","AMP","CAB","EQ","MOD","DLY","REV","VOL"],"blocks":{"AMP":{"on":true,"model_index":42,"knobs":{"Gain":60,"Level":70}}}}
Inclua os 11 blocos. Blocos desligados podem ter só {"on":false}. Não invente equipamento: se não souber o exato, diga na explicação que é aproximado.

CATÁLOGO MK-300:
${catalogForPrompt()}`;
  const a = req.analysis;
  const user = [
    `Artista: ${req.artist || '-'}`, `Música: ${req.song || '-'}`,
    `Intenção: ${req.intents.join(', ') || '-'}`, `Estilo: ${req.style ? STYLES[req.style].label : '-'}`, `Volume do preset: ${req.vol}`,
    req.base === 'nam' ? `Use o AMP model_index ${req.namSlot - 1} (captura NAM importada pelo usuário).` : '',
    a ? `Medidas do áudio: BPM ${a.bpm}, tom ${a.key}, centroide ${a.centroid} Hz, ganho sugerido ${a.gainHint}/100, brilho ${a.brightHint}/100, ambiência ${a.roomHint}/100, largura estéreo ${a.width}.` : '',
  ].filter(Boolean).join('\n');
  return { system, user };
}

async function callProvider(cfg, system, user) {
  if (cfg.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2500, system, messages: [{ role: 'user', content: user }] }),
    });
    const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'Erro ' + r.status);
    return j.content.map(c => c.text || '').join('');
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
    body: JSON.stringify({ model: cfg.model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'Erro ' + r.status);
  return j.choices[0].message.content;
}

/** converte a resposta da IA num preset válido (índices conferidos, controles limitados à faixa) */
export function presetFromAi(js, req) {
  const p = emptyPreset(ascii20(js.name || req.song || 'TIMBRE IA'));
  p.vol = req.vol; p.bpm = clamp(Math.round(js.bpm || (req.analysis && req.analysis.bpm) || 120), 40, 300);
  if (Array.isArray(js.chain)) { const c = js.chain.map(n => BLOCK_ID[String(n).toUpperCase()]).filter(x => x !== undefined); if (validChain(c)) p.chain = c; }
  const notes = [];
  BLOCKS.forEach((bn, b) => {
    const s = js.blocks && js.blocks[bn]; if (!s) return;
    const bl = p.blocks[b];
    if (s.model_index !== undefined && blockCat(b).models.some(m => m.index === s.model_index)) { bl.model = s.model_index; bl.knobs = defaultsFor(b, s.model_index); }
    const m = modelOf(b, bl.model);
    if (s.knobs) m.params.forEach((pr, k) => { const v = s.knobs[pr.name]; if (typeof v === 'number') bl.knobs[k] = clamp(Math.round(v), pr.min, pr.max); });
    bl.on = !!s.on;
    if (bl.on) notes.push(`${bn} · ${m.name}${m.ref ? ' (' + m.ref + ')' : ''}`);
  });
  const vol = p.blocks[BLOCK_ID.VOL]; vol.on = true; if (!vol.knobs[0]) vol.knobs[0] = 100;
  return { preset: p, bpm: p.bpm, key: js.key || (req.analysis && req.analysis.key) || '', notes };
}

export async function generateAI(req, cfg) {
  const { system, user } = prompts(req);
  const text = await callProvider(cfg, system, user);
  const js = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const { preset, bpm, key, notes } = presetFromAi(js, req);
  return { preset, bpm, key, explain: { how: js.explanation || '', notes, intents: req.intents, engine: 'IA online · ' + cfg.model } };
}

export const cacheKey = req => JSON.stringify([req.artist.toLowerCase(), req.song.toLowerCase(), req.intents.slice().sort(), req.style, req.base, req.namSlot, req.analysis && [req.analysis.bpm, req.analysis.key, req.analysis.gainHint]]);
