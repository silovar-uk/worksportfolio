(() => {
  'use strict';

  const STYLE_ID = 'catalog-list-first-style';
  let shellObserver = null;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.catalog-overview{
  position:static!important;
  top:auto!important;
  z-index:auto!important;
  display:grid!important;
  grid-template-columns:minmax(220px,1fr) auto minmax(150px,auto)!important;
  gap:6px!important;
  align-items:stretch!important;
  margin:0 0 8px!important;
  padding:6px!important;
  border:1px solid var(--line-dark)!important;
  background:var(--paper)!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
.catalog-overview>.catalog-search{
  grid-column:1!important;
  grid-row:1!important;
  min-width:0!important;
}
.catalog-overview>.catalog-search input{
  width:100%!important;
  min-height:36px!important;
  height:36px!important;
  padding:.4rem .55rem!important;
  font-size:.8rem!important;
}
.catalog-filter-drawer{
  grid-column:2!important;
  grid-row:1!important;
  min-width:170px!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
}
.catalog-filter-drawer summary{
  list-style:none!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:7px!important;
  min-height:36px!important;
  height:36px!important;
  padding:0 10px!important;
  border:1px solid var(--line-dark)!important;
  background:var(--paper)!important;
  color:var(--ink)!important;
  font-size:.72rem!important;
  font-weight:850!important;
  cursor:pointer!important;
  white-space:nowrap!important;
}
.catalog-filter-drawer summary::-webkit-details-marker{display:none!important}
.catalog-filter-drawer summary::after{content:"＋";font-size:.85rem;line-height:1}
.catalog-filter-drawer[open] summary::after{content:"−"}
.catalog-filter-drawer summary [data-cat-filter-count]{margin-left:auto!important;color:var(--red)!important;font-size:.64rem!important}
.catalog-resultbar{
  grid-column:3!important;
  grid-row:1!important;
  min-height:36px!important;
  height:36px!important;
  padding:0 8px!important;
  border:1px solid var(--line)!important;
  display:flex!important;
  align-items:center!important;
  gap:6px!important;
  overflow:hidden!important;
}
.catalog-result{margin:0!important;font-size:.68rem!important;white-space:nowrap!important}
.catalog-result strong{font-size:.84rem!important}
.catalog-active{
  min-width:0!important;
  flex:1 1 auto!important;
  flex-wrap:nowrap!important;
  overflow-x:auto!important;
  scrollbar-width:none!important;
}
.catalog-active::-webkit-scrollbar{display:none!important}
.catalog-active button{
  flex:0 0 auto!important;
  max-width:150px!important;
  padding:.18rem .35rem!important;
  font-size:.62rem!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.catalog-select-visible{display:none!important}
.catalog-overview.is-filter-open .catalog-filter-drawer{
  grid-column:1/-1!important;
  grid-row:2!important;
  min-width:0!important;
}
.catalog-overview.is-filter-open .catalog-resultbar{grid-column:2/-1!important}
.catalog-overview.is-filter-open .catalog-select-visible{display:flex!important}
.catalog-filter-drawer .catalog-primary{
  display:grid!important;
  grid-template-columns:minmax(150px,1fr) minmax(150px,1fr) minmax(250px,1.4fr)!important;
  gap:5px!important;
  padding:6px 0 5px!important;
}
.catalog-filter-drawer .catalog-primary>.catalog-search{display:none!important}
.catalog-filter-drawer .catalog-primary>[data-cat-layout],
.catalog-filter-drawer .catalog-layout-native{display:none!important}
.catalog-filter-drawer .catalog-primary>select{
  grid-column:auto!important;
  min-width:0!important;
  width:100%!important;
  min-height:32px!important;
  height:32px!important;
  padding:.25rem .35rem!important;
  font-size:.65rem!important;
}
.catalog-filter-drawer .catalog-layout-switch{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  width:100%!important;
  min-width:0!important;
}
.catalog-filter-drawer .catalog-layout-switch button{
  min-width:0!important;
  min-height:32px!important;
  height:32px!important;
  padding:.2rem .25rem!important;
  font-size:.62rem!important;
  white-space:nowrap!important;
}
.catalog-filter-drawer>.catalog-quick{
  display:flex!important;
  grid-template-columns:none!important;
  margin:0!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  border-top:1px solid var(--line)!important;
  border-bottom:0!important;
  scrollbar-width:none!important;
  -webkit-overflow-scrolling:touch;
}
.catalog-filter-drawer>.catalog-quick::-webkit-scrollbar{display:none!important}
.catalog-filter-drawer .catalog-quick-button{
  flex:0 0 auto!important;
  min-width:94px!important;
  min-height:32px!important;
  padding:4px 6px!important;
  border-right:1px solid var(--line)!important;
  border-bottom:0!important;
  align-items:center!important;
  gap:4px!important;
}
.catalog-filter-drawer .catalog-quick-button span{font-size:.59rem!important}
.catalog-filter-drawer .catalog-quick-button strong{font-size:.78rem!important;line-height:1!important}
.catalog-filter-drawer .catalog-quick-icon{width:.9rem!important;height:.9rem!important;font-size:.56rem!important}
.catalog-filter-drawer>.catalog-taxonomy{
  padding:4px 0 2px!important;
  border-top:1px solid var(--line)!important;
  background:transparent!important;
}
.catalog-filter-drawer .catalog-taxonomy-head{display:none!important}
.catalog-filter-drawer .catalog-taxonomy-list{
  display:flex!important;
  flex-wrap:nowrap!important;
  width:100%!important;
  margin:0!important;
  padding:0 0 3px!important;
  gap:4px!important;
  overflow-x:auto!important;
  scrollbar-width:none!important;
}
.catalog-filter-drawer .catalog-taxonomy-list::-webkit-scrollbar{display:none!important}
.catalog-filter-drawer .catalog-taxonomy-button{
  flex:0 0 auto!important;
  min-height:26px!important;
  padding:.16rem .34rem!important;
  font-size:.59rem!important;
  white-space:nowrap!important;
}
.catalog-filter-drawer .catalog-taxonomy-button strong{font-size:.57rem!important}
.catalog-filter-drawer .catalog-filters{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:5px!important;
  padding:6px 0 0!important;
  border-top:1px solid var(--line)!important;
}
.catalog-filter-drawer .catalog-filters select{
  width:100%!important;
  min-height:32px!important;
  height:32px!important;
  padding:.25rem .35rem!important;
  font-size:.64rem!important;
}
.catalog-filter-drawer .catalog-filters .subtle-button{
  min-height:32px!important;
  padding:.25rem!important;
  font-size:.65rem!important;
}
@media(max-width:760px){
  .catalog-overview{
    grid-template-columns:minmax(0,1fr) auto!important;
    gap:4px!important;
    padding:4px!important;
  }
  .catalog-overview>.catalog-search{grid-column:1/-1!important;grid-row:1!important}
  .catalog-overview>.catalog-search input{min-height:34px!important;height:34px!important;font-size:.76rem!important}
  .catalog-filter-drawer{grid-column:1!important;grid-row:2!important;min-width:0!important}
  .catalog-filter-drawer summary{min-height:31px!important;height:31px!important;padding:0 7px!important;font-size:.67rem!important}
  .catalog-resultbar{
    grid-column:2!important;
    grid-row:2!important;
    min-width:92px!important;
    min-height:31px!important;
    height:31px!important;
    padding:0 6px!important;
    justify-content:flex-end!important;
  }
  .catalog-overview:not(.is-filter-open) .catalog-active{max-width:105px!important}
  .catalog-overview:not(.is-filter-open) .catalog-active button:nth-child(n+2){display:none!important}
  .catalog-overview.is-filter-open .catalog-filter-drawer{grid-column:1/-1!important;grid-row:2!important}
  .catalog-overview.is-filter-open .catalog-resultbar{grid-column:1/-1!important;grid-row:3!important;justify-content:flex-start!important}
  .catalog-filter-drawer .catalog-primary{grid-template-columns:1fr 1fr!important;gap:4px!important;padding:5px 0!important}
  .catalog-filter-drawer .catalog-layout-switch{grid-column:1/-1!important}
  .catalog-filter-drawer .catalog-filters{grid-template-columns:1fr 1fr!important;gap:4px!important}
  .catalog-filter-drawer .catalog-filters .subtle-button{grid-column:1/-1!important}
}
`;
    document.head.appendChild(style);
  }

  function setSummaryCopy(details) {
    const summary = details.querySelector(':scope > summary');
    if (!summary || summary.dataset.listFirstCopy) return;
    const count = summary.querySelector('[data-cat-filter-count]');
    summary.replaceChildren(document.createTextNode('絞り込み・表示'));
    if (count) summary.append(document.createTextNode(' '), count);
    summary.dataset.listFirstCopy = '1';
  }

  function syncOpenState(toolbar, details) {
    toolbar.classList.toggle('is-filter-open', details.open);
  }

  function installCompactFilterShell() {
    ensureStyle();
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const details = toolbar?.querySelector('[data-cat-more]');
    const primary = toolbar?.querySelector('.catalog-primary');
    const search = primary?.querySelector('.catalog-search') || toolbar?.querySelector(':scope > .catalog-search');
    const quick = toolbar?.querySelector('[data-cat-quick]');
    const taxonomy = toolbar?.querySelector('[data-taxonomy]');
    const filters = toolbar?.querySelector('.catalog-filters');
    if (!toolbar || !details || !primary || !search || !filters) return false;

    if (!details.dataset.listFirstReady) {
      details.classList.remove('catalog-more');
      details.classList.add('catalog-filter-drawer');
      details.open = false;
      details.dataset.listFirstReady = '1';
      details.addEventListener('toggle', () => syncOpenState(toolbar, details));
    }

    setSummaryCopy(details);

    if (search.parentElement !== toolbar) toolbar.insertBefore(search, details);
    if (primary.parentElement !== details) details.appendChild(primary);
    if (quick && quick.parentElement !== details) details.appendChild(quick);
    if (taxonomy && taxonomy.parentElement !== details) details.appendChild(taxonomy);
    if (filters.parentElement !== details) details.appendChild(filters);

    const nativeLayout = primary.querySelector('[data-cat-layout]');
    if (nativeLayout) {
      nativeLayout.hidden = true;
      nativeLayout.setAttribute('aria-hidden', 'true');
    }

    syncOpenState(toolbar, details);
    return true;
  }

  function startCompactFilterShell() {
    let attempts = 0;
    const wait = () => {
      attempts += 1;
      if (!installCompactFilterShell() && attempts < 40) {
        setTimeout(wait, 80);
        return;
      }
      const root = document.querySelector('.explorer');
      if (!shellObserver && root) {
        shellObserver = new MutationObserver(() => installCompactFilterShell());
        shellObserver.observe(root, { childList: true, subtree: true });
      }
    };
    wait();
  }

  if (document.readyState === 'complete') startCompactFilterShell();
  else window.addEventListener('load', startCompactFilterShell, { once: true });
})();
