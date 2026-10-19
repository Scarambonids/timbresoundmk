/* Gravar junto: entrada escolhida (microfone ou a MK-300 pelo USB) + a música tocando, em áudio ou vídeo. */
export async function audioInputs() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default'); }
  catch (e) { return []; }
}

export class Recorder {
  /** @param {{kind:'audio'|'video', deviceId?:string, player?:import('./player.js').Player}} o */
  async start({ kind, deviceId, player }) {
    this.kind = kind;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 } } : false,
    });
    const ctx = player ? player.graph() : (this.ownCtx = new (window.AudioContext || window.webkitAudioContext)());
    await ctx.resume();
    this.dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(this.stream).connect(this.dest);
    if (player) { this.player = player; player.out.connect(this.dest); }
    const tracks = [...this.dest.stream.getAudioTracks(), ...this.stream.getVideoTracks()];
    this.rec = new MediaRecorder(new MediaStream(tracks)); this.chunks = [];
    this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.rec.start(500);
    return this.stream;
  }
  /** para e devolve o arquivo gravado */
  stop() {
    return new Promise(res => {
      if (!this.rec) return res(null);
      this.rec.onstop = () => {
        const type = this.rec.mimeType || (this.kind === 'video' ? 'video/webm' : 'audio/webm');
        res({ blob: new Blob(this.chunks, { type }), ext: /mp4/.test(type) ? 'mp4' : /ogg/.test(type) ? 'ogg' : 'webm', kind: this.kind });
        this.rec = null;
      };
      try { this.rec.stop(); } catch (e) { res(null); }
      this.stream.getTracks().forEach(t => t.stop());
      if (this.player) try { this.player.out.disconnect(this.dest); } catch (e) {}
      if (this.ownCtx) this.ownCtx.close().catch(() => {});
    });
  }
  get active() { return !!this.rec; }
}
