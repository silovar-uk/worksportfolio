(() => {
  'use strict';

  const TYPE_LABELS = {
    'web-app': 'Webアプリ',
    'chrome-extension': 'Chrome拡張',
    'learning-tool': '学習ツール',
    'design-system': '設計ガイド',
    'content-page': 'コンテンツ',
    'data-tool': '分析・データ',
    utility: '便利ツール',
    experiment: '実験'
  };
  const STATUS_LABELS = {
    development: '開発中',
    active: '運用中',
    prototype: '試作中',
    dormant: '休止中',
    legacy: '初期記録'
  };
  const GLOBAL_ALIAS_GROUPS = [
    ['memo', 'メモ', 'めも'],
    ['chrome', 'クローム', 'くろーむ'],
    ['web', 'ウェブ', 'うぇぶ']
  ];

  let ready = false;
  let allowNativeSearch = false;
  let searchMode = false;
  let savedMarkFilter = null;
  let isComposing = false;
  let renderTimer = 0;
  let headerComposing = false;
  let headerTimer = 0;
  let headerActiveIndex = -1;

  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const projects = () => window.BUILD_DIARY_DATA?.projects || [];

  function kanaToHira(value) {
    return String(value || '').replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function norm(value) {
    return kanaToHira(String(value || '').toLowerCase().normalize('NFKC'))
      .replace(/[・･_\-‐‑‒–—―/\\.,:;'\"“”‘’!?！？()（）[\]【】{}<>「」『』]/g, '')
      .replace(/\s+/g, '');
  }

  const aliasGroups = GLOBAL_ALIAS_GROUPS.map((group) => group.map(norm));

  function queryTerms(query) {
    return String(query || '').normalize('NFKC').trim().split(/\s+/).map(norm).filter(Boolean);
  }

  function termMatches(haystack, term) {
    if (haystack.includes(term)) return true;
    const group = aliasGroups.find((items) => items.includes(term));
    return group ? group.some((alias) => haystack.includes(alias)) : false;
  }

  function searchable(project) {
    return norm([
      project.title,
      project.subtitle,
      project.summary,
      project.friction,
      project.firstBuild,
      project.currentAnswer,
      project.id,
      project.type,
      project.status,
      project.documentationState,
      ...(project.verbs || []),
      ...(project.technologies || []),
      ...(project.searchAliases || []),
      ...(project.relatedProjects || []).map((item) => item?.relation || '')
    ].join(' '));
  }

  function matches(project, query) {
    const terms = queryTerms(query);
    if (!terms.length) return true;
    const haystack = searchable(project);
    return terms.every((term) => termMatches(haystack, term));
  }

  function fieldScore(value, term, exact, prefix, partial) {
    const field = norm(value);
    if (!field) return 0;
    if (field === term) return exact;
    if (field.startsWith(term)) return prefix;
    if (field.includes(term)) return partial;
    const group = aliasGroups.find((items) => items.includes(term));
    if (!group) return 0;
    if (group.some((alias) => field === alias)) return exact - 4;
    if (group.some((alias) => field.startsWith(alias))) return prefix - 4;
    if (group.some((alias) => field.includes(alias))) return partial - 4;
    return 0;
  }

  function relevanceScore(project, query) {
    const terms = queryTerms(query);
    return terms.reduce((score, term) => {
      let termScore = 0;
      termScore = Math.max(termScore, fieldScore(project.title, term, 130, 105, 82));
      termScore = Math.max(termScore, fieldScore(project.id, term, 112, 90, 72));
      for (const alias of project.searchAliases || []) {
        termScore = Math.max(termScore, fieldScore(alias, term, 118, 94, 76));
      }
      termScore = Math.max(termScore, fieldScore(project.subtitle, term, 74, 60, 46));
      termScore = Math.max(termScore, fieldScore(project.summary, term, 42, 34, 26));
      termScore = Math.max(termScore, fieldScore(project.friction, term, 30, 24, 18));
      termScore = Math.max(termScore, fieldScore((project.verbs || []).join(' '), term, 34, 26, 20));
      termScore = Math.max(termScore, fieldScore((project.technologies || []).join(' '), term, 28, 22, 16));
      return score + termScore;
    }, project.featured ? 3 : 0);
  }

  function dateKey(value) {
    return String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');
  }

  function startDate(project) {
    return project.startedAt || project.createdAt || '';
  }

  function sortResults(list) {
    const sort = document.querySelector('[data-cat-sort]')?.value || 'created-desc';
    return list.sort(
      sort === 'created-asc' ? (a, b) => dateKey(startDate(a)).localeCompare(dateKey(startDate(b))) :
      sort === 'title-asc' ? (a, b) => String(a.title).localeCompare(String(b.title), 'ja') :
      sort === 'type-asc' ? (a, b) => String(TYPE_LABELS[a.type] || a.type).localeCompare(String(TYPE_LABELS[b.type] || b.type), 'ja') :
      sort === 'status-asc' ? (a, b) => String(STATUS_LABELS[a.status] || a.status).localeCompare(String(STATUS_LABELS[b.status] || b.status), 'ja') :
      sort === 'updated-desc' ? (a, b) => dateKey(b.updatedAt || b.createdAt).localeCompare(dateKey(a.updatedAt || a.createdAt)) :
      (a, b) => dateKey(startDate(b)).localeCompare(dateKey(startDate(a)))
    );
  }

  function searchProjects(query, options = {}) {
    const order = options.order || 'relevance';
    const limit = Number(options.limit) || 0;
    let list = projects().filter((project) => matches(project, query));
    if (order === 'catalog') {
      list = sortResults(list);
    } else {
      list.sort((a, b) => {
        const scoreDiff = relevanceScore(b, query) - relevanceScore(a, query);
        if (scoreDiff) return scoreDiff;
        return dateKey(b.updatedAt || startDate(b)).localeCompare(dateKey(a.updatedAt || startDate(a)));
      });
    }
    return limit ? list.slice(0, limit) : list;
  }

  window.WORKS_PORTFOLIO_SEARCH = Object.freeze({
    normalize: norm,
    matches,
    search: (query, options) => searchProjects(query, options)
  });

  function installStyles() {
    if (document.getElementById('catalog-search-redesign-style')) return;
    const style = document.createElement('style');
    style.id = 'catalog-search-redesign-style';
    style.textContent = `
.catalog-overview.catalog-search-redesign{border-top:2px solid var(--ink);box-shadow:none}
.catalog-search-redesign .catalog-primary{grid-template-columns:repeat(3,minmax(145px,1fr));padding:14px;align-items:start}
.catalog-search-stack{grid-column:1/-1;display:grid;gap:0}
.catalog-search-redesign .catalog-search{position:relative;display:block}
.catalog-search-redesign .catalog-search input{width:100%;min-height:58px;padding:.85rem 9.5rem .85rem 1rem;font-size:1.05rem;box-shadow:4px 4px 0 rgba(32,36,38,.06)}
.catalog-search-redesign .catalog-search::after{content:"全作品から検索";position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:.68rem;font-weight:800;color:var(--muted);pointer-events:none}
.catalog-search-surface{margin-top:12px;border-top:1px solid var(--ink);padding-top:12px}
.catalog-search-surface[hidden]{display:none}
.catalog-search-summary{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px}
.catalog-search-summary p{margin:0;font-size:.86rem;color:var(--muted)}
.catalog-search-summary strong{color:var(--ink)}
.catalog-search-clear{border:0;border-bottom:1px solid currentColor;background:transparent;padding:.2rem 0;cursor:pointer;font-size:.76rem;color:var(--muted)}
.catalog-search-results{display:grid;gap:10px}
.catalog-search-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:16px;border:1px solid var(--line-dark);background:var(--paper);box-shadow:3px 3px 0 rgba(32,36,38,.05)}
.catalog-search-result.is-featured{border-left:5px solid var(--red);background:linear-gradient(90deg,rgba(231,207,104,.14),var(--paper) 28%)}
.catalog-search-result-main{border:0;background:transparent;padding:0;text-align:left;cursor:pointer;min-width:0}
.catalog-search-result-main strong{display:block;font-size:1.05rem;line-height:1.3}
.catalog-search-result-main p{margin:.35rem 0 0;color:var(--muted);font-size:.8rem}
.catalog-search-result-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:.55rem}
.catalog-search-result-meta span{padding:.16rem .38rem;border:1px solid var(--line);font-size:.66rem;background:var(--bg)}
.catalog-search-result-links{display:flex;align-items:flex-start;gap:5px}
.catalog-search-result-links a{padding:.3rem .44rem;border:1px solid var(--line);font-size:.68rem;text-decoration:none}
.catalog-search-result-links a:hover,.catalog-search-result-links a:focus-visible{background:var(--ink);color:var(--paper)}
.catalog-search-empty{padding:34px 18px;border:1px dashed var(--line-dark);background:rgba(255,253,247,.45);text-align:center}
.catalog-search-empty h3{margin:0;font-size:1rem}.catalog-search-empty p{margin:.45rem 0 0;color:var(--muted);font-size:.82rem}
.catalog-filter-trigger{min-height:40px;padding:.48rem .72rem;border:1px solid var(--ink);background:var(--paper);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:.42rem;font-weight:800;font-size:.82rem;box-shadow:3px 3px 0 var(--yellow)}
.catalog-filter-trigger:hover,.catalog-filter-trigger:focus-visible{background:var(--ink);color:var(--paper)}
.catalog-filter-trigger b{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--red);color:#fff;font:800 .67rem "Roboto Mono",monospace}
.catalog-filter-shell[hidden]{display:none}.catalog-filter-shell{position:relative;padding:0 14px 14px}
.catalog-filter-backdrop{display:none}.catalog-filter-panel{border:1px solid var(--line-dark);background:var(--paper);box-shadow:5px 5px 0 rgba(32,36,38,.08);padding:14px}
.catalog-filter-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.catalog-filter-panel-head h3{margin:0;font-size:1.05rem}.catalog-filter-panel-head p{margin:.25rem 0 0;color:var(--muted);font-size:.75rem}
.catalog-filter-close{width:38px;height:38px;border:1px solid var(--line);background:transparent;cursor:pointer;font-size:1.2rem}
.catalog-filter-panel .catalog-quick{grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:10px;border:1px solid var(--line-dark)}
.catalog-filter-panel .catalog-more{display:block!important;border:0;padding:0}.catalog-filter-panel .catalog-more>summary{display:none}.catalog-filter-panel .catalog-filters{padding:0}
.catalog-search-redesign.is-search-mode .catalog-primary>select,.catalog-search-redesign.is-search-mode .catalog-resultbar{display:none}
@media(max-width:760px){
.catalog-search-redesign .catalog-primary{grid-template-columns:1fr 1fr;padding:10px}.catalog-search-redesign .catalog-search input{padding-right:1rem}.catalog-search-redesign .catalog-search::after{display:none}
.catalog-search-summary{align-items:flex-start}.catalog-search-result{grid-template-columns:1fr}.catalog-search-result-links{grid-row:2}
.catalog-filter-trigger{position:fixed;right:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:48;min-height:48px;padding:.62rem .82rem;border-radius:999px;box-shadow:0 8px 24px rgba(32,36,38,.22),3px 3px 0 var(--yellow)}
.catalog-filter-shell{position:fixed;inset:0;z-index:80;padding:0;display:flex;align-items:flex-end}.catalog-filter-shell[hidden]{display:none}
.catalog-filter-backdrop{display:block;position:absolute;inset:0;border:0;background:rgba(32,36,38,.48)}
.catalog-filter-panel{position:relative;z-index:1;width:100%;max-height:82vh;overflow:auto;border:0;border-radius:18px 18px 0 0;padding:16px 14px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 44px rgba(0,0,0,.18)}
.catalog-filter-panel .catalog-quick{grid-template-columns:repeat(2,1fr)}.catalog-filter-panel .catalog-filters{grid-template-columns:1fr 1fr}
body.catalog-filter-pop-open{overflow:hidden}
}
@media(max-width:420px){.catalog-filter-panel .catalog-filters{grid-template-columns:1fr}.catalog-search-summary{display:grid;gap:4px}}
`;
    document.head.appendChild(style);
  }

  function activeFilterCount() {
    const selectors = ['[data-cat-verb]', '[data-cat-type]', '[data-cat-status]', '[data-cat-year]', '[data-cat-doc]', '[data-cat-link]'];
    let count = selectors.filter((selector) => document.querySelector(selector)?.value).length;
    const quick = document.querySelector('[data-cat-quick-value].is-active');
    if (quick && quick.dataset.catQuickValue !== 'all') count += 1;
    const mark = document.querySelector('[data-mark-filter]');
    if (mark && mark.value !== 'all') count += 1;
    return count;
  }

  function updateFilterBadge() {
    const badge = document.querySelector('[data-filter-badge]');
    if (!badge) return;
    const count = activeFilterCount();
    badge.textContent = count ? String(count) : '';
    badge.hidden = !count;
  }

  function setFilterOpen(open) {
    const shell = document.querySelector('[data-filter-shell]');
    const trigger = document.querySelector('[data-filter-open]');
    if (!shell || !trigger) return;
    shell.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('catalog-filter-pop-open', open && matchMedia('(max-width:760px)').matches);
  }

  function restructureToolbar() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!toolbar || toolbar.dataset.searchRedesign) return false;
    const primary = toolbar.querySelector('.catalog-primary');
    const search = toolbar.querySelector('.catalog-search');
    const quick = toolbar.querySelector('[data-cat-quick]');
    const more = toolbar.querySelector('[data-cat-more]');
    const resultbar = toolbar.querySelector('.catalog-resultbar');
    if (!primary || !search || !quick || !more || !resultbar) return false;

    toolbar.dataset.searchRedesign = 'true';
    toolbar.classList.add('catalog-search-redesign');

    const stack = document.createElement('div');
    stack.className = 'catalog-search-stack';
    stack.dataset.searchStack = '';
    primary.insertBefore(stack, search);
    stack.appendChild(search);

    const surface = document.createElement('section');
    surface.className = 'catalog-search-surface';
    surface.dataset.searchSurface = '';
    surface.setAttribute('aria-live', 'polite');
    surface.setAttribute('aria-label', '検索結果');
    surface.hidden = true;
    stack.appendChild(surface);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'catalog-filter-trigger';
    trigger.dataset.filterOpen = '';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span aria-hidden="true">☷</span><span>絞り込む</span><b data-filter-badge hidden></b>';
    resultbar.appendChild(trigger);

    const shell = document.createElement('div');
    shell.className = 'catalog-filter-shell';
    shell.dataset.filterShell = '';
    shell.hidden = true;
    shell.innerHTML = '<button type="button" class="catalog-filter-backdrop" data-filter-close aria-label="絞り込みを閉じる"></button><aside class="catalog-filter-panel"><div class="catalog-filter-panel-head"><div><h3>眺め方を絞る</h3><p>検索中は全作品を対象にします。</p></div><button type="button" class="catalog-filter-close" data-filter-close aria-label="閉じる">×</button></div></aside>';
    const filterPanel = shell.querySelector('.catalog-filter-panel');
    more.open = true;
    filterPanel.appendChild(quick);
    filterPanel.appendChild(more);
    toolbar.appendChild(shell);

    trigger.addEventListener('click', () => setFilterOpen(true));
    shell.querySelectorAll('[data-filter-close]').forEach((button) => button.addEventListener('click', () => setFilterOpen(false)));
    updateFilterBadge();
    return true;
  }

  function rememberAndNeutralizeMarkFilter() {
    const select = document.querySelector('[data-mark-filter]');
    if (!select || select.value === 'all') return;
    if (savedMarkFilter == null) savedMarkFilter = select.value;
    select.value = 'all';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function restoreMarkFilter() {
    if (savedMarkFilter == null) return;
    const select = document.querySelector('[data-mark-filter]');
    if (select) {
      select.value = savedMarkFilter;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    savedMarkFilter = null;
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function resultHtml(project) {
    const links = [
      project.liveUrl ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">公開</a>` : '',
      project.repositoryUrl ? `<a href="${attr(project.repositoryUrl)}" target="_blank" rel="noopener">GitHub</a>` : ''
    ].filter(Boolean).join('');
    const status = STATUS_LABELS[project.status] || project.status || '';
    return `<article class="catalog-search-result${project.featured ? ' is-featured' : ''}" data-search-item="${attr(project.id)}">
      <button type="button" class="catalog-search-result-main" data-search-open="${attr(project.id)}">
        <strong>${esc(project.title || project.id)}</strong>
        <p>${esc(project.summary || project.friction || '説明を確認中です。')}</p>
        <span class="catalog-search-result-meta"><span>${esc(TYPE_LABELS[project.type] || project.type || 'その他')}</span>${status ? `<span>${esc(status)}</span>` : ''}</span>
      </button>
      ${links ? `<div class="catalog-search-result-links">${links}</div>` : ''}
    </article>`;
  }

  function setSearchMode(active) {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const panel = document.querySelector('[data-view-panel]');
    const surface = document.querySelector('[data-search-surface]');
    searchMode = active;
    toolbar?.classList.toggle('is-search-mode', active);
    if (surface) surface.hidden = !active;
    if (panel) {
      panel.hidden = active;
      panel.setAttribute('aria-hidden', active ? 'true' : 'false');
    }
    if (active) setFilterOpen(false);
  }

  function updateSearchUrl(query) {
    const params = new URLSearchParams(location.search);
    if (query) params.set('cat_q', query);
    else params.delete('cat_q');
    history.replaceState({}, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }

  function renderSearch() {
    const input = document.querySelector('[data-cat-search]');
    const surface = document.querySelector('[data-search-surface]');
    if (!input || !surface) return;
    const query = input.value.trim();
    if (!query) {
      resumeNativeView();
      return;
    }

    rememberAndNeutralizeMarkFilter();
    setSearchMode(true);
    const list = searchProjects(query, { order: 'catalog' });
    const summary = `<div class="catalog-search-summary"><p><strong>「${esc(query)}」</strong> の検索結果 <strong>${list.length}件</strong></p><button type="button" class="catalog-search-clear" data-search-clear>検索を解除</button></div>`;
    surface.innerHTML = list.length
      ? `${summary}<div class="catalog-search-results">${list.map(resultHtml).join('')}</div>`
      : `${summary}<div class="catalog-search-empty"><h3>一致する制作物はありません。</h3><p>別の言い方、ひらがな・カタカナ、英語名でも試せます。</p></div>`;
    updateSearchUrl(query);
  }

  function resumeNativeView() {
    const input = document.querySelector('[data-cat-search]');
    if (!input) return;
    clearTimeout(renderTimer);
    setSearchMode(false);
    restoreMarkFilter();
    updateSearchUrl('');
    allowNativeSearch = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    allowNativeSearch = false;
  }

  function scheduleSearch(delay = 70) {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      const input = document.querySelector('[data-cat-search]');
      if (!input || isComposing) return;
      if (input.value.trim()) renderSearch();
      else resumeNativeView();
    }, delay);
  }

  function clearSearch() {
    const input = document.querySelector('[data-cat-search]');
    if (!input) return;
    input.value = '';
    resumeNativeView();
    input.focus({ preventScroll: true });
  }

  function openFullSearch(query) {
    const input = document.querySelector('[data-cat-search]');
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!input || !toolbar) return;
    input.value = query;
    renderSearch();
    closeHeaderSuggestions();
    requestAnimationFrame(() => toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function bindSearch() {
    const input = document.querySelector('[data-cat-search]');
    if (!input || input.dataset.searchRedesignBound) return;
    input.dataset.searchRedesignBound = 'true';

    input.addEventListener('compositionstart', () => {
      isComposing = true;
      clearTimeout(renderTimer);
    }, true);

    input.addEventListener('compositionend', () => {
      isComposing = false;
      scheduleSearch(0);
    }, true);

    input.addEventListener('input', (event) => {
      if (allowNativeSearch) return;
      event.stopImmediatePropagation();
      if (event.isComposing || isComposing) return;
      scheduleSearch();
    }, true);

    document.addEventListener('click', (event) => {
      const clear = event.target.closest('[data-search-clear]');
      if (clear) {
        event.preventDefault();
        clearSearch();
        return;
      }
      const open = event.target.closest('[data-search-open]');
      if (open) {
        event.preventDefault();
        openProject(open.dataset.searchOpen);
      }
    });

    ['[data-cat-sort]', '[data-cat-layout]', '[data-cat-group]', '[data-cat-verb]', '[data-cat-type]', '[data-cat-status]', '[data-cat-year]', '[data-cat-doc]', '[data-cat-link]', '[data-mark-filter]']
      .forEach((selector) => document.querySelector(selector)?.addEventListener('change', () => {
        updateFilterBadge();
        if (selector === '[data-cat-sort]' && input.value.trim() && !isComposing) renderSearch();
      }));

    document.querySelector('[data-cat-quick]')?.addEventListener('click', () => window.setTimeout(updateFilterBadge, 0));
    document.querySelector('[data-cat-reset]')?.addEventListener('click', () => window.setTimeout(() => {
      updateFilterBadge();
      if (!input.value.trim() && searchMode) resumeNativeView();
    }, 0));

    if (input.value.trim()) renderSearch();
  }

  function truncate(value, max = 72) {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function headerSuggestionHtml(project, index) {
    const type = TYPE_LABELS[project.type] || project.type || '制作物';
    return `<button type="button" class="header-search-option" role="option" aria-selected="false" data-header-search-option="${index}" data-header-search-open="${attr(project.id)}">
      <strong>${esc(project.title || project.id)}</strong>
      <small>${esc(truncate(project.summary || project.subtitle || project.friction || ''))}</small>
      <span>${esc(type)}</span>
    </button>`;
  }

  function headerElements() {
    return {
      shell: document.querySelector('[data-header-search]'),
      input: document.querySelector('[data-header-search-input]'),
      panel: document.querySelector('[data-header-search-panel]'),
      list: document.querySelector('[data-header-search-list]')
    };
  }

  function closeHeaderSuggestions() {
    const { input, panel } = headerElements();
    if (!panel) return;
    panel.hidden = true;
    headerActiveIndex = -1;
    input?.setAttribute('aria-expanded', 'false');
  }

  function syncHeaderActiveOption() {
    const { input, list } = headerElements();
    const options = [...(list?.querySelectorAll('[data-header-search-option]') || [])];
    options.forEach((option, index) => {
      const active = index === headerActiveIndex;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-selected', String(active));
    });
    if (input) {
      const active = options[headerActiveIndex];
      if (active) {
        if (!active.id) active.id = `header-search-option-${headerActiveIndex}`;
        input.setAttribute('aria-activedescendant', active.id);
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }
  }

  function renderHeaderSuggestions() {
    const { input, panel, list } = headerElements();
    if (!input || !panel || !list || headerComposing) return;
    const query = input.value.trim();
    if (!query) {
      closeHeaderSuggestions();
      list.innerHTML = '';
      return;
    }

    const matchesList = searchProjects(query, { order: 'relevance', limit: 5 });
    headerActiveIndex = -1;
    list.innerHTML = matchesList.length
      ? matchesList.map(headerSuggestionHtml).join('')
      : '<p class="header-search-empty">一致する制作物はありません。</p>';
    const all = matchesList.length
      ? `<button type="button" class="header-search-all" data-header-search-all>すべての検索結果を見る →</button>`
      : '';
    panel.querySelector('[data-header-search-all]')?.remove();
    if (all) panel.insertAdjacentHTML('beforeend', all);
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function scheduleHeaderSuggestions(delay = 45) {
    clearTimeout(headerTimer);
    headerTimer = window.setTimeout(() => {
      if (!headerComposing) renderHeaderSuggestions();
    }, delay);
  }

  function installHeaderSearch() {
    const header = document.querySelector('.header-inner');
    const nav = header?.querySelector('.global-nav');
    if (!header || !nav || header.querySelector('[data-header-search]')) return;

    const shell = document.createElement('div');
    shell.className = 'header-search';
    shell.dataset.headerSearch = '';
    shell.innerHTML = `
      <label class="header-search-label">
        <span class="sr-only">制作物を検索</span>
        <input class="header-search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="制作物を検索" data-header-search-input aria-autocomplete="list" aria-expanded="false" aria-controls="header-search-panel">
        <span class="header-search-icon" aria-hidden="true">⌕</span>
      </label>
      <div class="header-search-panel" id="header-search-panel" data-header-search-panel role="listbox" aria-label="検索候補" hidden>
        <div class="header-search-list" data-header-search-list></div>
      </div>`;
    header.insertBefore(shell, nav);
  }

  function bindHeaderSearch() {
    const { shell, input } = headerElements();
    if (!shell || !input || input.dataset.headerSearchBound) return;
    input.dataset.headerSearchBound = 'true';

    input.addEventListener('compositionstart', () => {
      headerComposing = true;
      clearTimeout(headerTimer);
    }, true);
    input.addEventListener('compositionend', () => {
      headerComposing = false;
      scheduleHeaderSuggestions(0);
    }, true);
    input.addEventListener('input', (event) => {
      if (event.isComposing || headerComposing) return;
      scheduleHeaderSuggestions();
    }, true);
    input.addEventListener('focus', () => {
      if (input.value.trim()) renderHeaderSuggestions();
    });
    input.addEventListener('keydown', (event) => {
      const options = [...document.querySelectorAll('[data-header-search-option]')];
      if (event.key === 'ArrowDown' && options.length) {
        event.preventDefault();
        headerActiveIndex = Math.min(headerActiveIndex + 1, options.length - 1);
        syncHeaderActiveOption();
      } else if (event.key === 'ArrowUp' && options.length) {
        event.preventDefault();
        headerActiveIndex = headerActiveIndex <= 0 ? options.length - 1 : headerActiveIndex - 1;
        syncHeaderActiveOption();
      } else if (event.key === 'Enter' && input.value.trim()) {
        event.preventDefault();
        const active = options[headerActiveIndex];
        if (active?.dataset.headerSearchOpen) openProject(active.dataset.headerSearchOpen);
        else openFullSearch(input.value.trim());
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeHeaderSuggestions();
      }
    });

    shell.addEventListener('click', (event) => {
      const option = event.target.closest('[data-header-search-open]');
      if (option) {
        event.preventDefault();
        openProject(option.dataset.headerSearchOpen);
        return;
      }
      const all = event.target.closest('[data-header-search-all]');
      if (all) {
        event.preventDefault();
        openFullSearch(input.value.trim());
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!shell.contains(event.target)) closeHeaderSuggestions();
    }, true);
  }

  function bindGlobal() {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[data-filter-shell]') && !document.querySelector('[data-filter-shell]').hidden) {
        setFilterOpen(false);
        return;
      }
      if (searchMode) clearSearch();
    });
  }

  function start() {
    if (ready) return;
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]') || !document.querySelector('.header-inner')) {
        setTimeout(wait, 80);
        return;
      }
      ready = true;
      installStyles();
      installHeaderSearch();
      restructureToolbar();
      bindSearch();
      bindHeaderSearch();
      bindGlobal();
      setTimeout(updateFilterBadge, 120);
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();