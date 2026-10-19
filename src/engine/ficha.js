/* Ficha do timbre em texto: para copiar o som em qualquer pedaleira. */
import { BLOCKS, BLOCK_INFO } from '../domain/blocks.js';
import { modelOf, fmtParam } from '../domain/catalog.js';

export function fichaText(p, meta = {}) {
  const L = [];
  L.push('TONEMATCH MK-300 - FICHA DO TIMBRE', `Nome: ${p.name}`);
  if (meta.artist || meta.song) L.push(`Pedido: ${[meta.artist, meta.song].filter(Boolean).join(' · ')}`);
  L.push(`Volume do patch: ${p.vol} | BPM: ${p.bpm}${meta.key ? ' | Tom: ' + meta.key : ''}`);
  L.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, '');
  L.push('CADEIA (ordem do sinal, da guitarra para a saída; só blocos ligados)');
  L.push(p.chain.filter(b => p.blocks[b].on).map(b => BLOCKS[b]).join(' > '), '');
  let n = 1;
  for (const b of p.chain) {
    const bl = p.blocks[b]; if (!bl.on) continue;
    const m = modelOf(b, bl.model);
    L.push(`${n++}. ${BLOCKS[b]} - ${BLOCK_INFO[BLOCKS[b]].pt}   Efeito: ${m.name}${m.ref ? '   Referência: ' + m.ref : ''}   (MK-300: bloco ${BLOCKS[b]}, modelo nº ${m.index + 1})`);
    L.push('   ' + m.params.map((pr, k) => `${pr.name}: ${fmtParam(pr, bl.knobs[k])}`).join('   '));
  }
  const off = p.chain.filter(b => !p.blocks[b].on).map(b => BLOCKS[b]);
  if (off.length) L.push('', `Desligados: ${off.join(', ')}`);
  if (meta.explain) { L.push('', 'SOBRE O TIMBRE'); if (meta.explain.how) L.push(meta.explain.how); if (meta.explain.songNote) L.push(meta.explain.songNote); }
  L.push('', 'COPIANDO PARA OUTRA PEDALEIRA',
    '1. Monte os blocos ligados na mesma ordem da linha CADEIA.',
    '2. Em cada bloco, escolha o efeito parecido com a Referência.',
    '3. 0 a 100 é a posição do botão (50 = meio). ms, Hz, kHz e dB valem como estão. Acerte ganho e volume de ouvido.');
  return L.join('\n');
}
