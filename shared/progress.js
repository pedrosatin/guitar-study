(function () {
  'use strict';
  const KEY = 'guitar-study-practice-v1';
  let memory = { goal: 15, sessions: [] };
  let storageAvailable = true;
  function validSession(s) {
    return s && typeof s.id === 'string' && /^m[1-9]$/.test(s.moduleId) &&
      Number.isInteger(s.minutes) && s.minutes > 0 && s.minutes <= 180 &&
      typeof s.date === 'string' && Number.isFinite(Date.parse(s.date)) && typeof s.note === 'string';
  }
  function getState() {
    if (!storageAvailable) return structuredClone(memory);
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && Array.isArray(raw.sessions)) {
        memory = { goal: Number.isInteger(raw.goal) && raw.goal >= 5 && raw.goal <= 120 ? raw.goal : 15,
          sessions: raw.sessions.filter(validSession).slice(-1000) };
      }
    } catch { storageAvailable = false; }
    return structuredClone(memory);
  }
  function save(state) {
    memory = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    window.dispatchEvent(new Event('study-progress'));
    return storageAvailable;
  }
  function recordPractice(moduleId, { minutes, note = '' }) {
    const session = { id: crypto.randomUUID(), moduleId, minutes: Number(minutes), note: String(note).trim().slice(0, 500), date: new Date().toISOString() };
    if (!validSession(session)) throw new Error('Informe entre 1 e 180 minutos de prática.');
    const state = getState();
    state.sessions.push(session);
    state.sessions = state.sessions.slice(-1000);
    return save(state);
  }
  function setGoal(goal) {
    if (!Number.isInteger(goal) || goal < 5 || goal > 120) return false;
    return save({ ...getState(), goal });
  }
  function removeSession(id) {
    const state = getState();
    return save({ ...state, sessions: state.sessions.filter(s => s.id !== id) });
  }
  function dayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  window.GuitarStudy = { getState, recordPractice, setGoal, removeSession, dayKey, isStorageAvailable: () => storageAvailable };
})();
