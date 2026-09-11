import { readFile, writeFile } from 'node:fs/promises';

const projectsUrl = new URL('../data/projects.json', import.meta.url);
const projects = JSON.parse(await readFile(projectsUrl, 'utf8'));

const patches = {
  quicklinks: {
    title: 'Quick Links',
    subtitle: '仕事リンクを保存・検索・再発見するWeb/PWA',
    summary: '仕事やプロジェクトごとのリンクを保存・検索し、履歴やランダム表示からすぐ開き直せる、ブラウザ完結のリンクランチャー。URL貼り付けからページ情報を取得して追加できる。',
    friction: '仕事ごとに開くページが違い、ブックマークの階層を毎回たどっていた。',
    firstBuild: 'プロジェクト別にリンクを保存し、ブラウザからすぐ開き直せるローカル保存のリンク集から始めた。',
    currentAnswer: 'Web/PWAでリンクの追加・検索・履歴・ランダム再発見までまとめ、ブックマークの階層をたどらず作業文脈へ戻れるランチャー。',
    type: 'utility',
    verbs: ['保存する', '探す', '開く'],
    status: 'active',
    technologies: ['HTML', 'CSS', 'JavaScript', 'PWA', 'Local Storage'],
    documentationState: 'verified',
    relatedProjects: [
      { id: 'tabshelter', relation: 'ブラウザ作業の文脈を戻す' },
      { id: 'quicklinksexpansion', relation: '同じリンク呼び出し課題をChrome拡張で解く' }
    ],
    updates: [],
    searchAliases: ['Quick Links', 'quicklinks', 'リンク管理', 'リンクランチャー', 'ブックマーク', 'PWA', 'ランダムリンク']
  },
  quicklinksexpansion: {
    title: 'Quick Project Links｜Chrome Extension',
    subtitle: '仕事リンク・REDS検索・プロンプト・Log RelayをまとめるChrome拡張',
    summary: '頻繁に使う仕事リンクを検索して開くLinks、REDS向け検索、定型Promptの保存・コピー、短いメモを後で整理するLog Relayを一つのChrome拡張にまとめた個人用ランチャー。',
    friction: 'よく使う仕事リンク、検索、プロンプト、短いメモへ戻るたびに入口が分かれ、必要なものを呼び出すまでの小さな摩擦が積み重なっていた。',
    firstBuild: '保存した仕事リンクを検索してすぐ開くLinks機能を核に、検索・Prompt・Log Relayへ責務を広げた。',
    currentAnswer: 'Chromeのサイドパネルとショートカットを入口に、Links / REDS / Prompt / LOGの4モードを決定論的な操作で切り替え、capture now, organize laterまで同じ拡張内で扱う。',
    type: 'chrome-extension',
    verbs: ['探す', '開く', '記録する'],
    status: 'active',
    technologies: ['Chrome Extension', 'JavaScript', 'Manifest V3'],
    documentationState: 'verified',
    relatedProjects: [
      { id: 'quicklinks', relation: '同じリンク呼び出し課題をWeb/PWAで解く' }
    ],
    searchAliases: ['Quick Project Links', 'quicklinksexpansion', 'Chrome Extension', 'Links', 'REDS', 'Prompt', 'Log Relay']
  },
  converter: {
    title: 'IMAGE FORGE',
    subtitle: '16:9画像変換とfavicon一括生成をブラウザ内で完結',
    summary: '画像を16:9へ整え、PNG/JPGのサイズ調整やfavicon.ico・PWAアイコン・設置タグの一括生成までブラウザ内で行うWebツール。',
    friction: '画像の16:9化やfavicon一式の作成を、用途ごとに別ツールや手作業で処理していた。',
    firstBuild: '画像を16:9へ整えるブラウザツールとして作り、favicon pack生成を統合した。',
    currentAnswer: '元画像を選ぶだけで16:9変換とfavicon pack生成を同じ画面で完結し、画像データを外部へ送らずブラウザ内で処理する。',
    type: 'utility',
    verbs: ['変換する', '生成する', '整える'],
    status: 'active',
    technologies: ['HTML', 'JavaScript', 'PWA', 'JSZip', 'Tailwind CSS'],
    documentationState: 'verified',
    relatedProjects: [],
    updates: [],
    searchAliases: ['IMAGE FORGE', 'image forge', '16:9', '画像変換', 'favicon', 'favicon generator', 'PWA icon', 'アイコン生成']
  },
  convinitools: {
    title: 'テキスト便利変換ツール｜Chrome Extension',
    subtitle: '文字整形と日程候補づくりを一つにまとめるChrome拡張',
    summary: '曜日・時間条件を選ぶ調整カレンダーと、Markdown変換、改行修正、全半角、HTMLタグ除去などの文字整形をChromeサイドパネルでまとめて使うユーティリティ。',
    type: 'chrome-extension',
    status: 'active',
    technologies: ['Chrome Extension', 'JavaScript', 'Manifest V3'],
    documentationState: 'verified',
    relatedProjects: [],
    searchAliases: ['テキスト便利変換ツール', 'convinitools', 'text converter', '調整カレンダー', '文字整形', 'Chrome Extension']
  }
};

const seen = new Set();
for (const project of projects) {
  const patch = patches[project?.id];
  if (!patch) continue;
  seen.add(project.id);
  Object.assign(project, patch);
  if (project.id === 'quicklinks' || project.id === 'converter') delete project.extension;
}

const missing = Object.keys(patches).filter((id) => !seen.has(id));
if (missing.length) throw new Error(`Project identity migration could not find: ${missing.join(', ')}`);

await writeFile(projectsUrl, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
console.log(`Migrated project identities: ${[...seen].join(', ')}`);
