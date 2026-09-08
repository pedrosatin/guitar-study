const SONGS = [
`{title: Contar sem tocar}
{bpm: 60}
[Pulso]Conte 1, 2, 3, 4 [Pulso]Conte outra vez`,
`{title: Tocar só Em}
{bpm: 60}
[Em]Mi menor [Em]Mi menor`,
`{title: Trocar Em e Am}
{bpm: 60}
[Em]Mi menor [Am]Lá menor [Em]Mi menor [Am]Lá menor`
];
function parseChordPro(text) {
  const song = { title: "", bpm: 60, beatsPerMeasure: 4, sections: [] };
  const lines = text.split("\n");
  let currentSection = null;
  const directiveRe = /^\{(\w+)\s*:\s*(.*)\}$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    const m = line.match(directiveRe);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "title") song.title = val;
      else if (key === "bpm") song.bpm = Math.max(40, Math.min(200, parseInt(val, 10) || 60));
      else if (key === "time_signature") {
        const parts = val.split("/");
        song.beatsPerMeasure = Math.max(1, Math.min(8, parseInt(parts[0], 10) || 4));
      } else if (key === "c") {
        currentSection = { name: val, lines: [] };
        song.sections.push(currentSection);
      }
      continue;
    }
    if (!currentSection) {
      currentSection = { name: "", lines: [] };
      song.sections.push(currentSection);
    }
    currentSection.lines.push(parseLine(line));
  }
  return song;
}

function parseLine(line) {
  const words = [];
  const tokenRe = /\[([^\]]+)\]/g;
  const positions = [];
  let m;
  while ((m = tokenRe.exec(line)) !== null) {
    positions.push({ chord: m[1], start: m.index, end: m.index + m[0].length });
  }
  if (positions.length === 0) {
    return { words: [{ chord: "", lyric: line }] };
  }
  if (positions[0].start > 0) words.push({ chord: "", lyric: line.slice(0, positions[0].start) });
  for (let i = 0; i < positions.length; i++) {
    const lyricStart = positions[i].end;
    const lyricEnd = i + 1 < positions.length ? positions[i + 1].start : line.length;
    words.push({ chord: positions[i].chord, lyric: line.slice(lyricStart, lyricEnd) });
  }
  return { words };
}


const $ = id => document.getElementById(id);
let ctx, metro, song, words = [], elements = [], beat = 0, countIn = 4;
let customText = '';
let phase = 'idle', starting = false, request = 0, counting = true, preparing = true;
const duration = () => Number($('chord-beats').value) || song.beatsPerMeasure;
const shownChord = word => counting ? 'Conte' : word?.chord || 'Fim';
function controls() {
  const running = starting || !!metro?.isPlaying;
  $('play-btn').disabled = running || !words.length;
  $('play-btn').textContent = phase === 'paused' ? 'Continuar' : phase === 'finished' ? 'Repetir exercício' : 'Iniciar';
  $('pause-btn').disabled = !running;
  for (const id of ['song-select', 'chord-beats', 'repeat', 'bpm', 'load-custom']) $(id).disabled = running;
}
function state(message) { $('playback-status').textContent = message; controls(); }
function render() {
  $('song-area').replaceChildren(); words = []; elements = [];
  $('song-title').textContent = song.title || 'Meu exercício';
  for (const section of song.sections) {
    const sec = document.createElement('section'); sec.className = 'section';
    if (section.name) { const h = document.createElement('h4'); h.textContent = section.name; sec.append(h); }
    for (const line of section.lines) {
      const row = document.createElement('div'); row.className = 'line';
      for (const word of line.words) {
        const box = document.createElement('span'); box.className = 'word';
        const chord = document.createElement('span'); chord.className = 'chord'; chord.textContent = word.chord;
        const lyric = document.createElement('span'); lyric.className = 'lyric'; lyric.textContent = word.lyric;
        box.append(chord, document.createElement('br'), lyric); row.append(box);
        if (word.chord.trim()) { words.push(word); elements.push(box); }
      }
      sec.append(row);
    }
    $('song-area').append(sec);
  }
  document.querySelector('.beats').replaceChildren(...Array.from({length:song.beatsPerMeasure}, (_, i) => {
    const dot = document.createElement('span'); dot.className = 'beat-dot'; dot.textContent = i + 1; return dot;
  }));
  $('chord-beats').options[0].textContent = `Um compasso (${song.beatsPerMeasure} cliques)`;
}
function describe() {
  const total = words.length * duration();
  $('exercise-help').textContent = `${song.title || 'Minha cifra'}: ${words.length} ${counting ? 'grupos' : 'acordes'}, ${duration()} cliques por ${counting ? 'grupo' : 'acorde'}. ` +
    `${total} cliques por sequência, após ${song.beatsPerMeasure} cliques de preparação. ` +
    ($('repeat').checked ? 'A sequência repete até você pausar.' : 'A reprodução para ao terminar.');
}
function clearBeats() {
  document.querySelectorAll('.beat-dot').forEach(el => { el.classList.remove('on'); el.removeAttribute('aria-current'); });
}
function reset() {
  request++; starting = false; metro?.reset(); beat = 0; countIn = song.beatsPerMeasure; phase = 'idle'; preparing = true;
  elements.forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
  $('current-label').textContent = counting ? 'Sua ação' : 'Prepare';
  $('current-chord').textContent = shownChord(words[0]); $('next-chord').textContent = shownChord(words[1]);
  $('beat-instruction').textContent = 'Aguarde a preparação antes de tocar.';
  $('completion').textContent = 'Ao terminar, confira o que conseguiu acompanhar.';
  clearBeats(); describe(); state('Pronto. Inicie para ouvir a preparação.');
}
function load(text, countOnly = false) {
  counting = countOnly; song = parseChordPro(text); render();
  $('bpm').value = song.bpm; $('bpm-value').textContent = song.bpm;
  reset();
}
function onBeat(position) {
  if (countIn === 0 && beat >= words.length * duration()) {
    if ($('repeat').checked) beat = 0;
    else {
      metro.reset(); phase = 'finished'; clearBeats();
      $('current-label').textContent = 'Fim'; $('current-chord').textContent = 'Concluído'; $('next-chord').textContent = 'Fim';
      $('beat-instruction').textContent = 'Pare e confira sua tentativa abaixo.';
      $('completion').textContent = 'Sequência encerrada. Confira abaixo o que conseguiu fazer antes de avançar.';
      state('Exercício concluído. A reprodução terminou; a avaliação é sua.'); return false;
    }
  }
  document.querySelectorAll('.beat-dot').forEach((el, i) => {
    el.classList.toggle('on', i === position);
    if (i === position) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
  if (countIn > 0) {
    const number = song.beatsPerMeasure - countIn + 1;
    $('beat-instruction').textContent = `Preparação: ${number} de ${song.beatsPerMeasure}. Conte sem tocar.`;
    if (number === 1) state(`Preparação. Conte ${song.beatsPerMeasure} cliques sem tocar; depois ${counting ? 'continue contando' : 'toque ' + words[Math.floor(beat / duration())].chord}.`);
    countIn--; return;
  }
  preparing = false;
  const index = Math.floor(beat / duration());
  elements.forEach((el, i) => { el.classList.toggle('active', i === index); if (i === index) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
  $('current-label').textContent = counting ? 'Sua ação' : 'Toque agora'; $('current-chord').textContent = shownChord(words[index]);
  $('next-chord').textContent = words[index + 1] ? shownChord(words[index + 1]) : $('repeat').checked ? shownChord(words[0]) : 'Fim';
  $('beat-instruction').textContent = `${counting ? 'Conte' : 'Toque para baixo'}: ${position + 1}. Clique ${beat % duration() + 1} de ${duration()} neste ${counting ? 'grupo' : 'acorde'}.`;
  // Announce chord changes, keeping per-click visuals out of the live region.
  if (beat % duration() === 0) state(`${counting ? 'Contagem' : words[index].chord} · ${index + 1} de ${words.length}. ${duration()} cliques.`);
  beat++;
}
function pause(message = 'Pausado.') {
  request++; starting = false; metro?.reset();
  if (!preparing) beat = Math.floor(Math.max(0, beat - 1) / duration()) * duration();
  preparing = true; countIn = song.beatsPerMeasure; phase = 'paused';
  $('current-label').textContent = counting ? 'Sua ação' : 'Prepare';
  $('current-chord').textContent = shownChord(words[Math.floor(beat / duration())]);
  clearBeats(); $('beat-instruction').textContent = 'Continuar repete a preparação e o grupo ou acorde interrompido.';
  state(message + ' Continue quando estiver pronto.');
}
$('play-btn').addEventListener('click', async () => {
  if (!words.length || starting || metro?.isPlaying) return;
  if (phase === 'finished') reset();
  const token = ++request; starting = true; controls();
  try {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); metro = new Metronome(ctx); metro.onBeat = onBeat; }
    metro.setBPM($('bpm').value); metro.setBeatsPerMeasure(song.beatsPerMeasure);
    await metro.start(); if (token !== request) return;
    starting = false; phase = 'running'; state('Preparação. Aguarde os cliques antes de tocar.');
  } catch {
    if (token !== request) return;
    starting = false; metro?.reset(); state('Não foi possível iniciar o áudio. Tente novamente ou conte em voz alta e pratique sem os cliques.');
  }
});
$('pause-btn').addEventListener('click', () => pause());
$('restart-btn').addEventListener('click', reset);
$('bpm').addEventListener('input', () => { $('bpm-value').textContent = $('bpm').value; });
$('song-select').addEventListener('change', () => { $('custom-status').textContent = ''; load($('song-select').value === 'custom' ? customText : SONGS[Number($('song-select').value)], $('song-select').value === '0'); });
$('chord-beats').addEventListener('change', reset);
$('repeat').addEventListener('change', describe);
$('load-custom').addEventListener('click', () => {
  const text = $('custom-song').value.slice(0, 20000);
  const parsed = parseChordPro(text);
  if (!parsed.sections.some(section => section.lines.some(line => line.words.some(word => word.chord.trim())))) {
    $('custom-status').textContent = 'Inclua ao menos um acorde entre colchetes, como [Em]. O exercício anterior foi mantido.'; return;
  }
  if (!$('song-select').querySelector('option[value="custom"]')) {
    const option = document.createElement('option'); option.value = 'custom'; option.textContent = 'Minha cifra'; $('song-select').append(option);
  }
  customText = text; $('song-select').value = 'custom'; load(text); $('custom-status').textContent = 'Cifra carregada. Vá aos controles para iniciar.';
  $('play-btn').focus();
});
window.addEventListener('pagehide', () => {
  if (starting || metro?.isPlaying) pause('Pausado ao sair da página.');
  else request++;
  ctx?.close().catch(() => {}); metro = ctx = null;
});
document.addEventListener('visibilitychange', () => { if (document.hidden && (starting || metro?.isPlaying)) pause('Pausado ao sair da página.'); });
load(SONGS[0], true);
