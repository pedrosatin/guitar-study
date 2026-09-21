# Guitar Study

A static application for learning and practicing guitar. The home panel brings together nine modules, a suggested 15-minute routine, a daily goal, and a practice journal. The project uses plain HTML, CSS, and JavaScript, with no framework. The files needed to run it are already included in the repository.

## Running it

Clone the repository and enter the folder:

```sh
git clone https://github.com/pedrosatin/guitar-study.git
cd guitar-study
```

With Python 3 installed, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/. You can also run `npm run dev`.
Don't open the HTML files directly via `file://`: the JavaScript modules and media access need a server. Microphone and camera only work on localhost or HTTPS, after explicit permission.

## Pages

| Page | What to do |
| --- | --- |
| [My study](index.html) | Set a daily goal, pick a module, and check/export the journal |
| [Fundamentals](poc/m1-theory-foundation/index.html) | Follow the first lesson, play an open string and the first fret, check your practice, and answer five questions |
| [Chords and changes](poc/m2-chords-diagram/index.html) | Form Em and Am, check the strings, switch without a clock, then try a one-minute drill |
| [Chord sheets and metronome](poc/m3-chordpro-player/index.html) | Count clicks, play Em, and switch between Em/Am with lead-in, pause, and self-assessment |
| [Tuner](poc/m4-pitch-detect/index.html) | Identify strings and tuning pegs, adjust one string at a time, and follow the six checks |
| [Practice mirror](poc/m5-mediapipe-mirror/index.html) | Watch five Em/Am switches, check the strings, and review your practice with an optional camera |
| [Fretboard map](poc/m6-fretdetection-marks/index.html) | Count frets in the diagram, check five positions, and mark references with an optional camera |
| [Rhythm training](poc/m7-onset-rhythm/index.html) | Practice for 30 seconds with a lead-in, then check speed and consistency by taps or microphone |
| [Study plan](poc/m8-lesson-curator/index.html) | Organize 5, 10, or 20-minute sessions, resume lessons, and note what to repeat |
| [Audio to tablature](poc/m9-audio-tabs/index.html) | Open or record audio, transcribe up to 30 seconds, review note positions, and export TXT/MIDI |

Start with Fundamentals and the Study plan. Use the tuner before playing, and practice changes at a tempo where you can keep the sound clean.

## Progress and privacy

The journal records minutes you enter and your notes. Completing the full 60-second drill in Chords and changes adds a minute automatically when you save the result, so avoid logging that same minute again in the form at the bottom of the page.

Data stays in this browser's and this origin's local storage. Clearing site data erases progress. The panel exports goal and journal data as JSON; quiz results, Fundamentals self-assessments, chord-change records, and lesson completion have their own storage and are not included in that export. There is no cross-device sync or import.

Audio and video are processed on-device. The camera only opens on the student's action. Hand landmarks use MediaPipe, downloaded from jsDelivr and Google on demand. If the download fails, the mirror and manual marking still work.

## Current limitations

- Reference sounds are synthesized.
- The tuner analyzes a single isolated note. Chords, noise, and harmonics can produce wrong readings.
- Rhythm training estimates tempo and consistency from volume spikes. It does not measure exact sync with a recording.
- Chord sheets use a fixed duration per chord for exercises, without inferring the song's actual rhythm.
- Camera and marking are experimental visual references. They do not assess posture, finger pressure, string played, or chord correctness.
- Clean sound and exercise completion rely on self-assessment.
- Tests with simulated media don't prove accuracy with a real instrument.

## Tests

Use Node.js 20 or later and npm for the test tooling. The app itself runs on the files already included in the repo. The transcriber has a generated JavaScript bundle and a local model.

```sh
npm ci
npm test
# With the server running in another terminal and Chromium installed:
npm run test:browser
npm run test:a11y
npm run test:transcriber
# Optional, Linux/X11 graphical session with xdotool:
npm run test:zoom
```

Browser tests use `/usr/bin/chromium`. Set `CHROMIUM_PATH` for a different path, or `TEST_BASE_URL` for a different server. Screenshots are saved to `test-results/`.

## Structure and development

- `index.html`: the panel, goal, and practice history.
- `poc/`: nine independent modules, each with its own HTML, styles, scripts, and assets.
- `shared/`: module catalog, navigation, journal, storage, camera, and common styles.
- `tests/`: logic, audio, and browser integration tests.

`shared/study.css` holds the shared styles. Colors, typography, and spacing live in `shared/tokens.css`. Exercise-specific styles stay in each module's own directory.

Navigation is assembled by `shared/shell.js` from `shared/catalog.js`. The journal uses `shared/progress.js`; modules may keep their own exercise state. Preserve storage keys when changing the data format, or implement a migration.

To contribute, create a branch, implement the change, and run the affected tests. Changes to shared components should pass `npm test` and `npm run test:browser`. Use `npm run test:visual` to check the flow between pages on desktop and emulated mobile.

Tests use disposable browser profiles. Audio and camera are exercised with synthetic data; accuracy with a real instrument and clarity of the instructions still need validation with real people.

## Deploy

Available at https://pedrosatin.github.io/guitar-study/.

GitHub Actions publishes automatically on every push to `main`. You can also run the "Deploy GitHub Pages" workflow manually. The repository is public; the deployed site and its runtime files are public as well.

The `python3 scripts/package-site.py` script prepares `_site/` with only the tracked application files, from `index.html`, `shared/`, and `poc/`. There's no build step, backend, or database on the server. To add new assets, commit them to Git and check the extensions accepted by the script. The `_site/` directory is generated and gitignored.

GitHub Pages provides HTTPS. Microphone and camera remain subject to browser permission. Progress stays in each person's browser; records made on localhost are not transferred to the published site.

## Experimental transcription

The `poc/m9-audio-tabs/` module uses Basic Pitch 1.0.1 and TensorFlow.js 3.21.0, both under the Apache-2.0 license. `engine.js` and `model/` are served by the site itself, only when an analysis starts. Execution runs in JavaScript on the CPU inside a Web Worker, with no WebAssembly and no audio sent anywhere. Each analysis terminates the worker afterward to free the model and its tensors.

To regenerate the bundle and copy the model after engine changes:

```sh
npm ci
npm run build:transcriber
npm run test:transcriber
```

The worker's source lives in `scripts/transcription-worker.js`; the build script is `scripts/build-transcriber.cjs`. Commit the generated bundle, the model, and their licenses along with your changes. Deployment only copies these files.

Accepted files depend on the browser's codecs, up to 20 MB and 5 minutes. Analysis uses a 0.5-to-30-second slice converted to mono at 22050 Hz, with a 3-minute processing cap and cancellation support. Recording stops after 30 seconds, or when the tab is hidden or the page is closed. Audio and results are not persisted, so export before closing.

`tablature.js` suggests positions in standard tuning, avoids stacking overlapping notes on one string, and leaves unplaceable notes available for review. Conflicting manual changes are flagged. The review view lets you change string/fret and delete notes; it doesn't support inserting notes or editing pitch/duration. TXT export shows seconds without rhythmic notation; MIDI preserves detected timing without inferring measures or playing technique. Full-band audio doesn't go through instrument separation.

## License

MIT. See [LICENSE](LICENSE).
