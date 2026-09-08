/* Bundled by build-transcriber.cjs. One worker per run bounds model/tensor lifetime. */
import * as tf from '@tensorflow/tfjs';
import {BasicPitch, outputToNotesPoly, noteFramesToTime} from '@spotify/basic-pitch';
self.onmessage = async ({data}) => {
  try {
    // CPU also works on devices without WebGL and inside a dedicated worker.
    await tf.setBackend('cpu');
    await tf.ready();
    self.postMessage({type: 'progress', value: 0});
    const model = new BasicPitch(new URL('model/model.json', self.location.href).href);
    const frames = [], onsets = [];
    await model.evaluateModel(data.samples, (f, o) => { frames.push(...f); onsets.push(...o); }, value => self.postMessage({type: 'progress', value}));
    const notes = noteFramesToTime(outputToNotesPoly(frames, onsets, .5, .3, 8));
    self.postMessage({type: 'result', notes});
  } catch (error) {
    self.postMessage({type: 'error', message: 'Não foi possível analisar o áudio. Recarregue a página e tente um trecho menor.'});
  }
};
