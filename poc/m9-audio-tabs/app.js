(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const tab = window.GuitarTab;
  let audioBuffer = null, audioURL = null, notes = [], worker = null, timeout = null;
  let generation = 0, busy = false, recorder = null, stream = null, recordingTimer = null;
  let playback = null, clipStop = null, resultOffset = 0;
  const status = message => { $('status').textContent = message; };
  function setBusy(value) {
    busy = value;
    ['audio-file', 'record', 'demo'].forEach(id => { $(id).disabled = value; });
    $('clip-controls').disabled = value || !audioBuffer;
  }
  function stopPlayback() {
    clearTimeout(clipStop);
    $('original').pause();
    if (playback) { void playback.close(); playback = null; }
  }
  function clearResult() {
    notes = []; $('result').hidden = true; $('empty-result').hidden = false;
    $('notes').replaceChildren(); $('tab').textContent = '';
  }
  function endWorker() {
    worker?.terminate(); worker = null; clearTimeout(timeout);
    $('cancel').hidden = true; $('analysis-progress').hidden = true;
  }
  function cancelAnalysis() {
    generation++; endWorker(); setBusy(false); status('Análise cancelada. Você pode tentar outro trecho.');
  }
  function releaseMicrophone() {
    clearInterval(recordingTimer);
    stream?.getTracks().forEach(track => track.stop()); stream = null;
  }
  function resetSource() {
    stopPlayback(); clearResult(); audioBuffer = null;
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = null; $('original').removeAttribute('src'); $('original').hidden = true;
    $('source-name').textContent = 'Preparando áudio…';
  }
  async function inspectDuration(blob) {
    const probe = new Audio(), url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('O navegador demorou para abrir o áudio. Tente MP3 ou WAV.')), 10000);
        probe.onloadedmetadata = () => { clearTimeout(timer); resolve(probe.duration); };
        probe.onerror = () => { clearTimeout(timer); reject(new Error('Não foi possível ler esse áudio. Tente um arquivo MP3 ou WAV válido.')); };
        probe.preload = 'metadata'; probe.src = url;
      });
    } finally { probe.removeAttribute('src'); probe.load(); URL.revokeObjectURL(url); }
  }
  async function loadAudio(blob, name, recordedDuration) {
    const token = ++generation;
    resetSource(); setBusy(true); status('Abrindo áudio…');
    try {
      if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('Escolha um áudio de até 20 MB.');
      const duration = recordedDuration ?? await inspectDuration(blob);
      if (token !== generation) return;
      if (!Number.isFinite(duration) || duration < .5 || duration > 300) throw new Error('Escolha um áudio entre meio segundo e 5 minutos, com duração identificável. Tente MP3 ou WAV.');
      const bytes = await blob.arrayBuffer();
      // Decode directly at the model sample rate to reduce retained audio memory.
      const decoder = new OfflineAudioContext(1, 1, 22050);
      const decoded = await decoder.decodeAudioData(bytes);
      if (token !== generation) return;
      if (decoded.duration < .5 || decoded.duration > 300) throw new Error('Escolha um áudio entre meio segundo e 5 minutos.');
      audioBuffer = decoded; audioURL = URL.createObjectURL(blob);
      $('original').src = audioURL; $('original').hidden = false;
      $('source-name').textContent = `${name} · ${decoded.duration.toFixed(1)} segundos`;
      $('clip-start').value = '0'; $('clip-start').max = String(decoded.duration - .5);
      $('clip-duration').value = String(Math.floor(Math.min(10, decoded.duration) * 10) / 10);
      status('Áudio pronto. Escolha o trecho e gere a tablatura.');
    } catch (error) {
      if (token !== generation) return;
      $('source-name').textContent = 'Nenhum áudio carregado.';
      status(error.name === 'EncodingError' ? 'Não foi possível ler esse áudio. Tente um arquivo MP3 ou WAV válido.' : error.message);
    } finally { if (token === generation) setBusy(false); }
  }
  function selection() {
    const start = Number($('clip-start').value), duration = Number($('clip-duration').value);
    if (!audioBuffer || !$('transcribe-form').reportValidity() || !Number.isFinite(start + duration) || start < 0 || duration < .5 || duration > 30 || start + duration > audioBuffer.duration + .001) {
      throw new Error('Escolha um trecho de 0,5 a 30 segundos que caiba no áudio.');
    }
    return {start, duration};
  }
  async function transcribe(event) {
    event.preventDefault(); if (busy) return;
    let clip;
    try { clip = selection(); } catch (error) { status(error.message); return; }
    stopPlayback(); clearResult(); setBusy(true);
    const token = ++generation;
    const samples = new Float32Array(Math.floor(clip.duration * 22050));
    const offset = Math.floor(clip.start * 22050);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const source = audioBuffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] += (source[offset + i] || 0) / audioBuffer.numberOfChannels;
    }
    let energy = 0; for (const value of samples) energy += value * value;
    if (Math.sqrt(energy / samples.length) < .0005) { setBusy(false); status('O trecho está silencioso. Grave ou selecione um trecho com notas audíveis.'); return; }
    $('cancel').hidden = false; $('analysis-progress').hidden = false; $('analysis-progress').value = 0;
    status('Carregando o reconhecedor. O áudio permanece neste dispositivo…');
    const fail = message => { if (token !== generation) return; endWorker(); setBusy(false); status(message); };
    try {
      worker = new Worker('engine.js');
      timeout = setTimeout(() => fail('A análise excedeu 3 minutos. Tente um trecho menor ou use um computador.'), 180000);
      worker.onerror = () => fail('Não foi possível carregar o reconhecedor. Confira a conexão e tente novamente.');
      worker.onmessage = ({data}) => {
        if (token !== generation) return;
        if (data.type === 'progress') {
          const percent = Math.round(data.value * 100);
          $('analysis-progress').value = percent;
          status(percent ? `Analisando trecho: ${percent}%. Você pode cancelar.` : 'Preparando o modelo. Em celulares, a análise pode levar alguns minutos.');
        } else if (data.type === 'error') fail(data.message);
        else if (data.type === 'result') {
          endWorker(); setBusy(false);
          if (data.notes.length > 600) { status('Muitas notas detectadas. Escolha um trecho menor ou com menos ruído.'); return; }
          resultOffset = clip.start;
          notes = tab.assign(data.notes, Number($('max-fret').value), clip.duration);
          if (!notes.length) { status('Nenhuma nota reconhecida. Tente um trecho mais limpo e com som mais forte.'); return; }
          renderResult(); status('Transcrição concluída. Confira o resultado e revise as posições.');
          $('result-title').tabIndex = -1; $('result-title').focus();
        }
      };
      worker.postMessage({samples}, [samples.buffer]);
    } catch (_) { fail('Este navegador não conseguiu iniciar o reconhecedor. Tente um navegador atualizado.'); }
  }
  function updateTab() {
    const collisions = tab.conflicts(notes);
    const unassigned = notes.filter(n => !n.string).length;
    $('tab').textContent = tab.toText(notes);
    $('result-summary').textContent = `${notes.length} notas · trecho a partir de ${resultOffset.toFixed(1)} s do original · afinação padrão.`;
    $('review-status').textContent = unassigned || collisions.size ? `${unassigned} notas sem posição possível. ${collisions.size} notas disputam a mesma corda ao mesmo tempo. Revise a lista antes de tocar.` : 'Compare o som com o original. As posições sugeridas podem diferir das usadas pelo músico.';
    [...$('notes').children].forEach((row, i) => { row.dataset.conflict = String(collisions.has(i)); row.querySelector('.review-label').textContent = collisions.has(i) ? 'Conflito de corda' : !notes[i].string ? 'Sem posição' : ''; });
    ['play-notes', 'export-tab', 'export-midi'].forEach(id => { $(id).disabled = !notes.length; });
  }
  function renderResult() {
    $('result').hidden = false; $('empty-result').hidden = true; $('notes').replaceChildren();
    notes.forEach((note, index) => {
      const row = document.createElement('tr');
      [note.start.toFixed(2) + ' s', tab.noteName(note.pitch), note.duration.toFixed(2) + ' s'].forEach(text => { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); });
      const cell = document.createElement('td'), select = document.createElement('select');
      select.setAttribute('aria-label', `Posição da nota ${index + 1}, ${tab.noteName(note.pitch)}`);
      select.add(new Option('Sem posição', ''));
      tab.positions(note.pitch, Number($('max-fret').value)).forEach(p => select.add(new Option(`${p.string}ª corda · casa ${p.fret}`, `${p.string}:${p.fret}`)));
      select.value = note.string ? `${note.string}:${note.fret}` : '';
      select.addEventListener('change', () => { stopPlayback(); [note.string, note.fret] = select.value ? select.value.split(':').map(Number) : [null, null]; updateTab(); });
      cell.append(select); row.append(cell);
      const review = document.createElement('td'), label = document.createElement('span'), remove = document.createElement('button');
      label.className = 'review-label'; label.style.display = 'block';
      remove.type = 'button'; remove.textContent = 'Remover'; remove.setAttribute('aria-label', `Remover nota ${index + 1}, ${tab.noteName(note.pitch)}`);
      remove.addEventListener('click', () => { stopPlayback(); notes.splice(index, 1); renderResult(); const next = $('notes').children[Math.min(index, notes.length - 1)]; (next?.querySelector('button') || $('result-title')).focus(); });
      review.append(label, remove); row.append(review); $('notes').append(row);
    });
    updateTab();
  }
  async function startRecording() {
    if (busy) return;
    stopPlayback();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { status('Gravação indisponível. Use HTTPS e um navegador atualizado ou abra um arquivo.'); return; }
    const token = ++generation; setBusy(true);
    $('stop-record').hidden = false; $('stop-record').disabled = false; $('stop-record').textContent = 'Cancelar microfone';
    $('record-status').textContent = 'Aguardando permissão do microfone…';
    try {
      const granted = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}});
      if (token !== generation) { granted.getTracks().forEach(track => track.stop()); return; }
      stream = granted;
      const chunks = []; recorder = new MediaRecorder(stream);
      const activeRecorder = recorder;
      const recordedAt = performance.now();
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        releaseMicrophone(); recorder = null;
        if (token !== generation) return;
        $('stop-record').hidden = true;
        $('record-status').textContent = 'Microfone desligado. Gravação concluída.';
        void loadAudio(new Blob(chunks, {type: activeRecorder.mimeType}), 'Minha gravação', (performance.now() - recordedAt) / 1000);
      };
      recorder.onerror = () => { generation++; releaseMicrophone(); recorder = null; $('stop-record').hidden = true; setBusy(false); status('Falha na gravação. Tente novamente ou abra um arquivo.'); };
      stream.getAudioTracks()[0].onended = stopRecording;
      recorder.start(250);
      $('stop-record').textContent = 'Parar gravação';
      const began = performance.now();
      $('record-status').textContent = 'Gravando… 0 de 30 segundos.';
      recordingTimer = setInterval(() => {
        const elapsed = Math.floor((performance.now() - began) / 1000);
        $('record-status').textContent = `Gravando… ${Math.min(30, elapsed)} de 30 segundos.`;
        if (elapsed >= 30) stopRecording();
      }, 250);
    } catch (error) {
      if (token !== generation) return;
      releaseMicrophone(); $('stop-record').hidden = true; setBusy(false);
      $('record-status').textContent = error.name === 'NotAllowedError' ? 'Permissão negada. Libere o microfone no navegador ou abra um arquivo.' : 'Microfone indisponível. Confira o dispositivo e tente novamente.';
    }
  }
  function stopRecording() {
    if (recorder) { if (recorder.state === 'recording') { $('stop-record').disabled = true; recorder.stop(); releaseMicrophone(); } }
    else { generation++; releaseMicrophone(); $('stop-record').hidden = true; setBusy(false); $('record-status').textContent = 'Solicitação de microfone cancelada.'; }
  }
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function example() {
    // An audible synthesized E4, F#4, G4, A4 fixture, analyzed by the real model.
    const rate = 22050, length = rate * 5, bytes = new ArrayBuffer(44 + length * 2), view = new DataView(bytes);
    const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,rate,true); view.setUint32(28,rate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,length*2,true);
    [64,66,67,69].forEach((pitch, index) => {
      const frequency = 440 * 2 ** ((pitch - 69) / 12);
      for (let i=0; i<rate * .7; i++) { const t=i/rate, envelope=Math.min(1,t/.01)*Math.min(1,(.7-t)/.04)*Math.exp(-t*2); const value = envelope * .5 * Math.sin(2*Math.PI*frequency*t); view.setInt16(44 + (Math.floor((.5+index)*rate)+i)*2, Math.round(value*32767),true); }
    });
    void loadAudio(new Blob([bytes], {type:'audio/wav'}), 'Exemplo sintetizado: Mi, Fá♯, Sol, Lá');
  }
  $('audio-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) void loadAudio(file, file.name); event.target.value = ''; });
  $('demo').addEventListener('click', example);
  $('record').addEventListener('click', startRecording); $('stop-record').addEventListener('click', stopRecording);
  $('transcribe-form').addEventListener('submit', transcribe); $('cancel').addEventListener('click', cancelAnalysis);
  ['clip-start', 'clip-duration', 'max-fret'].forEach(id => $(id).addEventListener('input', () => { stopPlayback(); clearResult(); }));
  $('preview').addEventListener('click', async () => {
    try { const clip = selection(); stopPlayback(); $('original').currentTime = clip.start; await $('original').play(); clipStop = setTimeout(stopPlayback, clip.duration * 1000); } catch (error) { status(error.message); }
  });
  $('play-notes').addEventListener('click', async () => {
    stopPlayback();
    try {
      const context = new AudioContext(); playback = context; await context.resume(); if (playback !== context) return;
      const output = context.createGain(); output.gain.value = .08; output.connect(context.destination);
      const began = context.currentTime + .1;
      notes.forEach(note => { const osc = context.createOscillator(), gain = context.createGain(); osc.frequency.value = 440 * 2 ** ((note.pitch-69)/12); osc.connect(gain); gain.connect(output); const start = began+note.start, end = start+note.duration; gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.7,start+.01); gain.gain.exponentialRampToValueAtTime(.001,end); osc.start(start); osc.stop(end+.02); });
      clipStop = setTimeout(stopPlayback, (Math.max(...notes.map(n => n.start+n.duration))+.3)*1000);
    } catch (_) { stopPlayback(); status('Não foi possível reproduzir as notas neste navegador.'); }
  });
  $('stop-audio').addEventListener('click', stopPlayback);
  $('export-tab').addEventListener('click', () => download(tab.toText(notes), 'text/plain;charset=utf-8', 'minha-tablatura.txt'));
  $('export-midi').addEventListener('click', () => download(tab.toMidi(notes), 'audio/midi', 'minhas-notas.mid'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopPlayback();
    if (recorder || !$('stop-record').hidden) stopRecording();
  });
  window.addEventListener('pagehide', () => { generation++; endWorker(); if (recorder?.state === 'recording') recorder.stop(); releaseMicrophone(); stopPlayback(); if (audioURL) URL.revokeObjectURL(audioURL); });
})();
