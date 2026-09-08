/* Manual practice entry. Storage remains owned by progress.js. */
(function () {
  'use strict';
  window.mountPracticeLog = function (current) {
    const aside = document.createElement('aside');
    aside.className = 'study-shell';
    aside.setAttribute('aria-label', 'Diário de prática');
    aside.innerHTML = `<details><summary>Registrar minha prática</summary><p class="study-task"></p>
      <form class="study-log"><label>Minutos praticados<input name="minutes" type="number" min="1" max="180" step="1" required value="${current.time}"></label>
      <label>O que melhorar no próximo treino?<textarea name="note" rows="2" maxlength="500" placeholder="Ex.: trocar de Em para Am sem parar"></textarea></label>
      <button type="submit">Salvar prática</button></form>
      <p role="status" class="study-save-status"></p><p class="muted">Registre o tempo que você realmente praticou. Seus registros ficam neste navegador.</p></details>`;
    aside.querySelector('.study-task').textContent = current.task;
    aside.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = aside.querySelector('.study-save-status');
      try {
        const saved = window.GuitarStudy.recordPractice(current.id, { minutes: Number(form.elements.minutes.value), note: form.elements.note.value });
        status.textContent = saved ? 'Prática salva. Veja seu histórico em Meu estudo.' : 'Prática registrada só nesta página. O navegador bloqueou o armazenamento; copie sua anotação antes de sair.';
        form.elements.note.value = '';
      } catch (error) { status.textContent = error.message; }
    });
    document.body.append(aside);

  };
})();
