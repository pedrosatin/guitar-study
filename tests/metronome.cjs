const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function setup(resume = () => Promise.resolve()) {
  let clock = 0, id = 0;
  const timers = new Map(), oscillators = [], gains = [];
  const add = (fn, delay, repeat) => {
    const key = ++id;
    timers.set(key, { fn, due: clock + delay, repeat });
    return key;
  };
  const ctx = {
    get currentTime() { return clock / 1000; }, resume, destination: {},
    createOscillator() {
      const node = { frequency: {}, connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.started = time; }, stop() { this.stopped = true; } };
      oscillators.push(node); return node;
    },
    createGain() {
      const node = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(node); return node;
    }
  };
  const sandbox = { window: {}, setTimeout: (fn, delay) => add(fn, delay),
    setInterval: (fn, delay) => add(fn, delay, delay),
    clearTimeout: key => timers.delete(key), clearInterval: key => timers.delete(key) };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../poc/m3-chordpro-player/player.js'), 'utf8'), sandbox);
  return {
    metro: new sandbox.window.Metronome(ctx), timers, oscillators, gains,
    stall(ms) { clock += ms; },
    advance(ms) {
      const end = clock + ms;
      let iterations = 0;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        assert.ok(++iterations < 10000, 'timer processing must stay bounded');
        const [key, timer] = next;
        clock = Math.max(clock, timer.due);
        if (timer.repeat) timer.due = clock + timer.repeat; else timers.delete(key);
        timer.fn();
      }
      clock = end;
    }
  };
}

test('four beats keep tempo and accent; pausing resumes at the next beat', async () => {
  const f = setup(), beats = [];
  f.metro.setBPM(60);
  f.metro.onBeat = beat => beats.push(beat);
  await f.metro.start(); f.advance(3100);
  assert.deepEqual(beats, [0, 1, 2, 3]);
  assert.deepEqual(f.oscillators.map(node => node.frequency.value), [1200, 800, 800, 800]);
  f.metro.pause(); f.advance(5000);
  assert.equal(beats.length, 4);
  assert.equal(f.timers.size, 0);
  assert.ok(f.oscillators.every(node => node.stopped && node.disconnected));
  assert.ok(f.gains.every(node => node.disconnected));
  await f.metro.start(); f.advance(100);
  assert.deepEqual(beats, [0, 1, 2, 3, 0]);
});

test('reset inside onBeat remains reset and silences the ending beat', async () => {
  const f = setup();
  f.metro.onBeat = () => { f.metro.reset(); return false; };
  await f.metro.start(); f.advance(100);
  assert.equal(f.metro.beatInMeasure, 0);
  assert.equal(f.metro.isPlaying, false);
  assert.equal(f.oscillators.length, 0);
  assert.equal(f.timers.size, 0);
  const beats = [];
  f.metro.onBeat = beat => beats.push(beat);
  await f.metro.start(); f.advance(100);
  assert.deepEqual(beats, [0]);
});

test('pending resume cannot restart after pause; concurrent starts create one interval', async () => {
  const resolves = [];
  const f = setup(() => new Promise(resolve => resolves.push(resolve)));
  const first = f.metro.start(); f.metro.pause(); resolves.shift()(); await first;
  assert.equal(f.metro.isPlaying, false);
  assert.equal(f.timers.size, 0);
  const second = f.metro.start(), third = f.metro.start();
  resolves[1](); await third; resolves[0](); await second;
  assert.equal(f.timers.size, 1);
  f.advance(100);
  assert.equal(f.oscillators.length, 1);
});

test('a stalled scheduler does not replay missed beats', async () => {
  const f = setup(), beats = [];
  f.metro.onBeat = beat => beats.push(beat);
  await f.metro.start(); f.advance(100);
  f.stall(60 * 60 * 1000); f.advance(100);
  assert.deepEqual(beats, [0, 1]);
  assert.equal(f.oscillators.length, 2);
  assert.ok(f.timers.size <= 2);
});

test('a delayed pending beat is rescheduled without a burst', async () => {
  const f = setup(), beats = [];
  f.metro.onBeat = beat => beats.push(beat);
  await f.metro.start(); f.advance(40);
  assert.equal(f.metro.pending.size, 1);
  f.stall(10000); f.advance(0);
  assert.deepEqual(beats, []);
  f.advance(100);
  assert.deepEqual(beats, [0]);
});

test('audio rejection is reported only for the current start', async () => {
  let reject;
  const f = setup(() => new Promise((resolve, failure) => { reject = failure; }));
  const first = f.metro.start(); f.metro.reset(); reject(new Error('cancelled'));
  await first;
  const second = f.metro.start(); reject(new Error('audio unavailable'));
  await assert.rejects(second, /audio unavailable/);
  assert.equal(f.metro.isPlaying, false);
});


test('pausing before a scheduled click cancels it; natural endings disconnect nodes', async () => {
  const f = setup();
  await f.metro.start(); f.advance(40); f.metro.pause(); f.advance(100);
  assert.equal(f.oscillators.length, 0);
  assert.equal(f.metro.pending.size, 0);
  await f.metro.start(); f.advance(100);
  const oscillator = f.oscillators[0];
  oscillator.onended(); oscillator.onended();
  assert.equal(f.metro.nodes.size, 0);
  assert.equal(oscillator.disconnected, true);
  assert.equal(f.gains[0].disconnected, true);
});
