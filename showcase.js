(() => {
  'use strict';

  const config = () => window.WORKS_PORTFOLIO_SHOWCASE || null;
  const projects = () => Array.isArray(window.BUILD_DIARY_DATA?.projects) ? window.BUILD_DIARY_DATA.projects : [];
  const projectMap = () => new Map(projects().filter((project) => project?.id).map((project) => [project.id, project]));
  let activeFamily = '';
  let filterFrame = 0;
  let panelObserver = null;

  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const typeLabels = {
    'web-app': 'Webアプリ', 'chrome-extension': 'Chrome拡張', 'learning-tool': '学習ツール',
    'design-system': '設計・デザイン', 'content-page': 'コンテンツ', 'data-tool': '分析・データ',
    utility: '便利ツール', experiment: '実験'
  };

  function projectAction(project, label = '見る') {
    if (!project) return '';
    if (project.summaryOnly) {
      return project.liveUrl
        ? `<a class="showcase-action" href="${attr(project.liveUrl)}" target="_blank" rel="noopener">${esc(label)}</a>`
        : '<span class="showcase-source-note">Source not public</span>';
    }
    return `<button class="showcase-action" type="button" data-showcase-open="${attr(project.id)}">${esc(label)}</button>`;
  }

  function featuredCard(project) {
    const type = typeLabels[project.type] || project.type || '制作物';
    return `<article class="showcase-featured-card">
      <div class="showcase-card-meta"><span>${esc(type)}</span>${project.sourceVisibility === 'private' ? '<span>Source not public</span>' : ''}</div>
      <h3>${esc(project.title || project.id)}</h3>
      <p>${esc(project.summary || project.subtitle || '')}</p>
      <div class="showcase-card-footer">${projectAction(project, project.liveUrl ? '開く' : '制作記録を見る')}</div>
    </article>`;
  }

  function memberLink(project) {
    if (!project) return '';
    if (project.summaryOnly && !project.liveUrl) return `<span>${esc(project.title)}</span>`;
    if (project.summaryOnly && project.liveUrl) return `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">${esc(project.title)}</a>`;
    return `<button type="button" data-showcase-open="${attr(project.id)}">${esc(project.title)}</button>`;
  }

  function familyCard(family, map) {
    const members = (family.projectIds || []).map((id) => map.get(id)).filter(Boolean);
    return `<article class="showcase-family-card" data-showcase-family-card="${attr(family.id)}">
      <div class="showcase-family-head"><h3>${esc(family.label)}</h3><strong>${members.length}</strong></div>
      <p>${esc(family.description || '')}</p>
      <div class="showcase-family-members">${members.slice(0, 6).map(memberLink).join('')}</div>
      <button class="showcase-family-filter" type="button" data-showcase-family="${attr(family.id)}" aria-pressed="false">この系統を見る</button>
    </article>`;
  }

  function render() {
    const taxonomy = config();
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!taxonomy || !toolbar || document.querySelector('[data-portfolio-showcase]')) return false;

    const map = projectMap();
    const showcase = taxonomy.showcase || {};
    const featured = (showcase.featuredProjectIds || []).map((id) => map.get(id)).filter(Boolean).slice(0, 5);
    const families = Array.isArray(taxonomy.families) ? taxonomy.families : [];

    const section = document.createElement('section');
    section.className = 'portfolio-showcase';
    section.dataset.portfolioShowcase = '';
    section.innerHTML = `
      <section class="showcase-block showcase-entry" aria-labelledby="showcase-featured-title">
        <div class="showcase-block-head">
          <div><p>START HERE</p><h2 id="showcase-featured-title">まず見る${featured.length}作品</h2></div>
          <span>制作の系統が一周できる入口</span>
        </div>
        <p class="showcase-intro">全部を見る前に、まずは方向の違う制作物をひとつずつ。気になった入口から、そのまま近い作品へ辿れます。</p>
        <div class="showcase-featured-grid">${featured.map(featuredCard).join('')}</div>
      </section>

      <section class="showcase-block showcase-families-block" aria-labelledby="showcase-families-title">
        <div class="showcase-block-head">
          <div><p>PROJECT FAMILIES</p><h2 id="showcase-families-title">${families.length}つの制作系統</h2></div>
          <span data-showcase-family-hint>興味の入口から全作品を絞る</span>
          <button type="button" data-showcase-family-clear hidden>絞り込み解除</button>
        </div>
        <div class="showcase-families">${families.map((family) => familyCard(family, map)).join('')}</div>
      </section>

      <footer class="showcase-catalog-bridge">
        <div>
          <p>ALL WORKS</p>
          <h2>ここから全作品へ</h2>
          <span>名前で探す、目的で絞る、年代で辿る。必要になったところで一覧を使えます。</span>
        </div>
        <button type="button" class="showcase-primary" data-showcase-browse>全作品を見る</button>
      </footer>`;

    const explorer = toolbar.closest('.explorer');
    if (explorer?.parentNode) explorer.insertAdjacentElement('beforebegin', section);
    else toolbar.parentNode?.prepend(section);
    syncFamilyUi();
    syncVisibility();
    scheduleFamilyFilter();
    return true;
  }

  function openProject(id) {
    const project = projectMap().get(id);
    if (!project || project.summaryOnly) return;
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function scrollToCatalog() {
    document.querySelector('[data-catalog-toolbar]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function activeFamilyConfig() {
    if (!activeFamily) return null;
    return (config()?.families || []).find((item) => item.id === activeFamily) || null;
  }

  function syncFamilyUi() {
    const active = activeFamilyConfig();
    document.querySelectorAll('[data-showcase-family-card]').forEach((card) => {
      card.classList.toggle('is-active', Boolean(active && card.getAttribute('data-showcase-family-card') === active.id));
    });
    document.querySelectorAll('[data-showcase-family]').forEach((button) => {
      const selected = Boolean(active && button.getAttribute('data-showcase-family') === active.id);
      button.textContent = selected ? '絞り込みを解除' : 'この系統を見る';
      button.setAttribute('aria-pressed', String(selected));
    });
    const clear = document.querySelector('[data-showcase-family-clear]');
    const hint = document.querySelector('[data-showcase-family-hint]');
    if (clear) clear.hidden = !active;
    if (hint) hint.hidden = Boolean(active);
  }

  function applyFamilyFilter() {
    filterFrame = 0;
    if (document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button') !== 'shelf') return;

    const active = activeFamilyConfig();
    const ids = new Set(active?.projectIds || []);
    const enabled = Boolean(active);
    const items = [...document.querySelectorAll('[data-cat-item]')];
    let visibleCount = 0;

    items.forEach((item) => {
      const id = item.getAttribute('data-cat-item');
      const hiddenByFamily = enabled && !ids.has(id);
      item.dataset.showcaseFamilyHidden = hiddenByFamily ? 'true' : 'false';
      item.style.display = hiddenByFamily ? 'none' : '';
      if (!hiddenByFamily && !item.hidden) visibleCount += 1;
    });

    document.querySelectorAll('.catalog-group').forEach((group) => {
      const visible = [...group.querySelectorAll('[data-cat-item]')]
        .some((item) => item.style.display !== 'none' && !item.hidden);
      group.style.display = enabled && !visible ? 'none' : '';
    });

    const count = document.querySelector('[data-cat-count]');
    if (count && items.length) {
      count.innerHTML = enabled
        ? `<strong>${visibleCount}</strong>件（${esc(active.label)}）`
        : `<strong>${visibleCount}</strong> / ${projects().length}件`;
    }
  }

  function scheduleFamilyFilter() {
    cancelAnimationFrame(filterFrame);
    filterFrame = requestAnimationFrame(applyFamilyFilter);
  }

  function setFamily(id) {
    activeFamily = activeFamily === id ? '' : id;
    syncFamilyUi();
    scheduleFamilyFilter();
    if (activeFamily) requestAnimationFrame(scrollToCatalog);
  }

  function clearFamily() {
    if (!activeFamily) return;
    activeFamily = '';
    syncFamilyUi();
    scheduleFamilyFilter();
  }

  function syncVisibility() {
    const section = document.querySelector('[data-portfolio-showcase]');
    if (!section) return;
    const active = document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button');
    section.hidden = Boolean(active && active !== 'shelf');
  }

  function bindPanelObserver() {
    if (panelObserver) return;
    const panel = document.querySelector('[data-view-panel]');
    if (!panel) return;
    panelObserver = new MutationObserver(() => scheduleFamilyFilter());
    panelObserver.observe(panel, { childList: true });
  }

  function bindEvents() {
    if (document.documentElement.dataset.showcaseEventsBound) return;
    document.documentElement.dataset.showcaseEventsBound = 'true';

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const open = target.closest('[data-showcase-open]');
      if (open) {
        event.preventDefault();
        openProject(open.getAttribute('data-showcase-open'));
        return;
      }
      if (target.closest('[data-showcase-browse]')) {
        event.preventDefault();
        scrollToCatalog();
        return;
      }
      const family = target.closest('[data-showcase-family]');
      if (family) {
        event.preventDefault();
        setFamily(family.getAttribute('data-showcase-family'));
        return;
      }
      if (target.closest('[data-showcase-family-clear]')) {
        event.preventDefault();
        clearFamily();
        return;
      }
      if (target.closest('[data-view-button]')) {
        setTimeout(() => {
          syncVisibility();
          scheduleFamilyFilter();
        }, 0);
      }
    });

    window.addEventListener('popstate', () => setTimeout(() => {
      syncVisibility();
      scheduleFamilyFilter();
    }, 0));
  }

  function start() {
    bindEvents();
    let attempts = 0;
    const waitForCatalog = () => {
      attempts += 1;
      const toolbar = document.querySelector('[data-catalog-toolbar]');
      if (!config() || !toolbar) {
        if (attempts < 75) setTimeout(waitForCatalog, 80);
        return;
      }
      render();
      bindPanelObserver();
      syncVisibility();
      scheduleFamilyFilter();
    };
    waitForCatalog();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
