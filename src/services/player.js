/* Tocar junto: tocador com velocidade, trecho A–B e "reduzir guitarra" (só o centro do estéreo). */
export class Player {
  constructor(blob, { onTick = () => {}, onEnd = () => {} } = {}) {
    this.url = URL.createObjectURL(blob);
    const a = new Audio(this.url); a.preload = 'auto'; a.preservesPitch = true; a.webkitPreservesPitch = true;
    this.audio = a; this.a = null; this.b = null; this.ctx = null; this.monoOn = false;
    a.addEventListener('ended', onEnd);
    const tick = () => {
      if (!this.audio) return;
      if (this.a != null && this.b != null && a.currentTime >= this.b) a.currentTime = this.a;
      onTick(a.currentTime, a.duration || 0, this); this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  /** grafo WebAudio: fonte → (normal | centro mono) → saída; a saída também alimenta a gravação */
  graph() {
    if (this.ctx) return this.ctx;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.src = ctx.createMediaElementSource(this.audio);
    this.out = ctx.createGain(); this.out.connect(ctx.destination);
    const split = ctx.createChannelSplitter(2), sum = ctx.createGain(), merge = ctx.createChannelMerger(2);
    const gl = ctx.createGain(), gr = ctx.createGain(); gl.gain.value = gr.gain.value = 0.5;
    split.connect(gl, 0); split.connect(gr, 1); gl.connect(sum); gr.connect(sum); sum.connect(merge, 0, 0); sum.connect(merge, 0, 1);
    this.mono = { split, merge }; this.src.connect(this.out);
    return ctx;
  }
  async toggle() { await this.graph().resume(); if (this.audio.paused) await this.audio.play(); else this.audio.pause(); return !this.audio.paused; }
  async play() { await this.graph().resume(); await this.audio.play().catch(() => {}); }
  pause() { this.audio.pause(); }
  get playing() { return !this.audio.paused; }
  seekFraction(f) { if (this.audio.duration) this.audio.currentTime = f * this.audio.duration; }
  speed(pct) { this.audio.playbackRate = pct / 100; }
  markA() { this.a = this.audio.currentTime; this.b = null; }
  markB() { if (this.a == null || this.audio.currentTime <= this.a + 0.3) return false; this.b = this.audio.currentTime; this.audio.currentTime = this.a; return true; }
  clearAB() { this.a = this.b = null; }
  setMono(on) {
    this.graph(); this.src.disconnect();
    if (on) { this.src.connect(this.mono.split); this.mono.merge.connect(this.out); }
    else { try { this.mono.merge.disconnect(); } catch (e) {} this.src.connect(this.out); }
    this.monoOn = on;
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.audio) { this.audio.pause(); this.audio.src = ''; }
    URL.revokeObjectURL(this.url); if (this.ctx) this.ctx.close().catch(() => {});
    this.audio = null;
  }
}
export const fmtTime = s => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
