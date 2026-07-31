(() => {
  'use strict';

  const STORAGE_KEY = 'worksPortfolioFavoriteRatingsV1';
  const MAX_RATING = 5;
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
    renderAll();
  }

  function createRating(projectId, compact = false) {
    const current = getRating(projectId);
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
      button.setAttribute('aria-pressed', String(value <= current));
      button.textContent = value <= current ? '★' : '☆';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setRating(projectId, value === current ? 0 : value);
      });
      stars.appendChild(button);
    }
    root.appendChild(stars);

    if (current > 0) {
      const value = document.createElement('span');
      value.className = 'favorite-rating__value';
      value.textContent = `${current}/5`;
      root.appendChild(value);
    }

    return root;
  }

  function projectIdFromCard(card) {
    return card.querySelector('[data-project-open]')?.dataset.projectOpen || '';
  }

  function decorateCards() {
    document.querySelectorAll('.project-card, .timeline-card, .map-mobile-item').forEach((card) => {
      const projectId = projectIdFromCard(card);
      if (!projectId) return;
      card.querySelector(':scope > .favorite-rating')?.remove();
      const anchor = card.querySelector('.card-meta, .summary, h3, h4, h5');
      const rating = createRating(projectId, true);
      if (anchor?.parentNode) anchor.insertAdjacentElement('afterend', rating);
      else card.appendChild(rating);
    });
  }

  function decorateDialog() {
    const dialog = document.querySelector('[data-project-dialog]');
    const projectId = new URLSearchParams(location.search).get('project');
    if (!dialog?.open || !projectId) return;
    dialog.querySelector('.favorite-rating.is-detail')?.remove();
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

  const observer = new MutationObserver(renderAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', renderAll);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-project-open]')) setTimeout(renderAll, 0);
  });

  renderAll();
})();
