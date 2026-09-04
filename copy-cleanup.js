(() => {
  'use strict';

  if (!window.__worksportfolioDetailIconSelectorPatch) {
    window.__worksportfolioDetailIconSelectorPatch = true;
    const nativeQuerySelector = Element.prototype.querySelector;
    Element.prototype.querySelector = function patchedQuerySelector(selector) {
      const normalized = selector === ':scope > .project-title-inline-icon is-detail'
        ? ':scope > .project-title-inline-icon.is-detail'
        : selector;
      return nativeQuerySelector.call(this, normalized);
    };
  }

  const LIST_MIGRATION_KEY = 'worksportfolio-default-list-v1';
  const FAVORITES_KEY = 'worksPortfolioFavoriteRatingsV1';
  const mobile = window.matchMedia('(max-width: 760px)');
  let scheduled = false;

  const projects = () => Array.isArray(window.BUILD_DIARY_DATA?.projects)
    ? window.BUILD_DIARY_DATA.projects
    : [];

  function setText(target, value) {
    if (target && target.textContent !== value) target.textContent = value;
  }

  function ensureListDefault() {
    const params = new URLSearchParams(location.search);
    if (params.has('view')) return;
    try {
      if (localStorage.getItem(LIST_MIGRATION_KEY)) return;
      localStorage.setItem(LIST_MIGRATION_KEY, '1');
    } catch (_) { /* 保存できない環境ではその場だけ切り替える */ }
    const shelf = document.querySelector('.global-nav [data-view-button="shelf"]');
    if (shelf && !shelf.classList.contains('is-active')) shelf.click();
  }

  function replaceExactLabels() {
    const labels = new Map([
      ['概要を仮整理', '内容を確認中'],
      ['思い出し待ち', '未確認'],
      ['内容確認済み', '確認済み']
    ]);
    document.querySelectorAll('option,.catalog-badge,.meta-pill').forEach((element) => {
      const next = labels.get(element.textContent.trim());
      if (next) setText(element, next);
    });
  }

  function verificationCopy(project) {
    const messages = {
      verified: '説明、主な機能、公開リンクを確認済みです。',
      inferred: 'GitHubの説明やファイル構成から内容を整理しています。細部は未確認です。',
      unreviewed: '制作日、更新日、リンクなどの基本情報のみ確認しています。内容は未確認です。'
    };
    const parts = [messages[project.documentationState] || messages.unreviewed];
    if (project.liveUrlStatus === 'candidate') parts.push('公開URLは候補として掲載しています。');
    return parts.join(' ');
  }

  function enhanceProjectDetail() {
    const article = document.querySelector('[data-project-detail] article');
    if (!article) return;
    const id = new URLSearchParams(location.search).get('project');
    const project = projects().find((item) => item.id === id);
    if (!project) return;

    article.dataset.documentationState = project.documentationState || 'unreviewed';
    const headingLabels = new Map([
      ['最初の違和感', '作ったきっかけ'],
      ['とりあえず作ったもの', '最初の版'],
      ['現在の答え', '現在の状態'],
      ['改善の履歴', '更新履歴'],
      ['使っているもの', '技術'],
      ['ここからつながるもの', '関連する制作物']
    ]);
    article.querySelectorAll('.detail-section h3').forEach((heading) => {
      const next = headingLabels.get(heading.textContent.trim());
      if (next) setText(heading, next);
    });

    let note = article.querySelector('[data-detail-verification]');
    if (!note) {
      note = document.createElement('section');
      note.className = 'detail-verification';
      note.dataset.detailVerification = '';
      note.innerHTML = '<h3>確認状況</h3><p></p>';
      const links = article.querySelector('.detail-links');
      if (links) links.insertAdjacentElement('afterend', note);
      else article.querySelector('.detail-status')?.insertAdjacentElement('afterend', note);
    }
    setText(note.querySelector('p'), verificationCopy(project));
  }

  function syncMobileFilterShell() {
    const toolbar = document.querySelector('[data-catalog-toolbar]');
    const details = toolbar?.querySelector('.catalog-more');
    if (!toolbar || !details) return;

    const quick = toolbar.querySelector('[data-cat-quick]');
    const taxonomy = toolbar.querySelector('[data-taxonomy]');
    const filters = details.querySelector('.catalog-filters');
    const summary = details.querySelector('summary');

    if (summary && !summary.dataset.compactCopy) {
      const count = summary.querySelector('[data-cat-filter-count]');
      summary.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
      });
      summary.insertBefore(document.createTextNode('絞り込み・表示 '), count || null);
      summary.dataset.compactCopy = '1';
    }

    if (!toolbar.dataset.compactFilterReady) {
      details.open = false;
      toolbar.dataset.compactFilterReady = '1';
    }
    if (quick && quick.parentElement !== details) details.insertBefore(quick, filters || null);
    if (taxonomy && taxonomy.parentElement !== details) details.insertBefore(taxonomy, filters || null);
  }

  function favoriteRatings() {
    try {
      const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function projectIdFromSurface(surface) {
    return surface.dataset.catItem
      || surface.dataset.randomThreeItem
      || surface.querySelector('[data-project-open]')?.dataset.projectOpen
      || surface.querySelector('[data-wow-open]')?.dataset.wowOpen
      || surface.querySelector('[data-random-three-open]')?.dataset.randomThreeOpen
      || surface.querySelector('[data-floating-random-open]')?.dataset.floatingRandomOpen
      || surface.querySelector('[data-taxonomy-random-open]')?.dataset.taxonomyRandomOpen
      || '';
  }

  function setFavoriteTone(element, value) {
    if (!element) return;
    const rating = Number(value);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) element.dataset.favoriteRating = String(rating);
    else delete element.dataset.favoriteRating;
  }

  function syncFavoriteTones() {
    const ratings = favoriteRatings();
    const selector = [
      '.project-card', '.timeline-card', '.map-mobile-item', '.catalog-card', '.catalog-row',
      '.catalog-table tbody tr[data-cat-item]', '.portfolio-pick-card',
      '.random-three-card[data-random-three-item]', '.floating-random-card',
      '.catalog-random-result[data-taxonomy-random-result]'
    ].join(',');

    document.querySelectorAll(selector).forEach((surface) => {
      const id = projectIdFromSurface(surface);
      setFavoriteTone(surface, ratings[id]);
    });

    document.querySelectorAll('.favorite-rating[data-favorite-project]').forEach((control) => {
      setFavoriteTone(control, ratings[control.dataset.favoriteProject]);
    });

    const detailId = new URLSearchParams(location.search).get('project');
    setFavoriteTone(document.querySelector('[data-project-detail] article'), ratings[detailId]);
  }

  function updateRandomToggle(section, button) {
    const collapsed = section.classList.contains('is-mobile-collapsed');
    button.textContent = collapsed ? '3枚を見る' : '閉じる';
    button.setAttribute('aria-expanded', String(!collapsed));
  }

  function syncRandomThreeCollapse() {
    const section = document.querySelector('[data-random-three]');
    if (!section) return;
    let button = section.querySelector('[data-random-three-mobile-toggle]');

    if (!mobile.matches) {
      section.classList.remove('is-mobile-collapsed');
      if (button) button.hidden = true;
      return;
    }

    if (!section.dataset.mobileCollapseReady) {
      section.dataset.mobileCollapseReady = '1';
      section.classList.add('is-mobile-collapsed');
    }

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'random-three-mobile-toggle';
      button.dataset.randomThreeMobileToggle = '';
      const head = section.querySelector('.random-three-head');
      const refresh = section.querySelector('[data-random-three-refresh]');
      if (!head) return;
      head.insertBefore(button, refresh || null);
      button.addEventListener('click', () => {
        section.classList.toggle('is-mobile-collapsed');
        updateRandomToggle(section, button);
      });
    }

    button.hidden = false;
    updateRandomToggle(section, button);
  }

  function syncRandomThreeUrls() {
    const projectMap = new Map(projects().map((project) => [project.id, project]));
    document.querySelectorAll('.random-three-card[data-random-three-item]').forEach((card) => {
      const project = projectMap.get(card.dataset.randomThreeItem || '');
      const url = project?.liveUrl || project?.repositoryUrl || '';
      let link = card.querySelector('.random-three-url');
      if (!url) {
        link?.remove();
        return;
      }
      if (!link) {
        link = document.createElement('a');
        link.className = 'random-three-url';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const title = card.querySelector('.random-three-art h3');
        if (title) title.insertAdjacentElement('afterend', link);
        else card.querySelector('.random-three-art')?.prepend(link);
      }
      link.href = url;
      link.textContent = url;
      link.title = url;
    });
  }

  function dedupeDetailIcons() {
    const heading = document.querySelector('[data-project-dialog] .detail-title');
    if (!heading) return;
    const icons = [...heading.querySelectorAll(':scope > .project-title-inline-icon.is-detail')];
    icons.slice(1).forEach((icon) => icon.remove());
  }

  function applyDynamicCopy() {
    document.querySelectorAll('.loading').forEach((element) => setText(element, '制作物を読み込んでいます。'));
    document.querySelectorAll('.empty-state').forEach((element) => {
      setText(element.querySelector('h3'), '条件に合う制作物がありません。');
      setText(element.querySelector('p'), '検索や絞り込みの条件を変更してください。');
    });
    document.querySelectorAll('.friction-line strong').forEach((element) => setText(element, '作ったきっかけ：'));
    document.querySelectorAll('.map-side strong').forEach((element) => {
      if (element.textContent.trim() === '最初の違和感') setText(element, '作ったきっかけ');
    });
    document.querySelectorAll('.shelf-heading span').forEach((element) => {
      const match = element.textContent.match(/(\d+)\s*TOOLS/i);
      if (match) setText(element, `${match[1]}件`);
    });

    replaceExactLabels();
    enhanceProjectDetail();
    dedupeDetailIcons();
    syncMobileFilterShell();
    syncRandomThreeCollapse();
    syncRandomThreeUrls();
    syncFavoriteTones();
  }

  function apply() {
    scheduled = false;
    applyDynamicCopy();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function start() {
    apply();
    ensureListDefault();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    if (mobile.addEventListener) mobile.addEventListener('change', schedule);
    else mobile.addListener?.(schedule);
    window.addEventListener('storage', (event) => {
      if (event.key === FAVORITES_KEY) schedule();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
