(() => {
  'use strict';

  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  const partUrls = Array.from(
    { length: 7 },
    (_, index) => `.bootstrap/part-${String(index).padStart(2, '0')}.b64`
  );

  const extras = [
    {
      id: 'lineworks-scroll-copy',
      title: 'LINE WORKS Scroll & Copy',
      subtitle: 'トーク履歴のさかのぼり・抽出拡張',
      summary: 'LINE WORKSの長いトーク履歴をさかのぼり、複数形式で手元に保存するChrome拡張。',
      friction: '長いトークを手でスクロールし、あとから整理し直す作業が重かった。',
      firstBuild: '高速スクロール版から始め、途中停止後のコピーと構造化保存へ広げた。',
      currentAnswer: 'スクロール、収集、形式変換を一つにまとめた道具。',
      type: 'chrome-extension',
      verbs: ['記録する', '整理する'],
      status: 'active',
      visibility: 'local',
      featured: false,
      createdAt: '2026-05-01',
      createdAtPrecision: 'day',
      updatedAt: '2026-05-01',
      repositoryUrl: '',
      liveUrl: '',
      technologies: ['Chrome Extension', 'JavaScript'],
      documentationState: 'verified',
      map: { group: 'extension', x: 1320, y: 398 },
      relatedProjects: [],
      updates: [],
      aside: 'まず上へ行きたい日と、全部持って帰りたい日は、別の日だった。'
    },
    {
      id: 'lineworks-logger',
      title: 'LINE WORKS Logger',
      subtitle: 'トーク・メールのローカル記録拡張',
      summary: 'LINE WORKSのトークやメールを端末内に記録し、JSON・CSVとして持ち出すChrome拡張。',
      friction: '大量の連絡を画面上だけで追うと、あとから検索しにくかった。',
      firstBuild: '対象画面の情報を外部送信せず、ローカルへ蓄積する仕組みを作った。',
      currentAnswer: '業務連絡を自分で扱える記録データへ変える入口。',
      type: 'chrome-extension',
      verbs: ['記録する', '探す'],
      status: 'prototype',
      visibility: 'local',
      featured: false,
      createdAt: '2026-05',
      createdAtPrecision: 'month',
      updatedAt: '2026-05',
      repositoryUrl: '',
      liveUrl: '',
      technologies: ['Chrome Extension', 'JavaScript'],
      documentationState: 'verified',
      map: { group: 'extension', x: 1460, y: 398 },
      relatedProjects: [],
      updates: [],
      aside: '連絡は流れる。ログは流したくない。'
    },
    {
      id: 'x-auto-screenshot-scroll',
      title: 'X 自動スクリーンショット＆スクロール',
      subtitle: 'タイムライン連続撮影拡張',
      summary: 'Xを自動スクロールしながら連続撮影し、長いタイムラインをまとめて保存するChrome拡張。',
      friction: '一画面ずつスクロールして撮影する作業が終わらなかった。',
      firstBuild: 'スクロールと撮影を交互に実行する拡張を作った。',
      currentAnswer: 'データだけでなく、見た目ごとタイムラインを記録する道具。',
      type: 'chrome-extension',
      verbs: ['記録する', '集める'],
      status: 'dormant',
      visibility: 'local',
      featured: false,
      createdAt: '2025-06-02',
      createdAtPrecision: 'day',
      updatedAt: '2025-06-02',
      repositoryUrl: '',
      liveUrl: '',
      technologies: ['Chrome Extension', 'JavaScript'],
      documentationState: 'verified',
      map: { group: 'extension', x: 1180, y: 398 },
      relatedProjects: [],
      updates: [],
      aside: 'スクロールを自動化したら、撮る枚数まで自動で増えた。'
    }
  ];

  function buildDataPatchScript() {
    const extrasJson = JSON.stringify(extras).replace(/<\//g, '<\\/');
    return [
      '<script>',
      '(function(){',
      'var data=window.BUILD_DIARY_DATA;',
      'if(!data)return;',
      `var extras=${extrasJson};`,
      'var projectMap=new Map(data.projects.map(function(project){return [project.id,project];}));',
      'extras.forEach(function(project){projectMap.set(project.id,project);});',
      'data.projects=Array.from(projectMap.values());',
      "data.periods.forEach(function(period){if(period.id==='2026-05'){['lineworks-scroll-copy','lineworks-logger'].forEach(function(id){if(!period.projectIds.includes(id))period.projectIds.push(id);});}if(period.id==='2025-06'&&!period.projectIds.includes('x-auto-screenshot-scroll'))period.projectIds.push('x-auto-screenshot-scroll');});",
      "var portfolio=projectMap.get('build-diary');",
      "if(portfolio){portfolio.repositoryUrl='https://github.com/silovar-uk/worksportfolio';portfolio.liveUrl='https://silovar-uk.github.io/worksportfolio/';portfolio.updatedAt='2026-07-19';}",
      '})();',
      '<' + '/script>'
    ].join('');
  }

  function patchPortfolioHtml(html) {
    let patched = html
      .replace(
        '<span class="brand-mark" aria-hidden="true">d/</span>',
        '<img class="brand-mark" src="assets/favicon.svg" alt="" width="38" height="38">'
      )
      .replace(
        '.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--ink); font: 800 .8rem "Roboto Mono", monospace; transform: rotate(-3deg); background: var(--paper); }',
        '.brand-mark { display:block; width:38px; height:38px; object-fit:contain; flex:0 0 auto; }'
      )
      .replace(
        'href="assets/icons/favicon.ico" sizes="any"',
        'href="assets/favicon.svg" type="image/svg+xml"'
      );

    const oldFilters = [
      '<select data-verb-filter aria-label="目的で絞り込む">',
      '          <option value="">すべての目的</option>',
      '        </select>',
      '        <button type="button" class="subtle-button" data-clear-filter>全部出す</button>'
    ].join('\n');
    const newFilters = [
      '<select data-verb-filter aria-label="目的で絞り込む">',
      '          <option value="">すべての目的</option>',
      '        </select>',
      '        <select data-type-filter aria-label="種類で絞り込む"><option value="">すべての種類</option></select>',
      '        <select data-documentation-filter aria-label="整理状態で絞り込む"><option value="">すべての整理状態</option></select>',
      '        <button type="button" class="subtle-button" data-clear-filter>全部出す</button>'
    ].join('\n');
    if (patched.includes(oldFilters)) {
      patched = patched.replace(oldFilters, newFilters);
    }

    const dataStart = patched.indexOf('window.BUILD_DIARY_DATA =');
    if (dataStart < 0) {
      throw new Error('制作物データが見つかりません');
    }
    const dataScriptEnd = patched.indexOf('</script>', dataStart);
    if (dataScriptEnd < 0) {
      throw new Error('制作物データの終端が見つかりません');
    }
    const insertAt = dataScriptEnd + '</script>'.length;
    return patched.slice(0, insertAt) + buildDataPatchScript() + patched.slice(insertAt);
  }

  Promise.all(
    partUrls.map(async (url, index) => {
      status.textContent = `制作日記を組み立てています（${index + 1} / ${partUrls.length}）`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`データ取得失敗: ${response.status}`);
      }
      return response.text();
    })
  )
    .then((parts) => JSZip.loadAsync(parts.join(''), { base64: true }))
    .then((zip) => {
      const indexFile = zip.file('index.html');
      if (!indexFile) {
        throw new Error('ZIP内にindex.htmlがありません');
      }
      return indexFile.async('string');
    })
    .then(patchPortfolioHtml)
    .then((html) => {
      document.open();
      document.write(html);
      document.close();
    })
    .catch((error) => {
      console.error(error);
      status.classList.add('error');
      status.textContent = `制作日記を読み込めませんでした。エラー: ${error.message}`;
      retry.hidden = false;
    });
})();
