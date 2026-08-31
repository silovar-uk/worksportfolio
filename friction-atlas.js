(() => {
  'use strict';

  const THEME_DEFS = [
    {
      id: 'reduce',
      code: '01',
      label: '手間を減らしたかった',
      en: 'REDUCE FRICTION',
      note: 'クリック、移動、入力、確認。毎日の小さな面倒を削る。',
      words: ['面倒', '手間', '操作', 'クリック', '移動', '入力', '確認漏れ', '作業', '別々', '切り替', 'すぐ', '最小', '減ら', '速く', 'ランチャー', 'utility', '便利']
    },
    {
      id: 'remember',
      code: '02',
      label: '忘れず、戻りたかった',
      en: 'REMEMBER & RETURN',
      note: 'その場で終わる情報を、あとから再利用できる記録へ。',
      words: ['忘れ', '記録', '残す', '振り返', '思い出', 'あとから', '履歴', 'ログ', '保存', '辞書', 'アーカイブ', 'メモ', 'memory', 'archive']
    },
    {
      id: 'practice',
      code: '03',
      label: '小さく反復したかった',
      en: 'PRACTICE SMALL',
      note: '読むだけでなく、短く何度も手と口を動かす。',
      words: ['学ぶ', '練習', '復習', '反復', '問題', 'クイズ', '英語', 'スペイン語', 'ハングル', '話す', '読む', '音読', 'トレーニング', 'study', 'training', 'practice']
    },
    {
      id: 'compare',
      code: '04',
      label: '比べて、構造を見たかった',
      en: 'COMPARE & STRUCTURE',
      note: '差分、前後関係、まとまりを、頭の外へ出して確かめる。',
      words: ['比べ', '比較', '差分', '構造', '整理', 'フロー', '工程', '関係', 'つながり', '並べ', '可視化', '分析', 'map', 'gantt', 'diff']
    },
    {
      id: 'communicate',
      code: '05',
      label: '伝わり方まで設計したかった',
      en: 'MAKE IT LEGIBLE',
      note: '内容だけでなく、見せ方・順番・言葉まで含めて届ける。',
      words: ['伝える', '共有', 'デザイン', '広報', '告知', 'コンテンツ', '文章', '画像', 'レビュー', '見せる', '説明', 'design', 'communication', 'editorial']
    },
    {
      id: 'protect',
      code: '06',
      label: '自分の情報を守りたかった',
      en: 'KEEP IT PRIVATE',
      note: '便利さを残しながら、公開範囲とデータの持ち方を選ぶ。',
      words: ['守る', '暗号', '非公開', '本人', '認証', 'private', 'e2ee', 'access', 'security', '秘密', '限定']
    }
  ];

  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
  }[char]));
  const attr = (value) => esc(value).replace(/'/g, '&#39;');
  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFKC');
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let renderingAtlas = false;
  let viewTransitionGuard = false;

  function scoreTheme(project, theme) {
    const haystack = normalize([
      project.title,
      project.subtitle,
      project.summary,
      project.friction,
      project.currentAnswer,
      ...(project.verbs || []),
      ...(project.makingPrinciples || []),
      ...(project.portfolioFamilies || []),
      ...(project.technologies || [])
    ].filter(Boolean).join(' '));
    return theme.words.reduce((score, word) => score + (haystack.includes(normalize(word)) ? 1 : 0), 0);
  }

  function themeFor(project) {
    let best = THEME_DEFS[0];
    let bestScore = -1;
    THEME_DEFS.forEach((theme) => {
      let score = scoreTheme(project, theme);
      if (project.type === 'learning-tool' && theme.id === 'practice') score += 2;
      if (project.type === 'design-system' && theme.id === 'communicate') score += 1;
      if (project.type === 'data-tool' && theme.id === 'compare') score += 1;
      if (project.type === 'chrome-extension' && theme.id === 'reduce') score += 1;
      if ((project.visibility === 'private' || project.sourceVisibility === 'private') && theme.id === 'protect') score += 2;
      if (score > bestScore) {
        best = theme;
        bestScore = score;
      }
    });
    return best;
  }

  function applyIdentity() {
    document.documentElement.classList.add('friction-atlas-enabled');
    document.body?.classList.add('friction-atlas');

    const title = document.querySelector('#hero-title');
    if (title) title.innerHTML = '<span>不便を、</span><span>つくって解く。</span>';

    const lead = document.querySelector('.hero-lead');
    if (lead) lead.textContent = '日常で引っかかった小さな摩擦から生まれた、制作物の記録。';

    const eyebrow = document.querySelector('.hero .eyebrow');
    if (eyebrow) eyebrow.textContent = 'FRICTION ATLAS / BUILD DIARY';

    const heroAction = document.querySelector('.hero-actions [data-view-button="shelf"]');
    if (heroAction) heroAction.textContent = '何を作ったか見る';

    const note = document.querySelector('.hero-note');
    if (note && !note.dataset.atlasCopy) {
      note.dataset.atlasCopy = 'true';
      note.innerHTML = '<span class="note-pin" aria-hidden="true"></span><p><strong>完成品の展示ではなく、</strong><br>「なんで作ったん？」から読む。</p><small>WHY → WHEN → WHAT</small>';
    }

    const currentTitle = document.querySelector('#current-note-title');
    if (currentTitle) currentTitle.textContent = 'この地図の読み方';
    const currentEyebrow = document.querySelector('.current-note .eyebrow');
    if (currentEyebrow) currentEyebrow.textContent = 'HOW TO READ';
    const currentNote = document.querySelector('[data-current-note]');
    if (currentNote) currentNote.textContent = '同じ制作物を「なぜ作ったか」「いつ作ったか」「何を作ったか」の3つのレンズで見ます。見た目が変わるときには、必ずデータ上の理由があります。';

    const explorerTitle = document.querySelector('#explorer-title');
    if (explorerTitle) explorerTitle.textContent = '3つのレンズで見る';
    const explorerEyebrow = document.querySelector('.explorer-heading .eyebrow');
    if (explorerEyebrow) explorerEyebrow.textContent = 'THREE LENSES';

    relabelViews();
    injectLensIntro();
  }

  function relabelViews() {
    const labels = {
      timeline: { nav: 'いつ', title: 'いつ', small: 'WHEN / 時間で見る' },
      map: { nav: 'なぜ', title: 'なぜ', small: 'WHY / 不便からたどる' },
      shelf: { nav: '何を', title: '何を', small: 'WHAT / 一覧から探す' }
    };
    document.querySelectorAll('[data-view-button]').forEach((button) => {
      const copy = labels[button.dataset.viewButton];
      if (!copy || button.closest('.hero-actions')) return;
      if (button.classList.contains('view-chip')) {
        const span = button.querySelector('span');
        const small = button.querySelector('small');
        if (span) span.textContent = copy.title;
        if (small) small.textContent = copy.small;
        button.setAttribute('aria-label', `${copy.title}：${copy.small}`);
      } else if (button.classList.contains('nav-button')) {
        button.textContent = copy.nav;
      }
    });
  }

  function injectLensIntro() {
    const heading = document.querySelector('.explorer-heading');
    if (!heading || document.querySelector('[data-atlas-lens-intro]')) return;
    const intro = document.createElement('p');
    intro.className = 'atlas-lens-intro';
    intro.dataset.atlasLensIntro = 'true';
    intro.innerHTML = '<strong>同じ制作物、違う見え方。</strong><br>視点を切り替えると、時期・動機・用途の関係が変わります。';
    heading.insertAdjacentElement('afterend', intro);
  }

  function filteredProjectsFromUrl() {
    const params = new URLSearchParams(location.search);
    const q = normalize(params.get('q') || '');
    const verb = params.get('verb') || '';
    const type = params.get('type') || '';
    const doc = params.get('doc') || '';
    return projects().filter((project) => {
      const text = normalize([
        project.title, project.subtitle, project.summary, project.friction,
        ...(project.verbs || []), ...(project.technologies || [])
      ].join(' '));
      return (!q || text.includes(q))
        && (!verb || (project.verbs || []).includes(verb))
        && (!type || project.type === type)
        && (!doc || project.documentationState === doc);
    });
  }

  function projectCard(project) {
    const theme = themeFor(project);
    const date = String(project.startedAt || project.createdAt || '').replace(/-/g, '.');
    return `
      <article class="atlas-project" data-atlas-project="${attr(project.id)}" data-atlas-theme="${attr(theme.id)}">
        <button type="button" class="atlas-project-main" data-atlas-open="${attr(project.id)}">
          <span class="atlas-project-meta"><span>${esc(date || 'DATE TBD')}</span><span>${esc(project.type || '')}</span></span>
          <h4>${esc(project.title)}</h4>
          <p class="atlas-friction"><span>FRICTION</span>${esc(project.friction || project.summary || '作ったきっかけを整理中。')}</p>
          <span class="atlas-open-label">CASE FILE <span aria-hidden="true">↗</span></span>
        </button>
      </article>`;
  }

  function renderAtlas() {
    if (renderingAtlas) return;
    const active = document.querySelector('.view-chip.is-active[data-view-button="map"], .nav-button.is-active[data-view-button="map"]');
    const panel = document.querySelector('[data-view-panel]');
    if (!active || !panel || panel.querySelector('[data-friction-atlas]')) return;
    if (!panel.querySelector('.map-layout, .map-mobile-list')) return;

    renderingAtlas = true;
    const list = filteredProjectsFromUrl();
    const grouped = new Map(THEME_DEFS.map((theme) => [theme.id, []]));
    list.forEach((project) => grouped.get(themeFor(project).id).push(project));

    panel.innerHTML = `
      <section class="friction-atlas-view" data-friction-atlas>
        <header class="atlas-header">
          <div>
            <p class="eyebrow">WHY / FRICTION ATLAS</p>
            <h3>何に引っかかって、<br>何を作ったのか。</h3>
          </div>
          <p>技術ではなく、<strong>作る前にあった不便</strong>で制作物を並べ直します。カードを選ぶと、その不便から現在の答えまでを読めます。</p>
        </header>
        <div class="atlas-clusters">
          ${THEME_DEFS.map((theme) => {
            const items = grouped.get(theme.id) || [];
            return `
              <section class="atlas-cluster" data-atlas-cluster="${attr(theme.id)}">
                <header class="atlas-cluster-head">
                  <span class="atlas-cluster-number">${theme.code}</span>
                  <div><p>${theme.en}</p><h3>${theme.label}</h3><small>${theme.note}</small></div>
                  <strong>${items.length}</strong>
                </header>
                <div class="atlas-projects">${items.map(projectCard).join('') || '<p class="atlas-empty">いまは該当する制作物なし。</p>'}</div>
              </section>`;
          }).join('')}
        </div>
      </section>`;

    bindAtlasCards();
    assignViewTransitionNames();
    renderingAtlas = false;
  }

  function openProject(id) {
    const params = new URLSearchParams(location.search);
    params.set('project', id);
    try {
      history.pushState({}, '', `${location.pathname}?${params}${location.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      location.href = `${location.pathname}?${params}${location.hash}`;
    }
  }

  function bindAtlasCards() {
    document.querySelectorAll('[data-atlas-open]').forEach((button) => {
      button.addEventListener('click', () => openProject(button.dataset.atlasOpen));
    });
  }

  function safeTransitionName(id) {
    return `atlas-${String(id || 'project').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  function assignViewTransitionNames() {
    const panel = document.querySelector('[data-view-panel]');
    if (!panel) return;
    const seen = new Set();
    panel.querySelectorAll('[data-atlas-project], [data-cat-item], .timeline-card, .project-card').forEach((surface) => {
      let id = surface.getAttribute('data-atlas-project') || surface.getAttribute('data-cat-item');
      if (!id) id = surface.querySelector('[data-project-open]')?.getAttribute('data-project-open');
      if (!id || seen.has(id)) return;
      seen.add(id);
      surface.style.viewTransitionName = safeTransitionName(id);
    });
  }

  function installViewTransitions() {
    if (!document.startViewTransition || reducedMotion()) return;
    document.addEventListener('click', (event) => {
      if (viewTransitionGuard) return;
      const button = event.target.closest('[data-view-button]');
      if (!button || button.closest('.hero-actions')) return;
      const target = button.dataset.viewButton;
      if (!['timeline', 'shelf', 'map'].includes(target)) return;
      if (button.classList.contains('is-active')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      assignViewTransitionNames();
      document.startViewTransition(async () => {
        viewTransitionGuard = true;
        button.click();
        viewTransitionGuard = false;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (target === 'map') renderAtlas();
        assignViewTransitionNames();
      });
    }, true);
  }

  function observeViews() {
    const panel = document.querySelector('[data-view-panel]');
    if (!panel) return;
    const observer = new MutationObserver(() => {
      relabelViews();
      if (document.querySelector('[data-view-button="map"].is-active')) renderAtlas();
      assignViewTransitionNames();
    });
    observer.observe(panel, { childList: true, subtree: false });
  }

  function boot() {
    if (!window.BUILD_DIARY_DATA || !document.querySelector('[data-view-panel]')) {
      setTimeout(boot, 80);
      return;
    }
    applyIdentity();
    observeViews();
    installViewTransitions();
    if (document.querySelector('[data-view-button="map"].is-active')) renderAtlas();
    assignViewTransitionNames();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
