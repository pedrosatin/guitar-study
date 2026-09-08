import { RhythmMeasurement } from './measurement.js';
import { createMicrophone } from './microphone.js';
const $ = id => document.getElementById(id);
const measurement = new RhythmMeasurement();
let phase = 'idle';
let roundStart = 0;
let practiceStart = 0;
let timer = null;
let previousTick = 0;
let flashTimer = null;
let micState = 'idle';
let stale = false;
const mode = () => $('mode').value;
const target = () => Number($('target-bpm').value);
const active = () => phase === 'preparing' || phase === 'practicing';
const say = (id, text) => { if ($(id).textContent !== text) $(id).textContent = text; };
const microphone = createMicrophone({
  onOnset: time => { if (mode() === 'mic' && (phase === 'idle' || phase === 'practicing')) record(time); },
  onState: (state, message) => {
    micState = state;
    say('status', message);
    $('toggle').textContent = state === 'requesting' ? 'Cancelar pedido de microfone' :
      ['calibrating', 'listening'].includes(state) ? 'Desligar microfone' : 'Ligar microfone';
    if (active() && mode() === 'mic' && ['idle', 'error'].includes(state)) finish(false, 'A rodada foi interrompida porque o microfone parou.');
    controls();
  }
});
function controls() {
  $('mode').disabled = active();
  $('target-bpm').disabled = active();
  $('visual-toggle').disabled = active() || (mode() === 'mic' && micState !== 'listening');
  $('stop-round').disabled = !active();
  $('reset').disabled = active();
  $('tap').disabled = mode() !== 'tap' || phase === 'preparing' || phase === 'done';
  $('sens').disabled = active(); $('gate').disabled = active();
}
function renderChart() {
  $('bars').replaceChildren();
  const max = 3;
  const expected = 60 / target();
  const y = 150 - expected / max * 140;
  $('target-line').setAttribute('y1', y); $('target-line').setAttribute('y2', y);
  const width = 640 / Math.max(1, measurement.intervals.length);
  measurement.intervals.forEach((interval, i) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const height = Math.min(max, interval) / max * 140;
    Object.entries({x:i * width + 2, y:150 - height, width:Math.max(1, width - 4), height, fill:'#a8b7ca'}).forEach(([key, value]) => rect.setAttribute(key, value));
    $('bars').append(rect);
  });
  $('intervalInfo').textContent = measurement.intervals.length ? `${measurement.intervals.length} intervalos. Mais recente: ${measurement.intervals.at(-1).toFixed(2)} s. Esperado: ${expected.toFixed(2)} s.` : 'Ainda sem intervalos.';
}
function renderMeasurement() {
  $('onsetCount').textContent = measurement.count;
  renderChart();
  const result = measurement.summary(target());
  $('bpm').textContent = result && !stale ? result.bpm : '—';
  if (mode() === 'guitar') { say('practice-result', 'Sem medição nesta opção. Observe se consegue manter um movimento por número.'); return; }
  if (stale) { say('practice-result', 'Sem batidas recentes. Marque três batidas para medir novamente.'); return; }
  if (!result) { say('practice-result', 'Marque pelo menos três batidas para medir.'); return; }
  const speed = Math.abs(result.difference) <= 3 ? 'Velocidade próxima da escolhida.' : result.difference > 0 ? 'Você está mais rápido. Espere um pouco mais entre batidas.' : 'Você está mais lento. Diminua um pouco o intervalo entre batidas.';
  const regularity = result.variation <= .10 ? 'Os intervalos recentes estão parecidos.' : 'Os intervalos variaram. Conte em voz alta e tente manter o mesmo espaço entre as batidas.';
  say('practice-result', `${speed} ${regularity} Estimativa dos últimos ${result.samples} intervalos.`);
}
function reset() {
  measurement.reset(); stale = false;
  clearTimeout(flashTimer); $('dot').classList.remove('hit');
  renderMeasurement();
}
function newAttempt() {
  phase = 'idle'; reset();
  $('review').hidden = true;
  $('visual-toggle').textContent = 'Iniciar rodada de 30 s';
  $('remaining').textContent = '30 segundos de prática após a preparação.';
  say('round-status', 'Pronto para começar.');
  controls();
}
function record(time) {
  // A click can arrive after a suspended timer; resolve the round before counting it.
  if (active()) { tick(); if (phase !== 'practicing') return; }
  if (phase !== 'idle' && phase !== 'practicing') return;
  if (!measurement.add(time)) return;
  stale = false;
  $('dot').classList.add('hit'); clearTimeout(flashTimer);
  flashTimer = setTimeout(() => $('dot').classList.remove('hit'), 90);
  renderMeasurement();
}
function finish(completed, message) {
  clearInterval(timer); timer = null;
  phase = completed ? 'done' : 'idle';
  $('pulse').textContent = '—';
  say('round-status', message || 'Rodada concluída. Confira o resultado e sua experiência abaixo.');
  $('remaining').textContent = completed ? '30 segundos encerrados.' : 'Ao reiniciar, haverá quatro pulsos de preparação.';
  $('review').hidden = !completed;
  $('visual-toggle').textContent = completed ? 'Repetir rodada de 30 s' : 'Iniciar rodada de 30 s';
  // Freeze a completed result even if the microphone was left listening.
  if (!['idle', 'error'].includes(micState)) microphone.stop();
  renderMeasurement();
  if (completed && !measurement.summary(target()) && mode() !== 'guitar') say('practice-result', 'Tempo encerrado, sem batidas suficientes para estimar o andamento. Repita e marque pelo menos três batidas.');
  controls();
}
function tick() {
  if (!active()) return;
  const now = performance.now();
  if (now - previousTick > 1500) { finish(false, 'A página ficou sem atualizar. Reinicie a rodada para acompanhar a contagem.'); return; }
  previousTick = now;
  if (now >= practiceStart + 30000) { finish(true); return; }
  const period = 60000 / target();
  if (now < practiceStart) {
    $('pulse').textContent = Math.floor((now - roundStart) / period) + 1;
    return;
  }
  if (phase === 'preparing') {
    phase = 'practicing'; reset(); controls();
    say('round-status', 'Valendo. Faça uma batida por número.');
  }
  $('pulse').textContent = Math.floor((now - practiceStart) / period) % 4 + 1;
  $('remaining').textContent = `${Math.ceil((practiceStart + 30000 - now) / 1000)} segundos restantes.`;
  if (measurement.last !== null && now / 1000 - measurement.last > 3 && !stale) { stale = true; renderMeasurement(); }
}
$('visual-toggle').addEventListener('click', () => {
  if (active() || (mode() === 'mic' && micState !== 'listening')) return;
  phase = 'preparing'; reset(); $('review').hidden = true;
  $('review').querySelectorAll('input').forEach(input => { input.checked = false; });
  roundStart = previousTick = performance.now(); practiceStart = roundStart + 4 * 60000 / target();
  say('round-status', 'Preparação. Apenas acompanhe quatro números; espere aparecer "Valendo".');
  $('remaining').textContent = 'A prática começa depois do 4.';
  controls(); tick(); timer = setInterval(tick, 25);
});
$('stop-round').addEventListener('click', () => finish(false, 'Rodada interrompida. Você pode tentar novamente.'));
$('tap').addEventListener('click', () => record(performance.now() / 1000));
$('tap').addEventListener('keydown', event => { if (event.repeat && [' ', 'Enter'].includes(event.key)) event.preventDefault(); });
$('reset').addEventListener('click', newAttempt);
$('target-bpm').addEventListener('input', () => { $('target-value').textContent = target(); newAttempt(); });
$('mode').addEventListener('change', () => {
  microphone.stop(); newAttempt();
  $('microphone-panel').hidden = mode() !== 'mic';
  $('tap').hidden = $('tap-help').hidden = mode() !== 'tap';
  $('review').hidden = true;
  say('mode-help', mode() === 'tap' ? 'A medição acompanha seus cliques. Deixe o violão apoiado enquanto usa o botão.' : mode() === 'guitar' ? 'Acompanhe os números com o violão. Ao terminar, você mesmo confere como foi.' : 'Ligue o microfone e teste a detecção antes de iniciar. O pulso visual fica silencioso para não entrar na medição.');
  say('round-status', mode() === 'mic' ? 'Ligue o microfone para preparar esta rodada.' : 'Pronto para começar.');
  controls();
});
$('toggle').addEventListener('click', () => {
  if (['requesting', 'calibrating', 'listening'].includes(micState)) microphone.stop();
  else { newAttempt(); microphone.start({sensitivity:Number($('sens').value), noiseGate:Number($('gate').value)}); }
});
$('sens').addEventListener('input', () => { $('sensVal').textContent = Number($('sens').value).toFixed(1); microphone.setSensitivity(Number($('sens').value)); newAttempt(); });
$('gate').addEventListener('input', () => { $('gateVal').textContent = Number($('gate').value).toFixed(3); microphone.setNoiseGate(Number($('gate').value)); newAttempt(); });
function cleanup() {
  if (active()) finish(false, 'Rodada interrompida ao sair da página. Reinicie quando estiver pronto.');
  else microphone.stop();
  clearTimeout(flashTimer); $('dot').classList.remove('hit');
}
window.addEventListener('pagehide', cleanup);
document.addEventListener('visibilitychange', () => { if (document.hidden) cleanup(); });
reset(); controls();

let staleTimer = null;
function watchSilence() {
  clearInterval(staleTimer);
  staleTimer = setInterval(() => {
    if (phase === 'idle' && measurement.last !== null && performance.now() / 1000 - measurement.last > 3 && !stale) {
      stale = true; renderMeasurement();
    }
  }, 500);
}
window.addEventListener('pagehide', () => clearInterval(staleTimer));
window.addEventListener('pageshow', watchSilence);
watchSilence();
