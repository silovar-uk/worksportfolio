(() => {
  'use strict';

  const TYPE_LABELS = {
    'web-app': 'Webアプリ',
    'chrome-extension': 'Chrome拡張',
    'learning-tool': '学習ツール',
    'design-system': '設計・デザイン',
    'content-page': '文章・知識',
    'data-tool': '分析・データ',
    utility: '便利ツール',
    experiment: '実験',
    other: 'その他'
  };
  const STATUS_LABELS = {
    development: '開発中', active: '運用中', prototype: '試作中', dormant: '休止中', legacy: '初期記録'
  };
  const DOC_LABELS = { verified: '確認済み', inferred: '内容を確認中', unreviewed: '未確認' };
  const detailCache = new Map();
  let requestId = 0;

  const indexProjects = () => Array.isArray(window.WORKS_PORTFOLIO_SEARCH_INDEX) ? window.WORKS_PORTFOLIO_SEARCH_INDEX : [];
  const indexProjectId = (item) => item?.i || '';
  const indexProjectTitle = (item) => item?.t || item?.i || '';
  const isSummaryOnly = (item) => item?.s === 1;
  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');

  function formatDate(value) {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return String(value);
    if (match[3]) return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    if (match[2]) return `${Number(match[1])}.${Number(match[2])}`;
    return match[1];
  }

  async function loadDetail(id) {
    if (detailCache.has(id)) return detailCache.get(id);
    const response = await fetch(`data/project-details/${encodeURIComponent(id)}.json`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`project detail ${id}: ${response.status}`);
    const detail = await response.json();
    detailCache.set(id, detail);
    return detail;
  }

  function relatedMarkup(project) {
    const map = new Map(indexProjects().map((item) => [indexProjectId(item), item]));
    const related = (project.relatedProjects || [])
      .map((relation) => ({ relation, project: map.get(relation.id || relation.target) }))
      .filter((item) => item.project && !isSummaryOnly(item.project));
    if (!related.length) return '';
    return `<section class="detail-section"><h3>関連する制作物</h3><div class="detail-related">${related.map(({ relation, project: item }) =>
      `<button type="button" data-core-related-project="${attr(indexProjectId(item))}"><strong>${esc(indexProjectTitle(item))}</strong><br><small>${esc(relation.relation || '関連する制作物')}</small></button>`
    ).join('')}</div></section>`;
  }

  function markup(project) {
    const extension = project.extension || null;
    return `<article>
      <p class="eyebrow">${esc(TYPE_LABELS[project.type] || project.type || '制作物')} / ${esc(formatDate(project.startedAt || project.createdAt))}</p>
      <h2 class="detail-title" id="dialog-title">${esc(project.title || project.id)}</h2>
      <p class="detail-subtitle">${esc(project.subtitle || project.summary || '')}</p>
      <div class="detail-status">
        <span class="meta-pill">${esc(STATUS_LABELS[project.status] || project.status || '記録')}</span>
        <span class="meta-pill">制作 ${esc(formatDate(project.startedAt || project.createdAt))}</span>
        <span class="meta-pill">最終更新 ${esc(formatDate(project.updatedAt || project.createdAt))}</span>
        <span class="meta-pill">${esc(DOC_LABELS[project.documentationState] || '内容を確認中')}</span>
        ${(project.verbs || []).map((verb) => `<span class="meta-pill">${esc(verb)}</span>`).join('')}
      </div>
      <div class="detail-links">
        ${project.liveUrl ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noreferrer">公開ページを開く ↗</a>` : '<span class="meta-pill">公開ページ：未登録</span>'}
        ${project.repositoryUrl ? `<a href="${attr(project.repositoryUrl)}" target="_blank" rel="noreferrer">GitHub ↗</a>` : '<span class="meta-pill">GitHub：手元のみ</span>'}
      </div>
      ${extension ? `<section class="detail-section extension-spec"><h3>Chrome拡張情報</h3><dl>
        <div><dt>バージョン</dt><dd>${esc(extension.version || '要確認')}</dd></div>
        <div><dt>拡張ID</dt><dd><code>${esc(extension.extensionId || '要確認')}</code></dd></div>
      </dl></section>` : ''}
      <section class="detail-section"><h3>作ったきっかけ</h3><p class="detail-friction">${esc(project.friction || '作ったきっかけを整理中です。')}</p></section>
      <section class="detail-section"><h3>最初の版</h3><p>${esc(project.firstBuild || '初期版の記録は未確認です。')}</p></section>
      <section class="detail-section"><h3>現在の状態</h3><p>${esc(project.currentAnswer || project.summary || '')}</p>${project.aside ? `<p class="detail-aside">${esc(project.aside)}</p>` : ''}</section>
      <section class="detail-section"><h3>更新履歴</h3><div class="detail-updates">${(project.updates || []).map((update) =>
        `<div class="detail-update"><time>${esc(formatDate(update.date))}${update.version ? ` / ${esc(update.version)}` : ''}</time><div><strong>${esc(update.change || '')}</strong><br><span class="update-reason">${esc(update.reason || '')}</span></div></div>`
      ).join('') || '<p>更新履歴は未確認です。</p>'}</div></section>
      <section class="detail-section"><h3>技術</h3><div class="card-meta">${(project.technologies || []).map((item) => `<span class="meta-pill">${esc(item)}</span>`).join('')}</div></section>
      ${relatedMarkup(project)}
    </article>`;
  }

  function elements() {
    return {
      dialog: document.querySelector('[data-project-dialog]'),
      detail: document.querySelector('[data-project-detail]'),
      about: document.querySelector('[data-about-dialog]')
    };
  }

  async function syncProjectFromUrl() {
    const { dialog, detail } = elements();
    if (!dialog || !detail) return;
    const id = new URLSearchParams(location.search).get('project');
    if (!id) {
      requestId += 1;
      if (dialog.open) dialog.close();
      return;
    }
    const indexProject = indexProjects().find((item) => indexProjectId(item) === id);
    if (!indexProject || isSummaryOnly(indexProject)) {
      requestId += 1;
      if (dialog.open) dialog.close();
      return;
    }
    const current = ++requestId;
    detail.innerHTML = '<div class="loading">詳細を読み込んでいます。</div>';
    if (!dialog.open) dialog.showModal();
    try {
      const project = await loadDetail(id);
      if (current !== requestId || new URLSearchParams(location.search).get('project') !== id) return;
      detail.innerHTML = markup(project);
    } catch (error) {
      console.warn('Project detail could not be loaded.', error);
      if (current !== requestId) return;
      detail.innerHTML = '<div class="empty-state"><h3>詳細を読み込めませんでした。</h3><p>検索と一覧はそのまま利用できます。</p></div>';
    }
  }

  function closeProject() {
    const params = new URLSearchParams(location.search);
    if (!params.has('project')) return;
    params.delete('project');
    history.replaceState({}, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
    syncProjectFromUrl();
  }

  function openRelated(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    syncProjectFromUrl();
  }

  function isBackdropClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  function bind() {
    const { dialog, about } = elements();
    document.querySelector('[data-dialog-close]')?.addEventListener('click', closeProject);
    document.querySelector('[data-about-button]')?.addEventListener('click', () => about?.showModal());
    document.querySelector('[data-about-close]')?.addEventListener('click', () => about?.close());
    dialog?.addEventListener('cancel', (event) => { event.preventDefault(); closeProject(); });
    dialog?.addEventListener('click', (event) => { if (isBackdropClick(event)) closeProject(); });
    about?.addEventListener('click', (event) => { if (isBackdropClick(event)) about.close(); });
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const related = target?.closest('[data-core-related-project]');
      if (related) openRelated(related.dataset.coreRelatedProject);
    });
    window.addEventListener('popstate', syncProjectFromUrl);
    window.WORKS_PORTFOLIO_PROJECT_DETAIL = Object.freeze({ sync: syncProjectFromUrl });
    syncProjectFromUrl();
    document.documentElement.classList.add('project-detail-core-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
