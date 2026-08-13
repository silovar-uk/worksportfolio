(() => {
  'use strict';

  const typeLabels = {
    'web-app': 'Webアプリ',
    'chrome-extension': 'Chrome拡張',
    'learning-tool': '学習ツール',
    'design-system': '設計ガイド',
    'content-page': 'コンテンツページ',
    'data-tool': '分析・データ',
    utility: '便利ツール',
    experiment: '実験'
  };
  const statusLabels = {
    development: '開発中',
    active: '運用中',
    prototype: '試作中',
    dormant: '休止中',
    legacy: '初期記録'
  };
  const docLabels = {
    verified: '内容確認済み',
    inferred: '概要を仮整理',
    unreviewed: '思い出し待ち'
  };
  const quickLabels = {
    all: 'すべて',
    recent: '最近更新',
    published: '公開ページ',
    active: '運用・開発',
    extension: 'Chrome拡張',
    web: 'Webアプリ'
  };
  const STORAGE_KEY = 'worksportfolio-catalog-v2';
  const selected = new Set();
  let ready = false;
  let quickFilter = 'all';

  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const norm = (value) => String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, '');
  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const currentView = () => document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button') || '';
  const dateNumber = (value) => String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');
  const timestamp = (value) => {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return 0;
    return Date.UTC(Number(match[1]), Number(match[2] || 1) - 1, Number(match[3] || 1));
  };
  const isRecent = (project, days = 150) => {
    const value = timestamp(project.updatedAt || project.createdAt);
    return value > 0 && Date.now() - value <= days * 86400000;
  };
  const formatDate = (value) => {
    if (!value) return '要確認';
    const match = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return String(value);
    if (match[3]) return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    if (match[2]) return `${Number(match[1])}.${Number(match[2])}`;
    return match[1];
  };
  const yearOf = (project) => String(project.createdAt || '').slice(0, 4) || '時期不明';
  const controls = () => ({
    search: document.querySelector('[data-cat-search]'),
    verb: document.querySelector('[data-cat-verb]'),
    type: document.querySelector('[data-cat-type]'),
    status: document.querySelector('[data-cat-status]'),
    year: document.querySelector('[data-cat-year]'),
    doc: document.querySelector('[data-cat-doc]'),
    link: document.querySelector('[data-cat-link]'),
    sort: document.querySelector('[data-cat-sort]'),
    layout: document.querySelector('[data-cat-layout]'),
    group: document.querySelector('[data-cat-group]')
  });

  function toolbarHtml() {
    return `
      <section class="catalog-overview" data-catalog-toolbar>
        <div class="catalog-quick" data-cat-quick></div>
        <div class="catalog-primary">
          <label class="catalog-search">
            <span class="sr-only">制作物を検索</span>
            <input type="search" data-cat-search placeholder="名前・困りごと・技術から探す">
          </label>
          <select data-cat-sort aria-label="並び順">
            <option value="updated-desc">更新が新しい順</option>
            <option value="created-desc">制作が新しい順</option>
            <option value="created-asc">制作が古い順</option>
            <option value="title-asc">名前順</option>
            <option value="type-asc">種類順</option>
            <option value="status-asc">状態順</option>
          </select>
          <select data-cat-layout aria-label="表示形式">
            <option value="compact">ざっと見る</option>
            <option value="cards">カード</option>
            <option value="table">表</option>
          </select>
          <select data-cat-group aria-label="グループ分け">
            <option value="none">まとめず表示</option>
            <option value="year">制作年でまとめる</option>
            <option value="type">種類でまとめる</option>
            <option value="status">状態でまとめる</option>
          </select>
        </div>
        <details class="catalog-more" data-cat-more>
          <summary>条件を細かく指定 <span data-cat-filter-count></span></summary>
          <div class="catalog-filters">
            <select data-cat-verb><option value="">すべての目的</option></select>
            <select data-cat-type><option value="">すべての種類</option></select>
            <select data-cat-status><option value="">すべての状態</option></select>
            <select data-cat-year><option value="">すべての制作年</option></select>
            <select data-cat-doc><option value="">すべての整理状態</option></select>
            <select data-cat-link>
              <option value="">すべての公開状況</option>
              <option value="live">公開ページあり</option>
              <option value="github">GitHubあり</option>
              <option value="both">公開ページ＋GitHub</option>
              <option value="local">手元のみ</option>
            </select>
            <button class="subtle-button" type="button" data-cat-reset>条件をすべて戻す</button>
          </div>
        </details>
        <div class="catalog-resultbar">
          <p class="catalog-result" data-cat-count></p>
          <div class="catalog-active" data-cat-active></div>
          <label class="catalog-select-visible"><input type="checkbox" data-cat-all> 表示中を選択</label>
        </div>
      </section>
      <div class="catalog-bulk" data-cat-bulk hidden>
        <strong data-cat-selected>0件選択</strong>
        <select data-cat-format aria-label="コピー形式">
          <option value="share">共有用テキスト</option>
          <option value="markdown">Markdown</option>
          <option value="tsv">TSV</option>
          <option value="json">JSON</option>
        </select>
        <button class="primary-action" type="button" data-cat-copy disabled>選択分をコピー</button>
        <button class="text-action" type="button" data-cat-clear disabled>選択解除</button>
        <span class="catalog-feedback" data-cat-feedback aria-live="polite"></span>
      </div>`;
  }

  function quickCounts() {
    const list = projects();
    return {
      all: list.length,
      recent: list.filter((project) => isRecent(project)).length,
      published: list.filter((project) => project.liveUrl).length,
      active: list.filter((project) => ['active', 'development'].includes(project.status)).length,
      extension: list.filter((project) => project.type === 'chrome-extension').length,
      web: list.filter((project) => project.type === 'web-app').length
    };
  }

  function renderQuickButtons() {
    const counts = quickCounts();
    document.querySelector('[data-cat-quick]').innerHTML = Object.keys(quickLabels).map((key) => `
      <button type="button" class="catalog-quick-button${quickFilter === key ? ' is-active' : ''}" data-cat-quick-value="${key}" aria-pressed="${quickFilter === key}">
        <span>${quickLabels[key]}</span><strong>${counts[key]}</strong>
      </button>`).join('');
  }

  function populate() {
    const c = controls();
    const list = projects();
    const verbs = [...new Set(list.flatMap((project) => project.verbs || []))].sort((a, b) => a.localeCompare(b, 'ja'));
    c.verb.innerHTML = '<option value="">すべての目的</option>' + verbs.map((value) => `<option>${esc(value)}</option>`).join('');
    const types = [...new Set(list.map((project) => project.type))].sort();
    c.type.innerHTML = '<option value="">すべての種類</option>' + types.map((value) => `<option value="${attr(value)}">${esc(typeLabels[value] || value)}</option>`).join('');
    const statuses = [...new Set(list.map((project) => project.status))].sort();
    c.status.innerHTML = '<option value="">すべての状態</option>' + statuses.map((value) => `<option value="${attr(value)}">${esc(statusLabels[value] || value)}</option>`).join('');
    const years = [...new Set(list.map(yearOf).filter((value) => /^\d{4}$/.test(value)))].sort().reverse();
    c.year.innerHTML = '<option value="">すべての制作年</option>' + years.map((value) => `<option value="${value}">${value}年</option>`).join('');
    c.doc.innerHTML = '<option value="">すべての整理状態</option>' + Object.keys(docLabels).map((value) => `<option value="${value}">${docLabels[value]}</option>`).join('');
    renderQuickButtons();
  }

  function readState() {
    const c = controls();
    const params = new URLSearchParams(location.search);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { saved = {}; }
    const get = (name, fallback = '') => params.has(`cat_${name}`) ? params.get(`cat_${name}`) : (saved[name] ?? fallback);
    c.search.value = get('q');
    c.verb.value = get('verb');
    c.type.value = get('type');
    c.status.value = get('status');
    c.year.value = get('year');
    c.doc.value = get('doc');
    c.link.value = get('link');
    c.sort.value = get('sort', 'updated-desc');
    c.layout.value = get('layout', 'compact');
    c.group.value = get('group', 'none');
    quickFilter = get('quick', 'all');
    if (!quickLabels[quickFilter]) quickFilter = 'all';
  }

  function saveState() {
    const c = controls();
    const state = {
      q: c.search.value,
      verb: c.verb.value,
      type: c.type.value,
      status: c.status.value,
      year: c.year.value,
      doc: c.doc.value,
      link: c.link.value,
      sort: c.sort.value,
      layout: c.layout.value,
      group: c.group.value,
      quick: quickFilter
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const params = new URLSearchParams(location.search);
    Object.entries(state).forEach(([key, value]) => {
      if (value && !(['sort', 'layout', 'group', 'quick'].includes(key) && value === ({ sort: 'updated-desc', layout: 'compact', group: 'none', quick: 'all' }[key]))) {
        params.set(`cat_${key}`, value);
      } else {
        params.delete(`cat_${key}`);
      }
    });
    history.replaceState({}, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }

  function passesQuick(project) {
    if (quickFilter === 'recent') return isRecent(project);
    if (quickFilter === 'published') return Boolean(project.liveUrl);
    if (quickFilter === 'active') return ['active', 'development'].includes(project.status);
    if (quickFilter === 'extension') return project.type === 'chrome-extension';
    if (quickFilter === 'web') return project.type === 'web-app';
    return true;
  }

  function filtered() {
    const c = controls();
    const query = norm(c.search.value);
    const list = projects().filter((project) => {
      const searchable = norm([
        project.title, project.subtitle, project.summary, project.friction, project.id,
        (project.verbs || []).join(' '), (project.technologies || []).join(' ')
      ].join(' '));
      const live = Boolean(project.liveUrl);
      const github = Boolean(project.repositoryUrl);
      return passesQuick(project)
        && (!query || searchable.includes(query))
        && (!c.verb.value || (project.verbs || []).includes(c.verb.value))
        && (!c.type.value || project.type === c.type.value)
        && (!c.status.value || project.status === c.status.value)
        && (!c.year.value || yearOf(project) === c.year.value)
        && (!c.doc.value || project.documentationState === c.doc.value)
        && (!c.link.value
          || (c.link.value === 'live' && live)
          || (c.link.value === 'github' && github)
          || (c.link.value === 'both' && live && github)
          || (c.link.value === 'local' && !live && !github));
    });
    const sort = c.sort.value;
    list.sort(
      sort === 'created-asc' ? (a, b) => dateNumber(a.createdAt).localeCompare(dateNumber(b.createdAt))
        : sort === 'created-desc' ? (a, b) => dateNumber(b.createdAt).localeCompare(dateNumber(a.createdAt))
          : sort === 'title-asc' ? (a, b) => a.title.localeCompare(b.title, 'ja')
            : sort === 'type-asc' ? (a, b) => (typeLabels[a.type] || a.type).localeCompare(typeLabels[b.type] || b.type, 'ja')
              : sort === 'status-asc' ? (a, b) => (statusLabels[a.status] || a.status).localeCompare(statusLabels[b.status] || b.status, 'ja')
                : (a, b) => dateNumber(b.updatedAt || b.createdAt).localeCompare(dateNumber(a.updatedAt || a.createdAt))
    );
    return list;
  }

  function filterDefinitions() {
    const c = controls();
    return [
      ['q', c.search.value, `検索「${c.search.value}」`],
      ['verb', c.verb.value, c.verb.value],
      ['type', c.type.value, typeLabels[c.type.value] || c.type.value],
      ['status', c.status.value, statusLabels[c.status.value] || c.status.value],
      ['year', c.year.value, c.year.value ? `${c.year.value}年` : ''],
      ['doc', c.doc.value, docLabels[c.doc.value] || c.doc.value],
      ['link', c.link.value, c.link.selectedOptions[0]?.textContent || ''],
      ['quick', quickFilter !== 'all' ? quickFilter : '', quickFilter !== 'all' ? quickLabels[quickFilter] : '']
    ].filter(([, value]) => value);
  }

  function renderActiveFilters() {
    const active = filterDefinitions();
    document.querySelector('[data-cat-filter-count]').textContent = active.length ? `（${active.length}件）` : '';
    document.querySelector('[data-cat-active]').innerHTML = active.map(([key, , label]) => `<button type="button" data-cat-clear-one="${key}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');
  }

  function check(project) {
    return `<label class="catalog-check"><input type="checkbox" data-cat-check="${attr(project.id)}"${selected.has(project.id) ? ' checked' : ''}><span class="sr-only">${esc(project.title)}を選択</span></label>`;
  }

  function linkButtons(project) {
    const links = [];
    if (project.liveUrl) links.push(`<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener" title="公開ページ">公開</a>`);
    if (project.repositoryUrl) links.push(`<a href="${attr(project.repositoryUrl)}" target="_blank" rel="noopener" title="GitHub">GitHub</a>`);
    return links.length ? links.join('') : '<span class="catalog-local">手元のみ</span>';
  }

  function row(project) {
    const recent = isRecent(project, 90);
    return `<article class="catalog-row${selected.has(project.id) ? ' selected' : ''}" data-cat-item="${attr(project.id)}">
      ${check(project)}
      <button class="catalog-main" type="button" data-project-open="${attr(project.id)}">
        <span class="catalog-titleline"><strong>${esc(project.title)}</strong>${recent ? '<em>NEW</em>' : ''}</span>
        <span class="catalog-summaryline">${esc(project.summary || project.friction || '')}</span>
      </button>
      <div class="catalog-facts">
        <span>${esc(typeLabels[project.type] || project.type)}</span>
        <span class="status status-${attr(project.status)}">${esc(statusLabels[project.status] || project.status)}</span>
        <span>制作 ${esc(formatDate(project.createdAt))}</span>
        <span>更新 ${esc(formatDate(project.updatedAt || project.createdAt))}</span>
      </div>
      <div class="catalog-links">${linkButtons(project)}</div>
    </article>`;
  }

  function card(project) {
    return `<article class="catalog-card${project.featured ? ' featured' : ''}${selected.has(project.id) ? ' selected' : ''}" data-cat-item="${attr(project.id)}">
      ${check(project)}
      <div class="catalog-card-top"><span>${esc(typeLabels[project.type] || project.type)}</span><span>${esc(formatDate(project.updatedAt || project.createdAt))}</span></div>
      <h3>${esc(project.title)}</h3>
      <p>${esc(project.summary || '')}</p>
      <div class="catalog-card-bottom"><span class="status status-${attr(project.status)}">${esc(statusLabels[project.status] || project.status)}</span><div class="catalog-links">${linkButtons(project)}</div></div>
      <button class="catalog-open" type="button" data-project-open="${attr(project.id)}">詳しく見る</button>
    </article>`;
  }

  function tableRow(project) {
    return `<tr class="${selected.has(project.id) ? 'selected' : ''}" data-cat-item="${attr(project.id)}">
      <td class="check-cell">${check(project)}</td>
      <td><button class="catalog-title" type="button" data-project-open="${attr(project.id)}"><strong>${esc(project.title)}</strong><small>${esc((project.summary || '').slice(0, 90))}</small></button></td>
      <td>${esc(typeLabels[project.type] || project.type)}</td>
      <td><span class="status status-${attr(project.status)}">${esc(statusLabels[project.status] || project.status)}</span></td>
      <td>${esc(formatDate(project.createdAt))}</td>
      <td>${esc(formatDate(project.updatedAt || project.createdAt))}</td>
      <td><div class="catalog-links">${linkButtons(project)}</div></td>
    </tr>`;
  }

  function grouped(list) {
    const groupBy = controls().group.value;
    if (groupBy === 'none') return [{ key: '', label: '', items: list }];
    const map = new Map();
    list.forEach((project) => {
      const key = groupBy === 'year' ? yearOf(project)
        : groupBy === 'type' ? project.type
          : project.status;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(project);
    });
    const label = (key) => groupBy === 'year' ? (/^\d{4}$/.test(key) ? `${key}年` : key)
      : groupBy === 'type' ? (typeLabels[key] || key)
        : (statusLabels[key] || key);
    return [...map.entries()].map(([key, items]) => ({ key, label: label(key), items }));
  }

  function groupSection(group, layout) {
    const heading = group.label ? `<header class="catalog-group-head"><h3>${esc(group.label)}</h3><span>${group.items.length}件</span></header>` : '';
    if (layout === 'table') {
      return `<section class="catalog-group">${heading}<div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th class="check-cell">選択</th><th>制作物</th><th>種類</th><th>状態</th><th>制作</th><th>更新</th><th>リンク</th></tr></thead><tbody>${group.items.map(tableRow).join('')}</tbody></table></div></section>`;
    }
    if (layout === 'cards') return `<section class="catalog-group">${heading}<div class="catalog-grid">${group.items.map(card).join('')}</div></section>`;
    return `<section class="catalog-group">${heading}<div class="catalog-list">${group.items.map(row).join('')}</div></section>`;
  }

  function render() {
    if (currentView() !== 'shelf') return;
    const panel = document.querySelector('[data-view-panel]');
    const list = filtered();
    const c = controls();
    document.querySelector('[data-cat-count]').innerHTML = `<strong>${list.length}</strong> / ${projects().length}件`;
    renderQuickButtons();
    renderActiveFilters();
    if (!list.length) {
      panel.innerHTML = '<div class="empty-state"><h3>その棚、今は空です。</h3><p>上の条件を少し戻してください。</p></div>';
      syncSelection(list);
      saveState();
      return;
    }
    panel.innerHTML = `<div class="catalog-groups">${grouped(list).map((group) => groupSection(group, c.layout.value)).join('')}</div>`;
    bindRows();
    syncSelection(list);
    saveState();
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function bindRows() {
    document.querySelectorAll('[data-cat-check]').forEach((input) => input.addEventListener('change', () => {
      if (input.checked) selected.add(input.dataset.catCheck);
      else selected.delete(input.dataset.catCheck);
      render();
    }));
    document.querySelectorAll('[data-project-open]').forEach((button) => button.addEventListener('click', () => openProject(button.getAttribute('data-project-open'))));
  }

  function syncSelection(list) {
    const count = selected.size;
    const all = document.querySelector('[data-cat-all]');
    const visibleSelected = list.filter((project) => selected.has(project.id)).length;
    const bulk = document.querySelector('[data-cat-bulk]');
    document.querySelector('[data-cat-selected]').textContent = `${count}件選択`;
    document.querySelector('[data-cat-copy]').disabled = !count;
    document.querySelector('[data-cat-clear]').disabled = !count;
    bulk.hidden = !count || currentView() !== 'shelf';
    all.checked = Boolean(list.length) && visibleSelected === list.length;
    all.indeterminate = visibleSelected > 0 && visibleSelected < list.length;
  }

  function copyFormat(list, format) {
    const primaryUrl = (project) => project.liveUrl || project.repositoryUrl || '';
    if (format === 'markdown') return list.map((project) => primaryUrl(project) ? `- [${project.title}](${primaryUrl(project)}) — ${project.summary}` : `- **${project.title}** — ${project.summary}`).join('\n');
    if (format === 'tsv') {
      const rows = [['タイトル', '概要', '種類', '状態', '制作日', '更新日', '公開ページ', 'GitHub']];
      list.forEach((project) => rows.push([project.title, project.summary, typeLabels[project.type] || project.type, statusLabels[project.status] || project.status, formatDate(project.createdAt), formatDate(project.updatedAt || project.createdAt), project.liveUrl || '', project.repositoryUrl || '']));
      return rows.map((rowData) => rowData.map((value) => String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t')).join('\n');
    }
    if (format === 'json') return JSON.stringify(list.map((project) => ({
      title: project.title,
      summary: project.summary,
      type: typeLabels[project.type] || project.type,
      status: statusLabels[project.status] || project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt || project.createdAt,
      liveUrl: project.liveUrl || null,
      repositoryUrl: project.repositoryUrl || null
    })), null, 2);
    return list.map((project) => `${project.title}\n${project.summary}${primaryUrl(project) ? `\n${primaryUrl(project)}` : ''}`).join('\n\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function clearOne(key) {
    const c = controls();
    if (key === 'q') c.search.value = '';
    else if (key === 'quick') quickFilter = 'all';
    else if (c[key]) c[key].value = '';
    render();
  }

  function enhance() {
    if (ready) return;
    const toolbar = document.querySelector('[data-toolbar]');
    if (!toolbar || !window.BUILD_DIARY_DATA) {
      setTimeout(enhance, 80);
      return;
    }
    ready = true;
    toolbar.outerHTML = toolbarHtml();
    populate();
    readState();
    renderQuickButtons();

    const c = controls();
    Object.values(c).forEach((element) => element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', render));
    document.querySelector('[data-cat-reset]').addEventListener('click', () => {
      c.search.value = '';
      c.verb.value = '';
      c.type.value = '';
      c.status.value = '';
      c.year.value = '';
      c.doc.value = '';
      c.link.value = '';
      c.sort.value = 'updated-desc';
      c.layout.value = 'compact';
      c.group.value = 'none';
      quickFilter = 'all';
      render();
    });
    document.querySelector('[data-cat-quick]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat-quick-value]');
      if (!button) return;
      quickFilter = button.dataset.catQuickValue;
      render();
    });
    document.querySelector('[data-cat-active]').addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat-clear-one]');
      if (button) clearOne(button.dataset.catClearOne);
    });
    document.querySelector('[data-cat-all]').addEventListener('change', (event) => {
      filtered().forEach((project) => {
        if (event.target.checked) selected.add(project.id);
        else selected.delete(project.id);
      });
      render();
    });
    document.querySelector('[data-cat-clear]').addEventListener('click', () => {
      selected.clear();
      render();
    });
    document.querySelector('[data-cat-copy]').addEventListener('click', () => {
      const list = projects().filter((project) => selected.has(project.id));
      const format = document.querySelector('[data-cat-format]').value;
      const feedback = document.querySelector('[data-cat-feedback]');
      copyText(copyFormat(list, format)).then(() => {
        feedback.textContent = `${list.length}件コピーしました`;
        setTimeout(() => { feedback.textContent = ''; }, 2400);
      }).catch(() => { feedback.textContent = 'コピーできませんでした'; });
    });
    document.querySelectorAll('[data-view-button]').forEach((button) => button.addEventListener('click', () => setTimeout(() => {
      const shelf = currentView() === 'shelf';
      const toolbarElement = document.querySelector('[data-catalog-toolbar]');
      const bulk = document.querySelector('[data-cat-bulk]');
      if (toolbarElement) toolbarElement.hidden = !shelf;
      if (shelf) render();
      else bulk.hidden = true;
    }, 0)));
    window.addEventListener('popstate', () => setTimeout(render, 0));
    setTimeout(() => {
      if (currentView() === 'shelf') render();
    }, 0);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 80));
})();
