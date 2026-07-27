(() => {
  'use strict';

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

    setHtml(document.querySelector('#hero-title'), '日常の小さな不便<br>から、小さな道具を作っている。');
    setText(
      document.querySelector('.hero-lead'),
      '普段の作業で気になったことを、WebアプリやChrome拡張にしています。ここでは、作ったものと更新の記録をまとめています。'
    );
    setText(document.querySelector('.hero-actions [data-view-button="timeline"]'), '年代順に見る');
    setText(document.querySelector('.hero-actions [data-random-button]'), 'ランダムで見る');

    setText(document.querySelector('.global-nav [data-view-button="timeline"]'), '年代順');
    setText(document.querySelector('.global-nav [data-view-button="shelf"]'), '一覧');
    setText(document.querySelector('.global-nav [data-view-button="map"]'), '関連');
    setText(document.querySelector('.global-nav [data-about-button]'), 'このページについて');

    setText(document.querySelector('.view-chip[data-view-button="timeline"] span'), '年代順');
    setText(document.querySelector('.view-chip[data-view-button="shelf"] span'), '一覧');
    setText(document.querySelector('.view-chip[data-view-button="map"] span'), '関連');

    setText(document.querySelector('#current-note-title'), '最近考えていること');
    setText(document.querySelector('#explorer-title'), '制作物を見る');

    const footerCopy = document.querySelector('.site-footer p:first-child');
    setText(footerCopy, '制作物と更新記録。');

    setText(document.querySelector('#about-title'), 'このページについて');
    const aboutParagraphs = document.querySelectorAll('.about-shell > p:not(.eyebrow)');
    setText(aboutParagraphs[0], '作ったものを、時期や種類ごとにまとめています。詳しい内容とGitHub、公開ページへのリンクを確認できます。');
    setText(aboutParagraphs[1], 'GitHubの公開リポジトリと、自作したChrome拡張を対象にしています。日付や説明を確認できていないものは、その旨を表示しています。');
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

  function applyDynamicCopy() {
    const count = total();
    setHtml(document.querySelector('.portfolio-wow-title'), `<strong>${count}</strong>件の制作物`);
    setText(document.querySelector('.portfolio-strata-head h3'), '制作年');
    setText(document.querySelector('.portfolio-pick-head h3'), '今日の1本');

    const statLabels = ['制作物', '種類', '制作年', 'お気に入り'];
    document.querySelectorAll('[data-wow-stats] .portfolio-wow-number span').forEach((element, index) => {
      if (statLabels[index]) setText(element, statLabels[index]);
    });

    const hints = document.querySelector('.portfolio-wow-hints');
    setHtml(hints, '<span><kbd>/</kbd> 検索</span><span><kbd>R</kbd> 別の作品</span><span>年を選ぶと一覧を絞り込み</span>');

    setText(document.querySelector('.catalog-taxonomy-head strong'), '種類');

    document.querySelectorAll('.loading').forEach((element) => setText(element, '制作物を読み込んでいます。'));
    document.querySelectorAll('.empty-state').forEach((element) => {
      setText(element.querySelector('h3'), '条件に合う制作物がありません。');
      setText(element.querySelector('p'), '検索や絞り込みの条件を変更してください。');
    });
    document.querySelectorAll('.friction-line strong').forEach((element) => setText(element, '作ったきっかけ：'));
    document.querySelectorAll('.shelf-heading span').forEach((element) => {
      const match = element.textContent.match(/(\d+)\s*TOOLS/i);
      if (match) setText(element, `${match[1]}件`);
    });

    document.querySelectorAll('.portfolio-pick-open,.catalog-random-actions .primary-action,.floating-random-actions .primary-action').forEach((element) => setText(element, '詳細を見る'));
    document.querySelectorAll('[data-wow-shuffle]').forEach((element) => setText(element, '別の作品'));
    document.querySelectorAll('.catalog-random-actions a,.floating-random-actions a').forEach((element) => {
      if (element.textContent.includes('すぐ使う')) setText(element, '公開ページ ↗');
    });

    replaceExactLabels();
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
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
