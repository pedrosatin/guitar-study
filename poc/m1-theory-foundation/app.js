(function () {
  "use strict";

  const FILES = [
    "01-partes",
    "02-notas",
    "03-acordes",
    "04-cordas",
    "05-dedilhado-batida",
    "06-postura"
  ];

  let descriptions = {};
  let audioContext = null;

  let activeOscillator = null;

  async function playTone(frequencyHz, button, name) {
    const status = document.getElementById("audio-status");
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("Áudio indisponível");
      if (!audioContext || audioContext.state === "closed") audioContext = new Ctx();
      await audioContext.resume();
      if (document.hidden) return;
      if (activeOscillator) activeOscillator.stop();
      document.querySelectorAll(".playing").forEach(el => el.classList.remove("playing"));
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequencyHz, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
      oscillator.connect(gain).connect(audioContext.destination);
      activeOscillator = oscillator;
      button.classList.add("playing");
      status.textContent = `Ouvindo ${name}. É um som eletrônico de referência.`;
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect();
        if (activeOscillator === oscillator) {
          activeOscillator = null;
          button.classList.remove("playing");
          status.textContent = `Referência de ${name} encerrada. Você pode ouvir novamente.`;
        }
      };
      oscillator.start(now);
      oscillator.stop(now + 1.05);
    } catch (_) {
      status.textContent = "Não foi possível tocar o som. Confira o volume e a permissão de áudio do navegador. Você pode continuar pelas instruções escritas.";
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activeOscillator) activeOscillator.stop();
  });
  window.addEventListener("pagehide", () => {
    if (audioContext) audioContext.close().catch(() => {});
    audioContext = null;
  });

  function renderSection(host, data) {
    host.innerHTML = "";
    const h2 = document.createElement(["01-partes", "02-notas", "03-acordes", "05-dedilhado-batida"].includes(data.id) ? "h3" : "h2");
    h2.textContent = data.id === "06-postura" ? "1. Prepare-se para tocar" : data.id === "04-cordas" ? "3. Encontre e ouça as cordas" : data.titulo;
    host.appendChild(h2);

    if (data.objetivo) {
      const obj = document.createElement("p");
      obj.className = "objetivo";
      obj.textContent = data.objetivo;
      host.appendChild(obj);
    }

    if (data.id === "01-partes") {
      descriptions = {};
      data.itens.forEach(function (it) { descriptions[it.parte] = it.descricao; });
    }

    if (data.id === "04-cordas") {
      const table = document.createElement("table");
      table.className = "cordas-table";
      table.innerHTML =
        "<caption>Afinação padrão, da corda mais grossa à mais fina</caption><thead><tr><th scope=\"col\">Corda</th><th scope=\"col\">Nome</th><th scope=\"col\">Som</th></tr></thead>";
      const tbody = document.createElement("tbody");
      data.itens.forEach(function (it) {
        const tr = document.createElement("tr");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Ouvir";
        btn.setAttribute("aria-label", "Ouvir corda " + it.corda);
        btn.addEventListener("click", function () {
          playTone(it.frequencia, btn, it.num + "ª corda, " + it.corda);
        });
        tr.innerHTML =
          "<th scope=\"row\">" + it.num + "ª" + (it.num === 6 ? " · mais grossa" : it.num === 1 ? " · mais fina" : "") + "</th>" +
          "<td>" + it.corda + "</td>" +
          "<td></td>";
        tr.lastElementChild.appendChild(btn);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      host.appendChild(table);
      const note = document.createElement("p");
      note.textContent = "Ouvir toca uma referência eletrônica por um segundo. O timbre, a característica do som, é diferente do violão. Escute a diferença entre grave, som mais grosso, e agudo, som mais fino. Os dois Mi têm o mesmo nome e alturas diferentes.";
      host.append(note);
      const status = document.createElement("p");
      status.id = "audio-status"; status.setAttribute("role", "status");
      status.textContent = "Selecione Ouvir para escutar uma corda. Ajuste o volume do aparelho se precisar.";
      host.append(status);
      const details = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = "O que significam E2, E4 e Hz no afinador?";
      const explanation = document.createElement("p");
      explanation.textContent = "As letras representam notas: E é Mi, A é Lá, D é Ré, G é Sol e B é Si. O número indica a região de altura, chamada oitava: E4 é mais agudo que E2. Hz mede quantas vibrações ocorrem por segundo. Você pode consultar esses valores depois.";
      const values = document.createElement("p");
      values.textContent = data.itens.map(it => `${it.num}ª corda: ${it.nota}, ${it.frequencia.toFixed(2)} Hz`).join("; ") + ".";
      details.append(summary, explanation, values); host.append(details);
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "itens";
    data.itens.forEach(function (it) {
      const li = document.createElement("li");
      const key = it.parte;
      const spanKey = document.createElement("span");
      spanKey.className = "parte";
      spanKey.textContent = key;
      const spanDesc = document.createElement("span");
      spanDesc.className = "descricao";
      spanDesc.textContent = ". " + it.descricao;
      li.appendChild(spanKey);
      li.appendChild(spanDesc);
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  async function loadDiagram() {
    const host = document.getElementById("diagram");
    try {
      const response = await fetch("assets/violao-parts.svg");
      if (!response.ok) throw new Error("Diagrama indisponível");
      host.innerHTML = await response.text();
    } catch (_) {
      host.textContent = "Não foi possível carregar o diagrama. Recarregue a página ou consulte as partes abaixo.";
      return;
    }
    const tip = document.getElementById("diagram-tip");

    const controls = document.createElement("div");
    controls.className = "diagram-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Escolher parte do violão");
    host.querySelectorAll(".part").forEach(function (el) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = el.dataset.part;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => el.dispatchEvent(new Event("click")));
      controls.append(button);
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", el.dataset.part);
      el.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.dispatchEvent(new Event("click")); } });
      el.addEventListener("focus", () => el.dispatchEvent(new Event("mouseenter")));
      el.addEventListener("mouseenter", function () {
        const partName = el.getAttribute("data-part") || el.querySelector("title").textContent;
        const desc = descriptions[partName] || partName;
        tip.innerHTML = '<span class="label">' + partName + "</span>" + desc;
      });
      el.addEventListener("click", function () {
        host.querySelectorAll(".part").forEach(part => part.classList.toggle("selected", part === el));
        controls.querySelectorAll("button").forEach(control => control.setAttribute("aria-pressed", String(control === button)));
        const partName = el.getAttribute("data-part") || el.querySelector("title").textContent;
        const desc = descriptions[partName] || partName;
        tip.innerHTML = '<span class="label">' + partName + "</span>" + desc;
      });
    });

    host.append(controls);
  }

  async function loadContent() {
    await Promise.all(FILES.map(async (id, i) => {
      const sectionId = "sec-" + String(i + 1).padStart(2, "0");
      const section = document.getElementById(sectionId);
      if (!section) return;
      let data = null;
      try {
        const res = await fetch("content/" + id + ".json", { cache: "no-store" });
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        data = null;
      }
      if (!data) {
        section.innerHTML = "<p>Este trecho não carregou. Recarregue a página para tentar novamente. Você pode continuar com o exercício do passo 4.</p>";
      } else {
        renderSection(section, data);
      }
      if (id === "01-partes") await loadDiagram();
    }));
  }

  function initQuiz() {
    const questions = [
      ["Qual é a 1ª corda do violão?", ["A mais fina", "A mais grossa", "A do meio"], 0, "A 1ª é a mais fina; a 6ª é a mais grossa. Na afinação padrão, as duas se chamam Mi.", "#sec-04"],
      ["O que significa tocar uma corda solta?", ["Afrouxar a tarraxa", "Tocar sem pressionar uma casa", "Tirar a corda do violão"], 1, "Corda solta vibra sem um dedo pressionando uma casa. Você não precisa mexer na tarraxa para fazer isso.", "#first-practice"],
      ["Onde fica a primeira casa?", ["Sobre a boca", "Entre a pestana e o primeiro traste", "Sobre o cavalete"], 1, "A primeira casa é o espaço entre a pestana e a primeira barra de metal, perto da cabeça.", "#first-practice"],
      ["Onde colocar a ponta do dedo dentro da casa?", ["Em cima do metal", "Perto do traste do lado do corpo", "No meio da boca"], 1, "Fique dentro da casa, próximo ao traste na direção do corpo, sem apoiar o dedo sobre o metal. Confira o ponto no desenho do passo 4.", "#first-practice"],
      ["Ao passar da corda solta para a primeira casa, o que acontece com a nota?", ["Fica obrigatoriamente mais alta em volume", "Fica mais aguda", "Sempre para de soar"], 1, "A nota fica mais aguda, com som mais fino. Volume é a intensidade do som; é uma característica diferente.", "#first-practice"]
    ];
    let index = 0, score = 0;
    let missed = [];
    const host = document.getElementById("quiz-question");
    const status = document.getElementById("quiz-status");
    const next = document.getElementById("quiz-next");
    const help = document.getElementById("quiz-help");
    try { const last = JSON.parse(localStorage.getItem("guitar-study-foundations-quiz-v2") || "null"); if (last && Number.isInteger(last.score) && last.score >= 0 && last.score <= questions.length) status.textContent = `Última revisão: ${last.score} de ${questions.length} acertos.`; } catch (_) {}
    function show() {
      next.hidden = true;
      help.hidden = true;
      host.replaceChildren();
      const question = document.createElement("p");
      question.tabIndex = -1;
      question.textContent = `${index + 1} de ${questions.length}. ${questions[index][0]}`;
      host.append(question);
      questions[index][1].forEach((answer, option) => {
        const button = document.createElement("button"); button.textContent = answer;
        button.addEventListener("click", () => {
          const correct = option === questions[index][2];
          if (correct) score++; else missed.push(questions[index]);
          host.querySelectorAll("button").forEach(b => b.disabled = true);
          status.textContent = (correct ? "Correto. " : "Revise. ") + questions[index][3];
          help.href = questions[index][4]; help.hidden = correct;
          next.textContent = index === questions.length - 1 ? "Ver resultado" : "Próxima pergunta";
          next.hidden = false; next.focus();
        });
        host.append(button);
      });
    }
    next.addEventListener("click", () => {
      index++;
      if (index < questions.length) { status.textContent = ""; show(); host.querySelector("p").focus(); return; }
      if (index === questions.length) {
        help.hidden = true; status.textContent = "";
        host.textContent = `Você acertou ${score} de ${questions.length}. ${score === questions.length ? "Você reconheceu os conceitos desta aula. Confira também a prática no violão antes de seguir." : "Releia os pontos que errou e tente novamente."}`;
        if (missed.length) {
          const list = document.createElement("ul");
          for (const item of missed) {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = item[4]; link.textContent = item[0];
            const explanation = document.createElement("p"); explanation.textContent = item[3];
            li.append(link, explanation); list.append(li);
          }
          host.append(list);
        }
        try { localStorage.setItem("guitar-study-foundations-quiz-v2", JSON.stringify({score, total: questions.length, date: new Date().toISOString()})); } catch (_) { status.textContent = "Resultado disponível nesta sessão; o navegador bloqueou o armazenamento."; }
        next.textContent = "Refazer revisão";
      } else { index = 0; score = 0; missed = []; status.textContent = ""; show(); host.querySelector("p").focus(); }
    });
    show();
  }

  function initPractice() {
    const key = "guitar-study-foundations-practice-v1";
    const checks = [...document.querySelectorAll("[data-practice]")];
    const status = document.getElementById("practice-status");
    const storage = document.getElementById("practice-storage");
    let available = true;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      checks.forEach(check => { check.checked = saved?.[check.dataset.practice] === true; });
    } catch (_) { available = false; }
    function update(save) {
      if (save) {
        try {
          localStorage.setItem(key, JSON.stringify(Object.fromEntries(checks.map(check => [check.dataset.practice, check.checked]))));
          available = true;
        } catch (_) { available = false; }
      }
      const done = checks.filter(check => check.checked).length;
      status.textContent = done === checks.length
        ? "Você marcou as 3 ações como feitas. Responda à revisão e confira o próximo passo."
        : `${done} de 3 ações marcadas. Continue a partir da primeira que ainda não conseguiu fazer.`;
      storage.textContent = available ? "Suas marcações ficam neste navegador. Você pode desmarcar para repetir. O tempo de prática é registrado separadamente no diário." : "As marcações estão disponíveis nesta página. O navegador não permitiu recuperar ou salvar o progresso.";
    }
    checks.forEach(check => check.addEventListener("change", () => update(true)));
    update(false);
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadContent();
    initQuiz();
    initPractice();

  });
})();