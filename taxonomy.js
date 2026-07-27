(() => {
  'use strict';

  const meta = {
    'web-app': { label: 'Webアプリ', order: 1 },
    'chrome-extension': { label: 'Chrome拡張', order: 2 },
    'learning-tool': { label: '学習ツール', order: 3 },
    'design-system': { label: '設計ガイド', order: 4 },
    'content-page': { label: 'コンテンツ', order: 5 },
    'data-tool': { label: '分析・データ', order: 6 },
    utility: { label: '便利ツール', order: 7 },
    experiment: { label: '実験', order: 8 },
    other: { label: 'その他', order: 9 }
  };
  const typeClasses = Object.keys(meta).map((type) => `type-${type}`);
  let observer = null;
  let scheduled = false;
  let currentRandomId = '';
  let currentRandomPoolSize = 0;
  let lastRandomId = '';

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const audit = () => window.WORKS_PORTFOLIO_AUDIT || { counts: { total: projects().length, byType: {} }, issues: {} };
  const projectMap = () => new Map(projects().map((project) => [project.id, project]));
  const typeOf = (project) => meta[project?.type] ? project.type : 'other';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => escapeHtml(value).replace(/'/g, '&#39;');

  function replaceHtmlIfChanged(element, html) {
    if (element.innerHTML !== html) element.innerHTML = html;
  }

  function setTypeClass(element, type) {
    const target = `type-${type}`;
    if (element.classList.contains(target)) return;
    typeClasses.forEach((className) => element.classList.remove(className));
    element.classList.add(target);
  }

  function assignType(element, type, surface = false) {
    if (!element) return;
    if (element.dataset.projectType !== type) element.dataset.projectType = type;
    if (surface) element.dataset.projectSurface = '';
    setTypeClass(element, type);
  }

  function randomResultHtml() {
    const project = projects().find((item) => item.id === currentRandomId);
    if (!project) return '';
    const type = typeOf(project);
    const poolLabel = currentRandomPoolSize
      ? `いま表示されている${currentRandomPoolSize}件から選出`
      : '全作品から選出';
    const directLink = project.liveUrl
      ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">すぐ使う ↗</a>`
      : '';
    return `
      <article class="catalog-random-result type-${type}" data-taxonomy-random-result aria-live="polite">
        <div class="catalog-random-result-head">
          <span>🎲 ${escapeHtml(poolLabel)}</span>
          <button type="button" data-taxonomy-random-close aria-label="ランダム結果を閉じる">×</button>
        </div>
        <p class="catalog-random-type">${escapeHtml(meta[type]?.label || project.type || 'その他')}</p>
        <h3>${escapeHtml(project.title || project.id)}</h3>
        <p>${escapeHtml(project.summary || project.friction || '説明を準備中です。')}</p>
        <div class="catalog-random-actions">
          <button type="button" class="primary-action" data-taxonomy-random-open="${attr(project.id)}">この作品を開く</button>
          <button type="button" class="subtle-button" data-taxonomy-random>もう1回</button>
          ${directLink}
        </div>
      </article>`;
  }

  function ensureTaxonomy() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!toolbar) return;
    let section = toolbar.querySelector('[data-taxonomy]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'catalog-taxonomy';
      section.dataset.taxonomy = '';
      const details = toolbar.querySelector('.catalog-more');
      toolbar.insertBefore(section, details || toolbar.querySelector('.catalog-resultbar'));
    }

    const counts = audit().counts || {};
    const byType = counts.byType || {};
    const entries = Object.keys(byType)
      .map((type) => ({ type: meta[type] ? type : 'other', originalType: type, count: byType[type] }))
      .sort((a, b) => (meta[a.type]?.order || 99) - (meta[b.type]?.order || 99));
    const current = document.querySelector('[data-cat-type]')?.value || '';
    const total = counts.total || projects().length;
    const html = `
      <div class="catalog-taxonomy-head">
        <strong>種類で見分ける</strong>
        <span>公開対象 ${total}件。色と件数は同じデータから自動集計。</span>
      </div>
      <div class="catalog-taxonomy-list">
        <button type="button" class="catalog-taxonomy-button catalog-taxonomy-all${current ? '' : ' is-active'}" data-taxonomy-filter="" aria-pressed="${!current}">
          <span>すべて</span><strong>${total}</strong>
        </button>
        ${entries.map(({ type, originalType, count }) => `<button type="button" class="catalog-taxonomy-button type-${type}${current === originalType ? ' is-active' : ''}" data-taxonomy-type="${type}" data-taxonomy-filter="${originalType}" aria-pressed="${current === originalType}"><span>${meta[type]?.label || originalType}</span><strong>${count}</strong></button>`).join('')}
        <button type="button" class="catalog-random-button" data-taxonomy-random><span aria-hidden="true">🎲</span><span>ランダムで1本</span></button>
      </div>
      ${randomResultHtml()}`;
    replaceHtmlIfChanged(section, html);
  }

  function decorateItems() {
    const map = projectMap();
    document.querySelectorAll('[data-cat-item]').forEach((item) => {
      const project = map.get(item.getAttribute('data-cat-item'));
      if (!project) return;
      const type = typeOf(project);
      assignType(item, type);

      let badge = null;
      if (item.classList.contains('catalog-row')) badge = item.querySelector('.catalog-facts > span:first-child');
      else if (item.classList.contains('catalog-card')) badge = item.querySelector('.catalog-card-top > span:first-child');
      else if (item.tagName === 'TR') badge = item.children[2];
      if (badge) {
        if (!badge.classList.contains('catalog-type-badge')) badge.classList.add('catalog-type-badge');
        setTypeClass(badge, type);
        if (badge.dataset.taxonomyType !== type) badge.dataset.taxonomyType = type;
      }
    });
  }

  function decorateProjectSurfaces() {
    const map = projectMap();
    document.querySelectorAll('[data-project-open]').forEach((control) => {
      if (control.closest('[data-cat-item]')) return;
      const id = control.getAttribute('data-project-open');
      const project = map.get(id);
      if (!project) return;
      const type = typeOf(project);
      const surface = control.closest('[data-project-card],[data-map-node],article,li,g,[class*="timeline-card"],[class*="project-card"],[class*="map-node"]') || control;
      assignType(surface, type, true);
      if (surface === control) assignType(control, type, true);
    });

    const activeId = new URLSearchParams(location.search).get('project');
    const activeProject = map.get(activeId);
    if (activeProject) document.documentElement.dataset.activeProjectType = typeOf(activeProject);
    else delete document.documentElement.dataset.activeProjectType;
  }

  function decorateGroups() {
    document.querySelectorAll('.catalog-group').forEach((group) => {
      const items = [...group.querySelectorAll('[data-cat-item]')];
      const types = new Set(items.map((item) => item.dataset.projectType).filter(Boolean));
      if (types.size !== 1) {
        if (group.dataset.groupType) delete group.dataset.groupType;
        typeClasses.forEach((className) => group.classList.remove(className));
        return;
      }
      const type = [...types][0];
      if (group.dataset.groupType !== type) group.dataset.groupType = type;
      setTypeClass(group, type);
    });
  }

  function ensureAuditNote() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!toolbar) return;
    let note = toolbar.querySelector('[data-audit-note]');
    if (!note) {
      note = document.createElement('p');
      note.className = 'catalog-audit-note';
      note.dataset.auditNote = '';
      toolbar.appendChild(note);
    }
    const report = audit();
    const issueCount = Object.values(report.issues || {}).reduce((sum, value) => {
      if (Array.isArray(value)) return sum + value.length;
      return sum + (Number(value) || 0);
    }, 0);
    const html = `<strong>集計基準</strong><span>${report.counts?.total || projects().length}件</span><span>公開ページ ${report.counts?.livePages || 0}</span><span>GitHub ${report.counts?.repositories || 0}</span><span>手元のみ ${report.counts?.localOnly || 0}</span><span class="${issueCount ? 'catalog-audit-warn' : 'catalog-audit-ok'}">${issueCount ? `参照整理 ${issueCount}件` : 'データ整合性 OK'}</span>`;
    replaceHtmlIfChanged(note, html);
  }

  function apply() {
    if (observer) observer.disconnect();
    ensureTaxonomy();
    decorateItems();
    decorateProjectSurfaces();
    decorateGroups();
    ensureAuditNote();
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function filterByType(type) {
    const allQuick = document.querySelector('[data-cat-quick-value="all"]');
    if (allQuick && !allQuick.classList.contains('is-active')) allQuick.click();
    const select = document.querySelector('[data-cat-type]');
    if (!select) return;
    select.value = type && select.value === type ? '' : type;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    currentRandomId = '';
    currentRandomPoolSize = 0;
    schedule();
  }

  function visibleCandidates() {
    const map = projectMap();
    const ids = [...document.querySelectorAll('[data-cat-item]')]
      .filter((item) => !item.hidden && !item.closest('.catalog-group[hidden]'))
      .map((item) => item.getAttribute('data-cat-item'))
      .filter((id) => id && map.has(id));
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return { list: projects(), fromVisible: false };
    return { list: uniqueIds.map((id) => map.get(id)).filter(Boolean), fromVisible: true };
  }

  function chooseRandom() {
    const pool = visibleCandidates();
    let candidates = pool.list;
    if (!candidates.length) return;
    if (candidates.length > 1 && lastRandomId) candidates = candidates.filter((project) => project.id !== lastRandomId);
    const project = candidates[Math.floor(Math.random() * candidates.length)];
    if (!project) return;
    currentRandomId = project.id;
    lastRandomId = project.id;
    currentRandomPoolSize = pool.fromVisible ? pool.list.length : 0;
    schedule();
    requestAnimationFrame(() => {
      document.querySelector('[data-taxonomy-random-result]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function clearRandomResult() {
    if (!currentRandomId) return;
    currentRandomId = '';
    currentRandomPoolSize = 0;
    schedule();
  }

  function start() {
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]')) {
        setTimeout(wait, 80);
        return;
      }
      document.addEventListener('click', (event) => {
        const randomOpen = event.target.closest('[data-taxonomy-random-open]');
        if (randomOpen) {
          event.preventDefault();
          openProject(randomOpen.dataset.taxonomyRandomOpen);
          return;
        }
        if (event.target.closest('[data-taxonomy-random-close]')) {
          event.preventDefault();
          clearRandomResult();
          return;
        }
        if (event.target.closest('[data-taxonomy-random]')) {
          event.preventDefault();
          chooseRandom();
          return;
        }
        const button = event.target.closest('[data-taxonomy-filter]');
        if (!button) return;
        event.preventDefault();
        filterByType(button.dataset.taxonomyFilter || '');
      });
      document.addEventListener('input', (event) => {
        if (event.target.matches('[data-cat-search]')) clearRandomResult();
      });
      document.addEventListener('change', (event) => {
        if (event.target.matches('[data-cat-verb],[data-cat-type],[data-cat-status],[data-cat-year],[data-cat-doc],[data-cat-link],[data-cat-sort],[data-cat-layout],[data-cat-group]')) clearRandomResult();
      });
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
