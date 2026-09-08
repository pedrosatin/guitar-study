(function () {
  'use strict';
  const study = window.GuitarStudy;
  const modules = window.STUDY_MODULES;
  const moduleList = document.getElementById('module-list');
  modules.forEach((module, index) => {
    const article = document.createElement('article'); article.className = 'module';
    article.innerHTML = `<span class="module-number">${String(index + 1).padStart(2, '0')}</span><div><span class="tag">${module.category}</span><h3><a href="poc/${module.path}/">${module.title}</a></h3><p>${module.description}</p></div>`;
    moduleList.append(article);
  });
  function render() {
    const state = study.getState();
    const today = study.dayKey(new Date());
    const todayMinutes = state.sessions.filter(s => study.dayKey(s.date) === today).reduce((sum, s) => sum + s.minutes, 0);
    document.getElementById('today-total').textContent = `${todayMinutes} de ${state.goal} minutos registrados`;
    const progress = document.getElementById('today-progress');
    progress.max = state.goal; progress.value = Math.min(todayMinutes, state.goal);
    document.getElementById('goal').value = state.goal;
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    const recent = state.sessions.filter(s => new Date(s.date) >= start && new Date(s.date) <= new Date());
    document.getElementById('week-total').textContent = `Últimos 7 dias: ${recent.reduce((sum, s) => sum + s.minutes, 0)} min em ${new Set(recent.map(s => study.dayKey(s.date))).size} dias de prática.`;
    const list = document.getElementById('session-list'); list.replaceChildren();
    if (!state.sessions.length) { const empty = document.createElement('p'); empty.textContent = 'Seu primeiro treino ainda não foi registrado. Escolha um módulo acima para começar.'; list.append(empty); }
    state.sessions.slice(-20).reverse().forEach(session => {
      const row = document.createElement('article'); row.className = 'session';
      const text = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${modules.find(m => m.id === session.moduleId).title} · ${session.minutes} min`;
      const date = document.createElement('p'); date.className = 'muted'; date.textContent = new Date(session.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      const note = document.createElement('p'); note.textContent = session.note;
      text.append(title, date, note);
      const remove = document.createElement('button'); remove.className = 'secondary'; remove.textContent = 'Excluir'; remove.setAttribute('aria-label', `Excluir registro de ${title.textContent}, ${date.textContent}`);
      remove.addEventListener('click', () => {
        const saved = study.removeSession(session.id); render();
        document.getElementById('history-status').textContent = saved ? 'Registro excluído.' : 'Exclusão temporária. O navegador bloqueou o armazenamento.';
        document.getElementById('export').focus();
      });
      row.append(text, remove); list.append(row);
    });
    document.getElementById('export').disabled = !state.sessions.length;
    if (!study.isStorageAvailable()) document.getElementById('goal-status').textContent = 'O armazenamento está indisponível. Os registros desta página serão perdidos ao sair.';
  }
  document.getElementById('goal-form').addEventListener('submit', event => {
    event.preventDefault();
    const saved = study.setGoal(Number(document.getElementById('goal').value));
    render();
    document.getElementById('goal-status').textContent = saved ? 'Meta diária salva.' : 'Não foi possível salvar a meta neste navegador.';
  });
  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(study.getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'meu-estudo-de-violao.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener('storage', render);
  render();
})();
