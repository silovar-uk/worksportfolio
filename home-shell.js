(() => {
  'use strict';

  const SEARCH_SEP = '\u001f';
  const TYPE_BY_CODE = { w: 'web-app', c: 'chrome-extension', l: 'learning-tool', d: 'design-system', p: 'content-page', a: 'data-tool', u: 'utility', e: 'experiment', o: 'other' };
  const ALIAS_GROUPS = [
    ['memo', 'メモ', 'めも'],
    ['chrome', 'クローム', 'くろーむ'],
    ['web', 'ウェブ', 'うぇぶ'],
    ['english', '英語', 'えいご'],
    ['design', 'デザイン', '設計']
  ];
  const FRICTIONS = {
    reduce: { label: '手間を減らす' }, remember: { label: '覚えて戻る' }, practice: { label: '小さく学ぶ' },
    compare: { label: '比べて整理する' }, communicate: { label: '伝わり方を整える' }, protect: { label: '情報を守る' }
  };
  const PROBLEM_SIGNALS = {
    reduce: ['面倒', 'めんど', '手間', 'クリック', '移動', '入力', '切り替', 'タブ', '操作', '毎回', '時間', '遅', '探す', '何度', 'click', 'tab'],
    remember: ['忘', '戻', '記録', '保存', '履歴', '思い出', '覚', '見つから', '探せない', 'メモ', 'remember', 'save'],
    practice: ['学', '練習', '復習', '勉強', '身につ', '覚えたい', '英語', '語彙', '問題', 'クイズ', 'practice', 'study'],
    compare: ['比べ', '比較', '違い', '差分', '整理', '構造', '分析', '可視化', '見える', 'compare', 'diff'],
    communicate: ['伝わ', '伝え', '文章', '共有', '説明', 'デザイン', '画像', 'レビュー', '告知', 'communication'],
    protect: ['秘密', '非公開', '守', '認証', '個人情報', '機密', '限定', 'private', 'security']
  };

  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const kanaToHira = (value) => String(value || '').replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  const normalize = (value) => kanaToHira(String(value || '').toLowerCase().normalize('NFKC'))
    .replace(/[・･_\-‐‑‒–—―/\\.,:;'\"“”‘’!?！？()（）[\]【】{}<>「」『』]/g, '')
    .replace(/\s+/g, '');
  const aliasGroups = ALIAS_GROUPS.map((group) => group.map(normalize));
  const dateNumber = (value) => String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');
  const packed = Array.isArray(window.WORKS_PORTFOLIO_SEARCH_INDEX) ? window.WORKS_PORTFOLIO_SEARCH_INDEX : [];
  const projectRecords = packed.map((raw) => ({
    id: raw.i,
    title: raw.t,
    hint: raw.h || '',
    hintSource: raw.r ? 'friction' : 'content',
    type: TYPE_BY_CODE[raw.y] || 'other',
    updatedAt: raw.u || '',
    liveUrl: raw.l || '',
    summaryOnly: Boolean(raw.s),
    aliases: raw.a || '',
    verbs: raw.v || '',
    technologies: raw.k || '',
    families: raw.f || '',
    familyIds: raw.j ? String(raw.j).split(SEARCH_SEP).filter(Boolean) : [],
    frictionIds: raw.g ? String(raw.g).split(SEARCH_SEP).filter(Boolean) : [],
    searchText: raw.x || ''
  }));
  const projects = () => projectRecords;

  function queryTerms(query) {
    return String(query || '').normalize('NFKC').trim().split(/\s+/).map(normalize).filter(Boolean);
  }
  function aliasesFor(term) { return aliasGroups.find((items) => items.includes(term)) || [term]; }
  function fieldScore(value, term, exact, prefix, partial) {
    const field = normalize(value);
    if (!field) return 0;
    let best = 0;
    for (const alias of aliasesFor(term)) {
      if (field === alias) best = Math.max(best, exact);
      else if (field.startsWith(alias)) best = Math.max(best, prefix);
      else if (field.includes(alias)) best = Math.max(best, partial);
    }
    return best;
  }
  function listScore(value, term, exact, prefix, partial) {
    if (!value) return 0;
    let best = 0;
    for (const item of String(value).split(SEARCH_SEP)) best = Math.max(best, fieldScore(item, term, exact, prefix, partial));
    return best;
  }

  function scoreProject(project, query) {
    const terms = queryTerms(query);
    if (!terms.length) return 0;
    let total = 0;
    for (const term of terms) {
      let best = 0;
      best = Math.max(best, fieldScore(project.title, term, 150, 125, 100));
      best = Math.max(best, fieldScore(project.id, term, 120, 96, 78));
      best = Math.max(best, listScore(project.aliases, term, 132, 104, 84));
      best = Math.max(best, fieldScore(project.hint, term, 94, 82, 70));
      best = Math.max(best, listScore(project.verbs, term, 70, 58, 46));
      best = Math.max(best, listScore(project.technologies, term, 58, 48, 38));
      best = Math.max(best, listScore(project.families, term, 52, 44, 34));
      best = Math.max(best, fieldScore(project.searchText, term, 58, 52, 42));
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  function matchesId(id, query) {
    const project = projects().find((item) => item.id === id);
    return Boolean(project) && (!queryTerms(query).length || scoreProject(project, query) > 0);
  }

  function matchReason(project, query) {
    const terms = queryTerms(query);
    if (!terms.length) return '最近更新';
    if (terms.some((term) => fieldScore(project.title, term, 1, 1, 1))) return '名前';
    if (terms.some((term) => listScore(project.aliases, term, 1, 1, 1))) return '別名';
    if (terms.some((term) => fieldScore(project.hint, term, 1, 1, 1))) return project.hintSource === 'friction' ? '困りごと' : '内容';
    if (terms.some((term) => listScore(project.technologies, term, 1, 1, 1))) return '技術';
    if (terms.some((term) => listScore(project.verbs, term, 1, 1, 1))) return '目的';
    if (terms.some((term) => listScore(project.families, term, 1, 1, 1))) return '制作系統';
    return '内容';
  }

  function search(query) {
    const terms = queryTerms(query);
    const list = projects().slice();
    if (!terms.length) return list.sort((a, b) => dateNumber(b.updatedAt).localeCompare(dateNumber(a.updatedAt)));
    return list
      .map((project) => ({ project, score: scoreProject(project, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || dateNumber(b.project.updatedAt).localeCompare(dateNumber(a.project.updatedAt)))
      .map((item) => item.project);
  }

  function splitList(value) { return String(value || '').split(SEARCH_SEP).filter(Boolean); }
  function problemSignalHits(query) {
    const text = normalize(query);
    return Object.entries(PROBLEM_SIGNALS)
      .map(([id, words]) => ({ id, words: words.filter((word) => text.includes(normalize(word))) }))
      .filter((item) => item.words.length)
      .sort((a, b) => b.words.length - a.words.length);
  }
  function problemText(project) {
    return normalize([project.title, project.hint, project.aliases, project.verbs, project.technologies, project.families, project.searchText].filter(Boolean).join(' '));
  }
  function problemRecommendations(query) {
    const q = String(query || '').trim();
    if (!q) return { hits: [], results: [] };
    const normalizedQuery = normalize(q);
    const hits = problemSignalHits(q);
    const ranked = projects().map((project) => {
      const text = problemText(project);
      let score = 0;
      const reasons = [];
      const matchedWords = [];
      for (const hit of hits) {
        if (!project.frictionIds.includes(hit.id)) continue;
        score += 100;
        reasons.push(FRICTIONS[hit.id]?.label || hit.id);
        for (const word of hit.words) {
          if (text.includes(normalize(word))) { score += 36; matchedWords.push(word); }
        }
      }
      const title = normalize(project.title);
      if (title && normalizedQuery.includes(title)) score += 180;
      for (const alias of splitList(project.aliases)) {
        const token = normalize(alias);
        if (token.length >= 2 && normalizedQuery.includes(token)) score += 90;
      }
      return { project, score, reasons: [...new Set(reasons)], matchedWords: [...new Set(matchedWords)] };
    }).filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || dateNumber(b.project.updatedAt).localeCompare(dateNumber(a.project.updatedAt)));

    if (!ranked.length) {
      return {
        hits,
        results: search(q).slice(0, 3).map((project) => ({ project, score: scoreProject(project, q), reasons: [matchReason(project, q)], matchedWords: [] }))
      };
    }
    return { hits, results: ranked.slice(0, 3) };
  }
  function problemReason(item) {
    if (item.matchedWords.length && item.reasons.length) return `「${item.matchedWords.slice(0, 2).join('・')}」＋ ${item.reasons.slice(0, 2).join(' / ')}`;
    if (item.reasons.length) return item.reasons.slice(0, 2).join(' / ');
    return item.reasons[0] || '入力内容と近い';
  }
  function problemResultCard(item) {
    const project = item.project;
    return `<article class="home-problem-result"><p class="home-problem-reason"><span>WHY MATCHED</span>${esc(problemReason(item))}</p><button type="button" data-home-problem-open="${attr(project.id)}"><strong>${esc(project.title || project.id)}</strong><small>${esc(project.hint || '制作物の説明を整理中。')}</small></button></article>`;
  }
  function renderProblemRecommendations(query) {
    const holder = document.querySelector('[data-home-problem-results]');
    if (!holder) return;
    const { hits, results } = problemRecommendations(query);
    if (!results.length) {
      holder.innerHTML = '<p class="home-problem-empty"><strong>まだ近い答えを絞れませんでした。</strong><br>「タブ」「忘れる」「比較」など、気になる動作を短く足してみてください。</p>';
      holder.hidden = false;
      return;
    }
    const primary = hits[0]?.id || '';
    holder.innerHTML = `<div class="home-problem-result-head"><div><span>NEARBY ANSWERS</span><strong>近い答えを3つ</strong></div>${primary ? `<button type="button" data-home-problem-all="${attr(primary)}">近い困りごとを一覧で見る ↓</button>` : ''}</div><div class="home-problem-result-grid">${results.map(problemResultCard).join('')}</div>`;
    holder.hidden = false;
    holder.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function bindProblemFinder() {
    const form = document.querySelector('[data-home-problem-form]');
    const input = document.querySelector('[data-home-problem-input]');
    const holder = document.querySelector('[data-home-problem-results]');
    if (!form || !input || !holder) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderProblemRecommendations(input.value);
    });
    document.addEventListener('click', (event) => {
      const example = event.target.closest('[data-home-problem-example]');
      if (example) {
        input.value = example.dataset.homeProblemExample || '';
        renderProblemRecommendations(input.value);
        return;
      }
      const open = event.target.closest('[data-home-problem-open]');
      if (open) {
        openProject(projects().find((item) => item.id === open.dataset.homeProblemOpen));
        return;
      }
      const all = event.target.closest('[data-home-problem-all]');
      if (all) sendFrictionToCatalog(all.dataset.homeProblemAll);
    });
  }

  function projectsForTheme(id) {
    if (!FRICTIONS[id]) return [];
    return projects().filter((project) => project.frictionIds.includes(id))
      .sort((a, b) => dateNumber(b.updatedAt).localeCompare(dateNumber(a.updatedAt)));
  }

  window.WORKS_PORTFOLIO_SEARCH = Object.freeze({ normalize, score: scoreProject, search, matchesId, matches: (project, query) => Boolean(project?.id) && matchesId(project.id, query) });

  let activeIndex = -1;
  let visibleResults = [];
  let composing = false;
  function headerElements() {
    return { shell: document.querySelector('[data-header-search]'), input: document.querySelector('[data-header-search-input]'), panel: document.querySelector('[data-header-search-panel]'), list: document.querySelector('[data-header-search-list]') };
  }
  function setPanel(open) {
    const { input, panel } = headerElements();
    if (!input || !panel) return;
    panel.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) activeIndex = -1;
  }
  function optionMarkup(project, index, query) {
    const disabled = Boolean(project.summaryOnly && !project.liveUrl);
    return `<button type="button" class="header-search-option${index === activeIndex ? ' is-active' : ''}" role="option" aria-selected="${index === activeIndex}" data-home-search-index="${index}" data-home-search-project="${attr(project.id)}"${disabled ? ' aria-disabled="true"' : ''}><strong>${esc(project.title || project.id)}</strong><small>${esc(project.hint || '制作物の説明を整理中。')}</small><span>MATCH: ${esc(matchReason(project, query))}</span></button>`;
  }
  function renderHeaderResults(query = '', explicitList = null, contextLabel = '') {
    const { list } = headerElements();
    if (!list) return;
    const allResults = explicitList || search(query);
    const results = allResults.slice(0, 7);
    visibleResults = results;
    if (activeIndex >= results.length) activeIndex = results.length ? 0 : -1;
    const heading = contextLabel || (query ? `「${query}」` : '最近更新');
    if (!results.length) {
      list.innerHTML = `<p class="header-search-empty"><strong>${esc(heading)}</strong><br>見つかりませんでした。名前だけでなく、困りごと・技術・用途でも探せます。</p>`;
      setPanel(true); return;
    }
    list.innerHTML = `<p class="home-search-context">${esc(heading)} <strong>${allResults.length}件</strong></p>${results.map((project, index) => optionMarkup(project, index, query)).join('')}${query ? `<button type="button" class="header-search-all" data-home-search-all>「${esc(query)}」を全作品で見る</button>` : ''}`;
    setPanel(true);
  }
  function activateIndex(next) {
    if (!visibleResults.length) return;
    activeIndex = (next + visibleResults.length) % visibleResults.length;
    const { list } = headerElements();
    list?.querySelectorAll('[data-home-search-index]').forEach((option, index) => { option.classList.toggle('is-active', index === activeIndex); option.setAttribute('aria-selected', String(index === activeIndex)); });
    list?.querySelector(`[data-home-search-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  function openProject(project) {
    if (!project) return;
    if (project.summaryOnly) { if (project.liveUrl) window.open(project.liveUrl, '_blank', 'noopener'); return; }
    const params = new URLSearchParams(location.search); params.set('project', project.id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`); window.dispatchEvent(new PopStateEvent('popstate')); setPanel(false);
  }
  function sendQueryToCatalog(query) {
    window.dispatchEvent(new CustomEvent('worksportfolio:set-query', { detail: { query } }));
    document.querySelector('.explorer')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); setPanel(false);
  }

  function bindHeaderSearch() {
    const { shell, input, list } = headerElements();
    if (!shell || !input || !list || input.dataset.homeSearchBound) return;
    input.dataset.homeSearchBound = 'true';
    input.addEventListener('focus', () => renderHeaderResults(input.value.trim()));
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; activeIndex = -1; renderHeaderResults(input.value.trim()); });
    input.addEventListener('input', () => { if (!composing) { activeIndex = -1; renderHeaderResults(input.value.trim()); } });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); activateIndex(activeIndex + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); activateIndex(activeIndex - 1); }
      else if (event.key === 'Enter') { if (!visibleResults.length) return; event.preventDefault(); openProject(visibleResults[Math.max(0, activeIndex)]); }
      else if (event.key === 'Escape') { event.preventDefault(); if (input.value) { input.value = ''; renderHeaderResults(''); } else { setPanel(false); input.blur(); } }
    });
    list.addEventListener('click', (event) => {
      const option = event.target.closest('[data-home-search-project]');
      if (option) { openProject(projects().find((item) => item.id === option.dataset.homeSearchProject)); return; }
      if (event.target.closest('[data-home-search-all]')) sendQueryToCatalog(input.value.trim());
    });
    document.addEventListener('pointerdown', (event) => { if (!shell.contains(event.target)) setPanel(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault(); input.focus(); renderHeaderResults(input.value.trim());
    });
  }

  let activeFrictionId = '';
  function setFrictionButtons(id) {
    document.querySelectorAll('[data-home-friction]').forEach((button) => {
      const active = button.dataset.homeFriction === id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-expanded', String(active));
    });
  }
  function frictionCard(project) {
    const answerByType = {
      'web-app': 'Webアプリとして答えを作った。', 'chrome-extension': 'Chrome拡張として答えを作った。',
      'learning-tool': '学習ツールとして答えを作った。', 'design-system': '設計・デザインの仕組みにした。',
      'content-page': '読める知識の形にした。', 'data-tool': '分析・データの道具にした。',
      utility: '小さな便利ツールにした。', experiment: 'まず試作品にした。', other: '使える形にした。'
    };
    return `<article class="home-friction-result-card"><p><span>困った</span>${esc(project.hint || '作る前の引っかかりを整理中。')}</p><button type="button" data-home-friction-open="${attr(project.id)}"><strong>${esc(project.title || project.id)}</strong><small>${esc(answerByType[project.type] || answerByType.other)}</small></button></article>`;
  }
  function renderFrictionResults(id) {
    const holder = document.querySelector('[data-home-friction-results]');
    const theme = FRICTIONS[id];
    if (!holder || !theme) return;
    if (activeFrictionId === id && !holder.hidden) {
      activeFrictionId = ''; holder.hidden = true; holder.innerHTML = ''; setFrictionButtons(''); return;
    }
    const all = projectsForTheme(id);
    activeFrictionId = id; setFrictionButtons(id);
    holder.innerHTML = `<div class="home-friction-result-head"><div><span>SELECTED FRICTION</span><strong>${esc(theme.label)}</strong><small>${all.length}件のうち、まず3件</small></div><button type="button" data-home-friction-all="${attr(id)}">すべて見る ↓</button></div><div class="home-friction-result-grid">${all.slice(0,3).map(frictionCard).join('')}</div>`;
    holder.hidden = false;
    holder.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function sendFrictionToCatalog(id) {
    window.dispatchEvent(new CustomEvent('worksportfolio:set-friction', { detail: { friction: id } }));
    document.querySelector('.explorer')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function bindHomeSections() {
    document.addEventListener('click', (event) => {
      const open = event.target.closest('[data-home-open],[data-home-friction-open]');
      if (open) {
        const id = open.dataset.homeOpen || open.dataset.homeFrictionOpen;
        openProject(projects().find((item) => item.id === id)); return;
      }
      const friction = event.target.closest('[data-home-friction]');
      if (friction) { renderFrictionResults(friction.dataset.homeFriction); return; }
      const all = event.target.closest('[data-home-friction-all]');
      if (all) { sendFrictionToCatalog(all.dataset.homeFrictionAll); return; }
      if (event.target.closest('[data-home-surprise]')) {
        const candidates = projects().filter((project) => !project.summaryOnly || project.liveUrl);
        openProject(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    });
  }

  function init() { document.documentElement.classList.add('home-redesign'); bindHeaderSearch(); bindProblemFinder(); bindHomeSections(); document.documentElement.classList.add('search-core-ready'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
