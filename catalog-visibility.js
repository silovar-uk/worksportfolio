(() => {
  'use strict';

  const STYLE_ID = 'catalog-visible-url-style';
  const HEADER_STYLE_ID = 'catalog-header-search-style';
  let decorateScheduled = false;

  function currentView() {
    return document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button') || '';
  }

  function activateShelf() {
    if (currentView() === 'shelf') return;
    const button = document.querySelector('[data-view-button="shelf"]');
    if (button) button.click();
  }

  function sync() {
    const shelf = currentView() === 'shelf';
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const bulk = document.querySelector('[data-cat-bulk]');
    if (toolbar) toolbar.hidden = !shelf;
    if (bulk && !shelf) bulk.hidden = true;
    if (shelf) scheduleDecorateUrls();
  }

  function promoteCatalogControls() {
    if (document.querySelector('[data-header-catalog]')) return true;

    const header = document.querySelector('.site-header');
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!header || !toolbar) return false;

    const search = toolbar.querySelector('.catalog-search');
    const type = toolbar.querySelector('[data-cat-type]');
    const year = toolbar.querySelector('[data-cat-year]');
    const sort = toolbar.querySelector('[data-cat-sort]');
    if (!search || !type || !year || !sort) return false;

    const tools = document.createElement('div');
    tools.className = 'header-catalog-tools';
    tools.setAttribute('data-header-catalog', '');
    tools.setAttribute('role', 'search');
    tools.setAttribute('aria-label', '制作物を検索・絞り込み');

    const searchWrap = document.createElement('div');
    searchWrap.className = 'header-catalog-search';
    searchWrap.appendChild(search);

    const filters = document.createElement('div');
    filters.className = 'header-catalog-filters';
    [type, year, sort].forEach((control) => filters.appendChild(control));

    tools.append(searchWrap, filters);
    header.appendChild(tools);

    const quick = toolbar.querySelector('.catalog-quick');
    const primary = toolbar.querySelector('.catalog-primary');
    if (quick && primary) primary.insertAdjacentElement('afterend', quick);

    const searchInput = tools.querySelector('[data-cat-search]');
    if (searchInput) {
      searchInput.placeholder = '制作物を検索 — 名前・困りごと・技術';
      searchInput.setAttribute('aria-label', '制作物を検索');
    }

    tools.addEventListener('input', activateShelf, true);
    tools.addEventListener('change', activateShelf, true);
    return true;
  }

  function visibleUrl(value) {
    return String(value || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }

  function createUrlLink(project, modifier = '') {
    if (!project?.liveUrl) return null;
    const link = document.createElement('a');
    link.className = `catalog-url${modifier ? ` ${modifier}` : ''}`;
    link.href = project.liveUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = project.liveUrl;
    link.textContent = visibleUrl(project.liveUrl);
    link.setAttribute('aria-label', `${project.title}の公開URLを新しいタブで開く`);
    return link;
  }

  function decorateUrls() {
    const map = new Map((window.BUILD_DIARY_DATA?.projects || []).map((project) => [project.id, project]));
    if (!map.size) return;

    document.querySelectorAll('[data-cat-item]').forEach((item) => {
      const project = map.get(item.getAttribute('data-cat-item'));
      if (!project?.liveUrl) return;

      if (item.classList.contains('catalog-row')) {
        if (item.querySelector(':scope > .catalog-url')) return;
        const main = item.querySelector(':scope > .catalog-main');
        const link = createUrlLink(project, 'catalog-url-row');
        if (!main || !link) return;
        main.insertAdjacentElement('afterend', link);
        item.classList.add('has-catalog-url');
        return;
      }

      if (item.classList.contains('catalog-card')) {
        if (item.querySelector(':scope > .catalog-url')) return;
        const link = createUrlLink(project, 'catalog-url-card');
        if (!link) return;
        const bottom = item.querySelector(':scope > .catalog-card-bottom');
        item.insertBefore(link, bottom || item.querySelector(':scope > .catalog-open'));
        item.classList.add('has-catalog-url');
        return;
      }

      if (item.matches('tr')) {
        const links = item.querySelector('.catalog-links');
        if (!links || links.querySelector('.catalog-url')) return;
        const link = createUrlLink(project, 'catalog-url-table');
        if (!link) return;
        links.appendChild(link);
        links.classList.add('has-catalog-url');
      }
    });
  }

  function scheduleDecorateUrls() {
    if (decorateScheduled) return;
    decorateScheduled = true;
    requestAnimationFrame(() => {
      decorateScheduled = false;
      decorateUrls();
    });
  }

  function injectHeaderStyles() {
    if (document.getElementById(HEADER_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HEADER_STYLE_ID;
    style.textContent = `
      .site-header { overflow: visible; }
      .header-catalog-tools {
        width:min(calc(100% - 40px),var(--max));
        margin:0 auto;
        padding:0 0 12px;
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(420px,.72fr);
        gap:10px;
        align-items:stretch;
      }
      .header-catalog-search { min-width:0; }
      .header-catalog-search .catalog-search { display:block; height:100%; }
      .header-catalog-search .catalog-search input {
        width:100%;
        height:100%;
        min-height:50px;
        padding:.72rem .95rem;
        border:1px solid var(--ink);
        background:var(--paper);
        color:var(--ink);
        font-size:1rem;
        border-radius:0;
        box-shadow:3px 3px 0 var(--yellow);
      }
      .header-catalog-search .catalog-search input:focus {
        outline:2px solid var(--red);
        outline-offset:2px;
        box-shadow:4px 4px 0 var(--yellow);
      }
      .header-catalog-filters {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }
      .header-catalog-filters select {
        width:100%;
        min-width:0;
        min-height:50px;
        padding:.58rem .68rem;
        border:1px solid var(--line-dark);
        background:var(--paper);
        color:var(--ink);
        border-radius:0;
        font-size:.82rem;
      }
      .header-catalog-filters select:focus-visible { outline:2px solid var(--red); outline-offset:1px; }
      [data-catalog-toolbar] .catalog-primary { grid-template-columns:repeat(2,minmax(160px,220px)); justify-content:end; }
      [data-catalog-toolbar] .catalog-primary:empty { display:none; }
      [data-catalog-toolbar] .catalog-quick { border-top:1px solid var(--line-dark); }

      @media (max-width:900px) {
        .header-catalog-tools { grid-template-columns:1fr; gap:8px; }
        .header-catalog-search .catalog-search input { min-height:46px; }
        .header-catalog-filters select { min-height:42px; }
      }
      @media (max-width:760px) {
        .header-inner { min-height:54px; gap:.7rem; }
        .header-catalog-tools { width:min(calc(100% - 20px),var(--max)); padding-bottom:9px; }
        .header-catalog-search .catalog-search input { min-height:44px; font-size:.92rem; padding:.6rem .72rem; }
        .header-catalog-filters { grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
        .header-catalog-filters select { min-height:38px; padding:.42rem .38rem; font-size:.68rem; }
        [data-catalog-toolbar] .catalog-primary { grid-template-columns:1fr 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .catalog-url {
        display:block;
        min-width:0;
        color:var(--muted);
        font:500 .64rem/1.45 "Roboto Mono","Noto Sans Mono",monospace;
        text-decoration:none;
        overflow-wrap:anywhere;
        word-break:break-word;
        opacity:.76;
      }
      .catalog-url::before { content:"↗ "; color:var(--red); font-weight:800; }
      .catalog-url:hover,.catalog-url:focus-visible { color:var(--red-dark); opacity:1; text-decoration:underline; }
      .catalog-row.has-catalog-url { min-height:84px; grid-template-rows:auto auto; }
      .catalog-row.has-catalog-url > .catalog-check { grid-row:1 / span 2; }
      .catalog-row.has-catalog-url > .catalog-main { grid-column:2; grid-row:1; }
      .catalog-row.has-catalog-url > .catalog-facts { grid-column:3; grid-row:1; }
      .catalog-row.has-catalog-url > .catalog-links { grid-column:4; grid-row:1 / span 2; align-self:center; }
      .catalog-url-row { grid-column:2 / 4; grid-row:2; margin-top:-2px; }
      .catalog-url-card { margin-top:12px; }
      .catalog-table .catalog-links.has-catalog-url { flex-direction:column; align-items:flex-end; }
      .catalog-url-table { max-width:280px; margin-top:3px; text-align:right; }

      @media (max-width:760px) {
        .catalog-row,
        .catalog-row.has-catalog-url {
          display:grid !important;
          grid-template-columns:24px minmax(0,1fr) 32px !important;
          grid-template-rows:1fr !important;
          gap:7px !important;
          min-height:56px !important;
          padding:6px 7px !important;
          align-items:center !important;
        }
        .catalog-row > .catalog-check,
        .catalog-row.has-catalog-url > .catalog-check {
          grid-column:1 !important;
          grid-row:1 !important;
          width:24px;
          height:32px;
          align-self:center;
        }
        .catalog-row .catalog-check input { width:16px; height:16px; }
        .catalog-row > .catalog-main,
        .catalog-row.has-catalog-url > .catalog-main {
          grid-column:2 !important;
          grid-row:1 !important;
          min-width:0;
          align-self:center;
        }
        .catalog-row .catalog-main { display:block !important; }
        .catalog-row .catalog-main > .project-signal-icon,
        .catalog-row .catalog-summaryline,
        .catalog-row > .catalog-facts,
        .catalog-row.has-catalog-url > .catalog-facts,
        .catalog-row > .catalog-url-row,
        .catalog-row.has-catalog-url > .catalog-url-row,
        .catalog-row .catalog-mark-actions { display:none !important; }
        .catalog-row .catalog-titleline { display:flex; min-width:0; gap:5px; }
        .catalog-row .catalog-titleline strong {
          min-width:0;
          font-size:.86rem;
          line-height:1.3;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .catalog-row .catalog-titleline em { font-size:.52rem; padding:.05rem .25rem; }
        .catalog-row > .catalog-links,
        .catalog-row.has-catalog-url > .catalog-links {
          grid-column:3 !important;
          grid-row:1 !important;
          align-self:center !important;
          justify-self:end;
          display:flex;
          width:30px;
          overflow:hidden;
        }
        .catalog-row .catalog-links > a { display:none !important; }
        .catalog-row .catalog-links > a:first-of-type {
          display:grid !important;
          place-items:center;
          width:30px;
          height:30px;
          padding:0;
          border:1px solid var(--line);
          font-size:0;
        }
        .catalog-row .catalog-links > a:first-of-type::after { content:"↗"; font-size:.78rem; font-weight:800; }
        .catalog-row .catalog-local { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    injectStyles();
    injectHeaderStyles();
    promoteCatalogControls();
    sync();
    document.querySelectorAll('[data-view-button]').forEach((button) => {
      button.addEventListener('click', () => setTimeout(sync, 0));
    });
    window.addEventListener('popstate', () => setTimeout(sync, 0));
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-header-catalog]')) promoteCatalogControls();
      scheduleDecorateUrls();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    scheduleDecorateUrls();
  }, 160));
})();
