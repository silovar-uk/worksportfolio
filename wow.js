(() => {
  'use strict';

  const TYPE_META = {
    'web-app': { label: 'Webアプリ', color: 'var(--type-web)', order: 1 },
    'chrome-extension': { label: 'Chrome拡張', color: 'var(--type-extension)', order: 2 },
    'learning-tool': { label: '学習ツール', color: 'var(--type-learning)', order: 3 },
    'design-system': { label: '設計ガイド', color: 'var(--type-design)', order: 4 },
    'content-page': { label: 'コンテンツ', color: 'var(--type-content)', order: 5 },
    'data-tool': { label: '分析・データ', color: 'var(--type-data)', order: 6 },
    utility: { label: '便利ツール', color: 'var(--type-utility)', order: 7 },
    experiment: { label: '実験', color: 'var(--type-experiment)', order: 8 },
    other: { label: 'その他', color: 'var(--type-other)', order: 9 }
  };
  const STATUS_LABELS = {
    development: '開発中', active: '運用中', prototype: '試作中', dormant: '休止中', legacy: '初期記録'
  };
  const DAILY_KEY = 'worksportfolio-daily-pick-v1';
  let currentPickId = '';
  let section = null;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const audit = () => window.WORKS_PORTFOLIO_AUDIT?.counts || {};
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => escapeHtml(value).replace(/'/g, '&#39;');
  const typeOf = (project) => TYPE_META[project?.type] ? project.type : 'other';
  const yearOf = (project) => {
    const match = String(project?.createdAt || '').match(/^\d{4}/);
    return match ? match[0] : '時期不明';
  };
  const formatDate = (value) => {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!match) return '時期不明';
    if (match[3]) return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    if (match[2]) return `${Number(match[1])}.${Number(match[2])}`;
    return match[1];
  };
  const todayKey = () => new Date().toLocaleDateString('sv-SE');

  function typeEntries() {
    const present = new Set(projects().map(typeOf));
    return [...present].sort((a, b) => TYPE_META[a].order - TYPE_META[b].order);
  }

  function yearlyData() {
    const map = new Map();
    projects().forEach((project) => {
      const year = yearOf(project);
      if (!map.has(year)) map.set(year, { year, total: 0, types: {} });
      const item = map.get(year);
      const type = typeOf(project);
      item.total += 1;
      item.types[type] = (item.types[type] || 0) + 1;
    });
    return [...map.values()].sort((a, b) => {
      if (a.year === '時期不明') return 1;
      if (b.year === '時期不明') return -1;
      return Number(a.year) - Number(b.year);
    });
  }

  function validFavoriteCount() {
    try {
      const saved = JSON.parse(localStorage.getItem('worksportfolio-personal-marks-v1') || '{}');
      const valid = new Set(projects().map((project) => project.id));
      return (Array.isArray(saved.favorites) ? saved.favorites : []).filter((id) => valid.has(id)).length;
    } catch (_) {
      return 0;
    }
  }

  function statsHtml() {
    const data = yearlyData();
    const years = data.filter((item) => /^\d{4}$/.test(item.year));
    const counts = audit();
    return [
      [counts.total || projects().length, '公開している制作物'],
      [typeEntries().length, '制作物の種類'],
      [years.length, '制作した年'],
      [validFavoriteCount(), 'お気に入り']
    ].map(([value, label]) => `<div class="portfolio-wow-number"><strong>${value}</strong><span>${label}</span></div>`).join('');
  }

  function chartHtml() {
    const data = yearlyData();
    const types = typeEntries();
    const max = Math.max(1, ...data.map((item) => item.total));
    const currentYear = document.querySelector('[data-cat-year]')?.value || '';
    const bars = data.map((item, yearIndex) => {
      const segments = types.map((type, typeIndex) => {
        const count = item.types[type] || 0;
        if (!count) return '';
        const height = Math.max(5, Math.round((count / max) * 100));
        return `<i class="portfolio-year-segment" style="--segment-value:${height};--segment-color:${TYPE_META[type].color};--segment-index:${yearIndex * types.length + typeIndex}" title="${escapeHtml(TYPE_META[type].label)} ${count}件"></i>`;
      }).join('');
      const selectable = /^\d{4}$/.test(item.year);
      return `<button type="button" class="portfolio-year${currentYear === item.year ? ' is-active' : ''}" data-wow-year="${selectable ? item.year : ''}"${selectable ? '' : ' disabled'} aria-pressed="${currentYear === item.year}">
        <span class="portfolio-year-bars">${segments}</span>
        <span class="portfolio-year-label"><strong>${escapeHtml(item.year)}</strong><span>${item.total}件</span></span>
      </button>`;
    }).join('');
    const legend = types.map((type) => `<span><i style="--legend-color:${TYPE_META[type].color}"></i>${escapeHtml(TYPE_META[type].label)}</span>`).join('');
    return `<div class="portfolio-strata-chart" style="--year-count:${Math.max(data.length, 1)}">${bars}</div><div class="portfolio-legend">${legend}</div>`;
  }

  function pickCandidates(excludeId = '') {
    const list = projects().filter((project) => project.id !== excludeId);
    return list.length ? list : projects();
  }

  function dailyPickId() {
    const date = todayKey();
    try {
      const saved = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
      if (saved.date === date && projects().some((project) => project.id === saved.id)) return saved.id;
    } catch (_) { /* use deterministic fallback */ }
    const list = projects();
    if (!list.length) return '';
    const seed = [...date].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const id = list[seed % list.length].id;
    localStorage.setItem(DAILY_KEY, JSON.stringify({ date, id }));
    return id;
  }

  function randomPickId(excludeId = '') {
    const list = pickCandidates(excludeId);
    if (!list.length) return '';
    return list[Math.floor(Math.random() * list.length)].id;
  }

  function pickHtml(project) {
    if (!project) return '<p>作品を選べませんでした。</p>';
    const type = typeOf(project);
    const meta = TYPE_META[type];
    const links = [
      project.liveUrl ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">公開ページ ↗</a>` : '',
      project.repositoryUrl ? `<a href="${attr(project.repositoryUrl)}" target="_blank" rel="noopener">GitHub ↗</a>` : ''
    ].filter(Boolean).join('');
    return `<article class="portfolio-pick-card type-${type}" style="--pick-color:${meta.color}" data-wow-pick-card>
      <div class="portfolio-pick-meta"><span>${escapeHtml(meta.label)}</span><span>${escapeHtml(STATUS_LABELS[project.status] || project.status || '状態未設定')}</span><span>${escapeHtml(formatDate(project.createdAt))}</span></div>
      <h4>${escapeHtml(project.title)}</h4>
      <p>${escapeHtml(project.summary || project.friction || '説明を準備中です。')}</p>
      <div class="portfolio-pick-actions">
        <button type="button" class="portfolio-pick-open" data-wow-open="${attr(project.id)}">この作品を開く</button>
        <button type="button" data-wow-shuffle>別の1本</button>
        ${links}
      </div>
    </article>`;
  }

  function createSection() {
    const counts = audit();
    const data = yearlyData();
    const numericYears = data.map((item) => item.year).filter((year) => /^\d{4}$/.test(year));
    const firstYear = numericYears[0] || '—';
    const latestYear = numericYears[numericYears.length - 1] || '—';
    const element = document.createElement('section');
    element.className = 'portfolio-wow';
    element.dataset.portfolioWow = '';
    element.innerHTML = `
      <header class="portfolio-wow-head">
        <div>
          <p class="portfolio-wow-kicker">YOUR MAKING LANDSCAPE</p>
          <h2 class="portfolio-wow-title"><strong>${counts.total || projects().length}</strong>の道具が、<br>${firstYear}から${latestYear}まで<br>積み重なっている。</h2>
          <p class="portfolio-wow-lead">完成品の陳列ではなく、困りごとが道具へ変わってきた地層。年を押せば、その時期だけを掘り返せます。</p>
        </div>
        <div class="portfolio-wow-numbers" data-wow-stats>${statsHtml()}</div>
      </header>
      <div class="portfolio-wow-body">
        <section class="portfolio-strata">
          <header class="portfolio-strata-head"><h3>制作の地層</h3><p>年を押して絞り込み</p></header>
          <div data-wow-chart>${chartHtml()}</div>
        </section>
        <section class="portfolio-pick">
          <header class="portfolio-pick-head"><h3>今日の1本</h3><p>埋もれた作品を、もう一度</p></header>
          <div data-wow-pick></div>
        </section>
      </div>
      <footer class="portfolio-wow-hints"><span><kbd>/</kbd> 検索へ</span><span><kbd>R</kbd> 別の1本</span><span>年の棒を押すと一覧も連動</span></footer>`;
    currentPickId = dailyPickId();
    element.querySelector('[data-wow-pick]').innerHTML = pickHtml(projects().find((project) => project.id === currentPickId));
    return element;
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    location.reload();
  }

  function shufflePick() {
    currentPickId = randomPickId(currentPickId);
    const project = projects().find((item) => item.id === currentPickId);
    const target = section?.querySelector('[data-wow-pick]');
    if (!target) return;
    target.animate?.([{ opacity: .25, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
    target.innerHTML = pickHtml(project);
  }

  function syncYearChart() {
    const target = section?.querySelector('[data-wow-chart]');
    if (target) target.innerHTML = chartHtml();
  }

  function syncVisibility() {
    if (!section) return;
    const shelf = document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button') === 'shelf';
    section.hidden = !shelf;
  }

  function bindEvents() {
    section.addEventListener('click', (event) => {
      const year = event.target.closest('[data-wow-year]');
      if (year && year.dataset.wowYear) {
        const select = document.querySelector('[data-cat-year]');
        if (!select) return;
        select.value = select.value === year.dataset.wowYear ? '' : year.dataset.wowYear;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncYearChart();
        document.querySelector('[data-catalog-toolbar]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const open = event.target.closest('[data-wow-open]');
      if (open) {
        openProject(open.dataset.wowOpen);
        return;
      }
      if (event.target.closest('[data-wow-shuffle]')) shufflePick();
    });
    document.querySelector('[data-cat-year]')?.addEventListener('change', syncYearChart);
    document.querySelectorAll('[data-view-button]').forEach((button) => button.addEventListener('click', () => setTimeout(syncVisibility, 0)));
    document.addEventListener('keydown', (event) => {
      const tag = document.activeElement?.tagName;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable;
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector('[data-cat-search]')?.focus();
      } else if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        shufflePick();
        section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    window.addEventListener('storage', (event) => {
      if (event.key === 'worksportfolio-personal-marks-v1') {
        const stats = section?.querySelector('[data-wow-stats]');
        if (stats) stats.innerHTML = statsHtml();
      }
    });
  }

  function start() {
    const wait = () => {
      const toolbar = document.querySelector('[data-catalog-toolbar]');
      if (!window.BUILD_DIARY_DATA || !toolbar || !window.WORKS_PORTFOLIO_AUDIT) {
        setTimeout(wait, 80);
        return;
      }
      if (document.querySelector('[data-portfolio-wow]')) return;
      section = createSection();
      toolbar.parentNode.insertBefore(section, toolbar);
      bindEvents();
      syncVisibility();
    };
    wait();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
