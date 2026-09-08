(function () {
  "use strict";
  window.initChordDrill = function (data) {
    const a = document.getElementById("chord-a"), b = document.getElementById("chord-b");
    const start = document.getElementById("start-drill"), stop = document.getElementById("stop-drill");
    const result = document.getElementById("drill-result"), status = document.getElementById("drill-status");
    const countInput = document.getElementById("drill-count"), clock = document.getElementById("drill-time");
    const discard = document.createElement("button");
    discard.type = "button"; discard.id = "discard-drill"; discard.textContent = "Descartar resultado";
    result.appendChild(discard);
    const recent = document.createElement("div"); recent.id = "drill-history";
    document.getElementById("drill-best").after(recent);
    const storageNote = document.createElement("p"); storageNote.id = "drill-storage";
    recent.after(storageNote);
    const key = "guitar-study-chord-drills";
    let history = [], phase = "idle", timer = null, deadline = 0, activePair = null;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(stored)) history = stored.filter(entry => entry && typeof entry.pair === "string" && Number.isInteger(entry.count) && entry.count >= 0 && entry.count <= 300).slice(-100);
    } catch (_) { storageNote.textContent = "O histórico não pôde ser carregado. Novos resultados serão mantidos nesta página se o armazenamento estiver bloqueado."; }
    [a, b].forEach(select => data.forEach(chord => select.add(new Option(chord.name, chord.name))));
    a.value = "Em"; b.value = "Am";
    countInput.value = "";
    start.textContent = "Preparar e iniciar 1 minuto";
    function pairKey() { return [a.value, b.value].sort().join("/"); }
    function showHistory() {
      const entries = history.filter(entry => entry.pair === pairKey());
      document.getElementById("drill-best").textContent = entries.length ? `Seu melhor resultado neste par: ${Math.max(...entries.map(entry => entry.count))} trocas por minuto.` : "Ainda não há resultados para este par.";
      recent.replaceChildren();
      if (!entries.length) return;
      const title = document.createElement("h3"); title.textContent = "Últimos resultados deste par";
      const list = document.createElement("ul");
      entries.slice(-5).reverse().forEach(entry => {
        const item = document.createElement("li");
        const date = typeof entry.date === "string" && Number.isFinite(Date.parse(entry.date)) ? new Date(entry.date).toLocaleString("pt-BR") : "Data não registrada";
        item.textContent = `${date} · ${entry.count} trocas em 1 minuto`;
        list.appendChild(item);
      });
      recent.append(title, list);
    }
    function controls() {
      const locked = phase !== "idle";
      start.disabled = a.disabled = b.disabled = locked;
      stop.disabled = phase !== "preparing" && phase !== "running";
      result.hidden = phase !== "pending";
    }
    function reset(message) {
      clearInterval(timer); timer = null; activePair = null; phase = "idle";
      countInput.value = ""; clock.textContent = "60 segundos";
      controls(); status.textContent = message;
    }
    function tick() {
      const now = performance.now();
      if (phase === "preparing" && now >= deadline) {
        phase = "running";
        deadline += 60000;
        status.textContent = `Comece: alterne ${activePair.first} e ${activePair.second}. Conte cada troca com som limpo.`;
      }
      const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
      clock.textContent = phase === "preparing" ? `Começa em ${seconds} segundos` : `${seconds} segundos`;
      if (phase === "running" && seconds === 0) {
        clearInterval(timer); timer = null; phase = "pending";
        controls(); countInput.value = "";
        status.textContent = `Minuto concluído: ${activePair.first} / ${activePair.second}. Informe as trocas limpas; zero também vale. Salve ou descarte antes de iniciar outro treino.`;
        countInput.focus();
      }
    }
    start.addEventListener("click", () => {
      if (phase !== "idle") return;
      if (a.value === b.value) { status.textContent = "Escolha dois acordes diferentes."; return; }
      activePair = { key: pairKey(), first: a.value, second: b.value };
      phase = "preparing"; countInput.value = "";
      deadline = performance.now() + 5000;
      status.textContent = `Prepare ${a.value} no violão. Você tem 5 segundos; a montagem inicial não conta como troca.`;
      controls(); tick(); timer = setInterval(tick, 100);
    });
    stop.addEventListener("click", () => {
      if (phase === "preparing" || phase === "running") reset("Treino cancelado. Nenhum resultado ou minuto foi registrado.");
    });
    discard.addEventListener("click", () => {
      if (phase === "pending") { reset("Resultado descartado. Nenhum minuto foi registrado no diário."); start.focus(); }
    });
    [a,b].forEach(select => select.addEventListener("change", showHistory));
    result.addEventListener("submit", event => {
      event.preventDefault();
      if (phase !== "pending" || !activePair) return;
      const raw = countInput.value.trim(), count = Number(raw);
      if (raw === "" || !Number.isInteger(count) || count < 0 || count > 300) {
        status.textContent = "Informe um número inteiro de 0 a 300 trocas limpas."; countInput.focus(); return;
      }
      const completedPair = activePair;
      // Leave the pending state before writes or events can trigger another submit.
      reset("");
      history.push({ pair: completedPair.key, count, date: new Date().toISOString() });
      history = history.slice(-100);
      let saved = true;
      try { localStorage.setItem(key, JSON.stringify(history)); }
      catch (_) { saved = false; }
      storageNote.textContent = saved ? "Histórico salvo neste navegador." : "O navegador bloqueou o armazenamento. Este resultado ficará apenas nesta página e será perdido ao sair ou recarregar.";
      let diaryMessage = "Não foi possível registrar o minuto no diário. Você pode registrá-lo manualmente.";
      try {
        if (window.GuitarStudy?.recordPractice) {
          const diarySaved = window.GuitarStudy.recordPractice("m2", { minutes: 1, note: `${completedPair.first}/${completedPair.second}: ${count} trocas limpas` });
          diaryMessage = diarySaved ? "1 minuto registrado no diário; não precisa registrá-lo novamente." : "O minuto ficou apenas na memória desta página; o navegador bloqueou a gravação do diário.";
        }
      } catch (_) {}
      status.textContent = `${saved ? "Resultado salvo." : "Resultado mantido nesta página."} ${diaryMessage} Priorize o som limpo antes da velocidade.`;
      showHistory(); start.focus();
    });
    function cancelActive() {
      if (phase === "preparing" || phase === "running") reset("Treino cancelado ao sair da página. Nenhum resultado ou minuto foi registrado.");
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelActive(); });
    window.addEventListener("pagehide", cancelActive);
    controls(); showHistory();
  };
})();
