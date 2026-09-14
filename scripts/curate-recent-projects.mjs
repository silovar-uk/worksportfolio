import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const projectsUrl = new URL('data/projects.json', root);
const projects = JSON.parse(await readFile(projectsUrl, 'utf8'));

const curated = {
  dailyenglishchunks: {
    title: 'Daily English Chunks', subtitle: '意味のかたまりで読む英語チャンク練習',
    summary: '英語を単語ごとに訳さず、情景・意味・チャンク・確認・音読の順で読む練習を積み重ねる学習サイト。',
    icon: '🗣️', type: 'learning-tool', verbs: ['読む', '理解する', '話す'], status: 'active', documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage', 'GitHub Actions'], liveUrl: 'https://silovar-uk.github.io/dailyenglishchunks/'
  },
  l1l5analysis: {
    title: 'Argument Altitude', subtitle: '段落の抽象度から論証構造を読む分析ライブラリ',
    summary: 'Eric HayotのUneven U / Five Levels of Abstractionを参考に、論考を段落単位の抽象度と役割へ分解し、読むだけでなく書くときに構造を再利用するための学習・分析ツール。',
    friction: '文章の内容は理解できても、段落がどの抽象度で何の役割を果たしているかを、あとで使い直せる形では残せていなかった。',
    firstBuild: '論考をL5〜L1とCore Roleへ分解し、Library → Article → Section → Paragraphの構造で保存する静的Webツールとして作った。',
    currentAnswer: '本文そのものではなく、Section × L5〜L1のStructure MapとReverse Outlineで論証の骨格を見渡し、書くときに構造を取り出せる分析ライブラリ。',
    icon: '↕️', type: 'learning-tool', verbs: ['読む', '分析する', '書く'], status: 'active', visibility: 'public', featured: false,
    createdAt: '2026-09-13', createdAtPrecision: 'day', updatedAt: '2026-09-13', startedAt: '2026-09-13', startedAtPrecision: 'day', startedAtBasis: 'repository-created-at',
    repositoryUrl: 'https://github.com/silovar-uk/l1l5analysis', githubId: '1368066000', liveUrl: 'https://silovar-uk.github.io/l1l5analysis/',
    documentationState: 'verified', technologies: ['HTML', 'CSS', 'JavaScript', 'JSON', 'GitHub Pages'], relatedProjects: [], updates: [],
    searchAliases: ['Argument Altitude', 'L1 L5', 'L1〜L5', 'Uneven U', 'Five Levels of Abstraction', '文章構造', '論証構造', '段落分析', '抽象度', 'Eric Hayot'],
    portfolioFamilies: [], makingPrinciples: []
  },
  myessays: {
    title: 'My Essays', subtitle: '論文・エッセイ・レビューを育てる個人アーカイブ',
    summary: 'Markdownで書いた論考を、全文検索・分類・お気に入り・読書ビューとともに蓄積し、あとから読み直しやすくする公開アーカイブ。',
    icon: '📄', type: 'content-page', verbs: ['書く', '探す', '読み返す'], status: 'active', documentationState: 'verified',
    technologies: ['Markdown', 'HTML', 'JavaScript', 'GitHub Pages'], liveUrl: 'https://silovar-uk.github.io/myessays/'
  },
  sukan: {
    title: '数感', subtitle: '数字の勘を1分ずつ鍛えるミニゲーム',
    summary: '8問・最大60秒で、暗算だけでなく人口・地理・宇宙・人体など現実の数字の桁感まで練習できる数字ゲーム。',
    icon: '🔢', type: 'learning-tool', verbs: ['計算する', '見積もる', '鍛える'], status: 'active', documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage'], liveUrl: 'https://silovar-uk.github.io/sukan/'
  },
  myglossary: {
    title: 'My Glossary', subtitle: '学んだ言葉を使える形で残す個人用語集',
    summary: '定義・具体例・関連語・勘違い・出典をまとめ、検索、今日の1語、ランダム復習、ミニクイズで学んだ言葉を思い出せる用語集。',
    icon: '📚', type: 'learning-tool', verbs: ['調べる', '覚える', '復習する'], status: 'active', documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage'], liveUrl: 'https://silovar-uk.github.io/myglossary/'
  },
  techniques: {
    title: 'Techniques', subtitle: '「どうやるんやったっけ？」を取り戻す手順集',
    summary: 'PC・仕事・暮らしなどの小さな手順を、結論、手順、コピペ用コマンド、注意点、一次情報へのリンクとともに短く残す実用メモ。',
    icon: '🛠️', type: 'content-page', verbs: ['調べる', '実行する', '思い出す'], status: 'active', documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'GitHub Actions'], liveUrl: 'https://silovar-uk.github.io/techniques/'
  },
  'urawa-history-quiz': {
    title: 'URAWA HISTORY QUIZ', subtitle: 'クイズから浦和レッズの歴史を流れで学ぶ',
    summary: '1992〜2025のシーズン、選手、監督、ユニフォーム、出来事をDBでつなぎ、クイズを入口に浦和レッズの歴史を「点」ではなく「流れ」として学ぶWebアプリ。',
    friction: '年、選手、監督、ユニフォーム、出来事を個別に覚えても、それぞれがどの時代にどうつながっていたかを一続きの歴史として思い出しにくかった。',
    firstBuild: '1992〜2025の34シーズンを扱うDBとQuiz Engineを用意し、Question → Answer → Memory Hook → History → Next Questionの学習ループを実装した。',
    currentAnswer: 'クイズとHistoryを分断せず、正解後のMemory Hookや年・カテゴリ別の学習履歴から、事実のつながりを辿れるモバイル優先の歴史学習アプリ。',
    icon: '♦️', type: 'learning-tool', verbs: ['解く', '学ぶ', 'つなげる'], status: 'development', visibility: 'public', featured: false,
    createdAt: '2026-09-07', createdAtPrecision: 'day', updatedAt: '2026-09-07', startedAt: '2026-09-07', startedAtPrecision: 'day', startedAtBasis: 'repository-created-at',
    repositoryUrl: 'https://github.com/silovar-uk/urawa-history-quiz', githubId: '1359999028', liveUrl: 'https://silovar-uk.github.io/urawa-history-quiz/',
    documentationState: 'verified', technologies: ['HTML', 'CSS', 'JavaScript', 'JSON', 'localStorage', 'GitHub Pages'], relatedProjects: [], updates: [],
    searchAliases: ['URAWA HISTORY QUIZ', '浦和歴史クイズ', '浦和レッズ', '歴史クイズ', 'Urawa Reds', 'history quiz', 'レッズ歴史', 'シーズンクイズ'],
    portfolioFamilies: [], makingPrinciples: []
  },
  likewhat: {
    title: 'Like What?', subtitle: '曖昧な「〜っぽい」を設計原則へ変換するリファレンス',
    summary: 'Brand・Artist・Institution・Scene・Industry Clusterを横断し、UIパターンや視覚文法を比較して再利用できる設計原則へ変換するデザインライブラリ。',
    icon: '◫', type: 'design-system', verbs: ['探す', '比べる', '設計する'], status: 'active', featured: true, documentationState: 'verified',
    technologies: ['JavaScript', 'JSON', 'GitHub Actions'], liveUrl: 'https://silovar-uk.github.io/likewhat/'
  }
};

const map = new Map((Array.isArray(projects) ? projects : []).filter((project) => project?.id).map((project) => [project.id, project]));
let changed = false;
for (const [id, defaults] of Object.entries(curated)) {
  const current = map.get(id) || { id };
  const next = { ...defaults, ...current, id };
  if (JSON.stringify(next) !== JSON.stringify(current)) {
    map.set(id, next);
    changed = true;
  }
}

if (changed) {
  const nextProjects = [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  await writeFile(projectsUrl, `${JSON.stringify(nextProjects, null, 2)}\n`, 'utf8');
}
console.log(changed ? `Curated ${Object.keys(curated).length} recent projects in canonical registry.` : 'Recent project curation is already current.');
