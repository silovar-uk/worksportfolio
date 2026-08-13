(() => {
  'use strict';

  const STORAGE_KEY = 'worksportfolio-personal-marks-v1';
  const FILTER_KEY = 'worksportfolio-mark-filter-v1';
  const state = {
    favorites: new Set(),
    later: new Set(),
    filter: 'all'
  };
  let scheduled = false;
  let applying = false;
  let observer = null;

  function readStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.favorites = new Set(Array.isArray(saved.favorites) ? saved.favorites : []);
      state.later = new Set(Array.isArray(saved.later) ? saved.later : []);
    } catch (_) {
      state.favorites = new Set();
      state.later = new Set();
    }
    const params = new URLSearchParams(location.search);
    const savedFilter = params.get('cat_mark') || localStorage.getItem(FILTER_KEY) || 'all';
    state.filter = ['all', 'favorite', 'later', 'unmarked'].includes(savedFilter) ? savedFilter : 'all';
  }

  function saveMarks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      favorites: [...state.favorites],
      later: [...state.later]
    }));
  }

  function saveFilter() {
    localStorage.setItem(FILTER_KEY, state.filter);
    const params = new URLSearchParams(location.search);
    if (state.filter === 'all') params.delete('cat_mark');
    else params.set('cat_mark', state.filter);
    history.replaceState({}, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }

  function projectIds() {
    return new Set((window.BUILD_DIARY_DATA?.projects || []).map((project) => project.id));
  }

  function pruneMissing() {
    const valid = projectIds();
    state.favorites = new Set([...state.favorites].filter((id) => valid.has(id)));
    state.later = new Set([...state.later].filter((id) => valid.has(id)));
    saveMarks();
  }

  function matches(id) {
    if (state.filter === 'favorite') return state.favorites.has(id);
    if (state.filter === 'later') return state.later.has(id);
    if (state.filter === 'unmarked') return !state.favorites.has(id) && !state.later.has(id);
    return true;
  }

  function markButton(id, kind) {
    const active = kind === 'favorite' ? state.favorites.has(id) : state.later.has(id);
    const label = kind === 'favorite' ? 'お気に入り' : 'あとで見る';
    const symbol = kind === 'favorite' ? (active ? '★' : '☆') : (active ? '●' : '○');
    return `<button type="button" class="catalog-mark-button${active ? ' is-active' : ''}" data-mark-toggle="${kind}" data-mark-id="${id}" aria-pressed="${active}" title="${label}${active ? 'から外す' : 'に追加'}"><span aria-hidden="true">${symbol}</span><span class="catalog-mark-label">${label}</span></button>`;
  }

  function ensureQuickButtons() {
    const quick = document.querySelector('[data-cat-quick]');
    if (!quick) return;
    const configs = [
      ['favorite', 'お気に入り', state.favorites.size, '★'],
      ['later', 'あとで見る', state.later.size, '○']
    ];
    configs.forEach(([filter, label, count, icon]) => {
      let button = quick.querySelector(`[data-mark-quick="${filter}"]`);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'catalog-quick-button catalog-mark-quick';
        button.dataset.markQuick = filter;
        quick.appendChild(button);
      }
      button.classList.toggle('is-active', state.filter === filter);
      button.setAttribute('aria-pressed', String(state.filter === filter));
      button.innerHTML = `<span>${icon} ${label}</span><strong>${count}</strong>`;
    });
  }

  function ensureFilterSelect() {
    const filters = document.querySelector('.catalog-filters');
    if (!filters) return;
    let select = filters.querySelector('[data-mark-filter]');
    if (!select) {
      select = document.createElement('select');
      select.dataset.markFilter = '';
      select.setAttribute('aria-label', 'お気に入り状態で絞り込む');
      select.innerHTML = '<option value="all">すべての個人マーク</option><option value="favorite">お気に入り</option><option value="later">あとで見る</option><option value="unmarked">未整理</option>';
      const reset = filters.querySelector('[data-cat-reset]');
      filters.insertBefore(select, reset || null);
    }
    select.value = state.filter;
  }

  function ensureBulkButtons() {
    const bulk = document.querySelector('[data-cat-bulk]');
    if (!bulk) return;
    if (!bulk.querySelector('[data-mark-bulk="favorite"]')) {
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = 'text-action catalog-mark-bulk';
      favorite.dataset.markBulk = 'favorite';
      favorite.textContent = '★ お気に入り';
      bulk.insertBefore(favorite, bulk.querySelector('[data-cat-format]'));
    }
    if (!bulk.querySelector('[data-mark-bulk="later"]')) {
      const later = document.createElement('button');
      later.type = 'button';
      later.className = 'text-action catalog-mark-bulk';
      later.dataset.markBulk = 'later';
      later.textContent = '○ あとで見る';
      bulk.insertBefore(later, bulk.querySelector('[data-cat-format]'));
    }
  }

  function decorateItem(item) {
    const id = item.getAttribute('data-cat-item');
    if (!id) return;
    item.classList.toggle('is-favorite', state.favorites.has(id));
    item.classList.toggle('is-later', state.later.has(id));
    item.hidden = !matches(id);

    let actions = item.querySelector('.catalog-mark-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'catalog-mark-actions';
      if (item.tagName === 'TR') {
        const titleCell = item.children[1];
        if (titleCell) titleCell.appendChild(actions);
      } else if (item.classList.contains('catalog-row')) {
        const links = item.querySelector('.catalog-links');
        if (links) links.prepend(actions);
        else item.appendChild(actions);
      } else {
        item.appendChild(actions);
      }
    }
    const desired = markButton(id, 'favorite') + markButton(id, 'later');
    if (actions.innerHTML !== desired) actions.innerHTML = desired;
  }

  function updateGroups() {
    document.querySelectorAll('.catalog-group').forEach((group) => {
      const items = [...group.querySelectorAll('[data-cat-item]')];
      const visible = items.filter((item) => !item.hidden).length;
      group.hidden = visible === 0;
      const count = group.querySelector('.catalog-group-head span');
      if (count) count.textContent = `${visible}件`;
    });
  }

  function updateResultCount() {
    const result = document.querySelector('[data-cat-count]');
    if (!result) return;
    const all = [...document.querySelectorAll('[data-cat-item]')];
    const visible = all.filter((item) => !item.hidden).length;
    const total = window.BUILD_DIARY_DATA?.projects?.length || all.length;
    result.innerHTML = `<strong>${visible}</strong> / ${total}件`;
  }

  function ensureActiveChip() {
    const active = document.querySelector('[data-cat-active]');
    if (!active) return;
    active.querySelectorAll('[data-mark-chip]').forEach((chip) => chip.remove());
    if (state.filter === 'all') return;
    const labels = { favorite: 'お気に入り', later: 'あとで見る', unmarked: '未整理' };
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.markChip = '';
    button.textContent = `${labels[state.filter]} ×`;
    active.appendChild(button);
  }

  function updateSelectVisibleLabel() {
    const label = document.querySelector('.catalog-select-visible');
    if (!label) return;
    const text = state.filter === 'all' ? '表示中を選択' : '絞り込み結果を選択';
    const input = label.querySelector('input');
    label.lastChild.textContent = ` ${text}`;
    if (input) input.setAttribute('aria-label', text);
  }

  function apply() {
    if (applying) return;
    applying = true;
    if (observer) observer.disconnect();
    ensureQuickButtons();
    ensureFilterSelect();
    ensureBulkButtons();
    document.querySelectorAll('[data-cat-item]').forEach(decorateItem);
    updateGroups();
    updateResultCount();
    ensureActiveChip();
    updateSelectVisibleLabel();
    applying = false;
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function toggle(id, kind) {
    const set = kind === 'favorite' ? state.favorites : state.later;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    saveMarks();
    scheduleApply();
  }

  function selectedIds() {
    return [...document.querySelectorAll('[data-cat-check]:checked')].map((input) => input.dataset.catCheck).filter(Boolean);
  }

  function bulkToggle(kind) {
    const ids = selectedIds();
    if (!ids.length) return;
    const set = kind === 'favorite' ? state.favorites : state.later;
    const shouldAdd = ids.some((id) => !set.has(id));
    ids.forEach((id) => shouldAdd ? set.add(id) : set.delete(id));
    saveMarks();
    scheduleApply();
    const feedback = document.querySelector('[data-cat-feedback]');
    if (feedback) {
      feedback.textContent = `${ids.length}件を${kind === 'favorite' ? 'お気に入り' : 'あとで見る'}${shouldAdd ? 'に追加' : 'から解除'}しました`;
      setTimeout(() => { feedback.textContent = ''; }, 2200);
    }
  }

  function setFilter(filter) {
    state.filter = filter;
    saveFilter();
    scheduleApply();
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const toggleButton = event.target.closest('[data-mark-toggle]');
      if (toggleButton) {
        event.preventDefault();
        event.stopPropagation();
        toggle(toggleButton.dataset.markId, toggleButton.dataset.markToggle);
        return;
      }
      const quick = event.target.closest('[data-mark-quick]');
      if (quick) {
        event.preventDefault();
        setFilter(quick.dataset.markQuick);
        return;
      }
      const chip = event.target.closest('[data-mark-chip]');
      if (chip) {
        event.preventDefault();
        setFilter('all');
        return;
      }
      const bulk = event.target.closest('[data-mark-bulk]');
      if (bulk) {
        event.preventDefault();
        bulkToggle(bulk.dataset.markBulk);
      }
    });

    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-mark-filter]')) setFilter(event.target.value);
    });
  }

  function start() {
    readStorage();
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]')) {
        setTimeout(wait, 100);
        return;
      }
      pruneMissing();
      bindEvents();
      observer = new MutationObserver(scheduleApply);
      observer.observe(document.body, { childList: true, subtree: true });
      scheduleApply();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
