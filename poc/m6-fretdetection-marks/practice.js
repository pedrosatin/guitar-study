const $ = id => document.getElementById(id);
const sequence = [1, 5, 3, 12, 7];
let completed = 0;
const svg = $('fretboard');
const ns = 'http://www.w3.org/2000/svg';
function shape(tag, attributes, text) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  svg.append(node);
  return node;
}
// Equal-tempered fret positions: the twelfth fret halves the string length.
const edges = Array.from({length: 13}, (_, fret) => 55 + 1300 * (1 - 2 ** (-fret / 12)));
shape('rect', {x:55,y:55,width:650,height:94,fill:'#593e29',rx:3});
const highlight = shape('rect', {x:55,y:55,width:0,height:94,fill:'#e6b566',opacity:.7});
for (let fret = 0; fret <= 12; fret++) {
  shape('line', {x1:edges[fret],x2:edges[fret],y1:55,y2:149,stroke:fret ? '#b4bdcb' : '#f4e7c5','stroke-width':fret ? 2 : 7});
  if (fret) shape('text', {x:(edges[fret-1]+edges[fret])/2,y:178,fill:'#edf0f5','text-anchor':'middle','font-size':17}, fret);
}
for (let string = 0; string < 6; string++) shape('line', {x1:51,x2:709,y1:65+string*15,y2:65+string*15,stroke:'#eadbc1','stroke-width':2.5-string*.3});
shape('text', {x:18,y:30,fill:'#e6b566','font-size':17}, 'Pestana');
shape('text', {x:460,y:30,fill:'#edf0f5','font-size':17}, 'Contagem em direção ao corpo →');
function render() {
  const done = completed === sequence.length;
  $('target').textContent = done ? 'Cinco casas localizadas' : `Encontre a casa ${sequence[completed]}`;
  $('practice-status').textContent = `${completed} localizações confirmadas por você. ${completed} de 5 concluídas.`;
  $('found').disabled = done;
  $('hint').disabled = done;
  $('undo-found').disabled = completed === 0;
  $('practice-done').hidden = !done;
  $('practice-hint').hidden = true;
  $('hint').setAttribute('aria-expanded', 'false');
  $('hint').textContent = 'Mostrar ajuda para esta casa';
  highlight.setAttribute('width', 0);
}
$('hint').addEventListener('click', () => {
  if (completed === sequence.length) return;
  const show = $('practice-hint').hidden;
  const fret = sequence[completed];
  $('practice-hint').hidden = !show;
  $('hint').setAttribute('aria-expanded', String(show));
  $('hint').textContent = show ? 'Ocultar ajuda' : 'Mostrar ajuda para esta casa';
  $('hint-text').textContent = fret === 1
    ? 'Comece na pestana, junto às tarraxas. O primeiro espaço até a primeira barra de metal é a casa 1.'
    : `Conte ${fret} espaços desde a pestana em direção ao corpo. A casa ${fret} fica entre os trastes ${fret - 1} e ${fret}. Aponte para esse espaço, entre as barras de metal.`;
  highlight.setAttribute('x', edges[fret - 1]);
  highlight.setAttribute('width', show ? edges[fret] - edges[fret - 1] : 0);
});
$('found').addEventListener('click', () => {
  if (completed === sequence.length) return;
  completed++;
  render();
  if (completed === sequence.length) $('undo-found').focus();
});
$('undo-found').addEventListener('click', () => {
  if (!completed) return;
  completed--;
  render();
  if (!completed) $('found').focus();
});
$('restart').addEventListener('click', () => { completed = 0; render(); });
render();
