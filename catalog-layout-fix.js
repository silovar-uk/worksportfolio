(() => {
  'use strict';

  const STYLE_ID = 'catalog-layout-fix-style';
  let scheduled = false;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Keep catalog controls inside the catalog instead of expanding the sticky site header. */
      .header-catalog-tools { display:none !important; }
      [data-catalog-toolbar] .catalog-primary {
        grid-template-columns:minmax(260px,1fr) repeat(3,minmax(155px,auto)) !important;
        justify-content:stretch !important;
      }

      /* Let title/summary use the width that the row actually owns. */
      .catalog-main { width:100%; min-width:0; }
      .catalog-titleline { width:100%; min-width:0; }
      .catalog-titleline strong {
        flex:1 1 auto;
        min-width:0;
        max-width:100%;
      }
      .catalog-summaryline { max-width:100%; }

      @media (max-width:1100px) {
        [data-catalog-toolbar] .catalog-primary {
          grid-template-columns:1fr 1fr 1fr !important;
        }
        [data-catalog-toolbar] .catalog-search { grid-column:1 / -1; }
      }

      @media (max-width:760px) {
        [data-catalog-toolbar] .catalog-primary {
          grid-template-columns:1fr 1fr !important;
          padding:10px !important;
        }
        [data-catalog-toolbar] .catalog-search,
        [data-catalog-toolbar] [data-cat-sort] { grid-column:1 / -1; }

        /* Restore readable list rows instead of the ultra-compressed one-line variant. */
        .catalog-row,
        .catalog-row.has-catalog-url {
          display:grid !important;
          grid-template-columns:30px minmax(0,1fr) 38px !important;
          grid-template-rows:auto auto !important;
          gap:8px !important;
          min-height:82px !important;
          padding:9px 10px !important;
          align-items:center !important;
        }
        .catalog-row > .catalog-check,
        .catalog-row.has-catalog-url > .catalog-check {
          grid-column:1 !important;
          grid-row:1 / span 2 !important;
          width:30px;
          height:30px;
          align-self:center;
        }
        .catalog-row > .catalog-main,
        .catalog-row.has-catalog-url > .catalog-main {
          grid-column:2 !important;
          grid-row:1 !important;
          min-width:0;
          width:100%;
          align-self:center;
        }
        .catalog-row .catalog-titleline { display:flex !important; min-width:0; width:100%; gap:5px; }
        .catalog-row .catalog-titleline strong {
          flex:1 1 auto !important;
          min-width:0 !important;
          max-width:100% !important;
          font-size:.9rem;
          line-height:1.35;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .catalog-row .catalog-summaryline {
          display:block !important;
          margin-top:3px;
          color:var(--muted);
          font-size:.75rem;
          line-height:1.4;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .catalog-row > .catalog-facts,
        .catalog-row.has-catalog-url > .catalog-facts {
          grid-column:2 / 4 !important;
          grid-row:2 !important;
          display:flex !important;
          flex-wrap:wrap;
          gap:5px;
          min-width:0;
        }
        .catalog-row > .catalog-url-row,
        .catalog-row.has-catalog-url > .catalog-url-row { display:none !important; }
        .catalog-row > .catalog-links,
        .catalog-row.has-catalog-url > .catalog-links {
          grid-column:3 !important;
          grid-row:1 !important;
          align-self:center !important;
          justify-self:end;
          width:32px !important;
          max-width:32px;
          overflow:hidden;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function restoreCatalogControls() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const primary = toolbar?.querySelector('.catalog-primary');
    const filters = toolbar?.querySelector('.catalog-filters');
    if (!toolbar || !primary || !filters) return false;

    const searchInput = document.querySelector('[data-cat-search]');
    const search = searchInput?.closest('.catalog-search');
    const sort = document.querySelector('[data-cat-sort]');
    const layout = document.querySelector('[data-cat-layout]');
    const type = document.querySelector('[data-cat-type]');
    const status = document.querySelector('[data-cat-status]');
    const year = document.querySelector('[data-cat-year]');
    const doc = document.querySelector('[data-cat-doc]');

    if (search && search.parentElement !== primary) primary.insertBefore(search, primary.firstChild);
    if (sort && sort.parentElement !== primary) primary.insertBefore(sort, layout || null);

    if (type && type.parentElement !== filters) filters.insertBefore(type, status || filters.firstChild);
    if (year && year.parentElement !== filters) filters.insertBefore(year, doc || null);

    /* Leave the marker in place so catalog-visibility.js does not promote the controls again. */
    const headerTools = document.querySelector('[data-header-catalog]');
    if (headerTools) {
      headerTools.setAttribute('aria-hidden', 'true');
      headerTools.hidden = true;
    }
    return true;
  }

  function repair() {
    scheduled = false;
    installStyles();
    restoreCatalogControls();
  }

  function scheduleRepair() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(repair);
  }

  function start() {
    installStyles();
    scheduleRepair();
    setTimeout(scheduleRepair, 180);
    setTimeout(scheduleRepair, 320);
    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();