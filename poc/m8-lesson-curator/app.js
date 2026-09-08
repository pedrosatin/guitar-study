(function () {
  const PROGRESS_KEY = "guitar-study-progress";
  let lessons = [];
  let chordBank = {};
  let progress = {};
  let currentLesson = null;
  let metronome = null;
  let practiceGeneration = 0;
  let returnFocus = null;
  let goalChecks = {};
  let plan = { minutes: 10, last: null, notes: {} };
  function persistPlan() {
    try { localStorage.setItem("guitar-study-plan-v1", JSON.stringify(plan)); }
    catch (_) { storageWarning(); }
  }
  function storageWarning() {
    document.getElementById("lesson-status").textContent = "Armazenamento indisponível. As alterações ficam apenas nesta sessão.";
    const status = document.getElementById("note-status");
    if (status) status.textContent = "Anotação mantida apenas nesta sessão.";
  }
  function renderSession() {
    const allocations = {5:[1,3,1],10:[2,6,2],20:[3,14,3]}[plan.minutes];
    document.getElementById("session-minutes").value = plan.minutes;
    document.getElementById("session-outline").textContent = `${allocations[0]} min para preparar a posição e revisar a instrução; ${allocations[1]} min para repetir um exercício da aula; ${allocations[2]} min para conferir os objetivos e anotar o próximo passo. Afine antes de praticar se precisar.`;
  }
  function resumeLesson() {
    return lessons.find(l => l.id === plan.last && !isComplete(l.id)) || lessons.find(l => !isComplete(l.id)) || lessons[0];
  }
  try { const saved = JSON.parse(localStorage.getItem("guitar-study-lesson-goals") || "{}"); if (saved && typeof saved === "object" && !Array.isArray(saved)) goalChecks = saved; } catch (_) {}

  function loadProgress() {
    try { progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
    catch (e) { progress = {}; }
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) progress = {};
    progress = Object.fromEntries(lessons.filter(l => typeof progress[l.id] === "string" && Number.isFinite(Date.parse(progress[l.id]))).map(l => [l.id, progress[l.id]]));
    goalChecks = Object.fromEntries(lessons.flatMap(l => l.goals.map((_, i) => [l.id + ":" + i, goalChecks[l.id + ":" + i] === true])));
    try {
      const saved = JSON.parse(localStorage.getItem("guitar-study-plan-v1") || "{}");
      if (saved && typeof saved === "object") {
        plan.minutes = [5,10,20].includes(saved.minutes) ? saved.minutes : 10;
        plan.last = lessons.some(l => l.id === saved.last) ? saved.last : null;
        for (const l of lessons) if (typeof saved.notes?.[l.id] === "string") plan.notes[l.id] = saved.notes[l.id].slice(0,500);
      }
    } catch (_) { storageWarning(); }
    renderSession();
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (_) { document.getElementById("lesson-status").textContent = "O navegador bloqueou o armazenamento. O progresso será mantido nesta sessão."; }
  }
  function isComplete(id) { return !!progress[id]; }

  function parseLessonData() {
    const raw = document.getElementById("lessons-data").textContent;
    lessons = JSON.parse(raw);
  }
  function parseChordData() {
    const raw = document.getElementById("chords-data").textContent;
    chordBank = JSON.parse(raw);
  }

  function renderProgress() {
    const total = lessons.length;
    const done = lessons.filter(l => isComplete(l.id)).length;
    document.getElementById("progress-label").textContent =
      `${done} de ${total} lições concluídas`;
    document.getElementById("progress-fill").style.width =
      total ? ((done / total) * 100) + "%" : "0%";
  }

  function renderCards() {
    const next = resumeLesson();
    const allDone = lessons.every(l => isComplete(l.id));
    document.getElementById("continue-lesson").textContent = allDone ? "Revisar aula 1" : `Continuar aula ${lessons.indexOf(next) + 1}: ${next.title}`;
    document.getElementById("next-guidance").textContent = allDone ? "Você concluiu as cinco aulas pela sua autoavaliação. Escolha uma para revisar ou pratique a troca que anotou como difícil. Repetir ajuda a conferir se o movimento continua confortável." : "Retome a última aula incompleta que abriu. Para avançar, confira os objetivos dentro dela. Uma dificuldade é motivo para repetir o exercício com calma.";
    const host = document.getElementById("cards");
    host.innerHTML = "";
    lessons.forEach((lesson, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.dataset.id = lesson.id;

      let chordsHtml = "";
      if (!lesson.chords || lesson.chords.length === 0) {
        chordsHtml = '<span class="chip none">nenhum acorde</span>';
      } else {
        chordsHtml = lesson.chords.map(c =>
          `<span class="chip">${c.name}</span>`).join("");
      }
      const done = isComplete(lesson.id);
      const prereqPending = lesson.prerequisites.filter(p => !isComplete(p));
      let statusHtml;
      if (done) {
        statusHtml = '<span class="status done">✓ completo</span>';
      } else if (prereqPending.length > 0) {
        statusHtml = `<span class="status locked">Antes de praticar, revise: ${prereqPending.map(id => escapeHtml(lessons.find(l => l.id === id)?.title || id)).join(", ")}</span>`;
      } else {
        statusHtml = '<span class="status todo">▸ a começar</span>';
      }

      card.innerHTML = `
        <div class="num">Lição ${idx + 1} · cerca de ${lesson.duration_minutes} min, divisíveis em sessões</div>
        <div class="title">${escapeHtml(lesson.title)}</div>
        <div class="meta">${statusHtml}</div>
        <div class="chips">${chordsHtml}</div>
      `;
      card.addEventListener("click", () => openLesson(lesson.id));
      host.appendChild(card);
    });
    renderProgress();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function openLesson(id) {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    stopMetronome();
    returnFocus = document.activeElement;
    document.querySelector(".modal").scrollTop = 0;
    currentLesson = lesson;
    plan.last = id; persistPlan();

    const idx = lessons.indexOf(lesson);
    document.getElementById("m-title").textContent =
      `Lição ${idx + 1}: ${lesson.title}`;
    document.getElementById("m-meta").textContent =
      `Tempo sugerido: ${lesson.duration_minutes} min, em uma ou mais sessões`;

    const body = document.getElementById("m-body");
    body.innerHTML = "";
    const guide = document.createElement("section"); guide.className = "lesson-guide";
    guide.innerHTML = `<h2>Sua sessão de ${plan.minutes} minutos</h2><p>${escapeHtml(document.getElementById("session-outline").textContent)}</p><p>Leia a instrução, pratique devagar e confira o som. Pulso é cada batida regular do clique. Conte 1, 2, 3, 4; esse grupo é um compasso. Uma volta passa por todas as cifras da sequência uma vez.</p><p>Dedos: 1 indicador, 2 médio, 3 anelar, 4 mínimo. A corda 1 é a mais fina; a 6 é a mais grossa. Casa é o espaço entre trastes. Corda solta soa sem pressionar uma casa. Um acorde reúne notas tocadas juntas.</p>`;
    body.append(guide);

    const left = document.createElement("div");
    left.className = "col";
    const right = document.createElement("div");
    right.className = "col";

    const theorySection = document.createElement("section");
    theorySection.innerHTML = `<h2>Teoria</h2>`;
    const theory = document.createElement("div");
    theory.className = "theory";
    theory.innerHTML = window.Markdown.render(lesson.theory);
    theorySection.appendChild(theory);
    left.appendChild(theorySection);

    const goalsSection = document.createElement("section");
    goalsSection.innerHTML = `<h2>Autoavaliação</h2><p>Marque o que conseguiu fazer no violão. O site não escuta nem avalia sua execução nesta página. Se faltar algum objetivo, repita só esse exercício na próxima sessão. Você pode desmarcar um objetivo para reabrir uma aula concluída.</p>`;
    lesson.goals.forEach((goal, index) => {
      const label = document.createElement("label"); label.className = "goal-check";
      const check = document.createElement("input"); check.type = "checkbox";
      const key = lesson.id + ":" + index; check.checked = goalChecks[key] === true || isComplete(lesson.id);
      const text = document.createElement("span"); text.textContent = goal;
      check.addEventListener("change", () => {
        document.querySelectorAll(".goal-check input").forEach((input, i) => { goalChecks[lesson.id + ":" + i] = input.checked; });
        if (!check.checked && isComplete(lesson.id)) { delete progress[lesson.id]; saveProgress(); renderCards(); }
        try { localStorage.setItem("guitar-study-lesson-goals", JSON.stringify(goalChecks)); } catch (_) { document.getElementById("lesson-status").textContent = "Autoavaliação disponível apenas nesta sessão."; }
        updateCompleteButton();
      });
      label.append(check, text); goalsSection.append(label);
    });
    const tools = document.createElement("p");
    tools.innerHTML = `<a href="../m1-theory-foundation/">Revisar fundamentos</a> · <a href="../m2-chords-diagram/">Treinar acordes</a> · <a href="../m4-pitch-detect/">Afinar violão</a>`;
    goalsSection.append(tools);
    const noteLabel = document.createElement("label"); noteLabel.htmlFor = "lesson-note"; noteLabel.textContent = "O que repetir na próxima sessão?";
    const note = document.createElement("textarea"); note.id = "lesson-note"; note.maxLength = 500; note.rows = 3; note.placeholder = "Ex.: repetir Em para Am devagar e conferir a corda 2."; note.value = plan.notes[id] || "";
    const noteStatus = document.createElement("p"); noteStatus.id = "note-status"; noteStatus.setAttribute("role", "status"); noteStatus.textContent = "Até 500 caracteres. Salvo automaticamente neste navegador.";
    note.addEventListener("input", () => { plan.notes[id] = note.value; noteStatus.textContent = "Anotação salva neste navegador."; persistPlan(); });
    goalsSection.append(noteLabel, note, noteStatus);


    if (lesson.chords && lesson.chords.length > 0) {
      const chordsSection = document.createElement("section");
      chordsSection.innerHTML = `<h2>Acordes</h2><p>Diagrama de frente: corda 6 à esquerda e 1 à direita. Círculo vazio = solta; X = não tocar; ponto = casa pressionada. A barra no topo é a pestana.</p>`;
      const row = document.createElement("div");
      row.className = "chords-row";
      lesson.chords.forEach(c => {
        const def = chordBank[c.name];
        const cardEl = document.createElement("div");
        cardEl.className = "chord-card" + (c.essential ? " essential" : "");
        const label = document.createElement("div");
        label.className = "name";
        label.textContent = c.name;
        cardEl.appendChild(label);
        if (def) {
          cardEl.appendChild(window.ChordSvg.render(def));
        } else {
          const empty = document.createElement("div");
          empty.className = "missing-chord";
          empty.textContent = "sem diagrama";
          cardEl.appendChild(empty);
        }
        row.appendChild(cardEl);
      });
      chordsSection.appendChild(row);
      right.appendChild(chordsSection);
    }

    if (lesson.practice && lesson.practice.chords && lesson.practice.chords.length > 0) {
      const practiceSection = document.createElement("section");
      practiceSection.innerHTML = `<h2>Pratique com cliques</h2>`;
      const box = document.createElement("div");
      box.className = "practice-box";
      box.innerHTML = `
        <div class="bpm-row">
          <label for="lesson-bpm">Velocidade em batidas por minuto</label>
          <input id="lesson-bpm" type="range" min="40" max="160" value="${lesson.practice.bpm}" />
          <span class="bpm-val">${lesson.practice.bpm}</span>
          <button class="btn count-in">Preparar e tocar</button>
          <button class="btn start">Tocar sem preparação</button>
          <button class="btn stop">Parar</button>
        </div>
        <p class="practice-status" role="status">Faça primeiro a sequência sem relógio. Quando estiver pronto, use Preparar e tocar: conte quatro cliques antes de começar. Cada cifra recebe quatro cliques. Repita a sequência quatro vezes. O som é só o clique; toque os acordes no violão.</p><div class="seq"></div>
        <div class="beat-dots">
          <span class="dot"></span><span class="dot"></span>
          <span class="dot"></span><span class="dot"></span>
        </div>
        <div class="practice-pattern">
          Compasso ${lesson.practice.timeSignature} · padrão: ${escapeHtml(lesson.practice.pattern || "—")}
        </div>
      `;
      practiceSection.appendChild(box);
      right.appendChild(practiceSection);

      const seqEl = box.querySelector(".seq");
      lesson.practice.chords.forEach((ch, i) => {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = ch;
        s.dataset.idx = i;
        seqEl.appendChild(s);
      });

      const dots = box.querySelectorAll(".beat-dots .dot");
      const bpmInput = box.querySelector("input[type=range]");
      const bpmVal = box.querySelector(".bpm-val");
      let bpm = lesson.practice.bpm;
      bpmInput.addEventListener("input", () => {
        bpm = parseInt(bpmInput.value, 10);
        bpmVal.textContent = bpm;

      });

      const startBtn = box.querySelector(".start");
      const stopBtn = box.querySelector(".stop");
      const countInBtn = box.querySelector(".count-in");
      const seqChunks = Array.from(seqEl.children);

      stopMetronome();

      async function begin(withCountIn) {
        stopMetronome();
        const generation = practiceGeneration;
        startBtn.disabled = countInBtn.disabled = bpmInput.disabled = true;
        try {
          await ensureAudio();
          if (generation !== practiceGeneration) return;
          let beat = withCountIn ? -4 : 0;
          const maxBeats = lesson.practice.chords.length * 16;
          let nextTick = audioCtx.currentTime + 0.05;
          let lastTick = performance.now();
          const status = box.querySelector(".practice-status");
          const tick = () => {
            if (performance.now() - lastTick > 1500) { stopMetronome(); status.textContent = "Prática interrompida porque a página ficou sem atualizar. Prepare-se e reinicie."; return; }
            lastTick = performance.now();
            if (audioCtx.currentTime < nextTick) return;
            if (beat >= maxBeats) { stopMetronome(); status.textContent = "Quatro voltas concluídas. Confira os objetivos da aula."; return; }
            click(beat % 4 === 0 ? 1320 : 880, audioCtx.currentTime + .005, .05);
            if (beat < 0) status.textContent = `Prepare-se: ${beat + 5} de 4`;
            else { updateBeat(beat, dots, seqChunks); status.textContent = `Volta ${Math.floor(beat / (lesson.practice.chords.length * 4)) + 1} de 4 · ${lesson.practice.chords[Math.floor(beat / 4) % lesson.practice.chords.length]} · pulso ${beat % 4 + 1}`; }
            beat++;
            nextTick += 60 / bpm;
            if (nextTick < audioCtx.currentTime) nextTick = audioCtx.currentTime + 60 / bpm;
          };
          metronome = {timerId: setInterval(() => { try { tick(); } catch (_) { stopMetronome(); status.textContent = "Áudio interrompido. Você pode praticar contando em voz alta ou tentar iniciar novamente."; } }, 20)};
        } catch (_) { if (generation !== practiceGeneration) return; stopMetronome(); box.querySelector(".practice-status").textContent = "Não foi possível iniciar o áudio. Confira a permissão de som do navegador."; }
      }
      countInBtn.addEventListener("click", () => begin(true));
      startBtn.addEventListener("click", () => begin(false));
      stopBtn.addEventListener("click", () => { stopMetronome(); box.querySelector(".practice-status").textContent = "Prática interrompida. Inicie quando estiver pronto."; });
    }

    if (lesson.song) {
      const songSection = document.createElement("section");
      songSection.innerHTML = `<h2>Sequência escrita para conferir</h2>`;
      const box = document.createElement("div");
      box.className = "song-box";
      box.innerHTML = `
        <div class="song-head">
          <div class="t">${escapeHtml(lesson.song.title)}</div>
          <div class="a">${escapeHtml(lesson.song.artist)}</div>
        </div>
        <div class="chordpro">${renderChordPro(lesson.song.chordPro)}</div>
      `;
      songSection.appendChild(box);
      right.appendChild(songSection);
    }

    if (!lesson.song && !(lesson.practice && lesson.practice.chords && lesson.practice.chords.length > 0)) {
      const empty = document.createElement("section");
      empty.innerHTML = `<h2>Prática</h2><p class="empty">Toque as seis cordas soltas, diga o nome de cada uma e repita cinco vezes. Use o módulo de fundamentos para conferir as notas de referência.</p>`;
      right.appendChild(empty);
    }

    body.appendChild(left);
    body.appendChild(right);
    body.appendChild(goalsSection);

    const done = isComplete(lesson.id);
    const completeBtn = document.getElementById("m-complete");
    completeBtn.textContent = done ? "Concluído (desfazer)" : "Marcar como completo";
    completeBtn.classList.toggle("primary", !done);

    updateCompleteButton();
    const modal = document.getElementById("modal"); modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    setPageInert(true);
    document.body.style.overflow = "hidden"; document.getElementById("m-close").focus();
  }

  function updateBeat(beat, dots, seqChunks) {
    const inMeasure = beat % 4;
    dots.forEach((d, i) => d.classList.toggle("on", i === inMeasure));
    if (seqChunks.length > 0) {
      const measure = Math.floor(beat / 4) % seqChunks.length;
      seqChunks.forEach((c, i) => c.classList.toggle("active", i === measure));
    }
  }

  function renderChordPro(text) {
    const lines = text.split("\n");
    return lines.map(line => {
      let html = "";
      let i = 0;
      while (i < line.length) {
        const ch = line[i];
        if (ch === "[") {
          const end = line.indexOf("]", i);
          if (end === -1) { html += escapeHtml(line.slice(i)); break; }
          const chord = line.slice(i + 1, end);
          html += `<span class="cp-chord">${escapeHtml(chord)}</span>`;
          i = end + 1;
        } else {
          html += escapeHtml(ch);
          i++;
        }
      }
      return `<span class="cp-br">${html}</span>`;
    }).join("");
  }

  let audioCtx = null;
  async function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    return audioCtx;
  }

  function click(freq, time, dur) {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function stopMetronome() {
    practiceGeneration++;
    document.querySelectorAll(".start, .count-in, #lesson-bpm").forEach(button => button.disabled = false);
    if (metronome) {
      clearInterval(metronome.timerId);
      metronome = null;
    }
    document.querySelectorAll(".beat-dots .dot.on").forEach(d => d.classList.remove("on"));
    document.querySelectorAll(".seq .ch.active").forEach(c => c.classList.remove("active"));
  }

  function setPageInert(inert) {
    for (const element of document.querySelectorAll('body > main, body > nav, body > aside')) {
      element.inert = inert;
    }
  }

  function closeModal() {
    if (!currentLesson) return;
    const modal = document.getElementById("modal"); modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    setPageInert(false); document.body.style.overflow = "";
    const cardId = returnFocus?.dataset?.id;
    renderCards();
    const focusTarget = cardId ? document.querySelector(`[data-id="${cardId}"]`) : returnFocus;
    if (focusTarget?.isConnected) focusTarget.focus(); else document.getElementById("continue-lesson").focus();
    stopMetronome();
    currentLesson = null;
  }

  function updateCompleteButton() {
    if (!currentLesson) return;
    const checks = Array.from(document.querySelectorAll(".goal-check input"));
    const done = isComplete(currentLesson.id);
    const btn = document.getElementById("m-complete");
    btn.disabled = !done && !checks.every(check => check.checked);
    document.getElementById("completion-status").textContent = done ? "Aula concluída pela sua autoavaliação. Feche para continuar o plano ou desfaça para revisar os objetivos." : `${checks.filter(check => check.checked).length} de ${checks.length} objetivos conferidos. Repita os que ainda faltam, no seu ritmo.`;
    btn.textContent = done ? "Desfazer conclusão" : btn.disabled ? "Confira os objetivos" : "Concluir aula";
  }

  function bindGlobal() {
    window.addEventListener("pagehide", stopMetronome);
    document.getElementById("session-minutes").addEventListener("change", event => { plan.minutes = Number(event.target.value); persistPlan(); renderSession(); });
    document.getElementById("continue-lesson").addEventListener("click", () => openLesson(resumeLesson().id));
    document.addEventListener("visibilitychange", () => { if (document.hidden) { stopMetronome(); const status = document.querySelector(".practice-status"); if (status) status.textContent = "Prática interrompida ao sair da página. Prepare-se e reinicie."; } });
    document.getElementById("modal").addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const items = [...event.currentTarget.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)")];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.getElementById("m-close").addEventListener("click", closeModal);
    document.getElementById("m-back").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    document.getElementById("m-complete").addEventListener("click", () => {
      if (!currentLesson) return;
      const id = currentLesson.id;
      if (isComplete(id)) {
        delete progress[id];
        currentLesson.goals.forEach((_, index) => { goalChecks[id + ":" + index] = false; });
        document.querySelectorAll(".goal-check input").forEach(check => check.checked = false);
        try { localStorage.setItem("guitar-study-lesson-goals", JSON.stringify(goalChecks)); } catch (_) {}
      } else {
        progress[id] = new Date().toISOString();
      }
      saveProgress();
      renderCards();
      const done = isComplete(id);
      const btn = document.getElementById("m-complete");
      btn.textContent = done ? "Concluído (desfazer)" : "Marcar como completo";
      btn.classList.toggle("primary", !done);
      updateCompleteButton();
    });
    document.getElementById("reset-progress").addEventListener("click", () => {
      if (!confirm("Apagar conclusões, objetivos e anotações destas cinco aulas? O diário e os outros módulos serão preservados.")) return;
      progress = {};
      goalChecks = {};
      plan.last = null; plan.notes = {}; persistPlan();
      try { localStorage.removeItem("guitar-study-lesson-goals"); } catch (_) {}
      saveProgress();
      renderCards();
    });
  }

  function init() {
    parseLessonData();
    parseChordData();
    loadProgress();
    bindGlobal();
    renderCards();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
