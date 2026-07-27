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
  const TYPE_MARKS = {
    'web-app': 'W',
    'chrome-extension': '拡',
    'learning-tool': '学',
    'design-system': '設',
    'content-page': '読',
    'data-tool': '析',
    utility: '便',
    experiment: '試',
    other: '他'
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

  function cardCode(project) {
    const index = projects().findIndex((item) => item.id === project.id);
    return `#${String(Math.max(0, index) + 1).padStart(3, '0')}`;
  }

  function cardLabel(project) {
    if (project.featured) return '注目';
    if (project.liveUrl && project.documentationState === 'verified') return '公開・確認済み';
    if (project.liveUrl) return '公開中';
    if (project.documentationState === 'verified') return '確認済み';
    return '記録';
  }

  function pickThree() {
    const pool = [...projects()];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const next = pool.slice(0, Math.min(3, pool.length));
    const repeatsSameSet = pool.length > 3
      && next.length === 3
      && selectedIds.length === 3
      && next.every((project) => selectedIds.includes(project.id));
    if (repeatsSameSet) return pickThree();
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
    const type = project.type || 'other';
    const typeLabel = TYPE_LABELS[type] || type;
    const typeMark = TYPE_MARKS[type] || TYPE_MARKS.other;
    const status = STATUS_LABELS[project.status] || project.status || '未設定';
    const doc = DOC_LABELS[project.documentationState] || DOC_LABELS.unreviewed;
    return `<article class="random-three-card type-${escapeAttr(type)}" data-random-three-item="${escapeAttr(project.id)}" data-card-mark="${escapeAttr(typeMark)}">
      <div class="random-three-meta"><span class="random-three-type"><i aria-hidden="true">${escapeHtml(typeMark)}</i>${escapeHtml(typeLabel)}</span><span class="random-three-code">${escapeHtml(cardCode(project))}</span></div>
      <span class="random-three-label">${escapeHtml(cardLabel(project))}</span>
      <div class="random-three-art">
        <h3>${escapeHtml(project.title || project.id)}</h3>
        <p>${escapeHtml(project.summary || project.friction || '説明を確認中です。')}</p>
      </div>
      <dl class="random-three-facts">
        <div><dt>制作</dt><dd>${escapeHtml(formatDate(project.createdAt))}</dd></div>
        <div><dt>更新</dt><dd>${escapeHtml(formatDate(project.updatedAt || project.createdAt))}</dd></div>
        <div><dt>状態</dt><dd>${escapeHtml(status)}</dd></div>
        <div><dt>確認</dt><dd>${escapeHtml(doc)}</dd></div>
      </dl>
      <div class="random-three-actions">
        <button type="button" data-random-three-open="${escapeAttr(project.id)}">カードを開く</button>
        ${links(project)}
      </div>
    </article>`;
  }

  function render() {
    if (!section) return;
    const list = pickThree();
    const target = section.querySelector('[data-random-three-grid]');
    const html = list.map(card).join('');
    if (target && target.innerHTML !== html) target.innerHTML = html;
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
        <div><h2>ランダム3枚</h2><p>全制作物から選んでいます。</p></div>
        <button type="button" data-random-three-refresh>3枚引き直す</button>
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
