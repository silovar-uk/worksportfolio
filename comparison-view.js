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
  const COMPARE_KEY = 'worksportfolio-compare-ids-v1';

  let observer = null;
  let scheduled = false;
  let compareIds = loadCompareIds();
  let tray = null;
  let compareDialog = null;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const projectMap = () => new Map(projects().map((project) => [project.id, project]));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const escapeAttr = (value) => escapeHtml(value).replace(/'/g, '&#39;');

  function loadCompareIds() {
    try {
      const value = JSON.parse(sessionStorage.getItem(COMPARE_KEY) || '[]');
      return Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  function saveCompareIds() {
    try {
      sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds));
    } catch {
      // Storage is optional. Comparison still works for the current page.
    }
  }

  function replaceHtmlIfChanged(element, html) {
    if (element && element.innerHTML !== html) element.innerHTML = html;
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

  function selectedProjects() {
    const map = projectMap();
    const validIds = compareIds.filter((id) => map.has(id)).slice(0, 3);
    if (validIds.join('|') !== compareIds.join('|')) {
      compareIds = validIds;
      saveCompareIds();
    }
    return compareIds.map((id) => map.get(id)).filter(Boolean);
  }

  function ensureSwitch() {
    const primary = document.querySelector('.catalog-primary');
    const select = document.querySelector('[data-cat-layout]');
    if (!primary || !select) return false;

    select.classList.add('catalog-layout-native');
    const optionLabels = { compact: '一覧', cards: '比較カード', table: '表' };
    [...select.options].forEach((option) => {
      const next = optionLabels[option.value];
      if (next && option.textContent !== next) option.textContent = next;
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
      if (button.getAttribute('aria-pressed') !== String(active)) button.setAttribute('aria-pressed', String(active));
    });
  }

  function ensureCardActions(card, project) {
    const open = card.querySelector('.catalog-open');
    if (!open) return;

    let actions = card.querySelector('[data-card-actions]');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'catalog-card-actions';
      actions.dataset.cardActions = '';
      open.insertAdjacentElement('beforebegin', actions);
      actions.appendChild(open);
    }

    let compare = actions.querySelector('[data-compare-toggle]');
    if (!compare) {
      compare = document.createElement('button');
      compare.type = 'button';
      compare.className = 'catalog-compare-toggle';
      compare.dataset.compareToggle = project.id;
      actions.insertBefore(compare, open);
    }
    if (compare.dataset.compareToggle !== project.id) compare.dataset.compareToggle = project.id;
    if (open.textContent !== 'カードを開く') open.textContent = 'カードを開く';
  }

  function decorateCards() {
    const map = projectMap();
    document.querySelectorAll('.catalog-card[data-cat-item]').forEach((card) => {
      const project = map.get(card.dataset.catItem);
      if (!project) return;

      const type = project.type || 'other';
      const typeLabel = TYPE_LABELS[type] || type;
      const typeMark = TYPE_MARKS[type] || TYPE_MARKS.other;
      card.classList.add('catalog-comparison-card', `type-${type}`);
      card.dataset.cardMark = typeMark;
      card.dataset.cardLabel = cardLabel(project);
      card.setAttribute('aria-label', `${project.title}、${typeLabel}`);

      const top = card.querySelector('.catalog-card-top');
      if (top) {
        const topHtml = `<span class="catalog-card-type"><i aria-hidden="true">${escapeHtml(typeMark)}</i>${escapeHtml(typeLabel)}</span><span class="catalog-card-code">${escapeHtml(cardCode(project))}</span>`;
        if (top.innerHTML !== topHtml) top.innerHTML = topHtml;
      }

      let label = card.querySelector('[data-card-label]');
      if (!label) {
        label = document.createElement('span');
        label.className = 'catalog-card-label';
        label.dataset.cardLabel = '';
        card.querySelector('h3')?.insertAdjacentElement('beforebegin', label);
      }
      if (label.textContent !== cardLabel(project)) label.textContent = cardLabel(project);

      const summary = card.querySelector(':scope > p');
      if (summary) summary.classList.add('catalog-card-effect');

      let facts = card.querySelector('[data-comparison-facts]');
      if (!facts) {
        facts = document.createElement('dl');
        facts.className = 'catalog-card-compare';
        facts.dataset.comparisonFacts = '';
        const bottom = card.querySelector('.catalog-card-bottom');
        if (bottom) bottom.insertAdjacentElement('beforebegin', facts);
        else card.querySelector('.catalog-open')?.insertAdjacentElement('beforebegin', facts);
      }
      const factsHtml = `
        <div><dt>制作</dt><dd>${escapeHtml(formatDate(project.createdAt))}</dd></div>
        <div><dt>更新</dt><dd>${escapeHtml(formatDate(project.updatedAt || project.createdAt))}</dd></div>
        <div><dt>状態</dt><dd>${escapeHtml(STATUS_LABELS[project.status] || project.status || '未設定')}</dd></div>
        <div><dt>確認</dt><dd>${escapeHtml(DOC_LABELS[project.documentationState] || DOC_LABELS.unreviewed)}</dd></div>`;
      if (facts.innerHTML !== factsHtml) facts.innerHTML = factsHtml;

      let tags = card.querySelector('[data-comparison-tags]');
      const technologies = (project.technologies || []).slice(0, 3);
      if (technologies.length) {
        if (!tags) {
          tags = document.createElement('div');
          tags.className = 'catalog-card-tags';
          tags.dataset.comparisonTags = '';
          facts.insertAdjacentElement('afterend', tags);
        }
        const tagsHtml = technologies.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
        if (tags.innerHTML !== tagsHtml) tags.innerHTML = tagsHtml;
      } else if (tags) {
        tags.remove();
      }

      ensureCardActions(card, project);
    });
  }

  function ensureCompareUi() {
    tray = document.querySelector('[data-compare-tray]');
    if (!tray) {
      tray = document.createElement('aside');
      tray.className = 'compare-tray';
      tray.dataset.compareTray = '';
      tray.hidden = true;
      tray.setAttribute('aria-label', '比較トレイ');
      tray.innerHTML = `<div class="compare-tray-inner">
        <div class="compare-tray-heading"><strong>比較トレイ</strong><span data-compare-count>0/3</span></div>
        <div class="compare-tray-items" data-compare-items></div>
        <div class="compare-tray-actions">
          <button type="button" class="compare-tray-clear" data-compare-clear>クリア</button>
          <button type="button" class="compare-tray-open" data-compare-open disabled>あと1枚選ぶ</button>
        </div>
      </div><p class="sr-only" aria-live="polite" data-compare-live></p>`;
      document.body.appendChild(tray);
    }

    compareDialog = document.querySelector('[data-compare-dialog]');
    if (!compareDialog) {
      compareDialog = document.createElement('dialog');
      compareDialog.className = 'compare-dialog';
      compareDialog.dataset.compareDialog = '';
      compareDialog.setAttribute('aria-labelledby', 'compare-dialog-title');
      compareDialog.innerHTML = `<div class="compare-dialog-shell">
        <header class="compare-dialog-head">
          <div><p>選んだ制作物</p><h2 id="compare-dialog-title">比較する</h2></div>
          <button type="button" data-compare-close aria-label="比較を閉じる">×</button>
        </header>
        <div class="compare-dialog-grid" data-compare-dialog-grid></div>
      </div>`;
      compareDialog.addEventListener('click', (event) => {
        if (event.target === compareDialog) compareDialog.close();
      });
      document.body.appendChild(compareDialog);
    }
  }

  function compareLinks(project) {
    const links = [];
    if (project.liveUrl) links.push(`<a href="${escapeAttr(project.liveUrl)}" target="_blank" rel="noopener">公開ページ</a>`);
    if (project.repositoryUrl) links.push(`<a href="${escapeAttr(project.repositoryUrl)}" target="_blank" rel="noopener">GitHub</a>`);
    return links.length ? links.join('') : '<span>リンク未確認</span>';
  }

  function compareProjectHtml(project) {
    const type = project.type || 'other';
    const typeLabel = TYPE_LABELS[type] || type;
    const typeMark = TYPE_MARKS[type] || TYPE_MARKS.other;
    const technologies = (project.technologies || []).filter(Boolean);
    return `<article class="compare-dialog-card type-${escapeAttr(type)}" data-card-mark="${escapeAttr(typeMark)}">
      <div class="compare-dialog-card-head"><span><i aria-hidden="true">${escapeHtml(typeMark)}</i>${escapeHtml(typeLabel)}</span><small>${escapeHtml(cardCode(project))}</small></div>
      <h3>${escapeHtml(project.title || project.id)}</h3>
      <p class="compare-dialog-summary">${escapeHtml(project.summary || project.friction || '説明を確認中です。')}</p>
      <dl>
        <div><dt>制作</dt><dd>${escapeHtml(formatDate(project.createdAt))}</dd></div>
        <div><dt>更新</dt><dd>${escapeHtml(formatDate(project.updatedAt || project.createdAt))}</dd></div>
        <div><dt>状態</dt><dd>${escapeHtml(STATUS_LABELS[project.status] || project.status || '未設定')}</dd></div>
        <div><dt>確認</dt><dd>${escapeHtml(DOC_LABELS[project.documentationState] || DOC_LABELS.unreviewed)}</dd></div>
      </dl>
      <div class="compare-dialog-tech"><strong>技術</strong><p>${technologies.length ? technologies.map((item) => `<span>${escapeHtml(item)}</span>`).join('') : '<span>未確認</span>'}</p></div>
      <div class="compare-dialog-links">${compareLinks(project)}</div>
    </article>`;
  }

  function renderCompareDialog() {
    if (!compareDialog) return;
    const selected = selectedProjects();
    const grid = compareDialog.querySelector('[data-compare-dialog-grid]');
    if (grid) grid.style.setProperty('--compare-count', String(Math.max(2, selected.length)));
    replaceHtmlIfChanged(grid, selected.map(compareProjectHtml).join(''));
  }

  function announceCompare(message) {
    const live = tray?.querySelector('[data-compare-live]');
    if (live) live.textContent = message;
  }

  function syncCompareControls() {
    const selected = new Set(compareIds);
    const limitReached = compareIds.length >= 3;
    document.querySelectorAll('[data-compare-toggle]').forEach((button) => {
      const active = selected.has(button.dataset.compareToggle);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = !active && limitReached;
      const label = active ? '比較から外す' : '比較に追加';
      if (button.textContent !== label) button.textContent = label;
      button.closest('[data-cat-item],[data-random-three-item]')?.classList.toggle('is-in-compare', active);
    });
  }

  function renderCompareUi(message = '') {
    ensureCompareUi();
    const selected = selectedProjects();
    const isVisible = selected.length > 0;
    if (tray.hidden === isVisible) tray.hidden = !isVisible;
    document.documentElement.classList.toggle('has-compare-tray', isVisible);

    const items = tray.querySelector('[data-compare-items]');
    const itemsHtml = selected.map((project) => `<span class="compare-tray-item"><span>${escapeHtml(project.title || project.id)}</span><button type="button" data-compare-remove="${escapeAttr(project.id)}" aria-label="${escapeAttr(project.title || project.id)}を比較から外す">×</button></span>`).join('');
    replaceHtmlIfChanged(items, itemsHtml);

    const count = tray.querySelector('[data-compare-count]');
    if (count && count.textContent !== `${selected.length}/3`) count.textContent = `${selected.length}/3`;
    const open = tray.querySelector('[data-compare-open]');
    if (open) {
      const label = selected.length < 2 ? 'あと1枚選ぶ' : `${selected.length}枚を比較`;
      if (open.textContent !== label) open.textContent = label;
      open.disabled = selected.length < 2;
    }

    syncCompareControls();
    if (message) announceCompare(message);
    if (compareDialog?.open) renderCompareDialog();
  }

  function toggleCompare(id) {
    if (!projectMap().has(id)) return;
    const currentIndex = compareIds.indexOf(id);
    if (currentIndex >= 0) {
      compareIds.splice(currentIndex, 1);
      saveCompareIds();
      renderCompareUi('比較から外しました。');
      return;
    }
    if (compareIds.length >= 3) {
      tray?.classList.remove('is-limit');
      requestAnimationFrame(() => tray?.classList.add('is-limit'));
      announceCompare('比較できるのは3枚までです。');
      return;
    }
    compareIds.push(id);
    saveCompareIds();
    renderCompareUi(compareIds.length >= 2 ? '比較できるようになりました。' : '比較トレイに追加しました。');
  }

  function clearCompare() {
    compareIds = [];
    saveCompareIds();
    if (compareDialog?.open) compareDialog.close();
    renderCompareUi('比較トレイを空にしました。');
  }

  function openComparison() {
    if (selectedProjects().length < 2 || !compareDialog) return;
    renderCompareDialog();
    compareDialog.showModal();
  }

  function apply() {
    scheduled = false;
    ensureSwitch();
    syncSwitch();
    decorateCards();
    renderCompareUi();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function bindCompareEvents() {
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-compare-toggle]');
      if (toggle) {
        event.preventDefault();
        toggleCompare(toggle.dataset.compareToggle);
        return;
      }
      const remove = event.target.closest('[data-compare-remove]');
      if (remove) {
        event.preventDefault();
        toggleCompare(remove.dataset.compareRemove);
        return;
      }
      if (event.target.closest('[data-compare-clear]')) {
        event.preventDefault();
        clearCompare();
        return;
      }
      if (event.target.closest('[data-compare-open]')) {
        event.preventDefault();
        openComparison();
        return;
      }
      if (event.target.closest('[data-compare-close]')) {
        event.preventDefault();
        compareDialog?.close();
      }
    });
  }

  function start() {
    const wait = () => {
      if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-catalog-toolbar]')) {
        setTimeout(wait, 80);
        return;
      }
      ensureCompareUi();
      bindCompareEvents();
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
