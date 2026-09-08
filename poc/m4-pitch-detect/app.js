"use strict";

const TARGETS = {
  E2: 82.40688922821741,
  A2: 110.0,
  D3: 146.83238395883756,
  G3: 195.99771799009934,
  B3: 246.94165062806205,
  E4: 329.62755691286977,
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FFT_SIZE = 4096;
const RMS_GATE = 0.01;
const CLARITY_GATE = 0.9;
const MIN_PITCH = 65.0;
const MAX_PITCH = 1200.0;

function pitchToMidi(pitch) {
  return 69 + 12 * Math.log2(pitch / 440.0);
}

function midiToNoteName(midi) {
  const m = Math.round(midi);
  const name = NOTE_NAMES[((m % 12) + 12) % 12];
  const octave = Math.floor(m / 12) - 1;
  return { name, octave, nameOct: name + octave, midi: m };
}

function computeRMS(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

function mcleodNSDF(buf, sampleRate) {
  const limit = Math.min(buf.length - 2, Math.ceil(sampleRate / MIN_PITCH));
  const nsdf = new Float32Array(limit + 1);
  for (let tau = 0; tau <= limit; tau++) {
    let correlation = 0, energy = 0;
    for (let i = 0; i < buf.length - tau; i++) {
      const a = buf[i], b = buf[i + tau];
      correlation += a * b;
      energy += a * a + b * b;
    }
    nsdf[tau] = energy ? 2 * correlation / energy : 0;
  }
  return nsdf;
}

function findPeak(nsdf) {
  // Ignore the zero-lag lobe. The first strong positive peak gives the period.
  let start = 1;
  while (start < nsdf.length && nsdf[start] > 0) start++;
  const peaks = [];
  for (let i = start + 1; i < nsdf.length - 1; i++) {
    if (nsdf[i] > 0 && nsdf[i] > nsdf[i - 1] && nsdf[i] >= nsdf[i + 1]) {
      peaks.push({ tau: i, val: nsdf[i] });
    }
  }
  const best = Math.max(0, ...peaks.map(p => p.val));
  return peaks.find(p => p.val >= Math.max(0.8, best * 0.93)) || { tau: -1, val: 0 };
}

function parabolicInterp(nsdf, tau) {
  if (tau <= 0 || tau >= nsdf.length - 1) return { tau: tau, val: nsdf[tau] };
  const a = nsdf[tau - 1];
  const b = nsdf[tau];
  const c = nsdf[tau + 1];
  const denom = a - 2 * b + c;
  let shift = 0;
  let peak = b;
  if (denom !== 0) {
    shift = 0.5 * (a - c) / denom;
    peak = b - 0.25 * (a - c) * shift;
  }
  if (shift > 1) shift = 1;
  if (shift < -1) shift = -1;
  return { tau: tau + shift, val: peak };
}

function detectPitch(buf, sampleRate) {
  const nsdf = mcleodNSDF(buf, sampleRate);
  let { tau, val } = findPeak(nsdf);
  if (tau < 0 || val <= 0) return { pitch: -1, clarity: 0 };
  const pq = parabolicInterp(nsdf, tau);
  const refinedTau = pq.tau;
  const refinedVal = Math.max(0, Math.min(1, pq.val));
  if (refinedTau <= 0) return { pitch: -1, clarity: 0 };
  const pitch = sampleRate / refinedTau;
  return { pitch, clarity: refinedVal };
}

(function main() {
  const $ = id => document.getElementById(id);
  const strings = [
    ['E2', '6ª corda · Mi grave', 'a mais grossa'],
    ['A2', '5ª corda · Lá', 'a segunda mais grossa'],
    ['D3', '4ª corda · Ré', 'a terceira mais grossa'],
    ['G3', '3ª corda · Sol', 'a quarta a partir da mais grossa'],
    ['B3', '2ª corda · Si', 'a segunda mais fina'],
    ['E4', '1ª corda · Mi agudo', 'a mais fina'],
  ];
  const names = ['Dó', 'Dó sustenido', 'Ré', 'Ré sustenido', 'Mi', 'Fá', 'Fá sustenido', 'Sol', 'Sol sustenido', 'Lá', 'Lá sustenido', 'Si'];
  let ctx, analyser, stream, source, raf, buffer;
  let state = 'idle', generation = 0, lastFrame = -Infinity, stableSince = null;
  const tuned = new Set();
  const setText = (id, message) => { if ($(id).textContent !== message) $(id).textContent = message; };
  const status = (message, error = false) => {
    setText('status', message);
    $('status').classList.toggle('error', error);
  };
  const selection = () => strings.find(s => s[0] === $('target').value);
  function idle(message = 'Toque a corda selecionada sem pressionar nenhuma casa.') {
    setText('note', 'Sem leitura');
    setText('meta', 'Sem leitura.');
    setText('verdict', '—');
    $('verdict').className = 'verdict';
    $('needle').hidden = true;
    $('needle').className = 'gauge-needle';
    setText('centsLabel', 'Desvio: —');
    setText('guidance', message);
    stableSince = null;
  }
  function progress() {
    setText('progress', `${tuned.size} de 6 cordas conferidas nesta sessão. Este registro mostra as leituras anteriores; confira novamente se a afinação mudar.`);
    $('checked-strings').replaceChildren(...strings.map(([key, label]) => {
      const item = document.createElement('li');
      item.textContent = `${label}: ${tuned.has(key) ? 'conferida' : 'a conferir'}.`;
      return item;
    }));
    const index = strings.findIndex(s => s[0] === $('target').value);
    $('next-string').disabled = index === strings.length - 1;
    $('next-string').textContent = index === strings.length - 1 ? 'Última corda' : `Próxima: ${strings[index + 1][1]}`;
  }
  function targetChanged() {
    const [key, label, position] = selection();
    setText('targetLabel', `Alvo: ${label} · ${key} · ${TARGETS[key].toFixed(2)} Hz`);
    setText('string-help', `Toque a ${label.toLowerCase()}, ${position}. Deixe essa corda solta e abafe as outras.`);
    idle(state === 'running' ? undefined : 'Ligue o microfone para começar a conferir esta corda.');
    progress();
  }
  function stop(message = 'Microfone desligado.') {
    generation++;
    state = 'idle';
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    source?.disconnect();
    analyser?.disconnect();
    if (ctx) ctx.close().catch(() => {});
    ctx = analyser = stream = source = null;
    $('start').textContent = 'Ligar microfone';
    idle('Ligue o microfone para conferir a corda selecionada.');
    status(message);
  }
  async function start() {
    const token = ++generation;
    state = 'pending';
    $('start').textContent = 'Cancelar ativação';
    status('Aguardando permissão para usar o microfone…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'UnsupportedMicrophone' });
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Object.assign(new Error(), { name: 'UnsupportedAudio' });
      const acquired = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation:false, autoGainControl:false, noiseSuppression:false, channelCount:1}});
      if (token !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired;
      acquired.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
        if (token === generation) stop('O microfone foi desconectado. Conecte novamente e ligue o microfone.');
      }));
      ctx = new Audio();
      await ctx.resume();
      if (token !== generation) return;
      analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      buffer = new Float32Array(FFT_SIZE);
      state = 'running';
      lastFrame = -Infinity;
      $('start').textContent = 'Desligar microfone';
      status('Ouvindo. Toque somente a corda selecionada. O áudio fica neste navegador.');
      idle();
      raf = requestAnimationFrame(loop);
    } catch (error) {
      if (token !== generation) return;
      stop();
      const errors = {
        NotAllowedError: 'Permissão negada. Libere o microfone nas configurações do site e tente novamente.',
        NotFoundError: 'Nenhum microfone encontrado. Conecte um microfone e tente novamente.',
        NotReadableError: 'Não foi possível acessar o microfone. Feche outros aplicativos que o estejam usando e tente novamente.',
        UnsupportedMicrophone: 'Abra esta página em localhost ou HTTPS, em um navegador com acesso ao microfone.',
        UnsupportedAudio: 'Este navegador não oferece o áudio necessário. Tente outro navegador.',
      };
      status(errors[error.name] || 'Não foi possível iniciar o afinador. Confira o microfone e tente novamente.', true);
    }
  }
  function loop(now) {
    if (state !== 'running') return;
    raf = requestAnimationFrame(loop);
    if (now - lastFrame < 80) return;
    // A long interruption cannot establish a continuous stable reading.
    if (now - lastFrame > 300) stableSince = null;
    lastFrame = now;
    analyser.getFloatTimeDomainData(buffer);
    const rms = computeRMS(buffer);
    if (rms < RMS_GATE) { idle('Sem som suficiente. Toque a corda selecionada e aproxime o violão do microfone.'); return; }
    const {pitch, clarity} = detectPitch(buffer, ctx.sampleRate);
    if (pitch < MIN_PITCH || pitch > MAX_PITCH || clarity < CLARITY_GATE) {
      idle('Som sem uma nota clara. Abafe as outras cordas e toque apenas a selecionada.');
      return;
    }
    const cents = 1200 * Math.log2(pitch / TARGETS[$('target').value]);
    const inTune = Math.abs(cents) <= 5;
    const far = Math.abs(cents) > 150;
    stableSince = inTune ? (stableSince ?? now) : null;
    const confirmed = inTune && now - stableSince >= 1000;
    const detected = midiToNoteName(pitchToMidi(pitch));
    setText('note', `${names[((detected.midi % 12) + 12) % 12]} (${detected.nameOct})`);
    setText('meta', `${pitch.toFixed(2)} Hz · clareza do sinal ${(clarity * 100).toFixed(0)}%`);
    setText('centsLabel', `Desvio: ${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents`);
    $('needle').hidden = far;
    $('needle').style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
    $('needle').className = 'gauge-needle ' + (inTune ? 'in-tune' : 'off');
    setText('verdict', far ? '?' : confirmed ? '✓' : inTune ? '…' : cents < 0 ? '↑' : '↓');
    $('verdict').className = 'verdict ' + (confirmed ? 'ok' : inTune || far ? '' : 'bad');
    if (confirmed && !tuned.has($('target').value)) { tuned.add($('target').value); progress(); }
    setText('guidance', far ? 'Nota distante do alvo. Confira a corda tocada e a seleção antes de mexer na tarraxa.'
      : confirmed && tuned.size === 6 ? 'As seis cordas foram conferidas. Toque cada uma novamente para revisar e depois desligue o microfone.'
      : confirmed && $('target').value === 'E4' ? 'Corda conferida nesta leitura. Veja a lista para saber quais ainda faltam.'
      : confirmed ? 'Corda conferida nesta leitura. Use Próxima para conferir a seguinte ou toque novamente para verificar.'
      : inTune ? 'Som no alvo. Deixe a nota sustentar por pelo menos um segundo para conferir.'
      : cents < 0 ? 'Som um pouco grave. Aumente a tensão da corda em um movimento pequeno e toque novamente.'
      : 'Som um pouco agudo. Diminua a tensão da corda em um movimento pequeno e toque novamente.');

  }
  $('start').addEventListener('click', () => state !== 'idle' ? stop(state === 'pending' ? 'Ativação cancelada. Se a permissão ainda aparecer, você pode fechá-la.' : undefined) : start());
  $('target').addEventListener('change', targetChanged);
  $('next-string').addEventListener('click', () => {
    const index = strings.findIndex(s => s[0] === $('target').value);
    if (index < strings.length - 1) { $('target').value = strings[index + 1][0]; targetChanged(); }
  });
  $('reset-check').addEventListener('click', () => { tuned.clear(); targetChanged(); status(state === 'running' ? 'Conferência reiniciada. Toque a corda selecionada.' : 'Conferência reiniciada. Ligue o microfone para começar.'); });
  window.addEventListener('pagehide', () => stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden && state !== 'idle') stop('Microfone desligado ao sair da página. Ligue novamente para continuar.'); });
  targetChanged();
})();
