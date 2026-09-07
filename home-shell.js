(() => {
  'use strict';

  const ALIAS_GROUPS = [
    ['memo', 'メモ', 'めも'],
    ['chrome', 'クローム', 'くろーむ'],
    ['web', 'ウェブ', 'うぇぶ'],
    ['english', '英語', 'えいご'],
    ['design', 'デザイン', '設計']
  ];

  const FRICTIONS = {
    reduce: { label: '手間を減らす', words: ['面倒', '手間', '操作', 'クリック', '移動', '入力', '切り替', '効率', 'すぐ', '減ら', '便利', 'utility'] },
    remember: { label: '覚えて戻る', words: ['忘れ', '記録', '保存', '履歴', 'ログ', '辞書', 'メモ', 'アーカイブ', '思い出', '戻る', 'archive', 'memory'] },
    practice: { label: '小さく学ぶ', words: ['学ぶ', '練習', '復習', '反復', '問題', 'クイズ', '英語', '語彙', '音読', 'study', 'training', 'practice'] },
    compare: { label: '比べて整理する', words: ['比べ', '比較', '差分', '構造', '整理', '関係', '可視化', '分析', 'map', 'diff', 'フロー'] },
    communicate: { label: '伝わり方を整える', words: ['伝える', '共有', 'デザイン', '広報', '告知', '文章', '画像', 'レビュー', '見せる', '説明', 'communication', 'editorial'] },
    protect: { label: '情報を守る', words: ['守る', '暗号', '非公開', '認証', 'private', 'security', '秘密', '限定', 'access'] }
  };

  const projects = () => Array.isArray(window.WORKS_PORTFOLIO_SEARCH_INDEX) ? window.WORKS_PORTFOLIO_SEARCH_INDEX : [];
  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const kanaToHira = (value) => String(value || '').replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
  const normalize = (value) => kanaToHira(String(value || '').toLowerCase().normalize('NFKC'))
    .replace(/[・･_\-‐‑‒–—―/\\.,:;'\"“”‘’!?！？()（）[\]【】{}<>「」『』]/g, '')
    .replace(/\s+/g, '');
  const aliasGroups = ALIAS_GROUPS.map((group) => group.map(normalize));
  const dateNumber = (value) => String(value || '').replace(/[^0-9]/g, '').padEnd(8, '0');

  function queryTerms(query) {
    return String(query || '').normalize('NFKC').trim().split(/\s+/).map(normalize).filter(Boolean);
  }

  function aliasesFor(term) {
    return aliasGroups.find((items) => items.includes(term)) || [term];
  }

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

  function scoreProject(project, query) {
    const terms = queryTerms(query);
    if (!terms.length) return 0;
    let total = 0;
    for (const term of terms) {
      let best = 0;
      best = Math.max(best, fieldScore(project.title, term, 150, 125, 100));
      best = Math.max(best, fieldScore(project.id, term, 120, 96, 78));
      for (const alias of project.aliases || []) best = Math.max(best, fieldScore(alias, term, 132, 104, 84));
      best = Math.max(best, fieldScore(project.hint, term, 94, 82, 70));
      best = Math.max(best, fieldScore((project.verbs || []).join(' '), term, 70, 58, 46));
      best = Math.max(best, fieldScore((project.technologies || []).join(' '), term, 58, 48, 38));
      best = Math.max(best, fieldScore((project.families || []).join(' '), term, 52, 44, 34));
      best = Math.max(best, fieldScore(project.searchText, term, 58, 52, 42));
      if (!best) return 0;
      total += best;
    }
    if (project.featured) total += 4;
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
    if ((project.aliases || []).some((value) => terms.some((term) => fieldScore(value, term, 1, 1, 1)))) return '別名';
    if (terms.some((term) => fieldScore(project.hint, term, 1, 1, 1))) return project.hintSource === 'friction' ? '困りごと' : '内容';
    if (terms.some((term) => fieldScore((project.technologies || []).join(' '), term, 1, 1, 1))) return '技術';
    if (terms.some((term) => fieldScore((project.verbs || []).join(' '), term, 1, 1, 1))) return '目的';
    if (terms.some((term) => fieldScore((project.families || []).join(' '), term, 1, 1, 1))) return '制作系統';
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

  function themeScore(project, theme) {
    const text = normalize([
      project.title,
      project.hint,
      project.searchText,
      ...(project.verbs || []),
      ...(project.technologies || []),
      ...(project.families || [])
    ].filter(Boolean).join(' '));
    let score = theme.words.reduce((sum, word) => sum + (text.includes(normalize(word)) ? 1 : 0), 0);
    if (project.type === 'learning-tool' && theme === FRICTIONS.practice) score += 2;
    if (project.type === 'data-tool' && theme === FRICTIONS.compare) score += 1;
    if (project.type === 'chrome-extension' && theme === FRICTIONS.reduce) score += 1;
    if (project.sourceVisibility === 'private' && theme === FRICTIONS.protect) score += 2;
    return score;
  }

  function projectsForTheme(id) {
    const theme = FRICTIONS[id];
    if (!theme) return [];
    return projects()
      .map((project) => ({ project, score: themeScore(project, theme) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || dateNumber(b.project.updatedAt).localeCompare(dateNumber(a.project.updatedAt)))
      .map((item) => item.project);
  }

  window.WORKS_PORTFOLIO_SEARCH = Object.freeze({
    normalize,
    score: scoreProject,
    search,
    matchesId,
    matches: (project, query) => Boolean(project?.id) && matchesId(project.id, query)
  });

  let activeIndex = -1;
  let visibleResults = [];
  let composing = false;

  function headerElements() {
    return {
      shell: document.querySelector('[data-header-search]'),
      input: document.querySelector('[data-header-search-input]'),
      panel: document.querySelector('[data-header-search-panel]'),
      list: document.querySelector('[data-header-search-list]')
    };
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
    return `<button type="button" class="header-search-option${index === activeIndex ? ' is-active' : ''}" role="option" aria-selected="${index === activeIndex}" data-home-search-index="${index}" data-home-search-project="${attr(project.id)}"${disabled ? ' aria-disabled="true"' : ''}>
      <strong>${esc(project.title || project.id)}</strong>
      <small>${esc(project.hint || '制作物の説明を整理中。')}</small>
      <span>MATCH: ${esc(matchReason(project, query))}</span>
    </button>`;
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
      setPanel(true);
      return;
    }
    list.innerHTML = `<p class="home-search-context">${esc(heading)} <strong>${allResults.length}件</strong></p>
      ${results.map((project, index) => optionMarkup(project, index, query)).join('')}
      ${query ? `<button type="button" class="header-search-all" data-home-search-all>「${esc(query)}」を全作品で見る</button>` : ''}`;
    setPanel(true);
  }

  function activateIndex(next) {
    if (!visibleResults.length) return;
    activeIndex = (next + visibleResults.length) % visibleResults.length;
    const { list } = headerElements();
    list?.querySelectorAll('[data-home-search-index]').forEach((option, index) => {
      option.classList.toggle('is-active', index === activeIndex);
      option.setAttribute('aria-selected', String(index === activeIndex));
    });
    list?.querySelector(`[data-home-search-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function openProject(project) {
    if (!project) return;
    if (project.summaryOnly) {
      if (project.liveUrl) window.open(project.liveUrl, '_blank', 'noopener');
      return;
    }
    const params = new URLSearchParams(location.search);
    params.set('project', project.id);
    history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setPanel(false);
  }

  function sendQueryToCatalog(query) {
    window.dispatchEvent(new CustomEvent('worksportfolio:set-query', { detail: { query } }));
    document.querySelector('.explorer')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    setPanel(false);
  }

  function bindHeaderSearch() {
    const { shell, input, list } = headerElements();
    if (!shell || !input || !list || input.dataset.homeSearchBound) return;
    input.dataset.homeSearchBound = 'true';

    input.addEventListener('focus', () => renderHeaderResults(input.value.trim()));
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => {
      composing = false;
      activeIndex = -1;
      renderHeaderResults(input.value.trim());
    });
    input.addEventListener('input', () => {
      if (composing) return;
      activeIndex = -1;
      renderHeaderResults(input.value.trim());
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activateIndex(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        activateIndex(activeIndex - 1);
      } else if (event.key === 'Enter') {
        if (!visibleResults.length) return;
        event.preventDefault();
        openProject(visibleResults[Math.max(0, activeIndex)]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (input.value) {
          input.value = '';
          renderHeaderResults('');
        } else {
          setPanel(false);
          input.blur();
        }
      }
    });

    list.addEventListener('click', (event) => {
      const option = event.target.closest('[data-home-search-project]');
      if (option) {
        openProject(projects().find((item) => item.id === option.dataset.homeSearchProject));
        return;
      }
      if (event.target.closest('[data-home-search-all]')) sendQueryToCatalog(input.value.trim());
    });

    document.addEventListener('pointerdown', (event) => {
      if (!shell.contains(event.target)) setPanel(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      input.focus();
      renderHeaderResults(input.value.trim());
    });
  }

  function bindHomeSections() {
    document.addEventListener('click', (event) => {
      const open = event.target.closest('[data-home-open]');
      if (open) {
        openProject(projects().find((item) => item.id === open.dataset.homeOpen));
        return;
      }
      const friction = event.target.closest('[data-home-friction]');
      if (friction) {
        const theme = FRICTIONS[friction.dataset.homeFriction];
        const input = headerElements().input;
        if (!theme || !input) return;
        window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        input.value = '';
        input.focus({ preventScroll: true });
        activeIndex = -1;
        renderHeaderResults('', projectsForTheme(friction.dataset.homeFriction), theme.label);
        return;
      }
      if (event.target.closest('[data-home-surprise]')) {
        const candidates = projects().filter((project) => !project.summaryOnly || project.liveUrl);
        openProject(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    });
  }

  function init() {
    document.documentElement.classList.add('home-redesign');
    bindHeaderSearch();
    bindHomeSections();
    document.documentElement.classList.add('search-core-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
