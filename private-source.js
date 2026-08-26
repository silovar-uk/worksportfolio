(() => {
  'use strict';

  const projects = () => Array.isArray(window.BUILD_DIARY_DATA?.projects) ? window.BUILD_DIARY_DATA.projects : [];
  const privateById = () => new Map(projects()
    .filter((project) => project?.sourceVisibility === 'private')
    .map((project) => [project.id, project]));

  function badge() {
    const span = document.createElement('span');
    span.className = 'catalog-private-source';
    span.textContent = 'Source not public';
    span.title = '作品概要のみ公開しています';
    return span;
  }

  function makeStatic(button) {
    if (!button || button.dataset.privateStatic === 'true') return;
    if (button.classList.contains('catalog-open')) {
      button.remove();
      return;
    }
    const div = document.createElement('div');
    div.className = `${button.className} catalog-private-static`;
    div.innerHTML = button.innerHTML;
    div.dataset.privateStatic = 'true';
    button.replaceWith(div);
  }

  function markCatalogItem(item, project) {
    if (!item || !project) return;
    item.classList.add('is-private-source');
    item.dataset.sourceVisibility = 'private';

    const titleLine = item.querySelector('.catalog-titleline');
    if (titleLine && !titleLine.querySelector('.catalog-private-source')) titleLine.appendChild(badge());

    const cardType = item.querySelector('.catalog-card-top > span:first-child');
    if (cardType && !cardType.querySelector('.catalog-private-source')) cardType.appendChild(badge());

    const tableTitle = item.querySelector('.catalog-title strong');
    if (tableTitle && !item.querySelector('.catalog-title .catalog-private-source')) tableTitle.insertAdjacentElement('afterend', badge());

    const links = item.querySelector('.catalog-links');
    if (links && !links.querySelector('a') && !links.querySelector('.catalog-private-source')) {
      links.innerHTML = '';
      links.appendChild(badge());
    }

    if (project.summaryOnly) item.querySelectorAll('[data-project-open]').forEach((button) => makeStatic(button));
  }

  function markRandomItem(item, project) {
    if (!item || !project) return;
    item.classList.add('is-private-source');
    item.dataset.sourceVisibility = 'private';
    const flags = item.querySelector('.random-three-flags');
    if (flags && !flags.querySelector('.catalog-private-source')) flags.appendChild(badge());
    if (project.summaryOnly) item.querySelectorAll('[data-random-three-open]').forEach((button) => button.remove());
  }

  let applying = false;
  function apply() {
    if (applying) return;
    applying = true;
    const privateMap = privateById();
    document.querySelectorAll('[data-cat-item]').forEach((item) => {
      const id = item.getAttribute('data-cat-item');
      if (privateMap.has(id)) markCatalogItem(item, privateMap.get(id));
    });
    document.querySelectorAll('[data-random-three-item]').forEach((item) => {
      const id = item.getAttribute('data-random-three-item');
      if (privateMap.has(id)) markRandomItem(item, privateMap.get(id));
    });
    applying = false;
  }

  const start = () => {
    apply();
    const observer = new MutationObserver(() => queueMicrotask(apply));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('worksportfolio:audit', apply);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
