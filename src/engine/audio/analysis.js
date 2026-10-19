/* Medidas de um MP3/WAV, todas no celular: BPM, tom, brilho, ganho aparente,
   ambiência e largura estéreo. São estimativas que ajustam o timbre, não separam a guitarra. */
import { fft } from './fft.js';
import { PCS } from '../../domain/music.js';
import { clamp } from '../../lib/text.js';

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function corr(a, b) {
  const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12; let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < 12; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return s / Math.sqrt(sa * sb + 1e-12);
}
/** croma (12 classes) → tom pelo perfil de Krumhansl */
export function keyFromChroma(chroma) {
  let best = '', bk = -2;
  for (let r = 0; r < 12; r++) {
    const c = Array.from({ length: 12 }, (_, i) => chroma[(i + r) % 12]);
    const cM = corr(c, MAJOR), cm = corr(c, MINOR);
    if (cM > bk) { bk = cM; best = PCS[r]; } if (cm > bk) { bk = cm; best = PCS[r] + 'm'; }
  }
  return best;
}
/** envelope de ataques → BPM por autocorrelação, com preferência suave perto de 115 */
export function bpmFromEnvelope(env, fps) {
  const minLag = Math.floor(fps * 60 / 200), maxLag = Math.ceil(fps * 60 / 60);
  let bestLag = minLag, bestV = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    const bpm = 60 * fps / lag; const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2));
    if (s * w > bestV) { bestV = s * w; bestLag = lag; }
  }
  return 60 * fps / bestLag;
}

/** analisa amostras já decodificadas (L, R, taxa) */
export function analyzeSamples(L, R, sr) {
  const start = Math.floor(Math.min(L.length / sr * 0.15, 20) * sr), end = Math.min(L.length, start + 90 * sr);
  const N = end - start; const mono = new Float32Array(N); let side = 0, mid = 0;
  for (let i = 0; i < N; i++) { const l = L[start + i], r = R[start + i]; mono[i] = (l + r) / 2; side += (l - r) ** 2; mid += (l + r) ** 2; }
  const width = Math.sqrt(side / (mid + 1e-9));

  const hop = 512, fl = 1024, frames = Math.max(0, Math.floor((N - fl) / hop)); const env = new Float32Array(frames); let prev = 0;
  for (let f = 0; f < frames; f++) { let e = 0; const o = f * hop; for (let i = 0; i < fl; i += 2) { const d = mono[o + i + 1] - mono[o + i]; e += d * d; } e = Math.log(1 + 1000 * e); env[f] = Math.max(0, e - prev); prev = e; }
  const bpm = frames > 100 ? bpmFromEnvelope(env, sr / hop) : 120;

  const n = 4096, chroma = new Float64Array(12), bands = { low: 0, mid: 0, high: 0, pres: 0 };
  let cen = 0, tot = 0, flat = 0, fc = 0;
  const win = Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  const step = Math.max(n, Math.floor(N / 220));
  for (let o = 0; o + n < N; o += step) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = mono[o + i] * win[i];
    fft(re, im);
    let lg = 0, ar = 0, cnt = 0;
    for (let k = 1; k < n / 2; k++) {
      const f = k * sr / n, mag = Math.hypot(re[k], im[k]), pw = mag * mag;
      if (f >= 80 && f < 250) bands.low += pw; else if (f < 1500 && f >= 250) bands.mid += pw; else if (f < 4000 && f >= 1500) bands.high += pw; else if (f < 8000 && f >= 4000) bands.pres += pw;
      if (f >= 200 && f <= 6000) { cen += f * pw; tot += pw; }
      if (f >= 1000 && f <= 5000) { lg += Math.log(mag + 1e-12); ar += mag; cnt++; }
      if (f >= 65 && f <= 2000) chroma[((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12] += mag;
    }
    if (cnt) { flat += Math.exp(lg / cnt) / (ar / cnt + 1e-12); fc++; }
  }
  const centroid = cen / (tot + 1e-12), flatness = flat / Math.max(1, fc);
  const all = bands.low + bands.mid + bands.high + bands.pres + 1e-12;
  let peak = 0, rms = 0; for (let i = 0; i < N; i += 4) { const a = Math.abs(mono[i]); if (a > peak) peak = a; rms += mono[i] ** 2; }
  rms = Math.sqrt(rms / Math.max(1, N / 4)); const crest = peak / (rms + 1e-9);
  let tail = 0, tc = 0; for (let f = 2; f < frames - 20; f++) if (env[f] > 0.5) { let s = 0; for (let j = f + 6; j < f + 20; j++) s += env[j]; tail += s / 14 / env[f]; tc++; }

  return {
    bpm: Math.round(bpm), key: keyFromChroma(chroma), centroid: Math.round(centroid),
    gainHint: clamp(Math.round(20 + flatness * 160 + (bands.high + bands.pres) / all * 80 - (crest - 4) * 3), 10, 92),
    brightHint: clamp(Math.round(30 + (centroid - 1200) / 30), 25, 80),
    bassHint: clamp(Math.round(40 + bands.low / all * 80), 35, 70),
    roomHint: clamp(Math.round(8 + (tc ? tail / tc : 0.1) * 120), 5, 45),
    width: +width.toFixed(2), crest: +crest.toFixed(1), duration: Math.round(L.length / sr),
  };
}

/** decodifica no navegador e analisa */
export async function analyzeAudio(arrayBuf) {
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const buf = await new AC(2, 44100, 44100).decodeAudioData(arrayBuf.slice(0));
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  return analyzeSamples(L, R, buf.sampleRate);
}
