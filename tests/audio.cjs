const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pitch = {};
vm.createContext(pitch);
vm.runInContext(read('poc/m4-pitch-detect/app.js').split('(function main()')[0], pitch);
for (const sampleRate of [44100, 48000]) {
  for (const hz of [82.4069, 110, 146.8324, 195.998, 246.9417, 329.6276]) {
    for (const offset of [-20, 0, 20]) {
      const frequency = hz * 2 ** (offset / 1200);
      const buffer = Float32Array.from({length:4096}, (_, i) =>
        0.3 * Math.sin(2 * Math.PI * frequency * i / sampleRate) +
        0.1 * Math.sin(4 * Math.PI * frequency * i / sampleRate));
      const result = pitch.detectPitch(buffer, sampleRate);
      assert(Math.abs(1200 * Math.log2(result.pitch / frequency)) < 1, `${hz} Hz at ${sampleRate}, offset ${offset}`);
      assert(result.clarity > 0.9);
    }
  }
}
assert.equal(pitch.detectPitch(new Float32Array(4096), 48000).pitch, -1);
const parser = {};
vm.createContext(parser);
vm.runInContext(read('poc/m3-chordpro-player/app.js').split('const $ =')[0], parser);
const song = parser.parseChordPro('{title: Test}\n{bpm: 999}\n{time_signature: 3/4}\nIntro [Am]one [E]two');
assert.equal(song.bpm, 200);
assert.equal(song.beatsPerMeasure, 3);
assert.equal(song.sections[0].lines[0].words[0].lyric, 'Intro ');
assert.equal(song.sections[0].lines[0].words[1].chord, 'Am');
const onset = {};
vm.createContext(onset);
vm.runInContext(read('poc/m7-onset-rhythm/onset-detector.js').replace('export class OnsetDetector', 'this.OnsetDetector = class OnsetDetector'), onset);
let amplitude = 0, hits = 0;
const ctx = { currentTime:0, createAnalyser: () => ({getFloatTimeDomainData: data => data.fill(amplitude)}) };
const detector = new onset.OnsetDetector(ctx);
detector.onOnset(() => hits++);
function frame(value, time) { amplitude = value; ctx.currentTime = time; detector.process(); }
for (let i = 0; i < 40; i++) frame(0.001, i / 60);
frame(0.15, 1); frame(0.14, 1.05); frame(0.01, 1.1); frame(0.15, 1.12);
assert.equal(hits, 1, 'A single attack and its ringing should not double-count');
frame(0.001, 1.3); frame(0.15, 1.5);
assert.equal(hits, 2, 'A separate attack is detected');
console.log('Audio checks passed: 36 pitched/harmonic fixtures, silence, ChordPro parsing, onset ringing/retrigger.');
