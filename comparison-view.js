(() => {
  'use strict';

  const TYPE_LABELS = {
    'web-app': 'Webアプリ',
    'chrome-extension': 'Chrome拡張',
    'learning-tool': '学習ツール',
    'design-system': '設計ガイド',
    'content-page': 'コンテンツ',
    'data-tool': '分析・データ',
    utility: '便利ツール',
    experiment: '実験',
    other: 'その他'
  };
  const STATUS_LABELS = {
    development: '開発中',
    active: '運用中',
    prototype: '試作中',
    dormant: '休止中',
    legacy: '初期記録'
  };
  const DOC_LABELS = {
    verified: '確認済み',
    inferred: '内容を確認中',
    unreviewed: '未確認'
  };

  let observer = null;
  let scheduled = false;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const projectMap = () => new Map(projects().map((project) => [project.id, project]));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[char]));

  function formatDate(value) {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return '未確認';
    if (match[3]) return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    if (match[2]) return `${Number(match[1])}.${Number(match[2])}`;
    return match[1];
  }

  function ensureSwitch() {
    const primary = document.querySelector('.catalog-primary');
    const select = document.querySelector('[data-cat-layout]');
    if (!primary || !select) return false;

    select.classList.add('catalog-layout-native');
    const optionLabels = { compact: '一覧', cards: '比較カード', table: '表' };
    [...select.options].forEach((option) => {
      if (optionLabels[option.value]) option.textContent = optionLabels[option.value];
    });

    let switcher = primary.querySelector('[data-comparison-switch]');
    if (!switcher) {
      switcher = document.createElement('div');
      switcher.className = 'catalog-layout-switch';
      switcher.dataset.comparisonSwitch = '';
      switcher.setAttribute('role', 'group');
      switcher.setAttribute('aria-label', '表示形式');
      switcher.innerHTML = `
        <button type="button" data-comparison-layout="compact">一覧</button>
        <button type="button" data-comparison-layout="cards">比較カード</button>
        <button type="button" data-comparison-layout="table">表</button>`;
      select.insertAdjacentElement('afterend', switcher);
      switcher.addEventListener('click', (event) => {
        const button = event.target.closest('[data-comparison-layout]');
        if (!button) return;
        select.value = button.dataset.comparisonLayout;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncSwitch();
      });
    }
    syncSwitch();
    return true;
  }

  function syncSwitch() {
    const select = document.querySelector('[data-cat-layout]');
    if (!select) return;
    document.querySelectorAll('[data-comparison-layout]').forEach((button) => {
      const active = button.dataset.comparisonLayout === select.value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function decorateCards() {
    const map = projectMap();
    document.querySelectorAll('.catalog-card[data-cat-item]').forEach((card) => {
      const project = map.get(card.dataset.catItem);
      if (!project) return;

      card.classList.add('catalog-comparison-card');
      const top = card.querySelector('.catalog-card-top');
      if (top) {
        const first = top.querySelector('span:first-child');
        if (first) first.textContent = TYPE_LABELS[project.type] || project.type || 'その他';
      }

      let facts = card.querySelector('[data-comparison-facts]');
      if (!facts) {
        facts = document.createElement('dl');
        facts.className = 'catalog-card-compare';
        facts.dataset.comparisonFacts = '';
        const bottom = card.querySelector('.catalog-card-bottom');
        if (bottom) bottom.insertAdjacentElement('beforebegin', facts);
        else card.querySelector('.catalog-open')?.insertAdjacentElement('beforebegin', facts);
      }
      facts.innerHTML = `
        <div><dt>制作</dt><dd>${escapeHtml(formatDate(project.createdAt))}</dd></div>
        <div><dt>更新</dt><dd>${escapeHtml(formatDate(project.updatedAt || project.createdAt))}</dd></div>
        <div><dt>状態</dt><dd>${escapeHtml(STATUS_LABELS[project.status] || project.status || '未設定')}</dd></div>
        <div><dt>確認</dt><dd>${escapeHtml(DOC_LABELS[project.documentationState] || DOC_LABELS.unreviewed)}</dd></div>`;

      let tags = card.querySelector('[data-comparison-tags]');
      const technologies = (project.technologies || []).slice(0, 3);
      if (technologies.length) {
        if (!tags) {
          tags = document.createElement('div');
          tags.className = 'catalog-card-tags';
          tags.dataset.comparisonTags = '';
          facts.insertAdjacentElement('afterend', tags);
        }
        tags.innerHTML = technologies.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
      } else if (tags) {
        tags.remove();
      }

      const open = card.querySelector('.catalog-open');
      if (open) open.textContent = '詳細を見る';
    });
  }

  function apply() {
    scheduled = false;
    ensureSwitch();
    syncSwitch();
    decorateCards();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function start() {
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]')) {
        setTimeout(wait, 80);
        return;
      }
      apply();
      document.querySelector('[data-cat-layout]')?.addEventListener('change', () => setTimeout(syncSwitch, 0));
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
