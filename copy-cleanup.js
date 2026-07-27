(() => {
  'use strict';

  const LIST_MIGRATION_KEY = 'worksportfolio-default-list-v1';
  let scheduled = false;

  const projects = () => window.BUILD_DIARY_DATA?.projects || [];
  const total = () => window.WORKS_PORTFOLIO_AUDIT?.counts?.total || projects().length;

  function setText(target, value) {
    if (target && target.textContent !== value) target.textContent = value;
  }

  function setHtml(target, value) {
    if (target && target.innerHTML !== value) target.innerHTML = value;
  }

  function setMeta(name, value, property = false) {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    const element = document.querySelector(selector);
    if (element && element.getAttribute('content') !== value) element.setAttribute('content', value);
  }

  function applyStaticCopy() {
    if (document.title !== '制作物一覧｜つくって考えた') document.title = '制作物一覧｜つくって考えた';
    setMeta('description', '作ったWebアプリやChrome拡張と、その更新記録をまとめています。');
    setMeta('og:description', '作ったWebアプリやChrome拡張と、その更新記録。', true);

    setHtml(document.querySelector('#hero-title'), '小さな不便から、<br>小さな道具を作る');
    setText(
      document.querySelector('.hero-lead'),
      '普段の作業で気になったことを、WebアプリやChrome拡張にしています。ここでは、作ったものと更新の記録をまとめています。'
    );
    const heroAction = document.querySelector('.hero-actions [data-view-button]');
    if (heroAction) {
      heroAction.dataset.viewButton = 'shelf';
      setText(heroAction, '一覧を見る');
    }
    document.querySelector('.hero-actions [data-random-button]')?.remove();

    setText(document.querySelector('.global-nav [data-view-button="timeline"]'), '年代順');
    setText(document.querySelector('.global-nav [data-view-button="shelf"]'), '一覧');
    setText(document.querySelector('.global-nav [data-view-button="map"]'), '関連');
    setText(document.querySelector('.global-nav [data-about-button]'), 'このページについて');

    setText(document.querySelector('.view-chip[data-view-button="timeline"] span'), '年代順');
    setText(document.querySelector('.view-chip[data-view-button="shelf"] span'), '一覧');
    setText(document.querySelector('.view-chip[data-view-button="map"] span'), '関連');

    setText(document.querySelector('#current-note-title'), 'この一覧について');
    setText(
      document.querySelector('[data-current-note]'),
      'GitHubの公開リポジトリと、自作したChrome拡張を対象にしています。説明の確認状態は各制作物に表示しています。'
    );
    setText(document.querySelector('#explorer-title'), '制作物一覧');

    const footerCopy = document.querySelector('.site-footer p:first-child');
    setText(footerCopy, '制作物と更新記録。');

    setText(document.querySelector('#about-title'), 'このページについて');
    const aboutParagraphs = document.querySelectorAll('.about-shell > p:not(.eyebrow)');
    setText(aboutParagraphs[0], '作ったものを、時期や種類ごとにまとめています。詳しい内容とGitHub、公開ページへのリンクを確認できます。');
    setText(aboutParagraphs[1], '「確認済み」は説明と主なリンクを確認したもの、「内容を確認中」はGitHubの情報から整理したもの、「未確認」は基本情報のみのものです。');
  }

  function ensureListDefault() {
    const params = new URLSearchParams(location.search);
    if (params.has('view')) return;
    try {
      if (localStorage.getItem(LIST_MIGRATION_KEY)) return;
      localStorage.setItem(LIST_MIGRATION_KEY, '1');
    } catch (_) { /* 保存できない環境でも、その場では切り替える */ }
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

    article.querySelectorAll('.detail-section p').forEach((paragraph) => {
      const text = paragraph.textContent.trim();
      if (text === '初期版の記録は、これから追記する。') setText(paragraph, '初期版の記録は未確認です。');
      if (text === '履歴はこれから。最初から完璧だったわけではなく、記録がなかった。') setText(paragraph, '更新履歴は未確認です。');
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

  function applyDynamicCopy() {
    const count = total();
    setHtml(document.querySelector('.portfolio-wow-title'), `<strong>${count}</strong>件の制作物`);
    setText(document.querySelector('.portfolio-strata-head h3'), '制作年');

    const statLabels = ['制作物', '種類', '制作年', 'お気に入り'];
    document.querySelectorAll('[data-wow-stats] .portfolio-wow-number span').forEach((element, index) => {
      if (statLabels[index]) setText(element, statLabels[index]);
    });

    const hints = document.querySelector('.portfolio-wow-hints');
    setHtml(hints, '<span><kbd>/</kbd> 検索</span><span>年を選ぶと一覧を絞り込み</span>');

    setText(document.querySelector('.catalog-taxonomy-head strong'), '種類');

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

    document.querySelectorAll('.floating-random-actions .primary-action').forEach((element) => setText(element, '詳細を見る'));
    document.querySelectorAll('.floating-random-actions a').forEach((element) => {
      if (element.textContent.includes('すぐ使う')) setText(element, '公開ページ ↗');
    });

    replaceExactLabels();
    enhanceProjectDetail();
  }

  function apply() {
    scheduled = false;
    applyStaticCopy();
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
