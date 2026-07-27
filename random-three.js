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

  let selectedIds = [];
  let section = null;
  let observer = null;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[char]));
  const escapeAttr = (value) => escapeHtml(value).replace(/'/g, '&#39;');

  function formatDate(value) {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return '未確認';
    if (match[3]) return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    if (match[2]) return `${Number(match[1])}.${Number(match[2])}`;
    return match[1];
  }

  function pickThree() {
    const pool = [...projects()];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const next = pool.slice(0, Math.min(3, pool.length));
    if (next.length === 3 && selectedIds.length === 3 && next.every((project) => selectedIds.includes(project.id))) {
      return pickThree();
    }
    selectedIds = next.map((project) => project.id);
    return next;
  }

  function links(project) {
    const items = [];
    if (project.liveUrl) items.push(`<a href="${escapeAttr(project.liveUrl)}" target="_blank" rel="noopener">公開ページ</a>`);
    if (project.repositoryUrl) items.push(`<a href="${escapeAttr(project.repositoryUrl)}" target="_blank" rel="noopener">GitHub</a>`);
    return items.join('');
  }

  function card(project) {
    const type = TYPE_LABELS[project.type] || project.type || 'その他';
    const status = STATUS_LABELS[project.status] || project.status || '未設定';
    const doc = DOC_LABELS[project.documentationState] || DOC_LABELS.unreviewed;
    return `<article class="random-three-card" data-random-three-item="${escapeAttr(project.id)}">
      <div class="random-three-meta"><span>${escapeHtml(type)}</span><span>${escapeHtml(status)}</span></div>
      <h3>${escapeHtml(project.title || project.id)}</h3>
      <p>${escapeHtml(project.summary || project.friction || '説明を確認中です。')}</p>
      <dl class="random-three-facts">
        <div><dt>制作</dt><dd>${escapeHtml(formatDate(project.createdAt))}</dd></div>
        <div><dt>更新</dt><dd>${escapeHtml(formatDate(project.updatedAt || project.createdAt))}</dd></div>
        <div><dt>確認</dt><dd>${escapeHtml(doc)}</dd></div>
      </dl>
      <div class="random-three-actions">
        <button type="button" data-random-three-open="${escapeAttr(project.id)}">詳細を見る</button>
        ${links(project)}
      </div>
    </article>`;
  }

  function render() {
    if (!section) return;
    const list = pickThree();
    section.querySelector('[data-random-three-grid]').innerHTML = list.map(card).join('');
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function syncVisibility() {
    if (!section) return;
    const active = document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button');
    section.hidden = active && active !== 'shelf';
  }

  function create() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!toolbar || !window.BUILD_DIARY_DATA) return false;

    document.querySelectorAll('[data-portfolio-wow]').forEach((element) => element.remove());

    section = document.querySelector('[data-random-three]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'random-three';
      section.dataset.randomThree = '';
      section.innerHTML = `<header class="random-three-head">
        <div><h2>ランダムに3件</h2><p>全制作物から選んでいます。</p></div>
        <button type="button" data-random-three-refresh>入れ替える</button>
      </header>
      <div class="random-three-grid" data-random-three-grid></div>`;
      toolbar.parentNode.insertBefore(section, toolbar);
      section.addEventListener('click', (event) => {
        if (event.target.closest('[data-random-three-refresh]')) {
          render();
          return;
        }
        const open = event.target.closest('[data-random-three-open]');
        if (open) openProject(open.dataset.randomThreeOpen);
      });
      render();
    }
    syncVisibility();
    return true;
  }

  function start() {
    const wait = () => {
      if (!create()) {
        setTimeout(wait, 80);
        return;
      }
      document.querySelectorAll('[data-view-button]').forEach((button) => {
        button.addEventListener('click', () => setTimeout(syncVisibility, 0));
      });
      observer = new MutationObserver(() => {
        document.querySelectorAll('[data-portfolio-wow]').forEach((element) => element.remove());
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
