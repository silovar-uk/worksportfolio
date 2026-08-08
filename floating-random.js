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

  let currentId = '';
  let lastId = '';
  let poolSize = 0;
  let fromVisible = false;
  let expanded = false;
  let bound = false;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const projectMap = () => new Map(projects().map((project) => [project.id, project]));
  const typeOf = (project) => TYPE_LABELS[project?.type] ? project.type : 'other';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => escapeHtml(value).replace(/'/g, '&#39;');

  function candidates() {
    const map = projectMap();
    const ids = [...document.querySelectorAll('[data-cat-item]')]
      .filter((item) => !item.hidden && !item.closest('.catalog-group[hidden]'))
      .map((item) => item.getAttribute('data-cat-item'))
      .filter((id) => id && map.has(id));
    const unique = [...new Set(ids)];
    if (unique.length) return { list: unique.map((id) => map.get(id)).filter(Boolean), visible: true };
    return { list: projects(), visible: false };
  }

  function chooseRandom() {
    const pool = candidates();
    let list = pool.list;
    if (!list.length) return;
    if (list.length > 1 && lastId) list = list.filter((project) => project.id !== lastId);
    const project = list[Math.floor(Math.random() * list.length)];
    if (!project) return;
    currentId = project.id;
    lastId = project.id;
    poolSize = pool.list.length;
    fromVisible = pool.visible;
    expanded = true;
    render();
  }

  function openProject(id) {
    if (!id) return;
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function compactHtml() {
    return `
      <button type="button" class="floating-random-launch" data-floating-random-draw aria-label="ランダムで作品を1本選ぶ">
        <span class="floating-random-dice" aria-hidden="true">🎲</span>
        <span><strong>ランダムで1本</strong><small>いまの表示から選ぶ</small></span>
      </button>`;
  }

  function resultHtml(project) {
    const type = typeOf(project);
    const liveLink = project.liveUrl
      ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">すぐ使う ↗</a>`
      : '';
    const poolLabel = fromVisible ? `いま表示中の${poolSize}件から` : `全${poolSize}件から`;
    return `
      <div class="floating-random-card type-${type}" role="dialog" aria-label="ランダムで選ばれた作品">
        <div class="floating-random-head">
          <div><span aria-hidden="true">🎲</span><strong>ランダムで1本</strong></div>
          <button type="button" data-floating-random-minimize aria-label="ランダム表示を小さくする">−</button>
        </div>
        <p class="floating-random-pool">${escapeHtml(poolLabel)}選びました</p>
        <span class="floating-random-type">${escapeHtml(TYPE_LABELS[type])}</span>
        <h2>${escapeHtml(project.title || project.id)}</h2>
        <p class="floating-random-summary">${escapeHtml(project.summary || project.friction || '説明を準備中です。')}</p>
        <div class="floating-random-actions">
          <button type="button" class="primary-action" data-floating-random-open="${attr(project.id)}">この作品を開く</button>
          <button type="button" class="subtle-button" data-floating-random-draw>もう1回</button>
          ${liveLink}
        </div>
      </div>`;
  }

  function ensureHost() {
    let host = document.querySelector('[data-floating-random]');
    if (!host && document.body) {
      host = document.createElement('aside');
      host.className = 'floating-random';
      host.dataset.floatingRandom = '';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    return host;
  }

  function render() {
    const host = ensureHost();
    if (!host) return;
    const project = projects().find((item) => item.id === currentId);
    host.classList.toggle('is-expanded', Boolean(expanded && project));
    host.innerHTML = expanded && project ? resultHtml(project) : compactHtml();
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const open = target.closest('[data-floating-random-open]');
      if (open) {
        event.preventDefault();
        openProject(open.dataset.floatingRandomOpen);
        return;
      }

      if (target.closest('[data-floating-random-draw]')) {
        event.preventDefault();
        chooseRandom();
        return;
      }

      if (target.closest('[data-floating-random-minimize]')) {
        event.preventDefault();
        expanded = false;
        render();
      }
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && expanded) {
        expanded = false;
        render();
      }
    });
  }

  function start() {
    bindEvents();
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.body) {
        setTimeout(wait, 80);
        return;
      }
      render();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
