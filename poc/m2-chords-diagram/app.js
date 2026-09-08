(function () {
  var TUNING = [40, 45, 50, 55, 59, 64];
  const CHORD_NAMES = { Em: "Mi menor", Am: "Lá menor", C: "Dó maior", G: "Sol maior", D: "Ré maior", Dm: "Ré menor" };
  const FINGER_NAMES = { 1: "indicador", 2: "médio", 3: "anelar", 4: "mínimo" };
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function isOpen(f) { return Number(f) === 0; }
  function isMuted(f) { return f === "x" || f === "X" || f < 0; }

  function renderChord(chord) {
    var W = 200, H = 245;
    var padTop = 45, padBottom = 30, padLeft = 36, padRight = 14;
    var numStrings = 6, numFrets = 5;
    var stringSpacing = (W - padLeft - padRight) / (numStrings - 1);
    var fretSpacing = (H - padTop - padBottom) / numFrets;
    var parts = [];
    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" width="100%" height="auto">');

    parts.push('<text x="118" y="12" text-anchor="middle" fill="currentColor" font-size="11">Cabeça ↑</text>');
    for (var n = 0; n < numStrings; n++) {
      parts.push('<text x="' + (padLeft + n * stringSpacing) + '" y="' + (H - 8) + '" text-anchor="middle" fill="currentColor" font-size="12">' + (6 - n) + '</text>');
    }
    for (var f = 0; f < numFrets; f++) {
      parts.push('<text x="4" y="' + (padTop + (f + .5) * fretSpacing + 4) + '" fill="currentColor" font-size="11">' + (chord.baseFret + f) + 'ª</text>');
    }
    for (var i = 0; i <= numFrets; i++) {
      var y = padTop + i * fretSpacing;
      var sw = (chord.baseFret === 1 && i === 0) ? 3 : 1;
      parts.push('<line x1="' + padLeft + '" y1="' + y + '" x2="' + (W - padRight) + '" y2="' + y + '" stroke="currentColor" stroke-width="' + sw + '"/>');
    }

    for (var s = 0; s < numStrings; s++) {
      var xs = padLeft + s * stringSpacing;
      parts.push('<line x1="' + xs + '" y1="' + padTop + '" x2="' + xs + '" y2="' + (H - padBottom) + '" stroke="currentColor" stroke-width="' + (2 - s * .2) + '"/>');
    }

    if (chord.baseFret > 1) {
      parts.push('<text x="' + (padLeft - 8) + '" y="' + (padTop + fretSpacing / 2 + 4) + '" text-anchor="end" fill="#9ca3af" font-size="11" font-family="sans-serif">' + chord.baseFret + '</text>');
    }

    chord.frets.forEach(function (f, i) {
      var cx = padLeft + i * stringSpacing;
      if (isMuted(f)) {
        parts.push('<text x="' + cx + '" y="' + (padTop - 10) + '" text-anchor="middle" fill="#facc15" font-size="13" font-weight="700" font-family="sans-serif">X</text>');
      } else if (isOpen(f)) {
        parts.push('<circle cx="' + cx + '" cy="' + (padTop - 14) + '" r="6" fill="none" stroke="#22c55e" stroke-width="1.6"/>');
      } else {
        var fretAbs = Number(f) - (chord.baseFret - 1);
        var cy = padTop + (fretAbs - 0.5) * fretSpacing;
        parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="#22c55e"/>');
        var fing = chord.fingers[i];
        if (fing !== undefined && fing !== "x" && fing !== 0 && fing !== "0") {
          parts.push('<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" fill="#0b0e14" font-size="11" font-weight="700" font-family="sans-serif">' + fing + '</text>');
        }
      }
    });

    (chord.barres || []).forEach(function (b) {
      var fret = b.fret !== undefined ? b.fret : b;
      var from = b.from !== undefined ? b.from : 0;
      var to = b.to !== undefined ? b.to : 5;
      var fretAbs = Number(fret) - (chord.baseFret - 1);
      var cy = padTop + (fretAbs - 0.5) * fretSpacing;
      var x1 = padLeft + from * stringSpacing;
      var x2 = padLeft + to * stringSpacing;
      parts.push('<rect x="' + (x1 - 9) + '" y="' + (cy - 7) + '" width="' + (x2 - x1 + 18) + '" height="14" rx="4" fill="#22c55e"/>');
    });

    parts.push('</svg>');
    return parts.join('');
  }

  let audioCtx = null;
  let playback = 0;
  let activeNodes = [];
  let activeStatus = null;
  let activeButton = null;

  function stopAudio() {
    playback++;
    activeNodes.forEach(node => { try { node.stop(); } catch (_) {} });
    activeNodes = [];
    if (activeButton) activeButton.classList.remove("playing");
    if (activeStatus) activeStatus.textContent = "Reprodução encerrada. Você pode ouvir novamente.";
    activeButton = activeStatus = null;
  }

  async function playChord(chord, separate, status, button) {
    stopAudio();
    const request = playback;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("Áudio indisponível");
      if (!audioCtx || audioCtx.state === "closed") audioCtx = new AC();
      await audioCtx.resume();
      if (request !== playback || document.hidden) return;
      const strings = chord.frets.map((f, i) => ({ fret: f, index: i })).filter(item => !isMuted(item.fret));
      activeStatus = status; activeButton = button; button.classList.add("playing");
      status.textContent = `Ouvindo ${chord.name}, ${CHORD_NAMES[chord.name]}${separate ? ", uma corda por vez" : ""}. Referência eletrônica; o timbre é diferente do violão.`;
      strings.forEach((item, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t0 = audioCtx.currentTime + i * (separate ? .65 : .05);
        osc.type = "triangle";
        osc.frequency.value = midiToFreq(TUNING[item.index] + Number(item.fret));
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(.09, t0 + .012);
        gain.gain.exponentialRampToValueAtTime(.001, t0 + .6);
        osc.connect(gain).connect(audioCtx.destination);
        activeNodes.push(osc);
        osc.onended = () => {
          osc.disconnect(); gain.disconnect();
          activeNodes = activeNodes.filter(node => node !== osc);
          if (request === playback && !activeNodes.length) {
            button.classList.remove("playing");
            status.textContent = `Referência de ${chord.name} encerrada. Confira as cordas no seu instrumento.`;
            activeStatus = activeButton = null;
          }
        };
        osc.start(t0); osc.stop(t0 + .62);
      });
    } catch (_) {
      if (request !== playback) return;
      status.textContent = "Não foi possível reproduzir áudio. Confira o volume e a permissão de som do navegador. Você pode continuar pelas instruções escritas.";
    }
  }

  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAudio(); });
  window.addEventListener("pagehide", () => {
    stopAudio();
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = null;
  });

  function chordDescription(chord) {
    return chord.frets.map((f, i) => `${6 - i}ª corda: ${isMuted(f) ? "não tocar" : isOpen(f) ? "solta" : "casa " + f + ", dedo " + chord.fingers[i] + " " + FINGER_NAMES[chord.fingers[i]]}`).join("; ");
  }

  function makeDiagram(chord) {
    const diagram = document.createElement("div");
    diagram.className = "diagram";
    diagram.innerHTML = renderChord(chord);
    const svg = diagram.querySelector("svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", chord.name + ", " + CHORD_NAMES[chord.name] + ". " + chordDescription(chord));
    return diagram;
  }

  function buildCards(data) {
    for (const chord of data) {
      const card = document.createElement("article"); card.className = "card";
      const title = document.createElement("h3"); title.textContent = chord.name + ", " + CHORD_NAMES[chord.name];
      const layout = document.createElement("div"); layout.className = "chord-layout";
      const diagramWrap = document.createElement("div");
      const caption = document.createElement("p"); caption.className = "caption"; caption.textContent = "Cordas embaixo: 6 grossa → 1 fina. Casas à esquerda. Números nos pontos são dedos.";
      diagramWrap.append(makeDiagram(chord), caption);
      const instructions = document.createElement("div");
      const list = document.createElement("ol");
      chord.frets.map((f, i) => ({fret:f, index:i, finger:chord.fingers[i]}))
        .filter(item => !isOpen(item.fret) && !isMuted(item.fret))
        .sort((a,b) => a.finger - b.finger)
        .forEach(item => {
          const li = document.createElement("li");
          li.textContent = `Dedo ${item.finger}, ${FINGER_NAMES[item.finger]}, na ${6 - item.index}ª corda, ${item.fret}ª casa.`;
          list.append(li);
        });
      const open = document.createElement("p");
      open.textContent = "Deixe soltas as cordas " + chord.frets.map((f,i) => isOpen(f) ? `${6-i}ª` : null).filter(Boolean).join(", ") + ". Evite encostar nelas com os outros dedos.";
      const range = document.createElement("p");
      const first = 6 - chord.frets.findIndex(f => !isMuted(f));
      range.textContent = `Toque da ${first}ª à 1ª corda.` + (first < 6 ? ` Deixe ${first === 5 ? "a 6ª sem soar" : "a 6ª e a 5ª sem soar"}.` : " Todas as seis devem soar.");
      instructions.append(list, open, range);
      layout.append(diagramWrap, instructions); card.append(title, layout);
      const buttons = document.createElement("div"); buttons.className = "audio-controls";
      const status = document.createElement("p"); status.className = "audio-status"; status.setAttribute("role", "status");
      status.textContent = "Referência eletrônica: o timbre é diferente do violão. A página não escuta sua execução. Depois de ouvir, confira uma corda por vez no seu instrumento.";
      for (const separate of [false, true]) {
        const button = document.createElement("button"); button.type = "button";
        button.textContent = separate ? "Ouvir corda por corda" : "Ouvir " + chord.name;
        button.setAttribute("aria-label", separate ? "Ouvir " + chord.name + " corda por corda" : "Ouvir " + chord.name);
        button.addEventListener("click", () => playChord(chord, separate, status, button));
        buttons.append(button);
      }
      const stop = document.createElement("button"); stop.type = "button"; stop.textContent = "Parar som"; stop.addEventListener("click", stopAudio); buttons.append(stop);
      card.append(buttons, status);
      document.getElementById(chord.name === "Em" ? "first-chord" : chord.name === "Am" ? "second-chord" : "grid").append(card);
    }
  }

  function initPreview(data) {
    const a = document.getElementById("chord-a"), b = document.getElementById("chord-b");
    function update() {
      const host = document.getElementById("drill-preview"); host.replaceChildren();
      for (const select of [a,b]) {
        const chord = data.find(item => item.name === select.value);
        if (!chord) continue;
        const figure = document.createElement("figure");
        const caption = document.createElement("figcaption"); caption.textContent = chord.name + ", " + CHORD_NAMES[chord.name];
        figure.append(caption, makeDiagram(chord)); host.append(figure);
      }
    }
    [a,b].forEach(select => select.addEventListener("change", update)); update();
  }

  function load() {
    const data = JSON.parse(document.getElementById("chords-data").textContent);
    buildCards(data);
    window.initChordDrill(data);
    for (const select of document.querySelectorAll("#chord-a, #chord-b")) {
      for (const option of select.options) option.textContent = option.value + ", " + CHORD_NAMES[option.value];
    }
    initPreview(data);
    document.querySelector('a[href="#sound-help"]').addEventListener("click", () => { document.getElementById("sound-help").open = true; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
