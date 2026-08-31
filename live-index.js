(() => {
  'use strict';

  const TYPE_LABELS = {
    'web-app': 'Webアプリ',
    'chrome-extension': 'Chrome拡張',
    'learning-tool': '学習ツール',
    'design-system': '設計・デザイン',
    'content-page': '文章・知識',
    'data-tool': '分析・データ',
    utility: '便利ツール',
    experiment: '実験'
  };

  const QUICK_FILTERS = [
    { id: 'recent', label: '最近更新' },
    { id: 'extension', label: 'Chrome拡張' },
    { id: 'learning', label: '学習' },
    { id: 'writing', label: '文章・知識' },
    { id: 'work', label: '業務改善' },
    { id: 'random', label: 'ランダム' }
  ];

  const state = { query: '', quick: 'recent', selectedIndex: 0 };
  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, '');
  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');

  function dateNumber(value) {
    return String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');
  }

  function formatDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[2]}.${match[3]}`;
    const month = String(value || '').match(/^(\d{4})-(\d{2})/);
    if (month) return `${month[1]}.${month[2]}`;
    return value ? String(value).slice(0, 10).replace(/-/g, '.') : '—';
  }

  function searchable(project) {
    return normalize([
      project.title,
      project.subtitle,
      project.summary,
      project.friction,
      project.currentAnswer,
      ...(project.verbs || []),
      ...(project.technologies || []),
      ...(project.searchAliases || []),
      ...(project.portfolioFamilies || []),
      ...(project.makingPrinciples || [])
    ].filter(Boolean).join(' '));
  }

  function isWriting(project) {
    const text = searchable(project);
    return project.type === 'content-page' || ['文章', '記事', '知識', '辞書', 'essay', 'writing', 'contents', 'memo'].some((word) => text.includes(normalize(word)));
  }

  function isWork(project) {
    const text = searchable(project);
    return ['業務', '作業', '広報', 'レビュー', '比較', '運用', '効率', '整理', 'workflow', 'operation', 'productivity'].some((word) => text.includes(normalize(word)));
  }

  function filteredProjects() {
    let list = projects().slice();
    const query = normalize(state.query);
    if (query) list = list.filter((project) => searchable(project).includes(query));
    if (!query) {
      if (state.quick === 'extension') list = list.filter((project) => project.type === 'chrome-extension');
      if (state.quick === 'learning') list = list.filter((project) => project.type === 'learning-tool');
      if (state.quick === 'writing') list = list.filter(isWriting);
      if (state.quick === 'work') list = list.filter(isWork);
    }
    list.sort((a, b) => dateNumber(b.updatedAt || b.createdAt).localeCompare(dateNumber(a.updatedAt || a.createdAt)));
    return list;
  }

  function projectSummary(project) {
    return project.friction || project.summary || project.subtitle || '制作物の説明を整理中。';
  }

  function resultRow(project, index) {
    const selected = index === state.selectedIndex;
    return `
      <button type="button" class="live-result${selected ? ' is-selected' : ''}" data-live-project="${attr(project.id)}" data-live-index="${index}" aria-selected="${selected}">
        <span class="live-result-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="live-result-main">
          <strong>${esc(project.title)}</strong>
          <small>${esc(projectSummary(project))}</small>
        </span>
        <span class="live-result-meta">
          <span>${esc(TYPE_LABELS[project.type] || project.type || '制作物')}</span>
          <span>更新 ${esc(formatDate(project.updatedAt || project.createdAt))}</span>
        </span>
        <span class="live-result-arrow" aria-hidden="true">↗</span>
      </button>`;
  }

  function renderResults() {
    const root = document.querySelector('[data-live-index]');
    if (!root) return;
    const list = filteredProjects();
    state.selectedIndex = Math.min(state.selectedIndex, Math.max(0, list.length - 1));
    const visible = list.slice(0, 6);
    const label = state.query ? `「${state.query}」の検索結果` : state.quick === 'recent' ? '最近更新' : QUICK_FILTERS.find((item) => item.id === state.quick)?.label || '制作物';
    const count = root.querySelector('[data-live-result-count]');
    if (count) count.textContent = `${list.length}件`;
    const heading = root.querySelector('[data-live-result-label]');
    if (heading) heading.textContent = label;
    const results = root.querySelector('[data-live-results]');
    if (!results) return;
    results.innerHTML = visible.length ? visible.map(resultRow).join('') : `
      <div class="live-empty">
        <strong>見つかりませんでした。</strong>
        <p>名前だけでなく、困りごと・技術・目的からも検索できます。</p>
        <button type="button" data-live-clear>検索をクリア</button>
      </div>`;
    bindResultEvents();
    updateQuickButtons();
    updatePreview();
  }

  function updatePreview() {
    const root = document.querySelector('[data-live-index]');
    const preview = root?.querySelector('[data-live-preview]');
    if (!preview) return;
    const list = filteredProjects().slice(0, 6);
    const project = list[state.selectedIndex] || list[0];
    if (!project) {
      preview.innerHTML = '<p class="live-preview-empty">制作物を選ぶと、ここに概要が表示されます。</p>';
      return;
    }
    preview.innerHTML = `
      <p class="live-preview-kicker">SELECTED / ${esc(TYPE_LABELS[project.type] || project.type || 'PROJECT')}</p>
      <h3>${esc(project.title)}</h3>
      <p class="live-preview-friction"><span>困っていたこと</span>${esc(project.friction || project.summary || '')}</p>
      <p class="live-preview-answer"><span>いまの答え</span>${esc(project.currentAnswer || project.summary || project.subtitle || '')}</p>
      <button type="button" data-live-project="${attr(project.id)}">詳しく見る <span aria-hidden="true">↗</span></button>`;
    preview.querySelector('[data-live-project]')?.addEventListener('click', () => openProject(project.id));
  }

  function updateQuickButtons() {
    document.querySelectorAll('[data-live-quick]').forEach((button) => {
      const active = !state.query && button.dataset.liveQuick === state.quick;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    try {
      history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      location.href = `${location.pathname}?${params}${location.hash}`;
    }
  }

  function syncUnderlyingSearch(value) {
    const target = document.querySelector('[data-cat-search], [data-search-input]');
    if (!target || target === document.activeElement && target.matches('[data-live-search]')) return;
    if (target.value === value) return;
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function syncUnderlyingType(type) {
    const target = document.querySelector('[data-cat-type], [data-type-filter]');
    if (!target) return;
    target.value = type || '';
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function bindResultEvents() {
    document.querySelectorAll('[data-live-project]').forEach((button) => {
      button.addEventListener('click', () => openProject(button.dataset.liveProject));
      button.addEventListener('mouseenter', () => {
        if (button.dataset.liveIndex == null) return;
        state.selectedIndex = Number(button.dataset.liveIndex) || 0;
        document.querySelectorAll('.live-result').forEach((row, i) => row.classList.toggle('is-selected', i === state.selectedIndex));
        updatePreview();
      });
    });
    document.querySelector('[data-live-clear]')?.addEventListener('click', clearSearch);
  }

  function clearSearch() {
    state.query = '';
    state.selectedIndex = 0;
    const input = document.querySelector('[data-live-search]');
    if (input) input.value = '';
    syncUnderlyingSearch('');
    renderResults();
    input?.focus();
  }

  function activateQuick(id) {
    if (id === 'random') {
      const list = projects();
      const project = list[Math.floor(Math.random() * list.length)];
      if (project) openProject(project.id);
      return;
    }
    state.query = '';
    state.quick = id;
    state.selectedIndex = 0;
    const input = document.querySelector('[data-live-search]');
    if (input) input.value = '';
    syncUnderlyingSearch('');
    syncUnderlyingType(id === 'extension' ? 'chrome-extension' : id === 'learning' ? 'learning-tool' : '');
    renderResults();
  }

  function switchView(view) {
    const target = document.querySelector(`.view-chip[data-view-button="${view}"], .global-nav [data-view-button="${view}"]`);
    if (!target) return;
    target.click();
    setTimeout(() => document.querySelector('.explorer')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 0);
  }

  function buildHero() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.dataset.liveIndexReady) return;
    hero.dataset.liveIndexReady = 'true';
    hero.innerHTML = `
      <div class="live-index" data-live-index>
        <header class="live-index-head">
          <div class="live-index-heading">
            <p class="eyebrow">PROJECT INDEX / SINCE 2019</p>
            <h1 id="hero-title">制作物一覧</h1>
            <p class="hero-lead">Webアプリ、Chrome拡張、学習ツールなど、これまで作った制作物をまとめています。</p>
          </div>
          <div class="live-index-count" aria-label="登録制作物数">
            <strong>${projects().length}</strong>
            <span>PROJECTS</span>
            <small>UPDATED ${esc(formatDate(projects().slice().sort((a,b) => dateNumber(b.updatedAt || b.createdAt).localeCompare(dateNumber(a.updatedAt || a.createdAt)))[0]?.updatedAt || ''))}</small>
          </div>
        </header>

        <div class="live-search-shell">
          <label class="live-search">
            <span class="live-search-icon" aria-hidden="true">⌕</span>
            <span class="sr-only">制作物を検索</span>
            <input type="search" data-live-search autocomplete="off" placeholder="名前・困りごと・技術から探す" aria-controls="live-index-results" aria-autocomplete="list">
            <kbd aria-label="スラッシュキーで検索欄へ移動">/</kbd>
          </label>
          <div class="live-quick" aria-label="すぐ探す">
            ${QUICK_FILTERS.map((item) => `<button type="button" data-live-quick="${item.id}" aria-pressed="${item.id === 'recent'}">${item.label}</button>`).join('')}
          </div>
        </div>

        <div class="live-result-bar">
          <p><span data-live-result-label>最近更新</span> <strong data-live-result-count></strong></p>
          <div class="live-view-switch" aria-label="制作物の見方">
            <button type="button" data-live-view="shelf">一覧</button>
            <button type="button" data-live-view="map">作った理由</button>
            <button type="button" data-live-view="timeline">年代順</button>
          </div>
        </div>

        <div class="live-workspace">
          <div class="live-results" id="live-index-results" data-live-results role="listbox" aria-label="制作物候補"></div>
          <aside class="live-preview" data-live-preview aria-live="polite"></aside>
        </div>
        <p class="live-key-hint"><span>↑↓ 選択</span><span>Enter 開く</span><span>Esc クリア</span></p>
      </div>`;

    document.querySelector('.current-note')?.setAttribute('hidden', '');
    const explorerTitle = document.querySelector('#explorer-title');
    if (explorerTitle) explorerTitle.textContent = 'すべての制作物';
    const explorerEyebrow = document.querySelector('.explorer-heading .eyebrow');
    if (explorerEyebrow) explorerEyebrow.textContent = 'FULL INDEX';
    document.querySelector('[data-atlas-lens-intro]')?.remove();

    bindHeroEvents();
    renderResults();
  }

  function bindHeroEvents() {
    const input = document.querySelector('[data-live-search]');
    input?.addEventListener('input', () => {
      state.query = input.value.trim();
      state.selectedIndex = 0;
      if (state.query) state.quick = '';
      syncUnderlyingSearch(state.query);
      syncUnderlyingType('');
      renderResults();
    });
    input?.addEventListener('keydown', (event) => {
      const visibleCount = Math.min(filteredProjects().length, 6);
      if (event.key === 'ArrowDown' && visibleCount) {
        event.preventDefault();
        state.selectedIndex = (state.selectedIndex + 1) % visibleCount;
        renderResults();
      } else if (event.key === 'ArrowUp' && visibleCount) {
        event.preventDefault();
        state.selectedIndex = (state.selectedIndex - 1 + visibleCount) % visibleCount;
        renderResults();
      } else if (event.key === 'Enter' && visibleCount) {
        event.preventDefault();
        const project = filteredProjects().slice(0, 6)[state.selectedIndex];
        if (project) openProject(project.id);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clearSearch();
      }
    });
    document.querySelectorAll('[data-live-quick]').forEach((button) => button.addEventListener('click', () => activateQuick(button.dataset.liveQuick)));
    document.querySelectorAll('[data-live-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.liveView)));

    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (active?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      input?.focus();
    });
  }

  function relabelAtlasNavigation() {
    const labels = { shelf: '一覧', map: '作った理由', timeline: '年代順' };
    document.querySelectorAll('.global-nav [data-view-button]').forEach((button) => {
      if (labels[button.dataset.viewButton]) button.textContent = labels[button.dataset.viewButton];
    });
    document.querySelectorAll('.view-chip[data-view-button]').forEach((button) => {
      const span = button.querySelector('span');
      const small = button.querySelector('small');
      const view = button.dataset.viewButton;
      if (!labels[view]) return;
      if (span) span.textContent = labels[view];
      if (small) small.textContent = view === 'shelf' ? 'すべてから探す' : view === 'map' ? '困りごとからたどる' : '制作時期から見る';
    });
  }

  function boot() {
    if (!window.BUILD_DIARY_DATA || !document.querySelector('.hero')) {
      setTimeout(boot, 80);
      return;
    }
    document.body?.classList.add('live-index-enabled');
    buildHero();
    relabelAtlasNavigation();
    const observer = new MutationObserver(relabelAtlasNavigation);
    const panel = document.querySelector('[data-view-panel]');
    if (panel) observer.observe(panel, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();