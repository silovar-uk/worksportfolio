(() => {
  'use strict';

  const STYLE_ID = 'catalog-layout-fix-style';
  let scheduled = false;
  let pendingViewportRestore = 0;

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

      /* Search is filtering, not navigation: keep the viewport and result surface visually quiet. */
      html.catalog-search-stable { scroll-behavior:auto !important; }
      [data-view-panel] { overflow-anchor:none; }
      .catalog-search-results,
      .catalog-search-result,
      [data-view-panel] > .empty-state {
        animation:none !important;
        transition:none !important;
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

      /* Hero: treat the title as a quiet editorial label, not the visual destination. */
      @media (min-width:761px) {
        .hero {
          min-height:auto !important;
          padding-block:68px 42px !important;
          grid-template-columns:minmax(0,1fr) 240px !important;
          gap:24px 56px !important;
        }
        .hero::before { top:24px !important; width:32% !important; }
        .hero-copy h1 {
          max-width:620px !important;
          font-size:clamp(1.55rem,2.25vw,2.35rem) !important;
          line-height:1.18 !important;
          letter-spacing:-.025em !important;
        }
        .hero-lead {
          max-width:620px !important;
          margin-top:1rem !important;
          font-size:1rem !important;
          line-height:1.75 !important;
        }
        .hero-actions { margin-top:1.35rem !important; }
        .hero-note {
          width:min(100%,230px) !important;
          padding:1.45rem 1.25rem 1.1rem !important;
          transform:rotate(1deg) !important;
        }
        .hero-note p { font-size:.98rem !important; }
        .hero-stats {
          margin-top:12px !important;
          padding-top:16px !important;
        }
        .hero-stats dd { font-size:clamp(1.35rem,2.4vw,2rem) !important; }

        /* Keep a stable result stage so short searches do not collapse the page under the cursor. */
        .catalog-search-results,
        [data-view-panel] > .empty-state {
          min-height:clamp(600px,68vh,820px);
          align-content:start;
        }
      }

      @media (max-width:1100px) {
        [data-catalog-toolbar] .catalog-primary {
          grid-template-columns:1fr 1fr 1fr !important;
        }
        [data-catalog-toolbar] .catalog-search { grid-column:1 / -1; }
      }

      @media (max-width:760px) {
        .hero {
          min-height:auto !important;
          padding-top:52px !important;
          padding-bottom:34px !important;
        }
        .hero-copy h1 {
          font-size:clamp(1.75rem,8vw,2.6rem) !important;
          line-height:1.14 !important;
        }
        .hero-lead { margin-top:1rem !important; }

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

  function restoreViewport(snapshot) {
    if (!snapshot) return;
    const input = snapshot.input;
    document.documentElement.classList.add('catalog-search-stable');

    const apply = () => {
      window.scrollTo({ top:snapshot.scrollY, left:snapshot.scrollX, behavior:'auto' });
      if (input?.isConnected && document.activeElement !== input) {
        try { input.focus({ preventScroll:true }); } catch (_) { input.focus(); }
      }
      if (input?.isConnected && typeof snapshot.selectionStart === 'number') {
        try { input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd); } catch (_) {}
      }
    };

    apply();
    cancelAnimationFrame(pendingViewportRestore);
    pendingViewportRestore = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        apply();
        document.documentElement.classList.remove('catalog-search-stable');
      });
    });
  }

  function bindSearchStability() {
    if (document.documentElement.dataset.catalogSearchStabilityBound) return;
    document.documentElement.dataset.catalogSearchStabilityBound = 'true';

    document.addEventListener('input', event => {
      const input = event.target.closest?.('[data-cat-search], [data-search-input]');
      if (!input || matchMedia('(max-width:760px)').matches) return;
      const snapshot = {
        input,
        scrollX:window.scrollX,
        scrollY:window.scrollY,
        selectionStart:input.selectionStart,
        selectionEnd:input.selectionEnd
      };
      restoreViewport(snapshot);
      setTimeout(() => restoreViewport(snapshot), 0);
    }, true);

    document.addEventListener('change', event => {
      const control = event.target.closest?.('[data-catalog-toolbar] select, [data-cat-sort], [data-cat-layout], [data-cat-group], [data-cat-verb], [data-cat-type], [data-cat-status], [data-cat-year], [data-cat-doc], [data-cat-link], [data-mark-filter]');
      if (!control || matchMedia('(max-width:760px)').matches) return;
      const input = document.querySelector('[data-cat-search]');
      const snapshot = {
        input:document.activeElement === input ? input : null,
        scrollX:window.scrollX,
        scrollY:window.scrollY,
        selectionStart:input?.selectionStart ?? null,
        selectionEnd:input?.selectionEnd ?? null
      };
      restoreViewport(snapshot);
      setTimeout(() => restoreViewport(snapshot), 0);
    }, true);
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
    bindSearchStability();
    scheduleRepair();
    setTimeout(scheduleRepair, 180);
    setTimeout(scheduleRepair, 320);
    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();