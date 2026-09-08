/* Composes page chrome once; never rebuilds exercise or media nodes. */
(function () {
  'use strict';
  const root = new URL('../', document.currentScript.src);
  const current = window.STUDY_MODULES.find(module => location.pathname.includes('/' + module.path + '/'));
  window.mountStudyNavigation(root, current);
  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'study-content';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'study-skip';
    skip.href = '#' + main.id;
    skip.textContent = current ? 'Pular para o exercício' : 'Pular para o conteúdo';
    document.body.prepend(skip);
  }
  if (current) window.mountPracticeLog(current);
})();
