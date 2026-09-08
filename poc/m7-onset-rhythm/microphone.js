import { OnsetDetector } from './onset-detector.js';

// Each activation owns its stream, context and animation frame. An old promise
// may finish, but cannot change or release a newer activation.
export function createMicrophone({ onOnset = () => {}, onFlux = () => {}, onState = () => {}, onReady = () => {} } = {}) {
  let session = null;
  let state = 'idle';
  let sensitivity = 2.5;
  let noiseGate = 0.012;

  function notify(next, message) {
    state = next;
    onState(next, message);
  }

  function release(current) {
    if (!current || current.released) return;
    current.released = true;
    cancelAnimationFrame(current.frame);
    for (const [track, listener] of current.listeners) track.removeEventListener('ended', listener);
    try { current.source?.disconnect(); } catch {}
    try { current.detector?.analyser.disconnect(); } catch {}
    current.stream?.getTracks().forEach(track => track.stop());
    if (current.context) {
      try { Promise.resolve(current.context.close()).catch(() => {}); } catch {}
    }
  }

  function stop() {
    const current = session;
    session = null;
    release(current);
    notify('idle', 'Microfone desligado.');
  }

  function fail(current, message) {
    if (session !== current) return;
    session = null;
    release(current);
    notify('error', message);
  }

  function permissionMessage(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Permissão negada. Libere o microfone no navegador ou use o treino por toque.';
    if (error?.name === 'NotFoundError') return 'Nenhum microfone encontrado. Conecte um microfone ou use o treino por toque.';
    if (error?.name === 'NotReadableError') return 'Microfone ocupado ou indisponível. Feche outros aplicativos que o utilizam e tente novamente.';
    return 'Não foi possível ligar o microfone. Tente novamente ou use o treino por toque.';
  }

  async function start(options = {}) {
    if (session) return;
    if (options.sensitivity !== undefined) setSensitivity(options.sensitivity);
    if (options.noiseGate !== undefined) setNoiseGate(options.noiseGate);
    const current = { frame: null, listeners: [], released: false };
    session = current;
    notify('requesting', 'Solicitando microfone… Você pode cancelar a ativação.');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail(current, 'Abra em localhost ou HTTPS para usar o microfone. O treino por toque continua disponível.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false }, video: false });
      if (session !== current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      const tracks = stream.getAudioTracks();
      if (!tracks.length || tracks.some(track => track.readyState === 'ended')) {
        fail(current, 'Microfone desconectado. Conecte novamente ou use o treino por toque.');
        return;
      }
      for (const track of tracks) {
        const ended = () => fail(current, 'Microfone desconectado. Conecte novamente ou use o treino por toque.');
        current.listeners.push([track, ended]);
        track.addEventListener('ended', ended);
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      current.context = new AudioContextClass();
      await current.context.resume();
      if (session !== current) return;
      current.source = current.context.createMediaStreamSource(stream);
      current.detector = new OnsetDetector(current.context, { fftSize: 2048, sensitivity, noiseGate });
      const detector = current.detector;
      detector.connectFrom(current.source)
        .onOnset((_audioTime, signal, threshold) => {
          if (session === current && state === 'listening') onOnset(performance.now() / 1000, signal, threshold);
        })
        .onFlux((signal, threshold, onset) => {
          if (session === current && state === 'listening') onFlux(signal, threshold, onset);
        });
      const startedAt = performance.now();
      let totalRms = 0;
      let samples = 0;
      notify('calibrating', 'Fique em silêncio por um segundo enquanto medimos o som ambiente.');
      function frame() {
        if (session !== current) return;
        try {
          if (state === 'calibrating') {
            detector.analyser.getFloatTimeDomainData(detector.timeData);
            const rms = Math.sqrt(detector.timeData.reduce((sum, value) => sum + value * value, 0) / detector.timeData.length);
            totalRms += Number.isFinite(rms) ? rms : 0;
            samples++;
            if (performance.now() - startedAt >= 1000 && samples >= 2) {
              detector.baselineRms = totalRms / samples;
              detector.baselineCount = detector.baselineFrames;
              detector.prevRms = Number.isFinite(rms) ? rms : 0;
              notify('listening', 'Microfone pronto. Toque uma batida por pulso.');
              if (session === current) onReady({ sampleRate: current.context.sampleRate, fftSize: detector.fftSize });
            }
          } else {
            detector.process();
          }
          if (session === current) current.frame = requestAnimationFrame(frame);
        } catch {
          fail(current, 'A leitura do microfone foi interrompida. Tente ligar novamente ou use o treino por toque.');
        }
      }
      if (session === current) current.frame = requestAnimationFrame(frame);
    } catch (error) {
      fail(current, permissionMessage(error));
    }
  }

  function setSensitivity(value) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) return;
    sensitivity = Number(value);
    session?.detector?.setSensitivity(sensitivity);
  }

  function setNoiseGate(value) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) return;
    noiseGate = Number(value);
    session?.detector?.setNoiseGate(noiseGate);
  }

  window.addEventListener('pagehide', () => { if (session) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && session) stop(); });
  return { start, stop, setSensitivity, setNoiseGate, get state() { return state; } };
}
