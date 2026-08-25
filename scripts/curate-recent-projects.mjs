import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const configUrl = new URL('data/portfolio-config.json', root);
const config = JSON.parse(await readFile(configUrl, 'utf8'));

const curated = {
  dailyenglishchunks: {
    title: 'Daily English Chunks',
    subtitle: '意味のかたまりで読む英語チャンク練習',
    summary: '英語を単語ごとに訳さず、情景・意味・チャンク・確認・音読の順で読む練習を積み重ねる学習サイト。',
    icon: '🗣️',
    type: 'learning-tool',
    verbs: ['読む', '理解する', '話す'],
    status: 'active',
    documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage', 'GitHub Actions'],
    liveUrl: 'https://silovar-uk.github.io/dailyenglishchunks/'
  },
  myessays: {
    title: 'My Essays',
    subtitle: '論文・エッセイ・レビューを育てる個人アーカイブ',
    summary: 'Markdownで書いた論考を、全文検索・分類・お気に入り・読書ビューとともに蓄積し、あとから読み直しやすくする公開アーカイブ。',
    icon: '📄',
    type: 'content-page',
    verbs: ['書く', '探す', '読み返す'],
    status: 'active',
    documentationState: 'verified',
    technologies: ['Markdown', 'HTML', 'JavaScript', 'GitHub Pages'],
    liveUrl: 'https://silovar-uk.github.io/myessays/'
  },
  sukan: {
    title: '数感',
    subtitle: '数字の勘を1分ずつ鍛えるミニゲーム',
    summary: '8問・最大60秒で、暗算だけでなく人口・地理・宇宙・人体など現実の数字の桁感まで練習できる数字ゲーム。',
    icon: '🔢',
    type: 'learning-tool',
    verbs: ['計算する', '見積もる', '鍛える'],
    status: 'active',
    documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage'],
    liveUrl: 'https://silovar-uk.github.io/sukan/'
  },
  myglossary: {
    title: 'My Glossary',
    subtitle: '学んだ言葉を使える形で残す個人用語集',
    summary: '定義・具体例・関連語・勘違い・出典をまとめ、検索、今日の1語、ランダム復習、ミニクイズで学んだ言葉を思い出せる用語集。',
    icon: '📚',
    type: 'learning-tool',
    verbs: ['調べる', '覚える', '復習する'],
    status: 'active',
    documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'localStorage'],
    liveUrl: 'https://silovar-uk.github.io/myglossary/'
  },
  techniques: {
    title: 'Techniques',
    subtitle: '「どうやるんやったっけ？」を取り戻す手順集',
    summary: 'PC・仕事・暮らしなどの小さな手順を、結論、手順、コピペ用コマンド、注意点、一次情報へのリンクとともに短く残す実用メモ。',
    icon: '🛠️',
    type: 'content-page',
    verbs: ['調べる', '実行する', '思い出す'],
    status: 'active',
    documentationState: 'verified',
    technologies: ['HTML', 'CSS', 'JavaScript', 'GitHub Actions'],
    liveUrl: 'https://silovar-uk.github.io/techniques/'
  },
  likewhat: {
    title: 'Like What?',
    subtitle: '曖昧な「〜っぽい」を設計原則へ変換するリファレンス',
    summary: 'Brand・Artist・Institution・Scene・Industry Clusterを横断し、UIパターンや視覚文法を比較して再利用できる設計原則へ変換するデザインライブラリ。',
    icon: '◫',
    type: 'design-system',
    verbs: ['探す', '比べる', '設計する'],
    status: 'active',
    featured: true,
    documentationState: 'verified',
    technologies: ['JavaScript', 'JSON', 'GitHub Actions'],
    liveUrl: 'https://silovar-uk.github.io/likewhat/'
  }
};

config.hiddenIds = Array.from(new Set([...(Array.isArray(config.hiddenIds) ? config.hiddenIds : []), 'tecniques']));
config.overrides = config.overrides && typeof config.overrides === 'object' ? config.overrides : {};

let changed = false;
for (const [id, defaults] of Object.entries(curated)) {
  const current = config.overrides[id] && typeof config.overrides[id] === 'object' ? config.overrides[id] : {};
  const next = { ...defaults, ...current };
  if (JSON.stringify(next) !== JSON.stringify(current)) {
    config.overrides[id] = next;
    changed = true;
  }
}

if (!Array.isArray(config.hiddenIds) || !config.hiddenIds.includes('tecniques')) changed = true;

if (changed) {
  await writeFile(configUrl, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`Curated ${Object.keys(curated).length} recent projects and hid the empty typo repository tecniques.`);
} else {
  console.log('Recent project curation is already current.');
}
