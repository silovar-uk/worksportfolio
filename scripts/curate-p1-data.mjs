import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const projectsPath = new URL('data/projects.json', root);
const configPath = new URL('data/portfolio-config.json', root);
const projects = JSON.parse(await readFile(projectsPath, 'utf8'));
const config = JSON.parse(await readFile(configPath, 'utf8'));
const byId = new Map(projects.map((project) => [project.id, project]));

function patch(id, values) {
  const project = byId.get(id);
  if (!project) throw new Error(`Missing canonical project: ${id}`);
  Object.assign(project, values);
}

patch('payment-case-manager', {
  type: 'chrome-extension'
});

patch('lineworks-scroll-copy', {
  startedAt: '2026-05-01',
  startedAtPrecision: 'day',
  startedAtBasis: 'manual-record'
});

patch('x-auto-screenshot-scroll', {
  startedAt: '2025-06-02',
  startedAtPrecision: 'day',
  startedAtBasis: 'manual-record'
});

patch('baseballquiz', {
  title: 'NPB QUIZ CLUB',
  subtitle: 'NPBを「知っている」から、もう一段詳しくする野球学習アプリ',
  summary: '現役NPB・MLB、12球団、歴史、制度、指標、観戦知識をクイズと選手名鑑で学び、不正解だけでなく「正解したけど自信なし」も間隔反復で復習できるブラウザ学習アプリ。',
  friction: '野球の基本ルールは知っていても、選手・球団文化・制度・数字を断片的に覚えるだけでは、観戦やニュースをもう一段深く理解するところまでつながりにくかった。',
  firstBuild: 'ブラウザ完結の野球クイズとして始め、問題データと復習状態をlocalStorageで持つ構成から育てた。',
  currentAnswer: 'Daily Five、134人の選手名鑑、211問の確認問題、1→3→7→14→30日の復習間隔、LEVEL / XPを組み合わせ、読む・解く・復習するを一つの学習ループにしている。',
  type: 'learning-tool',
  verbs: ['学ぶ', '解く', '復習する'],
  technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage'],
  documentationState: 'verified'
});

patch('convinitools', {
  title: 'テキスト便利変換ツール',
  subtitle: '文字整形と日程候補づくりを一つにまとめるChrome拡張',
  summary: '曜日・時間条件を選ぶ調整カレンダーと、Markdown変換、改行修正、全半角、HTMLタグ除去などの文字整形をChromeサイドパネルでまとめて使うユーティリティ。',
  friction: '日程候補を文章へ整える作業と、コピーしたテキストを用途に合わせて整形する作業が細かく繰り返され、その都度別の手順を使い分ける必要があった。',
  firstBuild: '文字変換の小さな機能群を一つのChrome拡張にまとめ、後から調整カレンダーを追加した。',
  currentAnswer: '週・月カレンダーで日付と時間条件を作り、条件カードで編集し、用途別の書式へまとめてコピーできる。文字整形機能も同じサイドパネルから呼び出せる。',
  type: 'chrome-extension',
  verbs: ['変換する', '整える', '作る'],
  technologies: ['Chrome Extension', 'JavaScript', 'Manifest V3'],
  documentationState: 'inferred',
  relatedProjects: [{ id: 'converter', relation: '文字変換・整形をすぐ使う' }]
});

patch('quicklinksexpansion', {
  title: 'Quick Project Links',
  subtitle: '仕事リンク・REDS検索・プロンプト・Log RelayをまとめるChrome拡張',
  summary: '頻繁に使う仕事リンクを検索して開くLinks、REDS向け検索、定型Promptの保存・コピー、短いメモを後で整理するLog Relayを一つのChrome拡張にまとめた個人用ランチャー。',
  friction: 'よく使う仕事リンク、検索、プロンプト、短いメモへ戻るたびに入口が分かれ、必要なものを呼び出すまでの小さな摩擦が積み重なっていた。',
  firstBuild: '保存した仕事リンクを検索してすぐ開くLinks機能を核に、検索・Prompt・Log Relayへ責務を広げた。',
  currentAnswer: 'Chromeのサイドパネルとショートカットを入口に、Links / REDS / Prompt / LOGの4モードを決定論的な操作で切り替え、capture now, organize laterまで同じ拡張内で扱う。',
  type: 'chrome-extension',
  verbs: ['探す', '開く', '記録する'],
  technologies: ['Chrome Extension', 'JavaScript', 'Manifest V3'],
  documentationState: 'inferred',
  relatedProjects: [{ id: 'quicklinks', relation: 'リンクやプロンプトをすぐ呼び出す' }]
});

patch('myessays', {
  friction: 'MarkdownとGitHubで論考を蓄積できても、増えた文章を検索し、読み返し、派生版や読書状態まで同じ単位で管理する体験は別途必要だった。',
  firstBuild: '日本語Markdownを正本として論文・エッセイ・レビューを一覧から読める個人アーカイブとして始めた。',
  currentAnswer: '日本語Markdownを正本に、全文検索、Reader、English Mix / Español Mix、Argument Structure、読書状態を記事IDで束ねる個人アーカイブとして運用している。'
});

config.hiddenIds = Array.from(new Set([...(config.hiddenIds || []), 'keygridexpansion']));

await writeFile(projectsPath, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log('Applied P1 metadata curation: 6 project records updated, 2 chronology gaps synced, 1 empty source hidden.');
