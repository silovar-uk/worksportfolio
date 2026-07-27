(() => {
  'use strict';

  const RECENT_KEY = 'worksportfolio-recent-opened-v1';
  const MAX_RECENT = 30;
  let recentOnly = false;
  let defaultApplied = false;
  let refreshScheduled = false;

  const readRecent = () => {
    try {
      const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(value) ? value.filter((item) => item && typeof item.id === 'string') : [];
    } catch (_) {
      return [];
    }
  };

  const writeRecent = (items) => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
    } catch (_) {
      // Storage can be unavailable in private browsing or restricted environments.
    }
  };

  const recordOpened = (id) => {
    if (!id) return;
    const next = readRecent().filter((item) => item.id !== id);
    next.unshift({ id, openedAt: new Date().toISOString() });
    writeRecent(next);
    scheduleRefresh();
  };

  const recentIds = () => new Set(readRecent().map((item) => item.id));

  function applyDefaultView() {
    if (defaultApplied) return;
    const config = window.WORKS_PORTFOLIO_CONFIG || {};
    if ((config.defaultView || 'shelf') !== 'shelf') {
      defaultApplied = true;
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.has('project') || params.has('view')) {
      defaultApplied = true;
      return;
    }
    const shelfButton = document.querySelector('[data-view-button="shelf"]');
    if (!shelfButton) return;
    defaultApplied = true;
    if (!shelfButton.classList.contains('is-active')) shelfButton.click();
  }

  function relabelLiveLinks() {
    document.querySelectorAll('.catalog-links a[title="公開ページ"]').forEach((link) => {
      if (link.textContent.trim() === '公開') link.textContent = '開く';
      link.setAttribute('aria-label', '公開ページを開く');
    });
  }

  function addRecentButton() {
    const host = document.querySelector('[data-cat-quick]');
    if (!host || host.querySelector('[data-recent-opened]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-quick-button';
    button.dataset.recentOpened = '';
    button.innerHTML = '<span>最近開いた</span><strong>0</strong>';
    button.addEventListener('click', () => {
      recentOnly = !recentOnly;
      applyRecentFilter();
    });
    host.appendChild(button);
  }

  function applyRecentFilter() {
    const button = document.querySelector('[data-recent-opened]');
    if (!button) return;
    const ids = recentIds();
    button.querySelector('strong').textContent = String(ids.size);
    button.classList.toggle('is-active', recentOnly);
    button.setAttribute('aria-pressed', String(recentOnly));

    const items = [...document.querySelectorAll('[data-cat-item]')];
    items.forEach((item) => {
      const id = item.getAttribute('data-cat-item');
      item.hidden = recentOnly && !ids.has(id);
    });

    document.querySelectorAll('.catalog-group').forEach((group) => {
      const visible = [...group.querySelectorAll('[data-cat-item]')].some((item) => !item.hidden);
      group.hidden = recentOnly && !visible;
    });

    if (recentOnly) {
      const visibleCount = items.filter((item) => !item.hidden).length;
      const count = document.querySelector('[data-cat-count]');
      if (count) count.innerHTML = `<strong>${visibleCount}</strong>件（最近開いた）`;
    }
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      applyDefaultView();
      addRecentButton();
      relabelLiveLinks();
      applyRecentFilter();
    });
  }

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-project-open]');
    if (openButton) recordOpened(openButton.getAttribute('data-project-open'));

    const link = event.target.closest('.catalog-links a');
    if (link) {
      const item = link.closest('[data-cat-item]');
      if (item) recordOpened(item.getAttribute('data-cat-item'));
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.querySelector('[data-cat-search]')?.focus();
      return;
    }
    if (!typing && event.key === '/') {
      event.preventDefault();
      document.querySelector('[data-cat-search]')?.focus();
    }
    if (event.key === 'Escape' && document.activeElement?.matches?.('[data-cat-search]')) {
      document.activeElement.value = '';
      document.activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      document.activeElement.blur();
    }
  });

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRefresh, { once: true });
  } else {
    scheduleRefresh();
  }
})();
