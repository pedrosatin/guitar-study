const {buildSync} = require('esbuild');
const {mkdirSync, cpSync, copyFileSync, readFileSync, writeFileSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname, '..');
const output = join(root, 'poc/m9-audio-tabs');
mkdirSync(output, {recursive: true});
buildSync({entryPoints: [join(__dirname, 'transcription-worker.js')], outfile: join(output, 'engine.js'), bundle: true, minify: true, platform: 'browser', target: 'es2022', legalComments: 'linked'});
cpSync(join(root, 'node_modules/@spotify/basic-pitch/model'), join(output, 'model'), {recursive: true});
copyFileSync(join(root, 'node_modules/@spotify/basic-pitch/LICENSE'), join(output, 'basic-pitch-license.txt'));
// The npm TensorFlow.js package declares Apache-2.0 but omits the license file.
writeFileSync(join(output, 'tensorflow-license.txt'), 'TensorFlow.js 3.21.0. Copyright Google LLC.\nhttps://github.com/tensorflow/tfjs\n\n' + readFileSync(join(root, 'node_modules/@spotify/basic-pitch/LICENSE'), 'utf8'));
console.log('Built local transcription engine and copied model/licenses.');
