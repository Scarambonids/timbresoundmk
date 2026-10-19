/* Motor do app: música → artista → estilo → intenção → áudio → preset. Sem internet. */
import { STYLES } from '../data/styles.js';
import { findSong, findArtist, guessStyle } from './knowledge.js';
import { deepMerge, overlay, applyIntent, applyAnalysis, rigToPreset } from './rig.js';
import { ascii20 } from '../lib/text.js';

/**
 * @param {{artist,song,intents:string[],style,vol,base:'amp'|'nam',namSlot,analysis}} req
 * @returns {{preset,bpm,key,explain}}
 */
export function generateLocal(req) {
  const song = findSong(req.artist, req.song);
  const artist = song ? findArtist(song.a) : findArtist(req.artist);
  const styleKey = (!song && !artist && req.style) || (song && song.s) || (artist && artist.style) || req.style || guessStyle(`${req.artist} ${req.song}`) || 'rock70';

  let rig = deepMerge(STYLES[styleKey], {});
  if (artist) rig = overlay(rig, artist.rig);
  if (song && song.o) rig = overlay(rig, song.o);
  if (req.style && (song || artist) && req.style !== styleKey) rig = deepMerge(rig, { amp: { gain: STYLES[req.style].amp.gain } });

  const intents = [...req.intents]; if (song && song.intent && !intents.length) intents.push(song.intent);
  rig = applyIntent(rig, intents);
  rig = applyAnalysis(rig, req.analysis, !song && !artist);

  const bpm = Math.round((req.analysis && req.analysis.bpm) || (song && song.bpm) || 120);
  const key = (req.analysis && req.analysis.key) || (song && song.key) || '';
  const name = ascii20(req.song || req.artist || STYLES[styleKey].label);
  const { preset, notes } = rigToPreset(rig, { name, vol: req.vol, bpm, namSlot: req.base === 'nam' ? req.namSlot : 0 });

  const how = song ? `Música encontrada na base: ${song.a} · ${song.t}.`
    : artist ? `Música fora da base; usei o timbre típico de ${artist.name}.`
    : `Artista e música fora da base; montei pelo estilo ${STYLES[styleKey].label}${req.analysis ? ' e pelas medidas do áudio' : ''}.`;
  return { preset, bpm, key, explain: { how, notes, songNote: song && song.note, intents, style: STYLES[styleKey].label, engine: 'Motor do app' } };
}
