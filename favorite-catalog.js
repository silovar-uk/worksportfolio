(() => {
  'use strict';

  const RATINGS_KEY = 'worksPortfolioFavoriteRatingsV1';
  const STATE_KEY = 'worksportfolio-favorite-catalog-v1';
  const BASE_STATE_KEY = 'worksportfolio-catalog-v3';
  const SORT_MIGRATION_KEY = 'worksportfolio-start-sort-default-v2';
  const STYLE_ID = 'favorite-catalog-enhancement-style';
  const FAVORITE_SORTS = new Set(['favorite-desc', 'favorite-asc']);
  const START_SORTS = new Set(['created-desc', 'created-asc']);
  let scheduled = false;
  let applying = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .catalog-overview:has(.catalog-more:not([open])) .catalog-primary{
        grid-template-columns:minmax(220px,1fr) minmax(178px,240px)!important;
      }
      .catalog-overview:has(.catalog-more:not([open])) .catalog-primary>[data-cat-sort]{
        display:block!important;grid-column:2!important;grid-row:1!important;min-width:0!important;width:100%!important;
      }
      .catalog-overview:has(.catalog-more:not([open])) .catalog-primary>[data-cat-layout],
      .catalog-overview:has(.catalog-more:not([open])) .catalog-primary>[data-cat-group],
      .catalog-overview:has(.catalog-more:not([open])) .catalog-primary>.catalog-layout-switch{
        display:none!important;
      }
      .catalog-active{display:flex;align-items:center;gap:5px;min-width:0;overflow-x:auto;scrollbar-width:none;white-space:nowrap}
      .catalog-active::-webkit-scrollbar{display:none}
      .catalog-active:empty{display:none!important}
      .catalog-active button{flex:0 0 auto;border:1px solid color-mix(in srgb,var(--red) 35%,var(--line));background:color-mix(in srgb,var(--red) 7%,var(--paper));color:var(--ink);border-radius:999px;padding:.2rem .42rem;font-size:.66rem;font-weight:800}
      .catalog-overview[data-filtered="true"] .catalog-more{border-color:color-mix(in srgb,var(--red) 48%,var(--line))!important}
      .catalog-overview[data-filtered="true"] .catalog-more>summary{color:var(--red)!important;background:color-mix(in srgb,var(--red) 7%,var(--paper))!important}
      .catalog-overview[data-filtered="true"] .catalog-resultbar{background:color-mix(in srgb,var(--red) 5%,var(--paper))!important}
      .catalog-overview[data-filtered="true"] .catalog-result strong{color:var(--red)}
      @media(max-width:760px){
        .catalog-primary{grid-template-columns:minmax(0,1fr) minmax(118px,39%)!important;gap:4px!important}
        .catalog-search{grid-column:1!important;grid-row:1!important}
        .catalog-primary>[data-cat-sort]{display:block!important;grid-column:2!important;grid-row:1!important;min-width:0!important;width:100%!important;height:35px!important;min-height:35px!important;padding:.28rem .32rem!important;font-size:.62rem!important}
        .catalog-overview:has(.catalog-more:not([open])) .catalog-primary{grid-template-columns:minmax(0,1fr) minmax(118px,39%)!important}
        .catalog-overview:has(.catalog-more:not([open])) .catalog-resultbar .catalog-active{display:flex!important}
        .catalog-resultbar{overflow:hidden!important}
        .catalog-active{flex:1 1 auto}
        .catalog-active button{font-size:.59rem;padding:.16rem .34rem}
        .catalog-overview[data-filtered="true"] .catalog-more>summary{box-shadow:inset 3px 0 0 var(--red)}
      }
    `;
    document.head.appendChild(style);
  }

  function readRatings() {
    try {
      const value = JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function readState() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {};
    } catch {
      saved = {};
    }
    const params = new URLSearchParams(location.search);
    return {
      filter: params.get('fav_rating') || saved.filter || 'all',
      sort: params.get('fav_sort') || saved.sort || ''
    };
  }

  function writeState(state) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) { /* noop */ }
    const params = new URLSearchParams(location.search);
    if (state.filter && state.filter !== 'all') params.set('fav_rating', state.filter);
    else params.delete('fav_rating');
    if (FAVORITE_SORTS.has(state.sort)) params.set('fav_sort', state.sort);
    else params.delete('fav_sort');
    history.replaceState({}, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }

  function ratingFor(id, ratings) {
    const value = Number(ratings[id]);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
  }

  function projectMap() {
    const list = Array.isArray(window.BUILD_DIARY_DATA?.projects) ? window.BUILD_DIARY_DATA.projects : [];
    return new Map(list.map((project) => [project.id, project]));
  }

  function dateNumber(value) {
    return String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');
  }

  function ensureControls() {
    const sort = document.querySelector('[data-cat-sort]');
    const filters = document.querySelector('.catalog-filters');
    if (!sort || !filters) return null;

    if (!sort.dataset.startSortReady) {
      const desc = sort.querySelector('option[value="created-desc"]');
      const asc = sort.querySelector('option[value="created-asc"]');
      const updated = sort.querySelector('option[value="updated-desc"]');
      if (desc) desc.textContent = '制作開始が新しい順';
      if (asc) asc.textContent = '制作開始が古い順';
      if (desc) sort.insertBefore(desc, sort.firstChild);
      if (asc && desc) desc.insertAdjacentElement('afterend', asc);
      if (updated && asc) asc.insertAdjacentElement('afterend', updated);
      sort.dataset.startSortReady = '1';
    }

    if (!sort.querySelector('option[value="favorite-desc"]')) {
      sort.insertAdjacentHTML('beforeend', '<option value="favorite-desc">お気に入り度が高い順</option><option value="favorite-asc">お気に入り度が低い順</option>');
    }

    let filter = filters.querySelector('[data-cat-favorite-rating]');
    if (!filter) {
      filter = document.createElement('select');
      filter.dataset.catFavoriteRating = '';
      filter.setAttribute('aria-label', 'お気に入り度で絞り込む');
      filter.innerHTML = [
        '<option value="all">すべてのお気に入り度</option>',
        '<option value="5">★★★★★ 5</option>',
        '<option value="4">★★★★☆ 4</option>',
        '<option value="3">★★★☆☆ 3</option>',
        '<option value="2">★★☆☆☆ 2</option>',
        '<option value="1">★☆☆☆☆ 1</option>',
        '<option value="rated">評価あり</option>',
        '<option value="unrated">未評価</option>'
      ].join('');
      const reset = filters.querySelector('[data-cat-reset]');
      filters.insertBefore(filter, reset || null);
    }
    return { sort, filter };
  }

  function migrateDefaultSort(sort) {
    let migrated = false;
    try { migrated = localStorage.getItem(SORT_MIGRATION_KEY) === '1'; } catch (_) { migrated = false; }
    if (migrated) return;

    const params = new URLSearchParams(location.search);
    if (!params.has('cat_sort') && !params.has('fav_sort')) {
      let base = {};
      try { base = JSON.parse(localStorage.getItem(BASE_STATE_KEY) || '{}') || {}; } catch (_) { base = {}; }
      if (!base.sort || base.sort === 'updated-desc') {
        base.sort = 'created-desc';
        try { localStorage.setItem(BASE_STATE_KEY, JSON.stringify(base)); } catch (_) { /* noop */ }
        sort.value = 'created-desc';
        sort.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    try { localStorage.setItem(SORT_MIGRATION_KEY, '1'); } catch (_) { /* noop */ }
  }

  function itemNodes(group) {
    return [
      ...group.querySelectorAll(':scope > .catalog-list > [data-cat-item]'),
      ...group.querySelectorAll(':scope > .catalog-grid > [data-cat-item]'),
      ...group.querySelectorAll(':scope > .catalog-table-wrap > .catalog-table > tbody > [data-cat-item]')
    ];
  }

  function matchesFilter(rating, filter) {
    if (filter === 'rated') return rating > 0;
    if (filter === 'unrated') return rating === 0;
    if (/^[1-5]$/.test(filter)) return rating === Number(filter);
    return true;
  }

  function compareByFavorite(a, b, direction, ratings) {
    const ar = ratingFor(a.dataset.catItem || '', ratings);
    const br = ratingFor(b.dataset.catItem || '', ratings);
    if (ar === 0 && br !== 0) return 1;
    if (br === 0 && ar !== 0) return -1;
    if (ar !== br) return direction === 'asc' ? ar - br : br - ar;
    return 0;
  }

  function compareByStarted(a, b, direction, projects) {
    const ap = projects.get(a.dataset.catItem || '');
    const bp = projects.get(b.dataset.catItem || '');
    const av = dateNumber(ap?.startedAt || ap?.createdAt);
    const bv = dateNumber(bp?.startedAt || bp?.createdAt);
    const compared = av.localeCompare(bv);
    return direction === 'asc' ? compared : -compared;
  }

  function reorder(parent, items, comparator) {
    if (!parent || items.length < 2) return;
    const sorted = [...items].sort(comparator);
    const changed = sorted.some((item, index) => item !== items[index]);
    if (!changed) return;
    sorted.forEach((item) => parent.appendChild(item));
  }

  function favoriteFilterLabel(filter) {
    return {
      '5': 'お気に入り度 ★5', '4': 'お気に入り度 ★4', '3': 'お気に入り度 ★3',
      '2': 'お気に入り度 ★2', '1': 'お気に入り度 ★1', rated: 'お気に入り度 評価あり', unrated: 'お気に入り度 未評価'
    }[filter] || 'お気に入り度';
  }

  function setSummaryLabel(summary, label) {
    if (!summary) return;
    let textNode = [...summary.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (!textNode) {
      textNode = document.createTextNode('');
      summary.insertBefore(textNode, summary.firstChild);
    }
    const next = `${label} `;
    if (textNode.textContent !== next) textNode.textContent = next;
  }

  function syncActiveChip(filter) {
    const active = document.querySelector('[data-cat-active]');
    const counter = document.querySelector('[data-cat-filter-count]');
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const summary = toolbar?.querySelector('.catalog-more>summary');
    if (!active) return;

    let favoriteChip = active.querySelector('[data-favorite-filter-active]');
    if (filter !== 'all') {
      if (!favoriteChip) {
        favoriteChip = document.createElement('button');
        favoriteChip.type = 'button';
        favoriteChip.dataset.favoriteFilterActive = '';
        active.appendChild(favoriteChip);
      }
      const html = `${favoriteFilterLabel(filter)} <span aria-hidden="true">×</span>`;
      if (favoriteChip.innerHTML !== html) favoriteChip.innerHTML = html;
    } else {
      favoriteChip?.remove();
    }

    const total = active.querySelectorAll('button').length;
    if (counter) {
      const next = total ? `（${total}件）` : '';
      if (counter.textContent !== next) counter.textContent = next;
    }
    if (toolbar) {
      toolbar.dataset.filtered = total ? 'true' : 'false';
      toolbar.dataset.filterCount = String(total);
    }
    setSummaryLabel(summary, total ? '絞り込み中' : '絞り込み・表示');
  }

  function apply() {
    scheduled = false;
    if (applying) return;
    ensureStyles();
    const controls = ensureControls();
    const panel = document.querySelector('[data-view-panel]');
    const count = document.querySelector('[data-cat-count]');
    if (!controls || !panel || !count) return;

    const state = readState();
    if (!['all', 'rated', 'unrated', '1', '2', '3', '4', '5'].includes(state.filter)) state.filter = 'all';
    if (!FAVORITE_SORTS.has(state.sort)) state.sort = '';

    if (controls.filter.value !== state.filter) controls.filter.value = state.filter;
    if (state.sort && controls.sort.value !== state.sort) controls.sort.value = state.sort;

    const ratings = readRatings();
    const projects = projectMap();
    const activeSort = controls.sort.value;
    let visible = 0;
    applying = true;
    try {
      document.querySelectorAll('.catalog-group').forEach((group) => {
        const items = itemNodes(group);
        const parent = items[0]?.parentElement;
        if (FAVORITE_SORTS.has(activeSort)) {
          reorder(parent, items, (a, b) => compareByFavorite(a, b, activeSort === 'favorite-asc' ? 'asc' : 'desc', ratings));
        } else if (START_SORTS.has(activeSort)) {
          reorder(parent, items, (a, b) => compareByStarted(a, b, activeSort === 'created-asc' ? 'asc' : 'desc', projects));
        }

        let groupVisible = 0;
        items.forEach((item) => {
          const rating = ratingFor(item.dataset.catItem || '', ratings);
          const show = matchesFilter(rating, state.filter);
          item.hidden = !show;
          if (show) {
            visible += 1;
            groupVisible += 1;
          }
        });
        group.hidden = state.filter !== 'all' && groupVisible === 0;
        const groupCount = group.querySelector('.catalog-group-head span');
        if (groupCount) {
          const next = `${state.filter === 'all' ? items.length : groupVisible}件`;
          if (groupCount.textContent !== next) groupCount.textContent = next;
        }
      });

      const total = Array.isArray(window.BUILD_DIARY_DATA?.projects) ? window.BUILD_DIARY_DATA.projects.length : visible;
      const nextCount = `<strong>${visible}</strong> / ${total}件`;
      if (count.innerHTML !== nextCount) count.innerHTML = nextCount;
      syncActiveChip(state.filter);
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function resetToStartSort() {
    const sort = document.querySelector('[data-cat-sort]');
    if (!sort) return;
    sort.value = 'created-desc';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function start() {
    const wait = () => {
      ensureStyles();
      const controls = ensureControls();
      if (!controls || !window.BUILD_DIARY_DATA) {
        setTimeout(wait, 80);
        return;
      }

      migrateDefaultSort(controls.sort);
      const state = readState();
      if (FAVORITE_SORTS.has(state.sort)) controls.sort.value = state.sort;
      controls.filter.value = state.filter || 'all';

      document.addEventListener('change', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.matches('[data-cat-favorite-rating]')) {
          const next = readState();
          next.filter = target.value || 'all';
          writeState(next);
          schedule();
          return;
        }
        if (target?.matches('[data-cat-sort]')) {
          const next = readState();
          next.sort = FAVORITE_SORTS.has(target.value) ? target.value : '';
          writeState(next);
          schedule();
        }
      });

      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-favorite-filter-active]')) {
          const next = readState();
          next.filter = 'all';
          writeState(next);
          const filter = document.querySelector('[data-cat-favorite-rating]');
          if (filter) filter.value = 'all';
          schedule();
          return;
        }
        if (target?.closest('[data-cat-reset]')) {
          const next = readState();
          next.filter = 'all';
          next.sort = '';
          writeState(next);
          setTimeout(() => {
            resetToStartSort();
            schedule();
          }, 0);
          return;
        }
        if (target?.closest('.favorite-rating__star')) setTimeout(schedule, 0);
      });

      window.addEventListener('storage', (event) => {
        if (event.key === RATINGS_KEY || event.key === STATE_KEY || event.key === BASE_STATE_KEY) schedule();
      });
      window.addEventListener('popstate', schedule);

      const observer = new MutationObserver((records) => {
        if (!applying && records.some((record) => record.addedNodes.length || record.removedNodes.length)) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
