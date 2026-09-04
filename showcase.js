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
  const timeValue = (value) => {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return 0;
    return Date.UTC(Number(match[1]), Number(match[2] || 1) - 1, Number(match[3] || 1));
  };
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
      <button class="showcase-family-filter" type="button" data-showcase-family="${attr(family.id)}">${activeFamily === family.id ? '絞り込みを解除' : '作品棚で絞る'}</button>
    </article>`;
  }

  function principleCard(principle, map) {
    const examples = (principle.projectIds || []).map((id) => map.get(id)).filter(Boolean).slice(0, 3);
    return `<article class="showcase-principle">
      <h3>${esc(principle.label)}</h3>
      <p>${esc(principle.description || '')}</p>
      <small>${examples.map((project) => esc(project.title)).join(' / ')}</small>
    </article>`;
  }

  function recentCard(project) {
    const date = project.updatedAt || project.createdAt || '';
    return `<article class="showcase-recent-card">
      <div><small>${esc(date)}</small><h3>${esc(project.title || project.id)}</h3></div>
      ${projectAction(project, project.liveUrl ? '開く' : '見る')}
    </article>`;
  }

  function render() {
    const taxonomy = config();
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!taxonomy || !toolbar || document.querySelector('[data-portfolio-showcase]')) return;

    const map = projectMap();
    const showcase = taxonomy.showcase || {};
    const featured = (showcase.featuredProjectIds || []).map((id) => map.get(id)).filter(Boolean).slice(0, 6);
    const recent = projects()
      .filter((project) => project?.documentationState === 'verified' && project?.id !== 'worksportfolio')
      .sort((a, b) => timeValue(b.updatedAt || b.createdAt) - timeValue(a.updatedAt || a.createdAt))
      .slice(0, Math.max(1, Number(showcase.recentLimit) || 4));

    const section = document.createElement('section');
    section.className = 'portfolio-showcase';
    section.dataset.portfolioShowcase = '';
    section.innerHTML = `
      <header class="showcase-hero">
        <p class="showcase-eyebrow">${esc(showcase.eyebrow || 'WORKS PORTFOLIO')}</p>
        <h1>${esc(showcase.title || 'つくって考えた')}</h1>
        <p class="showcase-lead">${esc(showcase.summary || '')}</p>
        <div class="showcase-hero-actions">
          <button type="button" class="showcase-primary" data-showcase-browse>全作品を見る</button>
          <span>${projects().length} works</span>
        </div>
      </header>

      <section class="showcase-block" aria-labelledby="showcase-featured-title">
        <div class="showcase-block-head"><div><p>SELECTED WORKS</p><h2 id="showcase-featured-title">代表作</h2></div><span>幅が見える6作品</span></div>
        <div class="showcase-featured-grid">${featured.map(featuredCard).join('')}</div>
      </section>

      <div class="showcase-two-column">
        <section class="showcase-block" aria-labelledby="showcase-principles-title">
          <div class="showcase-block-head"><div><p>MAKING PRINCIPLES</p><h2 id="showcase-principles-title">繰り返し現れる考え方</h2></div></div>
          <div class="showcase-principles">${(taxonomy.principles || []).map((principle) => principleCard(principle, map)).join('')}</div>
        </section>

        <section class="showcase-block" aria-labelledby="showcase-families-title">
          <div class="showcase-block-head"><div><p>PROJECT FAMILIES</p><h2 id="showcase-families-title">制作の系統</h2></div>${activeFamily ? '<button type="button" data-showcase-family-clear>絞り込み解除</button>' : ''}</div>
          <div class="showcase-families">${(taxonomy.families || []).map((family) => familyCard(family, map)).join('')}</div>
        </section>
      </div>

      <section class="showcase-block showcase-recent" aria-labelledby="showcase-recent-title">
        <div class="showcase-block-head"><div><p>RECENTLY BUILT</p><h2 id="showcase-recent-title">最近育てたもの</h2></div></div>
        <div class="showcase-recent-grid">${recent.map(recentCard).join('')}</div>
      </section>`;

    const explorer = toolbar.closest('.explorer');
    if (explorer?.parentNode) explorer.insertAdjacentElement('afterend', section);
    else toolbar.parentNode?.appendChild(section);
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
