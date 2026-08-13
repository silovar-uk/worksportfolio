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
  let bound = false;
  let observer = null;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
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

  function shuffle(items) {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function pickThree() {
    const all = projects();
    const count = Math.min(3, all.length);
    if (!count) {
      selectedIds = [];
      return [];
    }

    const previous = new Set(selectedIds);
    let candidates = all.filter((project) => !previous.has(project.id));
    if (candidates.length < count) candidates = all;
    const picked = shuffle(candidates).slice(0, count);
    selectedIds = picked.map((project) => project.id);
    return picked;
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
      <div class="random-three-flags"><span class="random-three-label">${escapeHtml(cardLabel(project))}</span></div>
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
        <button class="random-three-compare" type="button" data-compare-toggle="${escapeAttr(project.id)}" aria-pressed="false">比較に追加</button>
        ${links(project)}
      </div>
    </article>`;
  }

  function render() {
    if (!section) return;
    const target = section.querySelector('[data-random-three-grid]');
    if (!target) return;
    target.innerHTML = pickThree().map(card).join('');
    const button = section.querySelector('[data-random-three-refresh]');
    if (button) {
      button.textContent = '3枚引き直す';
      button.setAttribute('aria-label', '3枚すべてを引き直す');
    }
  }

  function openProject(id) {
    if (!id) return;
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function syncVisibility() {
    if (!section) return;
    const active = document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button');
    section.hidden = Boolean(active && active !== 'shelf');
  }

  function ensureSection() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    if (!toolbar || !window.BUILD_DIARY_DATA) return false;

    section = document.querySelector('[data-random-three]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'random-three';
      section.dataset.randomThree = '';
      section.innerHTML = `<header class="random-three-head">
        <div><h2>ランダム3枚</h2></div>
        <button type="button" data-random-three-refresh aria-label="3枚すべてを引き直す">3枚引き直す</button>
      </header>
      <div class="random-three-grid" data-random-three-grid></div>`;
      toolbar.parentNode.insertBefore(section, toolbar);
      render();
    } else {
      section.querySelector('.random-three-head p')?.remove();
      section.querySelectorAll('[data-random-three-keep]').forEach((element) => element.remove());
      section.querySelectorAll('.is-kept').forEach((element) => element.classList.remove('is-kept'));
      if (!section.querySelector('[data-random-three-grid]')?.children.length) render();
    }

    syncVisibility();
    return true;
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('[data-random-three-refresh]')) {
        event.preventDefault();
        ensureSection();
        render();
        return;
      }

      const open = target.closest('[data-random-three-open]');
      if (open) {
        event.preventDefault();
        openProject(open.dataset.randomThreeOpen);
      }
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-view-button]')) setTimeout(() => {
        ensureSection();
        syncVisibility();
      }, 0);
    });
  }

  function start() {
    try { sessionStorage.removeItem('worksportfolio-random-keep-v1'); } catch (_) { /* ignore */ }
    bindEvents();
    const wait = () => {
      if (!ensureSection()) {
        setTimeout(wait, 80);
        return;
      }
      if (!observer) {
        observer = new MutationObserver(() => {
          if (!document.querySelector('[data-random-three]')) setTimeout(ensureSection, 0);
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
