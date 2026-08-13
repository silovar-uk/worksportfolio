(() => {
  'use strict';

  const STYLE_ID = 'catalog-visible-url-style';
  let decorateScheduled = false;

  function currentView() {
    return document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button') || '';
  }

  function sync() {
    const shelf = currentView() === 'shelf';
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const bulk = document.querySelector('[data-cat-bulk]');
    if (toolbar) toolbar.hidden = !shelf;
    if (bulk && !shelf) bulk.hidden = true;
    if (shelf) scheduleDecorateUrls();
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
        .catalog-row .catalog-main {
          display:block !important;
        }
        .catalog-row .catalog-main > .project-signal-icon,
        .catalog-row .catalog-summaryline,
        .catalog-row > .catalog-facts,
        .catalog-row.has-catalog-url > .catalog-facts,
        .catalog-row > .catalog-url-row,
        .catalog-row.has-catalog-url > .catalog-url-row,
        .catalog-row .catalog-mark-actions {
          display:none !important;
        }
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
        .catalog-row .catalog-links > a {
          display:none !important;
        }
        .catalog-row .catalog-links > a:first-of-type {
          display:grid !important;
          place-items:center;
          width:30px;
          height:30px;
          padding:0;
          border:1px solid var(--line);
          font-size:0;
        }
        .catalog-row .catalog-links > a:first-of-type::after {
          content:"↗";
          font-size:.78rem;
          font-weight:800;
        }
        .catalog-row .catalog-local { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    injectStyles();
    sync();
    document.querySelectorAll('[data-view-button]').forEach((button) => {
      button.addEventListener('click', () => setTimeout(sync, 0));
    });
    window.addEventListener('popstate', () => setTimeout(sync, 0));
    const observer = new MutationObserver(() => scheduleDecorateUrls());
    observer.observe(document.body, { childList:true, subtree:true });
    scheduleDecorateUrls();
  }, 160));
})();
