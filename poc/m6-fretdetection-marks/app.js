import {createCamera,loadHandModel} from '../../shared/camera.js';
const $=id=>document.getElementById(id), labels=[1,3,5,7,12];
const video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const capture=document.createElement('canvas'),pixels=capture.getContext('2d',{willReadFrequently:true});
let marks=[], marking=false, model=null, generation=0, finger=null, cursor={x:.5,y:.5};
function closeModel(){generation++;model?.close();model=null;finger=null;}
let previousMarks=[];
function setTrackingStatus(message){
  if($('tracking-status').textContent!==message)$('tracking-status').textContent=message;
}
async function tracking(){
  closeModel();
  if(!$('tracking').checked||!camera.active){setTrackingStatus('Estimativa do indicador desligada.');draw();return;}
  const token=generation;setTrackingStatus('Baixando o modelo de mãos. Você já pode marcar as referências.');
  try{
    const loaded=await loadHandModel();
    if(token!==generation){loaded.close();return;}
    model=loaded;setTrackingStatus('Estimativa do indicador ligada. Marque as cinco referências para comparar a posição.');
  }catch{
    if(token!==generation)return;
    $('tracking').checked=false;
    setTrackingStatus('Modelo indisponível. A câmera e o mapa manual continuam funcionando. Marque a opção para tentar novamente.');
  }
}
function updateMarkControls(){
  $('undo-mark').disabled=!camera.active||marks.length===0;
  $('cancel-mark').disabled=!camera.active||!marking;
  $('suggest').disabled=!camera.active||marking;
}
function clear(){
  marks=[];previousMarks=[];marking=false;finger=null;cursor={x:.5,y:.5};
  $('map-status').textContent='Nenhuma referência marcada.';updateMarkControls();draw();
}
const camera=createCamera({video,startButton:$('start'),stopButton:$('stop'),status:$('status'),onStart(){
  $('stage').hidden=false;canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${canvas.width}/${canvas.height}`;
  ['calibrate','clear','suggest','tracking'].forEach(id=>$(id).disabled=false);clear();tracking();
},onStop(){
  $('stage').hidden=true;closeModel();clear();
  ['calibrate','clear','suggest','tracking','undo-mark','cancel-mark'].forEach(id=>$(id).disabled=true);
  $('tracking').checked=false;setTrackingStatus('Estimativa do indicador desligada.');
},onFrame(time){
  if(model){
    try{const result=model.detectForVideo(video,time);const tip=result.landmarks[0]?.[8];finger=tip?{x:1-tip.x,y:tip.y}:null;}
    catch{closeModel();$('tracking').checked=false;setTrackingStatus('Estimativa interrompida. O mapa manual continua disponível. Marque a opção para tentar novamente.');}
  }
  draw();
}});
$('tracking').disabled=true;
$('tracking').addEventListener('change',tracking);
$('calibrate').addEventListener('click',()=>{
  if(!camera.active)return;
  if(!marking)previousMarks=marks.map(mark=>({...mark}));
  marks=[];marking=true;cursor={x:.5,y:.5};promptMark();canvas.focus();
});
$('clear').addEventListener('click',clear);
$('undo-mark').addEventListener('click',()=>{
  if(!camera.active||!marks.length)return;
  if(!marking)previousMarks=marks.map(mark=>({...mark}));
  marks.pop();marking=true;promptMark();canvas.focus();
});
$('cancel-mark').addEventListener('click',()=>{
  if(!marking)return;
  marks=previousMarks;previousMarks=[];marking=false;
  $('map-status').textContent=marks.length===5?'Marcação cancelada. Mapa anterior com cinco referências restaurado.':'Marcação cancelada. Nenhuma referência marcada.';
  updateMarkControls();draw();$('calibrate').focus();
});
function promptMark(prefix=''){
  $('map-status').textContent=`${prefix}Marque o centro da casa ${labels[marks.length]} na mesma corda usada nas outras referências. ${marks.length} de 5 marcadas.`;
  updateMarkControls();draw();
}
function addMark(point){
  if(!marking||!camera.active)return;
  if(marks.some(mark=>Math.hypot(mark.x-point.x,mark.y-point.y)<.025)){
    promptMark('Essa referência está muito perto de outra. Tente novamente. ');return;
  }
  if(marks.length>0){
    const step=Math.sign(point.x-marks.at(-1).x);
    const direction=marks.length>1?Math.sign(marks[1].x-marks[0].x):step;
    if(!step||step!==direction){
      promptMark('A ordem ficou inconsistente; essa marca não foi salva. Continue em direção ao corpo do violão. ');return;
    }
  }
  marks.push({...point});
  if(marks.length===5){
    marking=false;previousMarks=[];
    $('map-status').textContent='Mapa com cinco referências. Confira as etiquetas. Refaça se mover o instrumento.';
    updateMarkControls();
  }else promptMark();
  draw();
}
canvas.addEventListener('click',event=>{const bounds=canvas.getBoundingClientRect();addMark({x:(event.clientX-bounds.left)/bounds.width,y:(event.clientY-bounds.top)/bounds.height});});
canvas.addEventListener('keydown',event=>{
  if(!marking)return;const moves={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};
  if(moves[event.key]){event.preventDefault();cursor.x=Math.max(0,Math.min(1,cursor.x+moves[event.key][0]));cursor.y=Math.max(0,Math.min(1,cursor.y+moves[event.key][1]));draw();}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();addMark(cursor);}
});
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Keep labels readable in CSS pixels when the camera bitmap shrinks on mobile.
  const scale=canvas.width/(canvas.getBoundingClientRect().width||canvas.width);
  ctx.font=`bold ${14*scale}px system-ui`;ctx.textBaseline='middle';
  marks.forEach((mark,i)=>{
    const x=mark.x*canvas.width,y=mark.y*canvas.height,text=`Casa ${labels[i]}`;
    const width=ctx.measureText(text).width+12*scale,height=24*scale;
    const left=Math.max(0,Math.min(canvas.width-width,x-width/2));
    const top=Math.max(0,Math.min(canvas.height-height,y+(i%2?10:-34)*scale));
    ctx.fillStyle='#73dfb2';ctx.beginPath();ctx.arc(x,y,4*scale,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#10171b';ctx.fillRect(left,top,width,height);
    ctx.fillStyle='#fff';ctx.fillText(text,left+6*scale,top+height/2);
  });
  if(marking){ctx.strokeStyle='#fff';ctx.lineWidth=2*scale;ctx.strokeRect(cursor.x*canvas.width-8*scale,cursor.y*canvas.height-8*scale,16*scale,16*scale);}
  if(finger){ctx.fillStyle='#f6ce81';ctx.beginPath();ctx.arc(finger.x*canvas.width,finger.y*canvas.height,6*scale,0,Math.PI*2);ctx.fill();}
  if(model&&(marking||marks.length<5))setTrackingStatus('Estimativa do indicador ligada. Conclua as cinco referências para comparar a posição.');
  if(model&&!marking&&marks.length===5){
    let nearest=-1,distance=Infinity;
    if(finger) marks.forEach((mark,i)=>{const d=Math.hypot((finger.x-mark.x)*canvas.width,(finger.y-mark.y)*canvas.height);if(d<distance){distance=d;nearest=i;}});
    setTrackingStatus(nearest>=0&&distance<canvas.width*.12?`Indicador próximo à referência da casa ${labels[nearest]}. Estimativa visual, confira no instrumento.`:'Indicador longe das referências ou não localizado. Ajuste o aparelho e a luz mantendo o violão confortável, ou continue pelo mapa manual.');
  }
}
$('hue').addEventListener('input',()=>{$('hue-value').textContent=`${$('hue').value}°`;});
// Connected components on a small pixel grid keep separated marks separate.
function colorMarks(){
  capture.width=320;capture.height=Math.round(320*video.videoHeight/video.videoWidth);
  pixels.save();pixels.translate(320,0);pixels.scale(-1,1);pixels.drawImage(video,0,0,capture.width,capture.height);pixels.restore();
  const {data}=pixels.getImageData(0,0,capture.width,capture.height),w=capture.width,h=capture.height;
  const mask=new Uint8Array(w*h),target=Number($('hue').value);
  for(let i=0;i<mask.length;i++){
    const r=data[i*4]/255,g=data[i*4+1]/255,b=data[i*4+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    if(max<.25||d===0||d/max<.5)continue;
    let hue=max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);hue=(hue+360)%360;
    const delta=Math.abs(hue-target);if(Math.min(delta,360-delta)<=18)mask[i]=1;
  }
  const found=[];
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;const stack=[i];mask[i]=0;let count=0,sx=0,sy=0;
    while(stack.length){const n=stack.pop(),x=n%w,y=Math.floor(n/w);count++;sx+=x;sy+=y;
      for(const next of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<h-1?n+w:-1])if(next>=0&&mask[next]){mask[next]=0;stack.push(next);}}
    if(count>=8)found.push({x:sx/count/w,y:sy/count/h});
  }
  return found.sort((a,b)=>a.x-b.x);
}
$('suggest').addEventListener('click',()=>{
  if(!camera.active||marking)return;
  let found;
  try{found=colorMarks();}catch{$('map-status').textContent='Não foi possível analisar a imagem. O mapa anterior foi mantido. Use Marcar referências.';return;}
  if(found.length!==5){$('map-status').textContent=`Encontradas ${found.length} manchas. São necessárias exatamente 5. O mapa anterior foi mantido. Ajuste cor, luz ou use Marcar referências.`;return;}
  marks=$('direction').value==='reverse'?found.reverse():found;marking=false;previousMarks=[];updateMarkControls();$('map-status').textContent='Mapa sugerido. Confira se cada etiqueta está na casa correta. Use Marcar referências para corrigir.';draw();
});
