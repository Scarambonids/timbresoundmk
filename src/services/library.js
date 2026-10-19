/* Biblioteca: músicas (com timbre, slot, BPM, tom e áudio) e gravações, no IndexedDB. */
import { DB } from '../lib/db.js';
import { clonePreset } from '../domain/preset.js';

export const listSongs = async () => (await DB.all('songs').catch(() => [])).sort((a, b) => b.updated - a.updated);
export const getSong = id => DB.get('songs', id);
export const putSong = s => DB.put('songs', { ...s, updated: Date.now() });

export function songFromTone({ preset, explain, meta, slot, audio, audioName }) {
  return { id: 's' + Date.now(), artist: meta.artist || '', song: meta.song || preset.name, preset: clonePreset(preset), explain, slot, bpm: meta.bpm || preset.bpm, key: meta.key || '', hasAudio: !!audio, audio: audio || undefined, audioName: audioName || '' };
}
export function songFromFile(file, analysis) {
  const base = file.name.replace(/\.[^.]+$/, '');
  const [artist, song] = base.includes(' - ') ? base.split(' - ') : ['', base];
  return { id: 's' + Date.now(), artist: artist.trim(), song: song.trim(), audio: file, hasAudio: true, audioName: file.name, bpm: analysis && analysis.bpm, key: analysis && analysis.key, analysis };
}
export async function deleteSong(id) {
  for (const r of await listRecordings(id)) await DB.del('recs', r.id);
  await DB.del('songs', id);
}
export const listRecordings = async songId => (await DB.all('recs')).filter(r => r.songId === songId).sort((a, b) => b.date - a.date);
export const getRecording = id => DB.get('recs', id);
export const putRecording = r => DB.put('recs', r);
export const deleteRecording = id => DB.del('recs', id);

export async function exportLibrary() {
  return { app: 'tonematch-mk300', songs: (await DB.all('songs')).map(({ audio, ...s }) => ({ ...s, hasAudio: false })) };
}
export async function importLibrary(json) { for (const s of json.songs || []) await DB.put('songs', { ...s, hasAudio: false }); }
