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

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const audit = () => window.WORKS_PORTFOLIO_AUDIT || { counts: { total: projects().length, byType: {} }, issues: {} };
  const projectMap = () => new Map(projects().map((project) => [project.id, project]));
  const typeOf = (project) => meta[project?.type] ? project.type : 'other';

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
    const html = `
      <div class="catalog-taxonomy-head">
        <strong>種類で見分ける</strong>
        <span>公開対象 ${counts.total || projects().length}件。色と件数は同じデータから自動集計。</span>
      </div>
      <div class="catalog-taxonomy-list">
        ${entries.map(({ type, originalType, count }) => `<button type="button" class="catalog-taxonomy-button type-${type}${current === originalType ? ' is-active' : ''}" data-taxonomy-type="${type}" data-taxonomy-filter="${originalType}" aria-pressed="${current === originalType}"><span>${meta[type]?.label || originalType}</span><strong>${count}</strong></button>`).join('')}
      </div>`;
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
    select.value = select.value === type ? '' : type;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    schedule();
  }

  function start() {
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]')) {
        setTimeout(wait, 80);
        return;
      }
      document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-taxonomy-filter]');
        if (!button) return;
        event.preventDefault();
        filterByType(button.dataset.taxonomyFilter);
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
