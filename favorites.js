(() => {
  'use strict';

  const STORAGE_KEY = 'worksPortfolioFavoriteRatingsV1';
  const MAX_RATING = 5;
  const SURFACE_SELECTOR = [
    '.project-card',
    '.timeline-card',
    '.map-mobile-item',
    '.catalog-card',
    '.catalog-row',
    '.catalog-table tbody tr[data-cat-item]',
    '.portfolio-pick-card',
    '.random-three-card[data-random-three-item]',
    '.floating-random-card',
    '.catalog-random-result[data-taxonomy-random-result]'
  ].join(',');

  let ratings = readRatings();
  let renderQueued = false;

  function readRatings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('お気に入り度を読み込めませんでした。', error);
      return {};
    }
  }

  function saveRatings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    } catch (error) {
      console.warn('お気に入り度を保存できませんでした。', error);
    }
  }

  function getRating(projectId) {
    const value = Number(ratings[projectId]);
    return Number.isInteger(value) && value >= 1 && value <= MAX_RATING ? value : 0;
  }

  function setRating(projectId, value) {
    if (!projectId) return;
    const next = Number(value);
    if (next >= 1 && next <= MAX_RATING) ratings[projectId] = next;
    else delete ratings[projectId];
    saveRatings();
    syncProjectControls(projectId);
  }

  function syncControl(root) {
    const projectId = root.dataset.favoriteProject || '';
    const current = getRating(projectId);
    root.querySelectorAll('[data-favorite-value]').forEach((button) => {
      const value = Number(button.dataset.favoriteValue);
      const active = value <= current;
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? '★' : '☆';
    });

    let valueNode = root.querySelector('.favorite-rating__value');
    if (current > 0) {
      if (!valueNode) {
        valueNode = document.createElement('span');
        valueNode.className = 'favorite-rating__value';
        root.appendChild(valueNode);
      }
      valueNode.textContent = `${current}/5`;
    } else {
      valueNode?.remove();
    }
  }

  function syncProjectControls(projectId) {
    document.querySelectorAll('.favorite-rating').forEach((root) => {
      if (root.dataset.favoriteProject === projectId) syncControl(root);
    });
  }

  function createRating(projectId, compact = false) {
    const root = document.createElement('div');
    root.className = `favorite-rating${compact ? ' is-compact' : ''}`;
    root.dataset.favoriteProject = projectId;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'お気に入り度');

    const label = document.createElement('span');
    label.className = 'favorite-rating__label';
    label.textContent = 'お気に入り度';
    root.appendChild(label);

    const stars = document.createElement('span');
    stars.className = 'favorite-rating__stars';
    for (let value = 1; value <= MAX_RATING; value += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'favorite-rating__star';
      button.dataset.favoriteValue = String(value);
      button.setAttribute('aria-label', `お気に入り度を${value}にする`);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = getRating(projectId);
        setRating(projectId, value === current ? 0 : value);
      });
      stars.appendChild(button);
    }
    root.appendChild(stars);
    syncControl(root);
    return root;
  }

  function projectIdFromSurface(surface) {
    return surface.dataset.catItem
      || surface.dataset.randomThreeItem
      || surface.querySelector('[data-project-open]')?.dataset.projectOpen
      || surface.querySelector('[data-wow-open]')?.dataset.wowOpen
      || surface.querySelector('[data-random-three-open]')?.dataset.randomThreeOpen
      || surface.querySelector('[data-floating-random-open]')?.dataset.floatingRandomOpen
      || surface.querySelector('[data-taxonomy-random-open]')?.dataset.taxonomyRandomOpen
      || '';
  }

  function existingRating(surface, projectId) {
    return [...surface.querySelectorAll('.favorite-rating')].find((rating) => (
      rating.dataset.favoriteProject === projectId
      && rating.closest(SURFACE_SELECTOR) === surface
    ));
  }

  function placeRating(surface, rating) {
    if (surface.matches('.portfolio-pick-card')) {
      rating.classList.add('is-pick');
      const actions = surface.querySelector('.portfolio-pick-actions');
      if (actions) actions.before(rating);
      else surface.appendChild(rating);
      return;
    }

    if (surface.matches('.random-three-card')) {
      rating.classList.add('is-random-three');
      const actions = surface.querySelector('.random-three-actions');
      if (actions) actions.before(rating);
      else surface.appendChild(rating);
      return;
    }

    if (surface.matches('.floating-random-card')) {
      rating.classList.add('is-floating-random');
      const actions = surface.querySelector('.floating-random-actions');
      if (actions) actions.before(rating);
      else surface.appendChild(rating);
      return;
    }

    if (surface.matches('.catalog-random-result')) {
      rating.classList.add('is-taxonomy-random');
      const actions = surface.querySelector('.catalog-random-actions');
      if (actions) actions.before(rating);
      else surface.appendChild(rating);
      return;
    }

    if (surface.matches('.catalog-row')) {
      rating.classList.add('is-catalog-row');
      const facts = surface.querySelector('.catalog-facts');
      if (facts) facts.prepend(rating);
      else surface.appendChild(rating);
      return;
    }

    if (surface.matches('.catalog-card')) {
      rating.classList.add('is-catalog-card');
      const summary = surface.querySelector(':scope > p');
      if (summary) summary.after(rating);
      else surface.appendChild(rating);
      return;
    }

    if (surface.matches('tr[data-cat-item]')) {
      rating.classList.add('is-catalog-table');
      const title = surface.querySelector('.catalog-title');
      if (title) title.after(rating);
      else surface.querySelector('td:nth-child(2)')?.appendChild(rating);
      return;
    }

    const anchor = surface.querySelector('.card-meta, .summary, h3, h4, h5');
    if (anchor?.parentNode) anchor.insertAdjacentElement('afterend', rating);
    else surface.appendChild(rating);
  }

  function decorateSurface(surface) {
    const projectId = projectIdFromSurface(surface);
    if (!projectId || existingRating(surface, projectId)) return;
    const rating = createRating(projectId, true);
    placeRating(surface, rating);
  }

  function decorateCards() {
    document.querySelectorAll(SURFACE_SELECTOR).forEach(decorateSurface);
  }

  function decorateDialog() {
    const dialog = document.querySelector('[data-project-dialog]');
    const projectId = new URLSearchParams(location.search).get('project');
    if (!dialog?.open || !projectId) return;

    const existing = dialog.querySelector('.favorite-rating.is-detail');
    if (existing?.dataset.favoriteProject === projectId) return;
    existing?.remove();

    const rating = createRating(projectId, false);
    rating.classList.add('is-detail');
    const status = dialog.querySelector('.detail-status');
    if (status) status.insertAdjacentElement('afterend', rating);
    else dialog.querySelector('[data-project-detail]')?.prepend(rating);
  }

  function renderAll() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      decorateCards();
      decorateDialog();
    });
  }

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length)) renderAll();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', renderAll);
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    ratings = readRatings();
    document.querySelectorAll('.favorite-rating').forEach(syncControl);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-project-open],[data-wow-open],[data-wow-shuffle],[data-random-three-refresh],[data-floating-random-draw],[data-taxonomy-random]')) {
      setTimeout(renderAll, 0);
    }
  });

  renderAll();
})();

(() => {
  'use strict';

  const TYPE_ICONS = {
    'web-app': '🖥️',
    'chrome-extension': '🧩',
    'learning-tool': '📘',
    'design-system': '✦',
    'content-page': '📚',
    'data-tool': '📊',
    utility: '🛠️',
    experiment: '🧪'
  };
  const STATUS_ICONS = {
    development: '🛠',
    active: '●',
    prototype: '◇',
    dormant: '◌',
    legacy: '·'
  };
  const VERB_ICONS = {
    '探す': '⌕', '整理する': '整', '振り返る': '↶', '記録する': '＋', '学ぶ': '学',
    '判断する': '分', '練習する': '鍛', '比べる': '⇄', '直す': '✎', '出力する': '↗',
    '書く': '✎', '組み立てる': '組', '推理する': '?', '遊ぶ': '遊', '作る': '＋',
    '確認する': '✓', '指示する': '☞', '共有する': '↗', '試す': '▷', '使う': '使',
    '設計する': '設', '伝える': '話', '解く': '解', '考える': '考', '見つける': '⌕',
    '拾う': '＋', '育てる': '育', '思い出す': '↶', '切り抜く': '✂', '整える': '整',
    '書き出す': '↗', 'つなぐ': '→', '確かめる': '✓', '選ぶ': '選', '実行する': '▶',
    '退避する': '↓', '復元する': '↑'
  };
  const QUICK_ICONS = {
    all: '🗂️',
    recent: '✨',
    published: '🌍',
    active: '🔥',
    extension: '🧩',
    web: '🖥️'
  };
  const SURFACE_SELECTOR = [
    '.project-card',
    '.timeline-card',
    '.map-mobile-item',
    '.catalog-card',
    '.catalog-row',
    '.catalog-table tbody tr[data-cat-item]',
    '.portfolio-pick-card',
    '.random-three-card[data-random-three-item]',
    '.floating-random-card',
    '.catalog-random-result[data-taxonomy-random-result]'
  ].join(',');

  let renderQueued = false;

  function projects() {
    return Array.isArray(window.BUILD_DIARY_DATA?.projects) ? window.BUILD_DIARY_DATA.projects : [];
  }

  function projectMap() {
    return new Map(projects().map((project) => [project.id, project]));
  }

  function projectIdFromSurface(surface) {
    return surface.dataset.catItem
      || surface.dataset.randomThreeItem
      || surface.querySelector('[data-project-open]')?.dataset.projectOpen
      || surface.querySelector('[data-wow-open]')?.dataset.wowOpen
      || surface.querySelector('[data-random-three-open]')?.dataset.randomThreeOpen
      || surface.querySelector('[data-floating-random-open]')?.dataset.floatingRandomOpen
      || surface.querySelector('[data-taxonomy-random-open]')?.dataset.taxonomyRandomOpen
      || '';
  }

  function projectIcon(project) {
    return String(project?.icon || TYPE_ICONS[project?.type] || '◆');
  }

  function createIcon(project, className = '') {
    const icon = document.createElement('span');
    icon.className = `project-signal-icon${className ? ` ${className}` : ''}`;
    icon.textContent = projectIcon(project);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function prependInlineIcon(target, value, className) {
    const classes = String(className || '').trim().split(/\s+/).filter(Boolean);
    if (!target || !classes.length) return;
    const directSelector = `:scope > .${classes.join('.')}`;
    if (target.querySelector(directSelector)) return;
    const icon = document.createElement('span');
    icon.className = classes.join(' ');
    icon.textContent = value;
    icon.setAttribute('aria-hidden', 'true');
    target.prepend(icon);
  }

  function verbList(project, className = '') {
    const verbs = Array.isArray(project?.verbs) ? project.verbs.slice(0, 3) : [];
    if (!verbs.length) return null;
    const list = document.createElement('div');
    list.className = `project-verb-list${className ? ` ${className}` : ''}`;
    list.setAttribute('aria-label', 'この制作物でできること');
    verbs.forEach((verb) => {
      const chip = document.createElement('span');
      chip.className = 'project-verb-chip';
      const icon = document.createElement('span');
      icon.className = 'project-verb-icon';
      icon.textContent = VERB_ICONS[verb] || '•';
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = verb;
      chip.append(icon, label);
      list.appendChild(chip);
    });
    return list;
  }

  function decorateQuickButtons() {
    document.querySelectorAll('[data-cat-quick-value]').forEach((button) => {
      const key = button.dataset.catQuickValue || '';
      const label = button.querySelector(':scope > span');
      if (!label || label.querySelector('.catalog-quick-icon')) return;
      const icon = document.createElement('span');
      icon.className = 'catalog-quick-icon';
      icon.textContent = QUICK_ICONS[key] || '◆';
      icon.setAttribute('aria-hidden', 'true');
      label.prepend(icon);
    });
  }

  function decorateCatalogRow(surface, project) {
    const main = surface.querySelector('.catalog-main');
    if (main && !main.querySelector(':scope > .project-signal-icon')) {
      main.prepend(createIcon(project, 'is-row'));
    }
    const summary = surface.querySelector('.catalog-summaryline');
    if (summary && !summary.dataset.signalCopy) {
      const text = [project.subtitle, project.summary].filter(Boolean).join(' — ');
      if (text) summary.textContent = text;
      summary.dataset.signalCopy = 'true';
    }
    const facts = surface.querySelector('.catalog-facts');
    const type = facts?.querySelector(':scope > span:not(.favorite-rating)');
    prependInlineIcon(type, TYPE_ICONS[project.type] || '◆', 'project-type-inline-icon');
    prependInlineIcon(facts?.querySelector('.status'), STATUS_ICONS[project.status] || '·', 'project-status-inline-icon');
  }

  function decorateCatalogCard(surface, project) {
    const heading = surface.querySelector(':scope > h3');
    if (heading && !surface.querySelector(':scope > .project-signal-icon')) {
      heading.before(createIcon(project, 'is-card'));
    }
    if (heading && project.subtitle && !surface.querySelector(':scope > .project-signal-subtitle')) {
      const subtitle = document.createElement('div');
      subtitle.className = 'project-signal-subtitle';
      subtitle.textContent = project.subtitle;
      heading.after(subtitle);
    }
    const summary = surface.querySelector(':scope > p');
    if (summary && !surface.querySelector(':scope > .project-verb-list')) {
      const verbs = verbList(project, 'is-card');
      if (verbs) summary.after(verbs);
    }
    const topType = surface.querySelector('.catalog-card-top > span:first-child');
    prependInlineIcon(topType, TYPE_ICONS[project.type] || '◆', 'project-type-inline-icon');
    prependInlineIcon(surface.querySelector('.catalog-card-bottom .status'), STATUS_ICONS[project.status] || '·', 'project-status-inline-icon');
    if (project.featured && !surface.querySelector(':scope > .project-featured-badge')) {
      const badge = document.createElement('span');
      badge.className = 'project-featured-badge';
      badge.textContent = '✦ まず見る';
      surface.appendChild(badge);
    }
  }

  function decorateCatalogTable(surface, project) {
    const title = surface.querySelector('.catalog-title');
    if (title && !title.querySelector(':scope > .project-signal-icon')) {
      title.prepend(createIcon(project, 'is-table'));
    }
    const summary = title?.querySelector('small');
    if (summary && !summary.dataset.signalCopy) {
      const text = [project.subtitle, project.summary].filter(Boolean).join(' — ');
      if (text) summary.textContent = text.slice(0, 120);
      summary.dataset.signalCopy = 'true';
    }
    prependInlineIcon(surface.querySelector('td:nth-child(3)'), TYPE_ICONS[project.type] || '◆', 'project-type-inline-icon');
    prependInlineIcon(surface.querySelector('.status'), STATUS_ICONS[project.status] || '·', 'project-status-inline-icon');
  }

  function decorateShowcase(surface, project) {
    const heading = surface.querySelector('h2,h3,h4,h5,.portfolio-pick-title');
    if (heading) prependInlineIcon(heading, projectIcon(project), 'project-title-inline-icon');
    if (surface.querySelector(':scope > .project-verb-list')) return;
    const actions = surface.querySelector(
      '.portfolio-pick-actions,.random-three-actions,.floating-random-actions,.catalog-random-actions'
    );
    const verbs = verbList(project, 'is-showcase');
    if (!verbs) return;
    if (actions) actions.before(verbs);
    else surface.appendChild(verbs);
  }

  function decorateSurface(surface, map) {
    const projectId = projectIdFromSurface(surface);
    const project = map.get(projectId);
    if (!project) return;
    surface.dataset.projectType = project.type || '';
    surface.dataset.projectStatus = project.status || '';
    if (surface.matches('.catalog-row')) decorateCatalogRow(surface, project);
    else if (surface.matches('.catalog-card')) decorateCatalogCard(surface, project);
    else if (surface.matches('tr[data-cat-item]')) decorateCatalogTable(surface, project);
    else decorateShowcase(surface, project);
  }

  function decorateDialog(map) {
    const dialog = document.querySelector('[data-project-dialog]');
    const projectId = new URLSearchParams(location.search).get('project') || '';
    const project = map.get(projectId);
    if (!dialog?.open || !project) return;
    const heading = dialog.querySelector('h2,h3,.detail-title');
    if (heading) prependInlineIcon(heading, projectIcon(project), 'project-title-inline-icon is-detail');
    if (!dialog.querySelector('.project-verb-list.is-detail')) {
      const verbs = verbList(project, 'is-detail');
      const status = dialog.querySelector('.detail-status');
      if (verbs && status) status.insertAdjacentElement('afterend', verbs);
      else if (verbs) heading?.insertAdjacentElement('afterend', verbs);
    }
  }

  function renderAll() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const map = projectMap();
      decorateQuickButtons();
      document.querySelectorAll(SURFACE_SELECTOR).forEach((surface) => decorateSurface(surface, map));
      decorateDialog(map);
    });
  }

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length)) renderAll();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (event.target.closest(
      '[data-view-button],[data-project-open],[data-wow-open],[data-wow-shuffle],'
      + '[data-random-three-refresh],[data-floating-random-draw],[data-taxonomy-random]'
    )) setTimeout(renderAll, 0);
  });
  window.addEventListener('popstate', renderAll);
  document.addEventListener('DOMContentLoaded', renderAll);
  renderAll();
})();
