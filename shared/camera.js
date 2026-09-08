// Shared lifecycle for the two camera exercises. No media access before a user action.
export function createCamera({video, startButton, stopButton, status, onStart, onFrame, onStop}) {
  let stream = null, frame = 0, generation = 0, active = false, pending = false, lastTime = -1;
  const stopLabel = stopButton.textContent;
  function stop(message = 'Câmera desligada. Você pode continuar o exercício manualmente.') {
    generation++; active = false; pending = false; cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null;
    startButton.disabled = false; stopButton.disabled = true; stopButton.textContent = stopLabel;
    onStop?.(); status.textContent = message;
  }
  async function start() {
    if (active || pending) return;
    const token = ++generation;
    pending = true; stopButton.textContent = 'Cancelar ativação';
    startButton.disabled = true; stopButton.disabled = false;
    status.textContent = 'Aguardando permissão para usar a câmera…';
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        stop('Use localhost ou HTTPS em um navegador com acesso à câmera.');
        return;
      }
      const acquired = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false});
      if (token !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (token === generation) stop('A câmera foi desconectada. Conecte novamente e clique em Ligar câmera.');
      }, {once:true}));
      video.srcObject = stream; await video.play();
      if (token !== generation) return;
      pending = false; stopButton.textContent = stopLabel;
      active = true; lastTime = -1; onStart?.();
      status.textContent = 'Câmera ligada. Ajuste a iluminação e mantenha a mão inteira na imagem.';
      function loop(time) {
        if (!active || token !== generation) return;
        try { if (video.readyState >= 2 && video.currentTime !== lastTime) { lastTime = video.currentTime; onFrame(time); } }
        catch { stop('A câmera não pôde continuar. Clique em Ligar câmera para tentar novamente.'); return; }
        frame = requestAnimationFrame(loop);
      }
      frame = requestAnimationFrame(loop);
    } catch (error) {
      if (token !== generation) return;
      const messages = {NotAllowedError:'Permissão de câmera negada. Libere a câmera nas configurações do site e tente novamente.',NotFoundError:'Nenhuma câmera encontrada. Conecte uma câmera ou pratique pelo roteiro.',NotReadableError:'A câmera está ocupada ou indisponível. Feche outros aplicativos e tente novamente.'};
      stop(messages[error?.name] || 'Não foi possível ligar a câmera. Tente novamente.');
    }
  }
  startButton.addEventListener('click',start); stopButton.addEventListener('click',()=>stop(pending
    ? 'Ativação cancelada. Se a janela de permissão continuar aberta, você pode fechá-la. Pratique pelo roteiro quando quiser.'
    : undefined));
  window.addEventListener('pagehide',()=>stop());
  document.addEventListener('visibilitychange',()=>{if(document.hidden) stop('Câmera desligada ao sair da página. Clique em Ligar câmera para retomar.');});
  return {stop, get active(){return active;}};
}
export async function loadHandModel() {
  const {FilesetResolver,HandLandmarker} = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
  const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  return HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1});
}
