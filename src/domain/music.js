/* Tons musicais em notação e em português. */
export const PCS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const ALT = ['C', 'Db', 'D', 'D#', 'E', 'F', 'Gb', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_PT = { C: 'Dó', 'C#': 'Dó#', Db: 'Ré♭', D: 'Ré', 'D#': 'Ré#', Eb: 'Mi♭', E: 'Mi', F: 'Fá', 'F#': 'Fá#', Gb: 'Sol♭', G: 'Sol', 'G#': 'Sol#', Ab: 'Lá♭', A: 'Lá', 'A#': 'Lá#', Bb: 'Si♭', B: 'Si' };

/** "Bm" → "Bm (Si menor) · relativo D" */
export function keyLabel(k) {
  if (!k) return '';
  const minor = /m$/.test(k); const root = k.replace(/m$/, '');
  let pc = PCS.indexOf(root); if (pc < 0) pc = ALT.indexOf(root);
  const rel = pc < 0 ? '' : minor ? PCS[(pc + 3) % 12] : PCS[(pc + 9) % 12] + 'm';
  return `${k} (${NOTE_PT[root] || root} ${minor ? 'menor' : 'maior'})${rel ? ' · relativo ' + rel : ''}`;
}
/** tempo de delay em ms para uma figura: q = semínima, e = colcheia, d8 = colcheia pontuada */
export function noteMs(bpm, note) { const q = 60000 / (bpm || 120); return note === 'd8' ? q * 0.75 : note === 'e' ? q / 2 : q; }
