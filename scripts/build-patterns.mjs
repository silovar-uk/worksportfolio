import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const audit = await readJson('data/pattern-audit.json');
const taxonomy = await readJson('data/pattern-taxonomy.json');
const rules = await readJson('data/pattern-merge-rules.json');
const payloads = await Promise.all((audit.candidateFiles || []).map(readJson));
const candidates = payloads.flatMap((payload) => payload.candidates || []);
const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
const categoryMap = new Map((taxonomy.categories || []).map((category) => [category.id, category]));

const categoryProfiles = {
  'interaction': {
    problem: '操作の途中で余計な判断や移動が増えると、作業の流れが切れやすい。',
    useWhen: ['頻繁に繰り返す入力・編集操作', 'スマホとPCの両方で直接操作する画面'],
    cautions: ['ショートカットや省略操作だけに依存せず、通常操作も残す。'],
    transferIdeas: ['入力フォーム', 'CMS', 'タスク管理', '編集ツール']
  },
  'navigation-search': {
    problem: '情報が増えるほど、場所や正式名称を知っている人しか目的地へ到達できなくなる。',
    useWhen: ['一覧件数が増えてきた', '初心者も検索する', '過去データを再発見したい'],
    cautions: ['検索・絞り込みの状態を複雑にしすぎず、解除方法を明確にする。'],
    transferIdeas: ['FAQ', 'ナレッジベース', '作品集', '商品・資料一覧']
  },
  'information-design': {
    problem: '情報量が増えると、重要度・順序・関係が同じ平面に並び、理解に時間がかかる。',
    useWhen: ['情報量が多い画面', '初心者向け説明', '比較・分類・状態を見せる'],
    cautions: ['構造化のためのラベルや箱を増やしすぎない。'],
    transferIdeas: ['レポート', 'ガイド', 'ダッシュボード', '学習教材']
  },
  'data-state': {
    problem: '保存状態やデータの意味が曖昧だと、更新・復元・移行の時に破損や取り違えが起きやすい。',
    useWhen: ['ブラウザ保存を使う', '履歴・お気に入り・進捗を持つ', 'データを取り込む'],
    cautions: ['スキーマ変更と既存データ移行をセットで設計する。'],
    transferIdeas: ['個人DB', '業務台帳', '学習ログ', '設定管理']
  },
  'resilience': {
    problem: '誤操作・外部障害・旧データ・端末差を正常系だけで扱うと、小さな失敗で作業全体が止まる。',
    useWhen: ['データを失うと困る', '外部APIやブラウザ機能へ依存する', '長期運用する'],
    cautions: ['フォールバックが通常系より複雑にならないよう、復旧経路も検証する。'],
    transferIdeas: ['バックアップ', 'インポート', '公開フロー', '編集履歴']
  },
  'account-security': {
    problem: '便利さを優先して保存・権限・公開範囲を広げると、必要以上の情報を扱うことになる。',
    useWhen: ['個人情報・業務情報を扱う', 'ブラウザ権限を要求する', '公開環境へ置く'],
    cautions: ['権限・保存・外部送信の理由を利用者に説明できる状態にする。'],
    transferIdeas: ['社内ツール', 'Chrome拡張', '応募フォーム', 'データ管理']
  },
  'visual-design': {
    problem: '見た目のルールが役割と結びついていないと、装飾が情報理解や操作を邪魔する。',
    useWhen: ['情報密度が高い', 'ブランドらしさを出したい', 'レスポンシブ対応する'],
    cautions: ['色・動きだけに意味を依存させず、文字や形でも補完する。'],
    transferIdeas: ['LP', 'ダッシュボード', 'エディタ', '長文ページ']
  },
  'microcopy': {
    problem: '短い文言が曖昧だと、利用者は機能そのものではなく言葉の意味を推測することになる。',
    useWhen: ['ボタン・状態名を付ける', '確認・注意・エラーを出す', '専門機能を一般利用者へ見せる'],
    cautions: ['短さだけを優先せず、操作後に何が起きるかを読み取れる言葉にする。'],
    transferIdeas: ['ボタン名', 'エラー文', '設定名', 'オンボーディング']
  },
  'feedback-motion': {
    problem: '処理中・成功・失敗・現在位置が見えないと、二重操作や不安が生まれる。',
    useWhen: ['保存や取得に待ち時間がある', '長い工程を進める', '状態変化をその場で伝えたい'],
    cautions: ['動きそのものを目的にせず、prefers-reduced-motionなど静かな代替も持つ。'],
    transferIdeas: ['ローディング', '保存状態', '進捗表示', '成功・失敗通知']
  },
  'architecture-automation': {
    problem: '同じ処理や情報を複数箇所で管理すると、変更時の不整合と運用負荷が増える。',
    useWhen: ['静的サイトを自動生成する', '複数形式へ出力する', '外部APIやビルド処理を使う'],
    cautions: ['自動化が壊れた時に原因と手動復旧方法を追えるようにする。'],
    transferIdeas: ['GitHub Actions', 'データ生成', 'PWA', 'コンテンツビルド']
  }
};

const verificationRank = { verified: 0, documented: 1, pending: 2 };
const worstVerification = (items) => items
  .map((item) => item.verification || 'pending')
  .sort((a, b) => (verificationRank[b] ?? 9) - (verificationRank[a] ?? 9))[0] || 'pending';
const unique = (values) => [...new Set(values.filter(Boolean))];

const claimed = new Map();
for (const group of rules.groups || []) {
  if (!group.id || !Array.isArray(group.members) || group.members.length < 2) {
    throw new Error(`Merge group must have id and at least two members: ${JSON.stringify(group)}`);
  }
  for (const candidateId of group.members) {
    if (!candidateMap.has(candidateId)) throw new Error(`Unknown merge member: ${candidateId}`);
    if (claimed.has(candidateId)) throw new Error(`Candidate ${candidateId} is in both ${claimed.get(candidateId)} and ${group.id}`);
    claimed.set(candidateId, group.id);
  }
}

function buildUsedIn(items) {
  const byProject = new Map();
  for (const item of items) {
    const current = byProject.get(item.projectId) || { projectId: item.projectId, candidateIds: [], sourceUrls: [] };
    current.candidateIds.push(item.id);
    current.sourceUrls.push(item.sourceUrl);
    byProject.set(item.projectId, current);
  }
  return [...byProject.values()].map((item) => ({
    projectId: item.projectId,
    candidateIds: unique(item.candidateIds),
    sourceUrls: unique(item.sourceUrls)
  }));
}

function categoriesFor(items) {
  const counts = new Map();
  const ordered = [];
  for (const item of items) {
    for (const category of item.categories || []) {
      if (!counts.has(category)) ordered.push(category);
      counts.set(category, (counts.get(category) || 0) + 1);
    }
  }
  return ordered.sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b));
}

function singletonPattern(candidate) {
  const categories = categoriesFor([candidate]);
  const primaryCategory = categories[0];
  const profile = categoryProfiles[primaryCategory] || categoryProfiles['information-design'];
  const label = categoryMap.get(primaryCategory)?.label || primaryCategory;
  return {
    id: candidate.id.replace('--', '-'),
    title: candidate.title,
    subtitle: candidate.officialName,
    officialName: candidate.officialName,
    summary: `「${candidate.title}」という工夫を、${label}の再利用可能な設計判断として整理したPattern。`,
    problem: profile.problem,
    solution: `「${candidate.title}」を設計ルールとして採用する。具体的な実装根拠は元制作物の ${candidate.officialName} に置く。`,
    useWhen: profile.useWhen,
    cautions: candidate.verification === 'verified'
      ? profile.cautions
      : [...profile.cautions, '現時点では作品説明ベースのため、転用前に実コードを再確認する。'],
    transferIdeas: profile.transferIdeas,
    categories,
    primaryCategory,
    projectIds: [candidate.projectId],
    sourceCandidateIds: [candidate.id],
    usedIn: buildUsedIn([candidate]),
    verification: candidate.verification,
    maturity: 'promoted-singleton'
  };
}

function mergedPattern(group) {
  const items = group.members.map((id) => candidateMap.get(id));
  const categories = categoriesFor(items);
  return {
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    officialName: group.officialName,
    summary: group.summary,
    problem: group.problem,
    solution: group.solution,
    useWhen: group.useWhen || [],
    cautions: group.cautions || [],
    transferIdeas: group.transferIdeas || [],
    categories,
    primaryCategory: categories[0],
    projectIds: unique(items.map((item) => item.projectId)),
    sourceCandidateIds: items.map((item) => item.id),
    usedIn: buildUsedIn(items),
    verification: worstVerification(items),
    maturity: 'consolidated'
  };
}

const patterns = [];
for (const group of rules.groups || []) patterns.push(mergedPattern(group));
for (const candidate of candidates) {
  if (!claimed.has(candidate.id)) patterns.push(singletonPattern(candidate));
}

for (const pattern of patterns) {
  const scored = patterns
    .filter((other) => other.id !== pattern.id)
    .map((other) => {
      const sharedCategories = other.categories.filter((category) => pattern.categories.includes(category)).length;
      const sharedProjects = other.projectIds.filter((projectId) => pattern.projectIds.includes(projectId)).length;
      return { id: other.id, score: sharedCategories * 3 + sharedProjects * 2 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5);
  pattern.relatedPatternIds = scored.map((item) => item.id);
  pattern.links = unique(pattern.usedIn.flatMap((item) => item.sourceUrls)).map((url) => ({ label: '実装・根拠', url }));
}

patterns.sort((a, b) => {
  const categoryCompare = a.primaryCategory.localeCompare(b.primaryCategory);
  return categoryCompare || a.title.localeCompare(b.title, 'ja');
});

const output = {
  schemaVersion: 1,
  generatedAt: audit.generatedAt,
  sourceCandidateCount: candidates.length,
  mergeGroupCount: (rules.groups || []).length,
  patternCount: patterns.length,
  principle: rules.principle,
  patterns
};

await writeFile(new URL('data/patterns.json', root), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Built ${patterns.length} formal patterns from ${candidates.length} candidates (${rules.groups.length} merge groups).`);
