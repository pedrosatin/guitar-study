class Metronome {
  constructor(ctx) {
    this.ctx = ctx;
    this.bpm = 80;
    this.beatsPerMeasure = 4;
    this.isPlaying = false;
    this.beatInMeasure = 0;
    this.nodes = new Set();
    this.pending = new Set();
    this.generation = 0;
  }
  setBPM(value) { this.bpm = Math.max(40, Math.min(200, Number(value) || 80)); }
  setBeatsPerMeasure(value) { this.beatsPerMeasure = Math.max(1, Math.min(8, Math.floor(Number(value)) || 4)); }
  async start() {
    if (this.isPlaying) return;
    const token = ++this.generation;
    try { await this.ctx.resume(); }
    catch (error) { if (token === this.generation) throw error; else return; }
    if (token !== this.generation) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.timerId = setInterval(() => this.schedule(), 20);
    this.schedule();
  }
  pause() {
    this.generation++;
    this.isPlaying = false;
    clearInterval(this.timerId);
    this.pending.forEach(clearTimeout);
    this.pending.clear();
    this.nodes.forEach(node => {
      try { node.stop(); } catch {}
      node.onended();
    });
    this.nodes.clear();
  }
  reset() { this.pause(); this.beatInMeasure = 0; }
  schedule() {
    if (!this.isPlaying || this.pending.size) return;
    const now = this.ctx.currentTime;
    // Resume the next beat after a stalled tab; never replay a backlog of clicks.
    if (this.nextNoteTime < now - 0.1) this.nextNoteTime = now + 0.04;
    if (this.nextNoteTime >= now + 0.04) return;
    const time = this.nextNoteTime, beat = this.beatInMeasure, token = this.generation;
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      if (!this.isPlaying || token !== this.generation) return;
      if (this.ctx.currentTime - time > 0.1) {
        this.nextNoteTime = this.ctx.currentTime + 0.04;
        return;
      }
      const playClick = this.onBeat?.(beat, time) !== false;
      // A callback may reset or pause, including at the end of an exercise.
      if (!this.isPlaying || token !== this.generation) return;
      if (playClick) this.click(beat === 0, Math.max(time, this.ctx.currentTime));
      this.beatInMeasure = (beat + 1) % this.beatsPerMeasure;
    }, Math.max(0, (time - now) * 1000));
    this.pending.add(timer);
    this.nextNoteTime += 60 / this.bpm;
  }
  click(accent, time) {
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.frequency.value = accent ? 1200 : 800;
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    osc.connect(gain); gain.connect(this.ctx.destination);
    this.nodes.add(osc);
    osc.onended = () => {
      if (!this.nodes.delete(osc)) return;
      osc.disconnect(); gain.disconnect();
    };
    osc.start(time); osc.stop(time + 0.05);
  }
}
window.Metronome = Metronome;
