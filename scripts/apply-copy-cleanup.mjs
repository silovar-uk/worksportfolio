import { readFileSync, writeFileSync } from 'node:fs';

const path = 'index.html';
let html = readFileSync(path, 'utf8');

function replaceCopy(before, after) {
  if (html.includes(before)) html = html.replace(before, after);
}

replaceCopy(
  '<meta name="description" content="日常の小さな不便から生まれたツールと、その時に考えていたことを残す制作日記。">',
  '<meta name="description" content="作ったWebアプリやChrome拡張と、その更新記録をまとめています。">'
);
replaceCopy(
  '<meta property="og:description" content="日常の小さな不便から生まれた、小さな道具と制作の記録。">',
  '<meta property="og:description" content="作ったWebアプリやChrome拡張と、その更新記録。">'
);
replaceCopy('<title>つくって考えた｜制作日記</title>', '<title>制作物一覧｜つくって考えた</title>');

replaceCopy(
  '<h1 id="hero-title">日常の小さな不便から、<br>小さな道具を作っている。</h1>',
  '<h1 id="hero-title">日常の小さな不便<br>から、小さな道具を作っている。</h1>'
);
replaceCopy(
  '<p class="hero-lead">「まあ仕方ないか」で終わる引っかかりが気になると、まず作って試します。GitHubに残る初期コードから、いま手元で動くChrome拡張まで、その試作と改善を残す制作日記です。</p>',
  '<p class="hero-lead">普段の作業で気になったことを、WebアプリやChrome拡張にしています。ここでは、作ったものと更新の記録をまとめています。</p>'
);
replaceCopy('>年代順に読む</button>', '>年代順に見る</button>');
replaceCopy('>何か見せて</button>', '>ランダムで見る</button>');

replaceCopy('data-view-button="shelf">本棚</button>', 'data-view-button="shelf">一覧</button>');
replaceCopy('data-view-button="map">地図</button>', 'data-view-button="map">関連</button>');
replaceCopy('data-about-button>このページ</button>', 'data-about-button>このページについて</button>');
replaceCopy('<h2 id="current-note-title">最近の自分</h2>', '<h2 id="current-note-title">最近考えていること</h2>');
replaceCopy('<h2 id="explorer-title">三つの見方</h2>', '<h2 id="explorer-title">制作物を見る</h2>');
replaceCopy('<span>本棚</span><small>作品を選ぶ</small>', '<span>一覧</span><small>制作物を選ぶ</small>');
replaceCopy('<span>地図</span><small>興味をたどる</small>', '<span>関連</span><small>関連する制作物を見る</small>');
replaceCopy('<p>つくって考えた — 小さな不便と、その時点の答え。</p>', '<p>制作物と更新記録。</p>');

replaceCopy('<h2 id="about-title">これは、ポートフォリオ兼、人生の日記。</h2>', '<h2 id="about-title">このページについて</h2>');
replaceCopy(
  '<p>GitHubがコードを見る場所なら、このページは「なぜ作ったか」を見る場所です。完成品だけでなく、最初の違和感、使って分かったこと、今の答えを残します。</p>',
  '<p>作ったものを、時期や種類ごとにまとめています。詳しい内容とGitHub、公開ページへのリンクを確認できます。</p>'
);
replaceCopy(
  '<p>GitHub上の61リポジトリと、自作したChrome拡張を統合しています。日付が「ごろ」のものはGitHub上の作成順をもとにした暫定整理、点線の「ページ候補」は公開確認前のURLです。Bitly、ChatGPT、Claudeなど第三者が制作した拡張は含めていません。</p>',
  '<p>GitHubの公開リポジトリと、自作したChrome拡張を対象にしています。日付や説明を確認できていないものは、その旨を表示しています。</p>'
);

replaceCopy('制作日記を開いています。少しだけ棚が重い。', '制作物を読み込んでいます。');
replaceCopy('その棚、今は空です。', '条件に合う制作物がありません。');
replaceCopy('検索語か絞り込みを少し戻してください。', '検索や絞り込みの条件を変更してください。');
replaceCopy('上の条件を少し戻してください。', '検索や絞り込みの条件を変更してください。');
replaceCopy('<strong>最初の違和感：</strong>', '<strong>作ったきっかけ：</strong>');
html = html.replace(/\$\{items\.length\} TOOLS/g, '${items.length}件');

html = html.replaceAll('内容確認済み', '確認済み');
html = html.replaceAll('概要を仮整理', '内容を確認中');
html = html.replaceAll('思い出し待ち', '未確認');

if (!html.includes('copy-cleanup.css')) {
  html = html.replace('</head>', '<link rel="stylesheet" href="copy-cleanup.css"></head>');
}
if (!html.includes('copy-cleanup.js')) {
  html = html.replace('</body>', '<script src="copy-cleanup.js"></script></body>');
}

if (!html.includes('日常の小さな不便<br>から、小さな道具を作っている。')) {
  throw new Error('The hero line break was not applied.');
}
if (!html.includes('copy-cleanup.css') || !html.includes('copy-cleanup.js')) {
  throw new Error('The copy cleanup assets were not included.');
}

writeFileSync(path, html);
console.log('Applied natural copy and simplified presentation.');
