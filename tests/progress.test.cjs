const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const code = readFileSync('shared/progress.js', 'utf8');
function setup(initial, blocked = false) {
  let stored = initial;
  const window = { dispatchEvent() {} };
  runInNewContext(code, { window, structuredClone, crypto: require('node:crypto').webcrypto, Event,
    localStorage: { getItem: () => stored, setItem: (_, value) => { if (blocked) throw Error('quota'); stored = value; } } });
  return { api: window.GuitarStudy, stored: () => stored };
}
test('practice persists with goal and survives a fresh page', () => {
  const { api, stored } = setup();
  api.setGoal(25);
  assert.equal(api.recordPractice('m2', { minutes: 5, note: 'Trocar Em para Am' }), true);
  const restored = setup(stored()).api.getState();
  assert.equal(restored.goal, 25);
  assert.equal(restored.sessions[0].minutes, 5);
  assert.equal(restored.sessions[0].note, 'Trocar Em para Am');
});
test('invalid module and non-integer duration do not create records', () => {
  const { api } = setup();
  for (const minutes of [0, -1, NaN, Infinity, 181, 1.5]) assert.throws(() => api.recordPractice('m2', { minutes }));
  assert.throws(() => api.recordPractice('unknown', { minutes: 5 }));
  assert.equal(api.getState().sessions.length, 0);
});
test('invalid saved data does not crash rendering', () => {
  assert.equal(setup('{bad').api.getState().sessions.length, 0);
  assert.equal(setup('{"sessions":[null,{},42],"goal":-20}').api.getState().goal, 15);
});
test('blocked writes retain all temporary records and expose status', () => {
  const { api } = setup('{"goal":15,"sessions":[]}', true);
  assert.equal(api.recordPractice('m1', { minutes: 2 }), false);
  assert.equal(api.recordPractice('m2', { minutes: 5 }), false);
  assert.equal(api.getState().sessions.length, 2);
  assert.equal(api.isStorageAvailable(), false);
});
test('delete only removes the selected record', () => {
  const { api } = setup();
  api.recordPractice('m1', { minutes: 2 });
  api.recordPractice('m2', { minutes: 5 });
  api.removeSession(api.getState().sessions[0].id);
  assert.equal(api.getState().sessions.length, 1);
  assert.equal(api.getState().sessions[0].moduleId, 'm2');
});
