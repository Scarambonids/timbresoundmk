/* Os 11 blocos da MK-300. A posição na lista é o id do bloco no protocolo. */
export const BLOCKS = ['WAH', 'FX', 'GATE', 'DS', 'AMP', 'CAB', 'EQ', 'MOD', 'DLY', 'REV', 'VOL'];
export const BLOCK_ID = Object.fromEntries(BLOCKS.map((n, i) => [n, i]));
export const BLOCK_INFO = {
  WAH: { pt: 'wah', color: '#8a8f99' }, FX: { pt: 'efeito / boost / comp', color: '#4f8fc0' },
  GATE: { pt: 'noise gate', color: '#3f9a86' }, DS: { pt: 'drive', color: '#c4483f' },
  AMP: { pt: 'amplificador', color: '#c58a3a' }, CAB: { pt: 'caixa (IR)', color: '#9a6b4c' },
  EQ: { pt: 'equalizador', color: '#2fa4a4' }, MOD: { pt: 'modulação', color: '#7d69c9' },
  DLY: { pt: 'delay', color: '#4f6fd0' }, REV: { pt: 'reverb', color: '#6a7fd8' },
  VOL: { pt: 'volume', color: '#9aa0a8' },
};
/* blocos em que os modelos compartilham os mesmos controles e mantêm valores na troca de modelo */
export const TONE_BLOCKS = ['DS', 'AMP', 'CAB'];
