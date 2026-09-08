import {createCamera, loadHandModel} from '../../shared/camera.js';
const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');
let model = null, modelGeneration = 0;
const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
function clearModel(){modelGeneration++; model?.close(); model = null; ctx.clearRect(0,0,canvas.width,canvas.height);}
async function enableTracking(){
  clearModel();
  if (!$('tracking').checked || !camera.active) { $('tracking-status').textContent = camera.active ? 'Espelho ligado' : 'Câmera desligada'; return; }
  const token = modelGeneration;
  $('tracking-status').textContent = 'Baixando modelo de mãos…';
  try { const loaded = await loadHandModel(); if(token !== modelGeneration) {loaded.close();return;} model = loaded; }
  catch { if(token !== modelGeneration)return; $('tracking').checked = false; $('tracking-status').textContent = 'Pontos indisponíveis. O espelho continua funcionando. Marque a opção para tentar novamente.'; }
}
const camera = createCamera({video,startButton:$('start'),stopButton:$('stop'),status:$('status'),onStart(){
  $('stage').hidden=false;canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${canvas.width}/${canvas.height}`;enableTracking();
},onStop(){$('stage').hidden=true;clearModel();$('tracking-status').textContent='Câmera desligada';},onFrame(time){
  if(!model)return;
  let result;
  try {result=model.detectForVideo(video,time);} catch {clearModel();$('tracking').checked=false;$('tracking-status').textContent='Rastreamento interrompido. Marque a opção para tentar novamente.';return;}
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const message = result.landmarks.length ? 'Mão localizada · pontos estimados' : 'Nenhuma mão localizada. Ajuste a posição do aparelho e a luz, mantendo o violão confortável. Você pode continuar sem os pontos.';
  if ($('tracking-status').textContent !== message) $('tracking-status').textContent = message;
  for(const hand of result.landmarks){
    ctx.strokeStyle='#73dfb2';ctx.fillStyle='#f6ce81';ctx.lineWidth=3;
    for(const [a,b] of connections){ctx.beginPath();ctx.moveTo(hand[a].x*canvas.width,hand[a].y*canvas.height);ctx.lineTo(hand[b].x*canvas.width,hand[b].y*canvas.height);ctx.stroke();}
    for(const point of hand){ctx.beginPath();ctx.arc(point.x*canvas.width,point.y*canvas.height,4,0,Math.PI*2);ctx.fill();}
  }
}});
$('tracking').addEventListener('change',enableTracking);
$('mirror').addEventListener('change', () => {
  $('stage').classList.toggle('unmirrored', !$('mirror').checked);
});
let changes = 0;
function renderChanges() {
  const complete = changes === 5;
  const toAm = changes % 2 === 0;
  $('change-title').textContent = complete ? 'Cinco trocas realizadas' : `Troca ${changes + 1}: ${toAm ? 'Em → Am' : 'Am → Em'}`;
  $('change-help').textContent = complete
    ? 'Agora confira o que você percebeu na revisão abaixo. A contagem registra suas tentativas; o som é conferido por você.'
    : `Monte ${toAm ? 'Am' : 'Em'} e toque cada corda ${toAm ? 'da 5ª à 1ª' : 'da 6ª à 1ª'}. Observe se algum dedo encosta numa corda vizinha que deveria soar.`;
  $('change-status').textContent = `${changes} de 5 trocas feitas por você.${complete ? ' Siga para a revisão abaixo.' : ''}`;
  $('count-change').disabled = complete;
  $('undo-change').disabled = changes === 0;
}
$('count-change').addEventListener('click', () => {
  if (changes < 5) changes++;
  renderChanges();
  if (changes === 5) $('undo-change').focus();
});
$('undo-change').addEventListener('click', () => {
  if (changes > 0) changes--;
  renderChanges();
  if (changes === 0) $('count-change').focus();
});
function review() {
  const count = document.querySelectorAll('.review:checked').length;
  $('review-status').textContent = count === 3
    ? 'Revisão concluída por você. Repita o detalhe escolhido e registre sua prática no diário abaixo.'
    : `${count} de 3 etapas verificadas por você.`;
}
document.querySelectorAll('.review').forEach(input => input.addEventListener('change', review));
$('reset-review').addEventListener('click', () => {
  changes = 0;
  renderChanges();
  document.querySelectorAll('.review').forEach(input => input.checked = false);
  review();
});
