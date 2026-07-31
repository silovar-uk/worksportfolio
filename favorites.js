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
