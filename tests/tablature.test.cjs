const {test} = require('node:test');
const assert = require('node:assert/strict');
const tab = require('../poc/m9-audio-tabs/tablature.js');
const note = (pitch, start = 0, duration = 1) => ({pitchMidi:pitch, startTimeSeconds:start, durationSeconds:duration, amplitude:.8});
test('same pitch has several positions and respects fret limit', () => {
  assert.deepEqual(tab.positions(64, 5), [{string:1,fret:0},{string:2,fret:5}]);
  assert.deepEqual(tab.positions(39), []);
});
test('simultaneous notes never silently share a string', () => {
  const result = tab.assign([note(64),note(59),note(55),note(50),note(45),note(40)]);
  assert.equal(new Set(result.map(n=>n.string)).size, 6);
  assert.equal(tab.conflicts(result).size, 0);
  const impossible = tab.assign([note(84),note(85)],20);
  assert.equal(impossible.filter(n => !n.string).length,1);
});
test('invalid notes removed, times clipped, out of range visible for review', () => {
  const result = tab.assign([note(64,-.1,1),note(65,29.9,1),note(66,31),note(10),note(NaN)],12,30);
  assert.equal(result.length,3);
  assert.ok(result.every(n=>n.start>=0 && n.start+n.duration<=30));
  assert.equal(result.find(n=>n.pitch===10).string,null);
});
test('text preserves seconds and open strings; MIDI has complete header and end', () => {
  const notes = tab.assign([note(64,.5)]);
  assert.match(tab.toText(notes), /0\.50/); assert.match(tab.toText(notes), /e \|-----0\|/);
  const midi = tab.toMidi(notes);
  assert.equal(Buffer.from(midi.slice(0,4)).toString(),'MThd');
  assert.equal(new DataView(midi.buffer).getUint32(18),midi.length-22);
  assert.deepEqual([...midi.slice(-4)],[0,255,47,0]);
});
test('manual position collisions are reported', () => {
  const notes = tab.assign([note(64),note(65,.5)]);
  notes.forEach(n=>{n.string=1;});
  assert.equal(tab.conflicts(notes).size,2);
});
