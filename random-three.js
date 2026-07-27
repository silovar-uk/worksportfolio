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
  const KEEP_KEY = 'worksportfolio-random-keep-v1';

  let selectedIds = [];
  let keptId = loadKeptId();
  let section = null;
  let observer = null;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const projectMap = () => new Map(projects().map((project) => [project.id, project]));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const escapeAttr = (value) => escapeHtml(value).replace(/'/g, '&#39;');

  function loadKeptId() {
    try {
      return sessionStorage.getItem(KEEP_KEY) || '';
    } catch {
      return '';
    }
  }

  function saveKeptId() {
    try {
      if (keptId) sessionStorage.setItem(KEEP_KEY, keptId);
      else sessionStorage.removeItem(KEEP_KEY);
    } catch {
      // Storage is optional. The interaction still works for the current page.
    }
  }

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

  function currentProjects() {
    const map = projectMap();
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }

  function pickThree() {
    const all = projects();
    const count = Math.min(3, all.length);
    if (!count) {
      selectedIds = [];
      return [];
    }

    const result = new Array(count);
    let keptProject = keptId ? all.find((project) => project.id === keptId) : null;
    if (keptId && !keptProject) {
      keptId = '';
      saveKeptId();
    }

    if (keptProject) {
      const previousIndex = selectedIds.indexOf(keptId);
      const keepIndex = previousIndex >= 0 && previousIndex < count ? previousIndex : 0;
      result[keepIndex] = keptProject;
    }

    const needed = count - (keptProject ? 1 : 0);
    const previousNonKept = new Set(selectedIds.filter((id) => id !== keptId));
    const available = all.filter((project) => project.id !== keptId);
    let candidates = available.filter((project) => !previousNonKept.has(project.id));
    if (candidates.length < needed) candidates = available;
    candidates = shuffle(candidates);

    let cursor = 0;
    for (let index = 0; index < result.length; index += 1) {
      if (result[index]) continue;
      while (cursor < candidates.length && result.some((item) => item?.id === candidates[cursor].id)) cursor += 1;
      if (cursor < candidates.length) result[index] = candidates[cursor++];
    }

    if (result.some((item) => !item)) {
      const fallback = shuffle(available).filter((project) => !result.some((item) => item?.id === project.id));
      let fallbackCursor = 0;
      for (let index = 0; index < result.length; index += 1) {
        if (!result[index] && fallbackCursor < fallback.length) result[index] = fallback[fallbackCursor++];
      }
    }

    selectedIds = result.filter(Boolean).map((project) => project.id);
    return result.filter(Boolean);
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
    const isKept = project.id === keptId;
    return `<article class="random-three-card type-${escapeAttr(type)}${isKept ? ' is-kept' : ''}" data-random-three-item="${escapeAttr(project.id)}" data-card-mark="${escapeAttr(typeMark)}">
      <div class="random-three-meta"><span class="random-three-type"><i aria-hidden="true">${escapeHtml(typeMark)}</i>${escapeHtml(typeLabel)}</span><span class="random-three-code">${escapeHtml(cardCode(project))}</span></div>
      <div class="random-three-flags">
        <span class="random-three-label">${escapeHtml(cardLabel(project))}</span>
        <button class="random-three-keep" type="button" data-random-three-keep="${escapeAttr(project.id)}" aria-pressed="${isKept}" aria-label="${isKept ? 'このカードのキープを解除' : 'このカードをキープ'}"><span aria-hidden="true">◆</span>${isKept ? 'キープ中' : 'キープ'}</button>
      </div>
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

  function updateRefreshButton() {
    const button = section?.querySelector('[data-random-three-refresh]');
    if (!button) return;
    const label = keptId ? '残り2枚を引く' : '3枚引き直す';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-label', keptId ? 'キープした1枚を残して、ほかの2枚を引き直す' : '3枚すべてを引き直す');
  }

  function render(repick = true) {
    if (!section) return;
    let list = repick ? pickThree() : currentProjects();
    if (!list.length || list.length !== Math.min(3, projects().length)) list = pickThree();
    const target = section.querySelector('[data-random-three-grid]');
    const html = list.map(card).join('');
    if (target && target.innerHTML !== html) target.innerHTML = html;
    updateRefreshButton();
  }

  function toggleKeep(id) {
    if (!projects().some((project) => project.id === id)) return;
    keptId = keptId === id ? '' : id;
    saveKeptId();
    render(false);
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
        <div><h2>ランダム3枚</h2><p>気になる1枚をキープして、残りだけ引き直せます。</p></div>
        <button type="button" data-random-three-refresh>3枚引き直す</button>
      </header>
      <div class="random-three-grid" data-random-three-grid></div>`;
      toolbar.parentNode.insertBefore(section, toolbar);
      section.addEventListener('click', (event) => {
        if (event.target.closest('[data-random-three-refresh]')) {
          render(true);
          return;
        }
        const keep = event.target.closest('[data-random-three-keep]');
        if (keep) {
          toggleKeep(keep.dataset.randomThreeKeep);
          return;
        }
        const open = event.target.closest('[data-random-three-open]');
        if (open) openProject(open.dataset.randomThreeOpen);
      });
      render(true);
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
