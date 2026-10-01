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
    experiment: '実験',
    other: 'その他'
  };
  const STATUS_LABELS = {
    development: '開発中', active: '運用中', prototype: '試作中', dormant: '休止中', legacy: '初期記録'
  };
  const FAMILY_LABELS = {
    'learning-practice': '学ぶ・練習する', 'writing-knowledge': '書く・知識を残す',
    'browser-productivity': 'ブラウザ操作を速くする', 'personal-systems': '自分の仕組みを作る',
    'design-communication': '伝える・設計する'
  };
  const FRICTION_LABELS = {
    reduce: '手間を減らす', remember: '覚えて戻る', practice: '小さく学ぶ',
    compare: '比べて整理する', communicate: '伝わり方を整える', protect: '情報を守る'
  };
  const QUICK_FILTERS = [
    ['all', 'すべて'], ['family:learning-practice', '学ぶ'], ['family:writing-knowledge', '書く・知識'],
    ['family:browser-productivity', 'ブラウザ'], ['family:personal-systems', '自分の仕組み'],
    ['family:design-communication', '伝える・設計'], ['recent', '最近']
  ];
  const STORAGE_KEY = 'worksportfolio-catalog-v5';

  const state = { q: '', quick: 'all', family: '', friction: '', type: '', status: '', year: '', link: '', sort: 'created-desc' };
  let catalogProjects = [];
  let catalogReady = false;

  const projects = () => catalogProjects;
  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const norm = (value) => String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, '');
  const dateNumber = (value) => String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');
  const chronologyDate = (project) => project?.startedAt || project?.createdAt || '';
  const yearOf = (project) => String(chronologyDate(project)).slice(0, 4) || '';
  const projectTypes = (project) => uniqueProjectTypes(project);
  function uniqueProjectTypes(project) {
    return [...new Set([project?.type, ...(Array.isArray(project?.categories) ? project.categories : [])].filter(Boolean))];
  }

  function timestamp(value) {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return 0;
    return Date.UTC(Number(match[1]), Number(match[2] || 1) - 1, Number(match[3] || 1));
  }

  function isRecent(project, days = 120) {
    const value = timestamp(project.updatedAt || project.createdAt);
    return value > 0 && Date.now() - value <= days * 86400000;
  }

  function formatDate(value) {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return String(value);
    if (match[3]) return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    if (match[2]) return `${Number(match[1])}.${Number(match[2])}`;
    return match[1];
  }

  async function loadCatalogProjects() {
    const response = await fetch('data/catalog-projects.json', { cache: 'force-cache' });
    if (!response.ok) throw new Error(`catalog-projects.json: ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.projects)) throw new Error('catalog-projects.json: invalid payload');
    catalogProjects = payload.projects;
    return catalogProjects;
  }

  function fallbackMatches(project, query) {
    const q = norm(query);
    if (!q) return true;
    return norm([project.title, project.summary, project.id, project.type, project.status].filter(Boolean).join(' ')).includes(q);
  }

  function matchesSearch(project, query) {
    const api = window.WORKS_PORTFOLIO_SEARCH;
    return api?.matchesId ? api.matchesId(project.id, query) : fallbackMatches(project, query);
  }

  function passesQuick(project) {
    if (state.quick === 'recent') return isRecent(project);
    if (state.quick.startsWith('family:')) return (project.familyIds || []).includes(state.quick.slice(7));
    return true;
  }

  function filtered() {
    const list = projects().filter((project) => {
      const live = Boolean(project.liveUrl);
      const github = Boolean(project.repositoryUrl);
      return matchesSearch(project, state.q)
        && passesQuick(project)
        && (!state.family || (project.familyIds || []).includes(state.family))
        && (!state.friction || (project.frictionIds || []).includes(state.friction))
        && (!state.type || projectTypes(project).includes(state.type))
        && (!state.status || project.status === state.status)
        && (!state.year || yearOf(project) === state.year)
        && (!state.link
          || (state.link === 'live' && live)
          || (state.link === 'github' && github)
          || (state.link === 'both' && live && github)
          || (state.link === 'local' && !live && !github));
    });

    list.sort(
      state.sort === 'updated-desc'
        ? (a, b) => dateNumber(b.updatedAt || b.createdAt).localeCompare(dateNumber(a.updatedAt || a.createdAt))
        : state.sort === 'created-asc'
          ? (a, b) => dateNumber(chronologyDate(a)).localeCompare(dateNumber(chronologyDate(b)))
          : state.sort === 'title-asc'
            ? (a, b) => String(a.title).localeCompare(String(b.title), 'ja')
            : (a, b) => dateNumber(chronologyDate(b)).localeCompare(dateNumber(chronologyDate(a)))
    );
    return list;
  }

  function quickCount(key) {
    return projects().filter((project) => {
      if (key === 'recent') return isRecent(project);
      if (key.startsWith('family:')) return (project.familyIds || []).includes(key.slice(7));
      return true;
    }).length;
  }

  function toolbarMarkup() {
    const types = [...new Set(projects().flatMap(projectTypes))].sort();
    const families = [...new Set(projects().flatMap((project) => project.familyIds || []))].sort();
    const frictions = [...new Set(projects().flatMap((project) => project.frictionIds || []))].sort();
    const statuses = [...new Set(projects().map((project) => project.status).filter(Boolean))].sort();
    const years = [...new Set(projects().map(yearOf).filter((year) => /^\d{4}$/.test(year)))].sort().reverse();
    return `<section class="catalog-overview" data-catalog-toolbar>
      <div class="catalog-quick" data-cat-quick>${QUICK_FILTERS.map(([key,label]) => `<button type="button" class="catalog-quick-button${state.quick===key?' is-active':''}" data-cat-quick-value="${key}" aria-pressed="${state.quick===key}"><span>${esc(label)}</span><strong>${quickCount(key)}</strong></button>`).join('')}</div>
      <div class="catalog-primary"><label class="catalog-search"><span class="sr-only">制作物を検索</span><input type="search" data-cat-search autocomplete="off" placeholder="名前・困りごと・技術から探す" value="${attr(state.q)}"></label>
        <select data-cat-sort aria-label="並び順"><option value="created-desc"${state.sort==='created-desc'?' selected':''}>制作開始が新しい順</option><option value="updated-desc"${state.sort==='updated-desc'?' selected':''}>更新が新しい順</option><option value="created-asc"${state.sort==='created-asc'?' selected':''}>制作開始が古い順</option><option value="title-asc"${state.sort==='title-asc'?' selected':''}>名前順</option></select></div>
      <details class="catalog-more" data-cat-more><summary>絞り込み <span data-cat-filter-count></span></summary><div class="catalog-filters">
        <select data-cat-family aria-label="目的で絞り込む"><option value="">すべての目的</option>${families.map(v=>`<option value="${attr(v)}"${state.family===v?' selected':''}>${esc(FAMILY_LABELS[v]||v)}</option>`).join('')}</select>
        <select data-cat-type aria-label="形で絞り込む"><option value="">すべての形</option>${types.map(v=>`<option value="${attr(v)}"${state.type===v?' selected':''}>${esc(TYPE_LABELS[v]||v)}</option>`).join('')}</select>
        <select data-cat-friction aria-label="困りごとで絞り込む"><option value="">すべての困りごと</option>${frictions.map(v=>`<option value="${attr(v)}"${state.friction===v?' selected':''}>${esc(FRICTION_LABELS[v]||v)}</option>`).join('')}</select>
        <select data-cat-status aria-label="状態で絞り込む"><option value="">すべての状態</option>${statuses.map(v=>`<option value="${attr(v)}"${state.status===v?' selected':''}>${esc(STATUS_LABELS[v]||v)}</option>`).join('')}</select>
        <select data-cat-year aria-label="制作開始年で絞り込む"><option value="">すべての制作開始年</option>${years.map(v=>`<option value="${v}"${state.year===v?' selected':''}>${v}年</option>`).join('')}</select>
        <select data-cat-link aria-label="リンク状況で絞り込む"><option value=""${!state.link?' selected':''}>すべてのリンク状況</option><option value="live"${state.link==='live'?' selected':''}>使える・読めるページあり</option><option value="github"${state.link==='github'?' selected':''}>GitHubあり</option><option value="both"${state.link==='both'?' selected':''}>公開ページ＋GitHub</option><option value="local"${state.link==='local'?' selected':''}>手元・概要のみ</option></select>
        <button class="subtle-button" type="button" data-cat-reset>条件をすべて戻す</button>
      </div></details>
      <div class="catalog-resultbar"><p class="catalog-result" data-cat-count></p><div class="catalog-active" data-cat-active></div></div>
    </section>`;
  }

  function linkButtons(project) {
    const links = [];
    if (project.liveUrl) {
      const label = project.access === 'gated' ? '限定' : project.type === 'content-page' ? '読む' : project.type === 'design-system' ? '見る' : '使う';
      links.push(`<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener" title="${label}">${label} ↗</a>`);
    }
    if (project.caseStudyUrl) links.push(`<a href="${attr(project.caseStudyUrl)}" target="_blank" rel="noopener" title="制作事例">事例 ↗</a>`);
    if (project.repositoryUrl) links.push(`<a href="${attr(project.repositoryUrl)}" target="_blank" rel="noopener" title="GitHub">GitHub</a>`);
    if (project.sourceVisibility === 'private') links.push('<span class="catalog-private-source">Source not public</span>');
    return links.length ? links.join('') : '<span class="catalog-local">手元のみ</span>';
  }
  function row(project) {
    const recent = isRecent(project,90);
    const privateBadge = project.sourceVisibility === 'private' ? '<span class="catalog-private-source">Source not public</span>' : '';
    const title = `<span class="catalog-titleline"><strong>${esc(project.title||project.id)}</strong>${recent?'<em>NEW</em>':''}${privateBadge}</span><span class="catalog-summaryline">${esc(project.summary||'制作物の説明を整理中。')}</span>`;
    const main = project.summaryOnly ? `<div class="catalog-main catalog-main-static">${title}</div>` : `<button class="catalog-main" type="button" data-project-open="${attr(project.id)}">${title}</button>`;
    const family = (project.familyIds||[])[0] || '', extra = Math.max(0,(project.familyIds||[]).length-1);
    const purpose = family ? `${FAMILY_LABELS[family]||family}${extra?` +${extra}`:''}` : '目的未分類';
    return `<article class="catalog-row" data-cat-item="${attr(project.id)}">${main}<div class="catalog-facts"><span class="catalog-purpose">${esc(purpose)}</span><span>${esc(TYPE_LABELS[project.type]||project.type||'制作物')}</span><span class="status status-${attr(project.status||'legacy')}">${esc(STATUS_LABELS[project.status]||project.status||'記録')}</span></div><div class="catalog-links">${linkButtons(project)}</div></article>`;
  }

  function activeFiltersMarkup() {
    const items = [];
    if (state.q) items.push(['q', `検索「${state.q}」`]);
    if (state.quick !== 'all') items.push(['quick', QUICK_FILTERS.find(([key])=>key===state.quick)?.[1] || state.quick]);
    if (state.family) items.push(['family', FAMILY_LABELS[state.family] || state.family]);
    if (state.friction) items.push(['friction', FRICTION_LABELS[state.friction] || state.friction]);
    if (state.type) items.push(['type', `形：${TYPE_LABELS[state.type] || state.type}`]);
    if (state.status) items.push(['status', STATUS_LABELS[state.status] || state.status]);
    if (state.year) items.push(['year', `${state.year}年`]);
    if (state.link) items.push(['link', {live:'公開ページあり',github:'GitHubあり',both:'公開＋GitHub',local:'手元・概要のみ'}[state.link] || state.link]);
    return items;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    const params = new URLSearchParams(location.search);
    for (const key of ['q','quick','family','friction','type','cat_type','status','year','link','sort']) params.delete(key);
    if (state.q) params.set('q',state.q); if (state.quick!=='all') params.set('quick',state.quick);
    if (state.family) params.set('family',state.family); if (state.friction) params.set('friction',state.friction);
    if (state.type) params.set('type',state.type); if (state.status) params.set('status',state.status);
    if (state.year) params.set('year',state.year); if (state.link) params.set('link',state.link);
    if (state.sort!=='created-desc') params.set('sort',state.sort);
    history.replaceState({},'',`${location.pathname}${params.toString()?`?${params}`:''}${location.hash}`);
  }
  function readState() {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}; } catch (_) {}
    const params = new URLSearchParams(location.search);
    const get = (key,fallback='') => params.has(key) ? params.get(key) : (saved[key] ?? fallback);
    state.q=get('q'); state.quick=get('quick','all'); state.family=get('family'); state.friction=get('friction');
    state.type=params.has('type')?params.get('type'):(params.has('cat_type')?params.get('cat_type'):(saved.type??''));
    state.status=get('status'); state.year=get('year'); state.link=get('link'); state.sort=get('sort','created-desc');
    if (!QUICK_FILTERS.some(([key])=>key===state.quick)) state.quick='all';
  }

  function syncControlsFromState() {
    const controls = {
      search:document.querySelector('[data-cat-search]'), sort:document.querySelector('[data-cat-sort]'),
      family:document.querySelector('[data-cat-family]'), friction:document.querySelector('[data-cat-friction]'),
      type:document.querySelector('[data-cat-type]'), status:document.querySelector('[data-cat-status]'),
      year:document.querySelector('[data-cat-year]'), link:document.querySelector('[data-cat-link]')
    };
    if (controls.search) controls.search.value=state.q; if (controls.sort) controls.sort.value=state.sort;
    if (controls.family) controls.family.value=state.family; if (controls.friction) controls.friction.value=state.friction;
    if (controls.type) controls.type.value=state.type; if (controls.status) controls.status.value=state.status;
    if (controls.year) controls.year.value=state.year; if (controls.link) controls.link.value=state.link;
    document.querySelectorAll('[data-cat-quick-value]').forEach(button => {
      const selected=button.dataset.catQuickValue===state.quick; button.classList.toggle('is-active',selected); button.setAttribute('aria-pressed',String(selected));
    });
  }

  function renderToolbar() {
    const oldToolbar = document.querySelector('[data-toolbar], [data-catalog-toolbar]');
    if (!oldToolbar) return false;
    const holder = document.createElement('div');
    holder.innerHTML = toolbarMarkup();
    oldToolbar.replaceWith(holder.firstElementChild);
    bindToolbarEvents();
    return true;
  }

  function renderList() {
    if (!catalogReady) return;
    const panel = document.querySelector('[data-view-panel]');
    const count = document.querySelector('[data-cat-count]');
    const active = document.querySelector('[data-cat-active]');
    if (!panel || !count || !active) return;
    const list = filtered();
    count.innerHTML = `<strong>${list.length}</strong> / ${projects().length}件`;
    const filters = activeFiltersMarkup();
    active.innerHTML = filters.map(([key, label]) => `<button type="button" data-cat-clear-one="${key}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');
    const advancedCount = filters.filter(([key]) => !['q', 'quick'].includes(key)).length;
    const badge = document.querySelector('[data-cat-filter-count]');
    if (badge) badge.textContent = advancedCount ? `（${advancedCount}）` : '';
    panel.innerHTML = list.length
      ? `<div class="catalog-list" data-catalog-list>${list.map(row).join('')}</div>`
      : '<div class="empty-state"><h3>条件に合う制作物がありません。</h3><p>名前だけでなく、困りごと・技術・用途からも検索できます。</p></div>';
    document.documentElement.classList.add('catalog-core-ready');
    saveState();
  }

  function openProject(id) {
    const project = projects().find((item) => item.id === id);
    if (!project || project.summaryOnly) return;
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function clearOne(key) {
    if (key === 'q') state.q = '';
    else if (key === 'quick') state.quick = 'all';
    else if (key in state) state[key] = '';
    syncControlsFromState();
    renderList();
  }

  function resetAll() {
    Object.assign(state, { q: '', quick: 'all', family: '', friction: '', type: '', status: '', year: '', link: '', sort: 'created-desc' });
    syncControlsFromState();
    renderList();
  }

  function bindToolbarEvents() {
    const toolbar=document.querySelector('[data-catalog-toolbar]'); if (!toolbar||toolbar.dataset.bound) return; toolbar.dataset.bound='true';
    toolbar.addEventListener('input',event=>{ if(!event.target.matches('[data-cat-search]')) return; state.q=event.target.value.trim(); state.quick='all'; syncControlsFromState(); renderList(); });
    toolbar.addEventListener('change',event=>{
      if(event.target.matches('[data-cat-sort]')) state.sort=event.target.value;
      if(event.target.matches('[data-cat-family]')) { state.family=event.target.value; if(state.quick.startsWith('family:')) state.quick='all'; }
      if(event.target.matches('[data-cat-friction]')) state.friction=event.target.value;
      if(event.target.matches('[data-cat-type]')) state.type=event.target.value;
      if(event.target.matches('[data-cat-status]')) state.status=event.target.value;
      if(event.target.matches('[data-cat-year]')) state.year=event.target.value;
      if(event.target.matches('[data-cat-link]')) state.link=event.target.value;
      syncControlsFromState(); renderList();
    });
    toolbar.addEventListener('click',event=>{
      const quick=event.target.closest('[data-cat-quick-value]');
      if(quick){ state.quick=quick.dataset.catQuickValue; state.q=''; if(state.quick.startsWith('family:')) state.family=''; syncControlsFromState(); renderList(); return; }
      const clear=event.target.closest('[data-cat-clear-one]'); if(clear) return clearOne(clear.dataset.catClearOne);
      if(event.target.closest('[data-cat-reset]')) resetAll();
    });
  }

  function bindListEvents() {
    const panel = document.querySelector('[data-view-panel]');
    if (!panel || panel.dataset.catalogCoreBound) return;
    panel.dataset.catalogCoreBound = 'true';
    panel.addEventListener('click', (event) => {
      const open = event.target.closest('[data-project-open]');
      if (open) openProject(open.dataset.projectOpen);
    });
  }

  function setQuery(query) {
    state.q=String(query||'').trim(); state.quick='all'; state.friction='';
    if(catalogReady){syncControlsFromState();renderList();}
  }
  function setFriction(friction) {
    state.q=''; state.quick='all'; state.friction=String(friction||'');
    if(catalogReady){syncControlsFromState();renderList();}
  }

  async function init() {
    const panel = document.querySelector('[data-view-panel]');
    if (!panel) return;
    readState();
    panel.innerHTML = '<div class="loading">制作物一覧を読み込んでいます。</div>';
    try {
      await loadCatalogProjects();
      catalogReady = true;
      if (!renderToolbar()) throw new Error('Catalog toolbar mount point missing');
      bindListEvents();
      renderList();
      window.WORKS_PORTFOLIO_CATALOG = Object.freeze({ setQuery, setFriction, render: renderList, count: () => projects().length });
      window.dispatchEvent(new CustomEvent('worksportfolio:catalog-ready'));
    } catch (error) {
      console.warn('Catalog data could not be loaded.', error);
      panel.innerHTML = '<div class="empty-state"><h3>制作物一覧を読み込めませんでした。</h3><p>上の検索はそのまま利用できます。通信状態を確認して再度アクセスしてください。</p></div>';
      document.documentElement.classList.add('catalog-core-failed');
      window.WORKS_PORTFOLIO_CATALOG = Object.freeze({ setQuery, setFriction, render: () => {}, count: () => 0 });
    }
  }

  window.addEventListener('worksportfolio:set-query', (event) => setQuery(event.detail?.query || ''));
  window.addEventListener('worksportfolio:set-friction', (event) => setFriction(event.detail?.friction || ''));
  window.addEventListener('popstate', () => {
    if (!catalogReady) return;
    readState();
    syncControlsFromState();
    renderList();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
