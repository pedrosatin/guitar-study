/* Common navigation for home and lessons. No exercise state lives here. */
(function () {
  'use strict';
  const icons = {
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    m1: 'M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z',
    m8: 'M9 5h12M9 12h12M9 19h12M2 5l2 2 3-4M2 12l2 2 3-4M2 19l2 2 3-4',
    m2: 'M5 3v18M12 3v18M19 3v18M3 6h18M3 12h18M3 18h18',
    m3: 'M8 4v16l12-8Z',
    m4: 'M2 12h3l3-8 5 16 3-8h6',
    m5: 'M3 7h4l2-3h6l2 3h4v14H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    m6: 'M2 6h20v12H2ZM7 6v12M13 6v12M18 6v12M2 12h20',
    m9: 'M3 6h18M3 12h18M3 18h18M7 3v6M12 9v6M17 15v6',
    m7: 'M5 21 10 3h4l5 18ZM12 16l7-10M9 17h6'
  };
  const groups = [
    { title: 'Aprender', ids: ['m1', 'm8'] },
    { title: 'Praticar', ids: ['m2', 'm3', 'm7'] },
    { title: 'Explorar o instrumento', ids: ['m4', 'm5', 'm6', 'm9'] }
  ];
  window.mountStudyNavigation = function (root, current) {
    const nav = document.createElement('nav');
    nav.className = 'study-shell study-navigation';
    nav.setAttribute('aria-label', 'Módulos de estudo');
    const brand = document.createElement('a');
    brand.className = 'study-brand';
    brand.href = root.href;
    brand.setAttribute('aria-label', 'Violão / Meu estudo');
    brand.innerHTML = '<span class="brand-symbol" aria-hidden="true">v.</span><span>Violão<span class="brand-caption">Meu espaço de estudo</span></span>';
    const toggle = document.createElement('button');
    toggle.className = 'study-menu-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Menu';
    toggle.setAttribute('aria-controls', 'study-navigation-links');
    toggle.setAttribute('aria-expanded', 'false');
    const links = document.createElement('div');
    links.id = 'study-navigation-links';
    links.className = 'study-links';
    function addLink(title, href, active, icon) {
      const link = document.createElement('a');
      link.href = href;
      if (icon) {
        const badge = document.createElement('span');
        badge.className = 'nav-icon';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[icon]}"></path></svg>`;
        link.append(badge);
      }
      link.append(document.createTextNode(title));
      if (active) link.setAttribute('aria-current', 'page');
      links.append(link);
    }
    addLink('Meu estudo', root.href, !current, 'home');
    for (const group of groups) {
      const label = document.createElement('p');
      label.className = 'nav-group';
      label.textContent = group.title;
      links.append(label);
      for (const id of group.ids) {
        const module = window.STUDY_MODULES.find(item => item.id === id);
        addLink(module.title, new URL(`poc/${module.path}/`, root).href, module === current, id);
      }
    }
    addLink('Diário de prática', new URL('#history', root).href, false);
    const note = document.createElement('p');
    note.className = 'nav-note';
    note.textContent = 'No seu tempo. Uma prática de cada vez.';
    links.append(note);
    nav.append(brand, toggle, links);
    document.body.prepend(nav);
    const desktop = matchMedia('(min-width: 1200px)');
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      links.hidden = !desktop.matches && !open;
    }
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !desktop.matches && !links.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    links.addEventListener('click', event => {
      if (event.target.closest('a') && !desktop.matches) setOpen(false);
    });
    desktop.addEventListener('change', () => {
      // Do not strand keyboard focus in the menu when switching to mobile.
      if (!desktop.matches && links.contains(document.activeElement)) toggle.focus();
      setOpen(false);
    });
    setOpen(false);
  };
})();
