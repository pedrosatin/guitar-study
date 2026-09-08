// One source and one clock per measurement; keep a short, bounded history.
export class RhythmMeasurement {
  constructor() { this.reset(); }
  reset() { this.last = null; this.count = 0; this.intervals = []; }
  add(time) {
    if (!Number.isFinite(time)) return false;
    if (this.last !== null && time - this.last < 0.18) return false;
    if (this.last !== null && time - this.last > 3) this.reset();
    if (this.last !== null) {
      this.intervals.push(time - this.last);
      if (this.intervals.length > 32) this.intervals.shift();
    }
    this.last = time;
    this.count++;
    return true;
  }
  summary(target) {
    const recent = this.intervals.slice(-8);
    if (recent.length < 2) return null;
    const sorted = [...recent].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const variation = recent.reduce((sum, t) => sum + Math.abs(t - median), 0) / recent.length / median;
    return { bpm: Math.round(60 / median), variation, median, samples: recent.length,
      difference: Math.round(60 / median) - target };
  }
}
