/* Pure note/tablature conversion. Standard tuning, first string first. */
(function (root) {
  'use strict';
  const tuning = [64, 59, 55, 50, 45, 40];
  const names = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
  const noteName = pitch => names[pitch % 12] + (Math.floor(pitch / 12) - 1);
  function positions(pitch, maxFret = 12) {
    return tuning.flatMap((open, index) => pitch >= open && pitch <= open + maxFret ? [{string: index + 1, fret: pitch - open}] : []);
  }
  function assign(raw, maxFret = 12, duration = 30) {
    const notes = raw.filter(n => Number.isFinite(n.startTimeSeconds) && Number.isFinite(n.durationSeconds) && Number.isInteger(n.pitchMidi) && n.pitchMidi >= 0 && n.pitchMidi <= 127 && n.durationSeconds > 0 && n.startTimeSeconds < duration)
      .map(n => ({start: Math.max(0, n.startTimeSeconds), duration: Math.min(n.durationSeconds, duration - Math.max(0, n.startTimeSeconds)), pitch: n.pitchMidi, amplitude: n.amplitude || .5}))
      .sort((a, b) => a.start - b.start || b.pitch - a.pitch);
    let hand = 0;
    const active = [];
    for (const n of notes) {
      const available = positions(n.pitch, maxFret).filter(p => !active.some(a => a.string === p.string && a.start + a.duration > n.start + .03));
      available.sort((a, b) => (Math.abs(a.fret - hand) + a.fret * .15) - (Math.abs(b.fret - hand) + b.fret * .15));
      const chosen = available[0];
      n.string = chosen?.string ?? null; n.fret = chosen?.fret ?? null;
      if (chosen) { active.push(n); if (chosen.fret > 0) hand = chosen.fret; }
      while (active.length && active[0].start + active[0].duration <= n.start) active.shift();
    }
    return notes;
  }
  function conflicts(notes) {
    return new Set(notes.flatMap((n, i) => notes.some((other, j) => i !== j && n.string && n.string === other.string && Math.min(n.start + n.duration, other.start + other.duration) - Math.max(n.start, other.start) > .03) ? [i] : []));
  }
  function toText(notes) {
    const groups = [];
    notes.forEach(n => {
      let group = groups.at(-1);
      if (!group || Math.abs(group.time - n.start) > .03) { group = {time: n.start, notes: []}; groups.push(group); }
      group.notes.push(n);
    });
    const blocks = [];
    for (let start = 0; start < groups.length; start += 8) {
      const chunk = groups.slice(start, start + 8);
      blocks.push('s  ' + chunk.map(g => g.time.toFixed(2).padStart(6)).join(''));
      ['e', 'B', 'G', 'D', 'A', 'E'].forEach((label, index) => blocks.push(label + ' |' + chunk.map(g => String(g.notes.find(n => n.string === index + 1)?.fret ?? '-').padStart(6, '-')).join('') + '|'));
      blocks.push('');
    }
    return 'Afinação padrão: E A D G B e. Casa 0 = corda solta.\nTempos em segundos; espaçamento não representa ritmo.\nNotas sem posição aparecem apenas na lista de revisão.\n\n' + blocks.join('\n');
  }
  // Format 0 MIDI, 480 ticks/quarter, fixed 120 BPM: 960 ticks/second.
  function toMidi(notes) {
    const variable = value => { const bytes = [value & 127]; while ((value >>= 7)) bytes.unshift((value & 127) | 128); return bytes; };
    const events = notes.flatMap(n => [{tick: Math.round(n.start * 960), on: true, pitch: n.pitch, velocity: Math.max(1, Math.min(127, Math.round(n.amplitude * 100)))}, {tick: Math.round((n.start + n.duration) * 960), on: false, pitch: n.pitch, velocity: 0}]).sort((a,b) => a.tick - b.tick || Number(a.on) - Number(b.on));
    const track = [0, 255, 81, 3, 7, 161, 32, 0, 192, 24];
    let previous = 0;
    events.forEach(e => { track.push(...variable(e.tick - previous), e.on ? 144 : 128, e.pitch, e.velocity); previous = e.tick; });
    track.push(0,255,47,0);
    const size = track.length;
    return new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,(size>>>24)&255,(size>>>16)&255,(size>>>8)&255,size&255,...track]);
  }
  const api = {positions, assign, conflicts, noteName, toText, toMidi};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GuitarTab = api;
})(globalThis);
