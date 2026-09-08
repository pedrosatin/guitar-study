export class OnsetDetector {
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.fftSize = options.fftSize ?? 2048;
    this.smoothing = options.smoothing ?? 0.2;
    this.refractoryMs = options.refractoryMs ?? 180;
    this.sensitivity = options.sensitivity ?? 2.5;
    this.noiseGate = options.noiseGate ?? 0.012;
    this.baselineFrames = options.baselineFrames ?? 30;
    this.baselineCount = 0;
    this.baselineSum = 0;
    this.baselineRms = 0;
    this.prevRms = 0;
    this.lastOnsetTime = -1;
    this.onsetCallback = null;
    this.fluxCallback = null;
    this._setupAnalyser();
  }

  _setupAnalyser() {
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.timeData = new Float32Array(this.fftSize);
  }

  connectFrom(source) {
    source.connect(this.analyser);
    return this;
  }

  setSensitivity(v) { this.sensitivity = v; }
  setNoiseGate(v) { this.noiseGate = v; }

  onOnset(cb) { this.onsetCallback = cb; return this; }
  onFlux(cb) { this.fluxCallback = cb; return this; }

  _computeRms() {
    this.analyser.getFloatTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = this.timeData[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.timeData.length);
    return Number.isFinite(rms) ? rms : 0;
  }

  process() {
    const rms = this._computeRms();
    const now = this.audioContext.currentTime;
    const sinceLastMs = this.lastOnsetTime < 0 ? Infinity : (now - this.lastOnsetTime) * 1000;

    let threshold = this.noiseGate;
    let onset = false;
    let signal = rms;

    if (this.baselineCount < this.baselineFrames) {
      this.baselineSum += rms;
      this.baselineCount++;
      if (this.baselineCount === this.baselineFrames) {
        this.baselineRms = this.baselineSum / this.baselineFrames;
      }
    } else {
      const adaptive = this.baselineRms * (1 + this.sensitivity);
      threshold = Math.max(this.noiseGate, adaptive);
      const flux = Math.max(0, rms - this.prevRms);
      if (rms > threshold && flux > Math.max(0.002, this.noiseGate * this.sensitivity * 0.25) && sinceLastMs > this.refractoryMs) {
        this.lastOnsetTime = now;
        onset = true;

        if (this.onsetCallback) this.onsetCallback(now, rms, threshold);
      }
      if (rms < threshold && !onset) {
        this.baselineRms = this.baselineRms * 0.95 + rms * 0.05;
      }
    }

    this.prevRms = rms;
    if (this.fluxCallback) this.fluxCallback(signal, threshold, onset);
  }
}