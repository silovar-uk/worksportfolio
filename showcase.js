(() => {
  'use strict';

  const config = () => window.WORKS_PORTFOLIO_SHOWCASE || null;
  const projects = () => Array.isArray(window.BUILD_DIARY_DATA?.projects) ? window.BUILD_DIARY_DATA.projects : [];
  const projectMap = () => new Map(projects().filter((project) => project?.id).map((project) => [project.id, project]));
  let activeFamily = '';
  let applyingFamily = false;
  let pendingViewportRestore = 0;

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
    return `<article class="showcase-family-card${activeFamily === family.id ? ' is-active' : ''}">
      <div class="showcase-family-head"><h3>${esc(family.label)}</h3><strong>${members.length}</strong></div>
      <p>${esc(family.description || '')}</p>
      <div class="showcase-family-members">${members.slice(0, 6).map(memberLink).join('')}</div>
      <button class="showcase-family-filter" type="button" data-showcase-family="${attr(family.id)}">${activeFamily === family.id ? '絞り込みを解除' : 'この系統を見る'}</button>
    </article>`;
  }

  function render() {
    const taxonomy = config();
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!taxonomy || !toolbar || document.querySelector('[data-portfolio-showcase]')) return;

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
          ${activeFamily ? '<button type="button" data-showcase-family-clear>絞り込み解除</button>' : '<span>興味の入口から全作品を絞る</span>'}
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
    syncVisibility();
    applyFamilyFilter();
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

  function familyIds() {
    const family = (config()?.families || []).find((item) => item.id === activeFamily);
    return new Set(family?.projectIds || []);
  }

  function applyFamilyFilter() {
    if (applyingFamily) return;
    applyingFamily = true;
    const ids = familyIds();
    const enabled = Boolean(activeFamily);
    const items = [...document.querySelectorAll('[data-cat-item]')];
    items.forEach((item) => {
      const id = item.getAttribute('data-cat-item');
      item.dataset.showcaseFamilyHidden = String(enabled && !ids.has(id));
      item.style.display = enabled && !ids.has(id) ? 'none' : '';
    });
    document.querySelectorAll('.catalog-group').forEach((group) => {
      const visible = [...group.querySelectorAll('[data-cat-item]')].some((item) => item.style.display !== 'none' && !item.hidden);
      group.style.display = enabled && !visible ? 'none' : '';
    });
    if (enabled) {
      const count = document.querySelector('[data-cat-count]');
      const visibleCount = items.filter((item) => item.style.display !== 'none' && !item.hidden).length;
      if (count) count.innerHTML = `<strong>${visibleCount}</strong>件（Project Family）`;
    }
    applyingFamily = false;
  }

  function setFamily(id) {
    activeFamily = activeFamily === id ? '' : id;
    document.querySelector('[data-portfolio-showcase]')?.remove();
    render();
    requestAnimationFrame(() => {
      applyFamilyFilter();
      scrollToCatalog();
    });
  }

  function clearFamily() {
    activeFamily = '';
    document.querySelector('[data-portfolio-showcase]')?.remove();
    render();
    requestAnimationFrame(applyFamilyFilter);
  }

  function syncVisibility() {
    const section = document.querySelector('[data-portfolio-showcase]');
    if (!section) return;
    const active = document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button');
    section.hidden = Boolean(active && active !== 'shelf');
  }

  function snapshotViewport(input = null) {
    return {
      input,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      selectionStart: input?.selectionStart ?? null,
      selectionEnd: input?.selectionEnd ?? null
    };
  }

  function restoreViewport(snapshot) {
    if (!snapshot) return;
    const input = snapshot.input;
    document.documentElement.classList.add('catalog-input-stable');

    const apply = () => {
      window.scrollTo({ top: snapshot.scrollY, left: snapshot.scrollX, behavior: 'auto' });
      if (input?.isConnected && document.activeElement !== input) {
        try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
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
        document.documentElement.classList.remove('catalog-input-stable');
      });
    });
  }

  function bindCatalogStability() {
    if (document.documentElement.dataset.catalogInputStabilityBound) return;
    document.documentElement.dataset.catalogInputStabilityBound = 'true';

    document.addEventListener('input', (event) => {
      if (matchMedia('(max-width:760px)').matches) return;
      const input = event.target instanceof Element ? event.target.closest('[data-cat-search], [data-search-input]') : null;
      if (!input) return;
      const snapshot = snapshotViewport(input);
      restoreViewport(snapshot);
      setTimeout(() => restoreViewport(snapshot), 0);
    }, true);

    document.addEventListener('change', (event) => {
      if (matchMedia('(max-width:760px)').matches) return;
      const control = event.target instanceof Element
        ? event.target.closest('[data-catalog-toolbar] select, [data-cat-sort], [data-cat-layout], [data-cat-group], [data-cat-verb], [data-cat-type], [data-cat-status], [data-cat-year], [data-cat-doc], [data-cat-link], [data-mark-filter]')
        : null;
      if (!control) return;
      const search = document.querySelector('[data-cat-search]');
      const snapshot = snapshotViewport(document.activeElement === search ? search : null);
      restoreViewport(snapshot);
      setTimeout(() => restoreViewport(snapshot), 0);
    }, true);
  }

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
    if (target.closest('[data-view-button]')) setTimeout(syncVisibility, 0);
  });

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render();
      applyFamilyFilter();
      syncVisibility();
    });
  });

  function start() {
    bindCatalogStability();
    render();
    const explorer = document.querySelector('.explorer');
    if (explorer) observer.observe(explorer, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
