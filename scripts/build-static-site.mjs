import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const readText = (path) => readFileSync(join(root, path), 'utf8');
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
}[char]));
const escapeAttr = (value) => escapeHtml(value).replace(/'/g, '&#39;');
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const config = readJson('data/portfolio-config.json');
const canonicalProjects = readJson('data/projects.json');
const periods = readJson('data/periods.json');
const settings = readJson('data/settings.json');
const projectStartDates = readJson('data/project-start-dates.json');
const catalog = readJson('data/catalog.json');
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];

// One shell, one search, one catalog. Secondary experiments stay in the repository
// but are intentionally not shipped on the first-load path.
const coreCssAssets = ['catalog.css', 'shell.css', 'home-shell.css'];
const coreJsAssets = ['catalog.js', 'home-shell.js'];
const cssAssets = [...coreCssAssets];
const jsAssets = [...coreJsAssets];

const HOME_FRICTIONS = [
  { id: 'reduce', code: '01', label: '手間を減らす', note: 'クリック、移動、入力、切り替えを少なくする。', words: ['面倒', '手間', '操作', 'クリック', '移動', '入力', '切り替', '効率', '減ら', '便利', 'utility'] },
  { id: 'remember', code: '02', label: '覚えて戻る', note: 'その場で終わる情報を、あとから戻れる場所へ。', words: ['忘れ', '記録', '保存', '履歴', 'ログ', '辞書', 'メモ', 'アーカイブ', '思い出', '戻る', 'archive', 'memory'] },
  { id: 'practice', code: '03', label: '小さく学ぶ', note: '短く、何度も触れられる練習にする。', words: ['学ぶ', '練習', '復習', '反復', '問題', 'クイズ', '英語', '語彙', '音読', 'study', 'training', 'practice'] },
  { id: 'compare', code: '04', label: '比べて整理する', note: '差分や構造を頭の外へ出して確かめる。', words: ['比べ', '比較', '差分', '構造', '整理', '関係', '可視化', '分析', 'map', 'diff', 'フロー'] },
  { id: 'communicate', code: '05', label: '伝わり方を整える', note: '内容だけでなく、見せ方・順番・言葉まで考える。', words: ['伝える', '共有', 'デザイン', '広報', '告知', '文章', '画像', 'レビュー', '見せる', '説明', 'communication', 'editorial'] },
  { id: 'protect', code: '06', label: '情報を守る', note: '便利さを残しながら、公開範囲を選ぶ。', words: ['守る', '暗号', '非公開', '認証', 'private', 'security', '秘密', '限定', 'access'] }
];

function assertArchitectureContract() {
  const shell = readText('shell.css');
  const home = readText('home-shell.css');
  const search = readText('home-shell.js');
  for (const marker of ['.site-header{', '.header-inner{', '.header-search{', '.hero{', '.hero-copy h1{']) {
    if (!shell.includes(marker)) throw new Error(`shell.css lost canonical selector ${marker}`);
  }
  if (!home.includes('.home-redesign') || !home.includes('.home-featured-grid') || !home.includes('.home-friction-grid')) {
    throw new Error('home-shell.css must own the stable home discovery layout.');
  }
  if (!search.includes('window.WORKS_PORTFOLIO_SEARCH') || !search.includes('data-header-search-input')) {
    throw new Error('home-shell.js must own the shared search engine and Header Search behavior.');
  }
  const postBuild = readText('scripts/apply-copy-cleanup.mjs');
  if (postBuild.includes('writeFileSync')) {
    throw new Error('apply-copy-cleanup.mjs must validate output, not rewrite the generated page.');
  }
}

assertArchitectureContract();

function createAssetVersion(paths) {
  const hash = createHash('sha256');
  paths.forEach((path) => {
    hash.update(path);
    hash.update('\0');
    hash.update(readFileSync(join(root, path)));
    hash.update('\0');
  });
  return hash.digest('hex').slice(0, 12);
}

const assetVersion = createAssetVersion([...cssAssets, ...jsAssets]);
const assetUrl = (path) => `${path}?v=${assetVersion}`;
const hidden = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object'
  ? config.repositoryProjectIds
  : {};

const typeByName = [
  [/extension|quicklinks|tabshelter|logger/i, 'chrome-extension'],
  [/quiz|english|hangul|study|training|dictionary/i, 'learning-tool'],
  [/design|pattern|prompt/i, 'design-system'],
  [/analysis|dashboard|result|predict|calc|fourier/i, 'data-tool'],
  [/wiki|article|contents|vision/i, 'content-page']
];
const typeLabels = {
  'web-app': 'Webアプリ',
  'chrome-extension': 'Chrome拡張',
  'learning-tool': '学習ツール',
  'design-system': '設計・デザイン',
  'content-page': '文章・知識',
  'data-tool': '分析・データ',
  utility: '便利ツール',
  experiment: '実験',
  other: 'その他'
};

function cleanDate(value) { return value ? String(value).slice(0, 10) : ''; }
function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))); }
function inferType(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics.join(' ') : '';
  const text = [repo.name, repo.description, topics].filter(Boolean).join(' ');
  for (const [pattern, type] of typeByName) if (pattern.test(text)) return type;
  return 'web-app';
}

function buildDiaryData() {
  const map = new Map(
    (Array.isArray(canonicalProjects) ? canonicalProjects : [])
      .filter((project) => project?.id)
      .map((project) => [String(project.id), { ...project }])
  );

  for (const repo of repositories) {
    const repositoryId = repo?.name || repo?.id || '';
    if (!repositoryId) continue;
    const projectId = repositoryProjectIds[repositoryId] || repositoryId;
    const existing = map.get(projectId) || {};
    const start = projectStartDates[projectId] || projectStartDates[repositoryId] || {};
    const createdAt = cleanDate(repo.createdAt || repo.created_at);
    const updatedAt = cleanDate(repo.updatedAt || repo.pushedAt || repo.updated_at || createdAt);
    const language = repo.language || '';
    const repositoryUrl = repo.repositoryUrl || repo.html_url || `https://github.com/${config.owner || 'silovar-uk'}/${repositoryId}`;
    const liveUrl = repo.liveUrl || repo.homepage || existing.liveUrl || '';

    const project = {
      id: projectId,
      title: existing.title || repositoryId,
      subtitle: existing.subtitle || 'GitHubリポジトリ',
      summary: existing.summary || repo.description || 'GitHub上で管理している制作物。',
      friction: existing.friction || '',
      firstBuild: existing.firstBuild || '',
      currentAnswer: existing.currentAnswer || '',
      type: existing.type || inferType(repo),
      verbs: unique(existing.verbs || ['作る']),
      status: existing.status || (repo.archived ? 'dormant' : 'development'),
      visibility: existing.visibility || 'public',
      featured: Boolean(existing.featured),
      createdAt: existing.createdAt || createdAt,
      createdAtPrecision: existing.createdAtPrecision || 'day',
      updatedAt: updatedAt || existing.updatedAt || existing.createdAt || createdAt,
      startedAt: start.date || existing.startedAt || createdAt || existing.createdAt || '',
      startedAtPrecision: start.precision || existing.startedAtPrecision || existing.createdAtPrecision || 'day',
      startedAtBasis: start.basis || existing.startedAtBasis || (createdAt ? 'repository-created' : 'record-created'),
      repositoryUrl,
      liveUrl,
      technologies: unique([...(existing.technologies || []), ...(language ? [language] : [])]),
      documentationState: existing.documentationState || 'unreviewed',
      relatedProjects: Array.isArray(existing.relatedProjects) ? existing.relatedProjects : [],
      updates: Array.isArray(existing.updates) ? existing.updates : [],
      aside: existing.aside || '',
      searchAliases: unique(existing.searchAliases || []),
      portfolioFamilies: unique(existing.portfolioFamilies || []),
      makingPrinciples: unique(existing.makingPrinciples || []),
      ...existing,
      id: projectId,
      repositoryUrl,
      liveUrl,
      updatedAt: updatedAt || existing.updatedAt || existing.createdAt || createdAt,
      technologies: unique([...(existing.technologies || []), ...(language ? [language] : [])])
    };
    if (start.date) {
      project.startedAt = start.date;
      project.startedAtPrecision = start.precision || project.startedAtPrecision || 'day';
      project.startedAtBasis = start.basis || project.startedAtBasis || 'repository-history';
    }
    map.set(projectId, project);
  }

  let projects = [...map.values()].filter((project) => project?.id && !hidden.has(project.id));
  const valid = new Set(projects.map((project) => project.id));
  projects = projects.map((project) => ({
    ...project,
    relatedProjects: Array.isArray(project.relatedProjects)
      ? project.relatedProjects.filter((relation) => relation && valid.has(relation.id || relation.target))
      : []
  }));

  const cleanPeriods = (Array.isArray(periods) ? periods : []).map((period) => ({
    ...period,
    projectIds: (Array.isArray(period.projectIds) ? period.projectIds : []).filter((id) => valid.has(id))
  }));
  const cleanSettings = {
    ...(settings && typeof settings === 'object' ? settings : {}),
    defaultView: 'shelf',
    defaultSort: config.defaultSort || settings.defaultSort || 'created-desc',
    currentNote: 'GitHubの公開リポジトリ、手元の制作物、概要のみ公開しているPrivate制作物を整理しています。説明の確認状態は各制作物に表示しています。'
  };
  for (const key of ['featuredProjectIds', 'recentProjectIds']) {
    if (Array.isArray(cleanSettings[key])) cleanSettings[key] = cleanSettings[key].filter((id) => valid.has(id));
  }

  return { projects, periods: cleanPeriods, settings: cleanSettings };
}

function replaceRequired(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Static shell marker not found: ${label}.`);
  return html.replace(pattern, replacement);
}

function stripLegacyTopShellCss(html) {
  const open = html.indexOf('<style>');
  const close = html.indexOf('</style>', open);
  if (open < 0 || close < 0) throw new Error('Primary inline style block was not found.');

  let css = html.slice(open + 7, close);
  css = css.replace(
    /^[ \t]*\.section-shell,\s*\.header-inner\s*\{([^}]*)\}[ \t]*$/gm,
    '.section-shell {$1}'
  );

  const selectors = [
    '.site-header', '.header-inner', '.site-brand', '.brand-mark', '.global-nav', '.nav-button',
    '.nav-button:hover, .nav-button:focus-visible, .nav-button.is-active', '.hero', '.hero::before',
    '.hero-copy h1', '.hero-lead', '.hero-actions', '.hero-note', '.hero-note p', '.hero-note small',
    '.note-pin', '.hero-stats', '.hero-stats div', '.hero-stats dt', '.hero-stats dd'
  ];

  for (const selector of selectors) {
    const pattern = new RegExp(`^[ \\t]*${escapeRegExp(selector)}\\s*\\{[^}]*\\}[ \\t]*\\n?`, 'gm');
    css = css.replace(pattern, '');
  }
  for (const selector of ['.site-header', '.header-inner', '.hero', '.hero-copy h1', '.hero-lead']) {
    if (new RegExp(`${escapeRegExp(selector)}\\s*\\{`).test(css)) {
      throw new Error(`Legacy inline Top Shell CSS survived for ${selector}.`);
    }
  }
  return html.slice(0, open + 7) + css + html.slice(close);
}

function applyStaticShell(html) {
  const heroTitle = String(settings.heroTitle || '').trim();
  const heroLead = String(settings.heroLead || '').trim();
  if (!heroTitle || !heroLead) throw new Error('data/settings.json must define heroTitle and heroLead.');

  html = replaceRequired(html, /<h1 id="hero-title">[\s\S]*?<\/h1>/, `<h1 id="hero-title">${escapeHtml(heroTitle)}</h1>`, 'hero title');
  html = replaceRequired(html, /<p class="hero-lead">[\s\S]*?<\/p>/, `<p class="hero-lead">${escapeHtml(heroLead)}</p>`, 'hero lead');

  if (!html.includes('data-header-search-input')) {
    const navMarker = '      <nav class="global-nav" aria-label="主なメニュー">';
    const searchMarkup = `      <div class="header-search" data-header-search>\n        <label class="header-search-label">\n          <span class="sr-only">制作物を検索</span>\n          <input class="header-search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="制作物を検索" data-header-search-input aria-autocomplete="list" aria-expanded="false" aria-controls="header-search-panel">\n          <span class="header-search-icon" aria-hidden="true">⌕</span>\n        </label>\n        <div class="header-search-panel" id="header-search-panel" data-header-search-panel role="listbox" aria-label="検索候補" hidden>\n          <div class="header-search-list" data-header-search-list></div>\n        </div>\n      </div>\n`;
    if (!html.includes(navMarker)) throw new Error('Header navigation marker not found.');
    html = html.replace(navMarker, `${searchMarkup}${navMarker}`);
  }

  if (html.includes('<html lang="ja">')) html = html.replace('<html lang="ja">', '<html lang="ja" class="home-redesign">');
  else if (!/class="[^"]*home-redesign/.test(html)) throw new Error('Unable to install home-redesign class on html.');
  return html;
}

function normalizeThemeText(value) {
  return String(value || '').toLowerCase().normalize('NFKC');
}

function themeScore(project, theme) {
  const text = normalizeThemeText([
    project.title, project.subtitle, project.summary, project.friction,
    ...(project.verbs || []), ...(project.technologies || [])
  ].filter(Boolean).join(' '));
  let score = theme.words.reduce((sum, word) => sum + (text.includes(normalizeThemeText(word)) ? 1 : 0), 0);
  if (project.type === 'learning-tool' && theme.id === 'practice') score += 2;
  if (project.type === 'data-tool' && theme.id === 'compare') score += 1;
  if (project.type === 'chrome-extension' && theme.id === 'reduce') score += 1;
  return score;
}

function featuredProjects(diary) {
  const map = new Map(diary.projects.map((project) => [project.id, project]));
  const configured = (diary.settings.featuredProjectIds || []).map((id) => map.get(id)).filter(Boolean);
  const fallback = diary.projects
    .filter((project) => project.liveUrl || project.featured)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return unique([...configured.map((project) => project.id), ...fallback.map((project) => project.id)])
    .map((id) => map.get(id))
    .filter(Boolean)
    .slice(0, 4);
}

function homeSectionsMarkup(diary) {
  const featured = featuredProjects(diary);
  const featuredMarkup = featured.map((project) => `<article class="home-featured-card">
    <p class="home-featured-card-meta">${escapeHtml(typeLabels[project.type] || project.type || '制作物')} / ${escapeHtml(String(project.updatedAt || project.createdAt || '').replace(/-/g, '.'))}</p>
    <h3>${escapeHtml(project.title || project.id)}</h3>
    <p>${escapeHtml(project.summary || project.friction || '制作物の説明を整理中。')}</p>
    <div class="home-featured-actions">
      <button type="button" data-home-open="${escapeAttr(project.id)}">制作記録を見る</button>
      ${project.liveUrl ? `<a href="${escapeAttr(project.liveUrl)}" target="_blank" rel="noopener">公開ページ ↗</a>` : ''}
    </div>
  </article>`).join('');

  const frictionMarkup = HOME_FRICTIONS.map((theme) => {
    const count = diary.projects.filter((project) => themeScore(project, theme) > 0).length;
    return `<button type="button" class="home-friction-button" data-home-friction="${theme.id}" aria-label="${escapeAttr(theme.label)}に関係する制作物 ${count}件を見る">
      <span>${theme.code}</span><strong>${escapeHtml(theme.label)}</strong><b>${count}</b>
    </button>`;
  }).join('');

  return `<section class="home-start section-shell" aria-labelledby="home-start-title">
    <div class="home-section-head"><div><p class="eyebrow">START HERE</p><h2 id="home-start-title">いま見るなら</h2></div><p>全部を見る前に、方向の違う制作物を4つだけ。公開ページへ直接行くことも、制作記録を読むこともできます。</p></div>
    <div class="home-featured-grid">${featuredMarkup}</div>
  </section>
  <section class="home-frictions section-shell" aria-labelledby="home-frictions-title">
    <div class="home-section-head"><div><p class="eyebrow">WHY I MADE THEM</p><h2 id="home-frictions-title">何に困って作った？</h2></div><p>技術名ではなく、作る前にあった小さな引っかかりから制作物を探します。</p></div>
    <div class="home-friction-grid">${frictionMarkup}</div>
    <div class="home-surprise-row"><p>目的が決まっていないときは、過去の問題解決をひとつ引く。</p><button type="button" class="home-surprise" data-home-surprise>おまかせで1つ</button></div>
  </section>`;
}

function applyHomeSections(html, diary) {
  if (html.includes('class="home-start')) return html;
  const marker = '    <section class="explorer section-shell"';
  if (!html.includes(marker)) throw new Error('Explorer marker not found for home discovery sections.');
  html = html.replace(marker, `${homeSectionsMarkup(diary)}\n\n${marker}`);
  html = html.replace('<p class="eyebrow">EXPLORE</p>\n          <h2 id="explorer-title">制作物一覧</h2>', '<p class="eyebrow">ALL PROJECTS</p>\n          <h2 id="explorer-title">すべての制作物</h2>');
  return html;
}

let html = readFileSync(join(root, 'src/index.template.html'), 'utf8');
if (!html.includes('window.BUILD_DIARY_DATA = __BUILD_DIARY_DATA__;')) {
  throw new Error('src/index.template.html is missing BUILD_DIARY_DATA placeholder.');
}

html = stripLegacyTopShellCss(html);
html = applyStaticShell(html);
const diary = buildDiaryData();
html = applyHomeSections(html, diary);
html = html.replace('__BUILD_DIARY_DATA__', scriptJson(diary));
const runtimeBlock = `<script data-worksportfolio-runtime>window.WORKS_PORTFOLIO_CONFIG=${scriptJson(config)};window.WORKS_PORTFOLIO_REPOSITORIES=${scriptJson(repositories)};window.WORKS_PORTFOLIO_START_DATES=${scriptJson(projectStartDates)};<\/script>`;
const dataScriptEnd = html.indexOf('</script>', html.indexOf('window.BUILD_DIARY_DATA'));
if (dataScriptEnd < 0) throw new Error('Inline project data script was not closed.');
html = html.slice(0, dataScriptEnd + 9) + runtimeBlock + html.slice(dataScriptEnd + 9);

const generatedAt = catalog.generatedAt || new Date().toISOString();
const stylesheetTags = coreCssAssets.map((path) => `<link rel="stylesheet" href="${assetUrl(path)}">`).join('');
const scriptTags = coreJsAssets.map((path) => `<script src="${assetUrl(path)}"><\/script>`).join('');
html = html.replace('</head>', `<meta name="worksportfolio-generated-at" content="${generatedAt}"><meta name="worksportfolio-assets-version" content="${assetVersion}">${stylesheetTags}<style>.recent-updates{display:none!important}</style></head>`);
html = html.replace('</body>', `${scriptTags}</body>`);

if (/jszip|loader\.js/i.test(html)) throw new Error('The generated page still depends on the runtime bootstrap loader.');
for (const asset of ['shell.css', 'home-shell.css', 'catalog.css', 'home-shell.js', 'catalog.js']) {
  if (!html.includes(asset)) throw new Error(`The generated page is missing ${asset}.`);
}
for (const retired of ['live-index.js', 'friction-atlas.js', 'random-three.js', 'catalog-list-first.js', 'catalog-visibility.js']) {
  if (html.includes(retired)) throw new Error(`Retired runtime asset leaked into the core page: ${retired}.`);
}
if (html.includes('catalog-search-redesign.js')) throw new Error('Legacy search redesign must not be shipped.');
if (html.includes('data-audit.js')) throw new Error('Production page must not ship the data-audit runtime.');
if (!html.includes(`<h1 id="hero-title">${escapeHtml(String(settings.heroTitle).trim())}</h1>`)) throw new Error('The generated page does not contain the canonical hero title.');
if (!html.includes('data-header-search-input')) throw new Error('The generated page is missing static header search markup.');
if (!html.includes('data-home-friction="reduce"')) throw new Error('The generated page is missing static friction navigation.');
if (!html.includes('data-home-surprise')) throw new Error('The generated page is missing the surprise entry point.');
if (!html.includes('window.BUILD_DIARY_DATA')) throw new Error('The generated page lost its project data.');
if (!html.includes('startedAt')) throw new Error('The generated page lost project start dates.');
if (html.includes('__BUILD_DIARY_DATA__')) throw new Error('Unresolved template placeholder remains.');

writeFileSync(join(root, 'index.html'), html);
console.log(`Generated stable portfolio (${Buffer.byteLength(html).toLocaleString('en-US')} bytes, ${repositories.length} repositories, ${diary.projects.length} visible pre-gate projects, ${coreJsAssets.length} core JS, assets ${assetVersion}).`);
