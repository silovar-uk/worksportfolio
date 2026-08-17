(() => {
  'use strict';

  const TYPE_LABELS = {
    'web-app':'Webアプリ','chrome-extension':'Chrome拡張','learning-tool':'学習ツール',
    'design-system':'設計ガイド','content-page':'コンテンツ','data-tool':'分析・データ',
    utility:'便利ツール',experiment:'実験'
  };
  const STATUS_LABELS = {
    development:'開発中',active:'運用中',prototype:'試作中',dormant:'休止中',legacy:'初期記録'
  };
  const GLOBAL_ALIAS_GROUPS = [
    ['memo','メモ','めも'],
    ['chrome','クローム','くろーむ'],
    ['web','ウェブ','うぇぶ']
  ];

  let ready = false;
  let allowNativeSearch = false;
  let searchMode = false;
  let savedMarkFilter = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const attr = (v) => esc(v).replace(/'/g,'&#39;');
  const projects = () => window.BUILD_DIARY_DATA?.projects || [];

  function kanaToHira(value) {
    return String(value || '').replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  function norm(value) {
    return kanaToHira(String(value || '').toLowerCase().normalize('NFKC'))
      .replace(/[・･_\-‐‑‒–—―/\\.,:;'"“”‘’!?！？()（）[\]【】{}<>「」『』]/g,'')
      .replace(/\s+/g,'');
  }

  const aliasGroups = GLOBAL_ALIAS_GROUPS.map(group => group.map(norm));

  function termMatches(haystack, term) {
    if (haystack.includes(term)) return true;
    const group = aliasGroups.find(items => items.includes(term));
    return group ? group.some(alias => haystack.includes(alias)) : false;
  }

  function searchable(project) {
    return norm([
      project.title,project.subtitle,project.summary,project.friction,project.firstBuild,
      project.currentAnswer,project.id,project.type,project.status,project.documentationState,
      ...(project.verbs || []),...(project.technologies || []),...(project.searchAliases || []),
      ...(project.relatedProjects || []).map(item => item?.relation || '')
    ].join(' '));
  }

  function matches(project, query) {
    const terms = String(query || '').normalize('NFKC').trim().split(/\s+/).map(norm).filter(Boolean);
    if (!terms.length) return true;
    const haystack = searchable(project);
    return terms.every(term => termMatches(haystack, term));
  }

  function dateKey(value) {
    return String(value || '').replace(/[^0-9]/g,'').padEnd(8,'0');
  }

  function startDate(project) {
    return project.startedAt || project.createdAt || '';
  }

  function sortResults(list) {
    const sort = document.querySelector('[data-cat-sort]')?.value || 'created-desc';
    return list.sort(
      sort === 'created-asc' ? (a,b) => dateKey(startDate(a)).localeCompare(dateKey(startDate(b))) :
      sort === 'title-asc' ? (a,b) => String(a.title).localeCompare(String(b.title),'ja') :
      sort === 'type-asc' ? (a,b) => String(TYPE_LABELS[a.type] || a.type).localeCompare(String(TYPE_LABELS[b.type] || b.type),'ja') :
      sort === 'status-asc' ? (a,b) => String(STATUS_LABELS[a.status] || a.status).localeCompare(String(STATUS_LABELS[b.status] || b.status),'ja') :
      sort === 'updated-desc' ? (a,b) => dateKey(b.updatedAt || b.createdAt).localeCompare(dateKey(a.updatedAt || a.createdAt)) :
      (a,b) => dateKey(startDate(b)).localeCompare(dateKey(startDate(a)))
    );
  }

  function installStyles() {
    if (document.getElementById('catalog-search-redesign-style')) return;
    const style = document.createElement('style');
    style.id = 'catalog-search-redesign-style';
    style.textContent = `
.catalog-overview.catalog-search-redesign{border-top:2px solid var(--ink);box-shadow:none}
.catalog-search-redesign .catalog-quick{border:0}
.catalog-search-redesign .catalog-primary{grid-template-columns:minmax(280px,1fr) repeat(3,minmax(145px,auto));padding:14px 14px 8px}
.catalog-search-redesign .catalog-search{position:relative}
.catalog-search-redesign .catalog-search input{min-height:58px;padding:.85rem 9.5rem .85rem 1rem;font-size:1.05rem;box-shadow:4px 4px 0 rgba(32,36,38,.06)}
.catalog-search-redesign .catalog-search::after{content:"全作品から検索";position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:.68rem;font-weight:800;color:var(--muted);pointer-events:none}
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
.catalog-search-mode-note{padding:.26rem .52rem;border-left:3px solid var(--yellow);background:rgba(231,207,104,.15);font-size:.72rem;font-weight:800;color:var(--muted)}
.catalog-search-results{display:grid;gap:10px}.catalog-search-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:16px;border:1px solid var(--line-dark);background:var(--paper);box-shadow:3px 3px 0 rgba(32,36,38,.05)}
.catalog-search-result.is-featured{border-left:5px solid var(--red);background:linear-gradient(90deg,rgba(231,207,104,.14),var(--paper) 28%)}
.catalog-search-result-main{border:0;background:transparent;padding:0;text-align:left;cursor:pointer;min-width:0}.catalog-search-result-main strong{display:block;font-size:1.05rem;line-height:1.3}.catalog-search-result-main p{margin:.35rem 0 0;color:var(--muted);font-size:.8rem}
.catalog-search-result-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:.55rem}.catalog-search-result-meta span{padding:.16rem .38rem;border:1px solid var(--line);font-size:.66rem;background:var(--bg)}
.catalog-search-result-links{display:flex;align-items:flex-start;gap:5px}.catalog-search-result-links a{padding:.3rem .44rem;border:1px solid var(--line);font-size:.68rem;text-decoration:none}.catalog-search-result-links a:hover{background:var(--ink);color:var(--paper)}
@media(max-width:760px){
.catalog-search-redesign .catalog-primary{grid-template-columns:1fr 1fr;padding:10px}.catalog-search-redesign .catalog-search{grid-column:1/-1}.catalog-search-redesign .catalog-search input{padding-right:1rem}.catalog-search-redesign .catalog-search::after{display:none}
.catalog-filter-trigger{position:fixed;right:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:48;min-height:48px;padding:.62rem .82rem;border-radius:999px;box-shadow:0 8px 24px rgba(32,36,38,.22),3px 3px 0 var(--yellow)}
.catalog-filter-shell{position:fixed;inset:0;z-index:80;padding:0;display:flex;align-items:flex-end}.catalog-filter-shell[hidden]{display:none}
.catalog-filter-backdrop{display:block;position:absolute;inset:0;border:0;background:rgba(32,36,38,.48)}
.catalog-filter-panel{position:relative;z-index:1;width:100%;max-height:82vh;overflow:auto;border:0;border-radius:18px 18px 0 0;padding:16px 14px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 44px rgba(0,0,0,.18)}
.catalog-filter-panel .catalog-quick{grid-template-columns:repeat(2,1fr)}.catalog-filter-panel .catalog-filters{grid-template-columns:1fr 1fr}
body.catalog-filter-pop-open{overflow:hidden}.catalog-search-result{grid-template-columns:1fr}.catalog-search-result-links{grid-row:2}
}
@media(max-width:420px){.catalog-filter-panel .catalog-filters{grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  function activeFilterCount() {
    const selectors = ['[data-cat-verb]','[data-cat-type]','[data-cat-status]','[data-cat-year]','[data-cat-doc]','[data-cat-link]'];
    let count = selectors.filter(sel => document.querySelector(sel)?.value).length;
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
    const quick = toolbar.querySelector('[data-cat-quick]');
    const more = toolbar.querySelector('[data-cat-more]');
    const resultbar = toolbar.querySelector('.catalog-resultbar');
    if (!quick || !more || !resultbar) return false;

    toolbar.dataset.searchRedesign = 'true';
    toolbar.classList.add('catalog-search-redesign');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'catalog-filter-trigger';
    trigger.dataset.filterOpen = '';
    trigger.setAttribute('aria-expanded','false');
    trigger.innerHTML = '<span aria-hidden="true">☷</span><span>絞り込む</span><b data-filter-badge hidden></b>';
    resultbar.appendChild(trigger);

    const shell = document.createElement('div');
    shell.className = 'catalog-filter-shell';
    shell.dataset.filterShell = '';
    shell.hidden = true;
    shell.innerHTML = '<button type="button" class="catalog-filter-backdrop" data-filter-close aria-label="絞り込みを閉じる"></button><aside class="catalog-filter-panel"><div class="catalog-filter-panel-head"><div><h3>眺め方を絞る</h3><p>検索中は、この条件を使いません。</p></div><button type="button" class="catalog-filter-close" data-filter-close aria-label="閉じる">×</button></div></aside>';
    const panel = shell.querySelector('.catalog-filter-panel');
    more.open = true;
    panel.appendChild(quick);
    panel.appendChild(more);
    toolbar.appendChild(shell);

    trigger.addEventListener('click', () => setFilterOpen(true));
    shell.querySelectorAll('[data-filter-close]').forEach(btn => btn.addEventListener('click', () => setFilterOpen(false)));
    updateFilterBadge();
    return true;
  }

  function rememberAndNeutralizeMarkFilter() {
    const select = document.querySelector('[data-mark-filter]');
    if (!select || select.value === 'all') return;
    if (savedMarkFilter == null) savedMarkFilter = select.value;
    select.value = 'all';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function restoreMarkFilter() {
    if (savedMarkFilter == null) return;
    const select = document.querySelector('[data-mark-filter]');
    if (select) {
      select.value = savedMarkFilter;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    savedMarkFilter = null;
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project',id);
    history.pushState({},'',`${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function resultHtml(project) {
    const links = [
      project.liveUrl ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">公開</a>` : '',
      project.repositoryUrl ? `<a href="${attr(project.repositoryUrl)}" target="_blank" rel="noopener">GitHub</a>` : ''
    ].join('');
    return `<article class="catalog-search-result${project.featured ? ' is-featured' : ''}" data-cat-item="${attr(project.id)}">
      <button type="button" class="catalog-search-result-main" data-search-open="${attr(project.id)}">
        <strong>${esc(project.title || project.id)}</strong>
        <p>${esc(project.summary || project.friction || '説明を確認中です。')}</p>
        <span class="catalog-search-result-meta"><span>${esc(TYPE_LABELS[project.type] || project.type || 'その他')}</span><span>${esc(STATUS_LABELS[project.status] || project.status || '')}</span></span>
      </button>
      <div class="catalog-search-result-links">${links}</div>
    </article>`;
  }

  function renderSearch() {
    const input = document.querySelector('[data-cat-search]');
    const panel = document.querySelector('[data-view-panel]');
    if (!input || !panel) return;
    const query = input.value.trim();
    if (!query) return;

    searchMode = true;
    rememberAndNeutralizeMarkFilter();
    const list = sortResults(projects().filter(project => matches(project,query)));
    panel.innerHTML = list.length
      ? `<div class="catalog-search-results">${list.map(resultHtml).join('')}</div>`
      : '<div class="empty-state"><h3>その言葉では見つかりませんでした。</h3><p>言い換え、ひらがな・カタカナ、英語名でも試せます。</p></div>';

    const count = document.querySelector('[data-cat-count]');
    if (count) count.innerHTML = `<strong>${list.length}</strong> / ${projects().length}件`;
    const active = document.querySelector('[data-cat-active]');
    if (active) active.innerHTML = `<span class="catalog-search-mode-note">全作品から検索中${activeFilterCount() ? '・絞り込み条件は一時的に無視' : ''}</span>`;

    const params = new URLSearchParams(location.search);
    params.set('cat_q',query);
    history.replaceState({},'',`${location.pathname}?${params}${location.hash}`);
  }

  function resumeNativeView() {
    const input = document.querySelector('[data-cat-search]');
    if (!input) return;
    searchMode = false;
    restoreMarkFilter();
    allowNativeSearch = true;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    allowNativeSearch = false;
  }

  function bindSearch() {
    const input = document.querySelector('[data-cat-search]');
    if (!input || input.dataset.searchRedesignBound) return;
    input.dataset.searchRedesignBound = 'true';

    input.addEventListener('input', event => {
      if (allowNativeSearch) return;
      event.stopImmediatePropagation();
      if (input.value.trim()) renderSearch();
      else resumeNativeView();
    }, true);

    ['[data-cat-sort]','[data-cat-layout]','[data-cat-group]','[data-cat-verb]','[data-cat-type]','[data-cat-status]','[data-cat-year]','[data-cat-doc]','[data-cat-link]','[data-mark-filter]']
      .forEach(sel => document.querySelector(sel)?.addEventListener('change',() => {
        updateFilterBadge();
        if (input.value.trim()) setTimeout(renderSearch,0);
      }));

    document.querySelector('[data-cat-quick]')?.addEventListener('click',() => {
      setTimeout(() => {
        updateFilterBadge();
        if (input.value.trim()) renderSearch();
      },0);
    });

    const reset = document.querySelector('[data-cat-reset]');
    reset?.addEventListener('click', event => {
      if (!input.value.trim()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ['[data-cat-verb]','[data-cat-type]','[data-cat-status]','[data-cat-year]','[data-cat-doc]','[data-cat-link]'].forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.value = '';
      });
      document.querySelector('[data-cat-quick-value="all"]')?.click();
      const mark = document.querySelector('[data-mark-filter]');
      if (mark) { mark.value = 'all'; mark.dispatchEvent(new Event('change',{bubbles:true})); }
      updateFilterBadge();
      renderSearch();
    }, true);

    if (input.value.trim()) renderSearch();
  }

  function bindGlobal() {
    document.addEventListener('click', event => {
      const open = event.target.closest('[data-search-open]');
      if (open) { event.preventDefault(); openProject(open.dataset.searchOpen); }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setFilterOpen(false);
    });
    const observer = new MutationObserver(() => {
      if (!searchMode) return;
      const input = document.querySelector('[data-cat-search]');
      if (!input?.value.trim()) return;
      document.querySelectorAll('.catalog-search-result[hidden]').forEach(el => { el.hidden = false; });
      const count = document.querySelector('[data-cat-count]');
      const visible = document.querySelectorAll('.catalog-search-result').length;
      if (count && !count.textContent.startsWith(String(visible))) count.innerHTML = `<strong>${visible}</strong> / ${projects().length}件`;
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function start() {
    if (ready) return;
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]')) {
        setTimeout(wait,80);
        return;
      }
      ready = true;
      installStyles();
      restructureToolbar();
      bindSearch();
      bindGlobal();
      setTimeout(updateFilterBadge,120);
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
