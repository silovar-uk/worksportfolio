import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
}[char]));

const config = readJson('data/portfolio-config.json');
const canonicalProjects = readJson('data/projects.json');
const periods = readJson('data/periods.json');
const settings = readJson('data/settings.json');
const projectStartDates = readJson('data/project-start-dates.json');
const catalog = readJson('data/catalog.json');
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];

const cssAssets = [
  'catalog.css', 'taxonomy.css', 'floating-random.css', 'wow.css', 'random-three.css',
  'comparison-view.css', 'motion.css', 'marks.css', 'shelf-priority.css', 'favorites.css', 'copy-cleanup.css',
  'friction-atlas.css', 'live-index.css', 'shell.css'
];
const jsAssets = [
  'data-audit.js', 'catalog.js', 'catalog-visibility.js', 'catalog-search-redesign.js', 'taxonomy.js', 'floating-random.js',
  'wow.js', 'random-three.js', 'comparison-view.js', 'wow-stage.js', 'motion.js', 'marks.js',
  'shelf-priority.js', 'favorites.js', 'favorite-catalog.js', 'copy-cleanup.js', 'friction-atlas.js', 'live-index.js'
];

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
    defaultView: config.defaultView || settings.defaultView || 'shelf',
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

function applyStaticShell(html) {
  const heroTitle = String(settings.heroTitle || '').trim();
  const heroLead = String(settings.heroLead || '').trim();
  if (!heroTitle || !heroLead) throw new Error('data/settings.json must define heroTitle and heroLead.');

  html = replaceRequired(
    html,
    /<h1 id="hero-title">[\s\S]*?<\/h1>/,
    `<h1 id="hero-title">${escapeHtml(heroTitle)}</h1>`,
    'hero title'
  );
  html = replaceRequired(
    html,
    /<p class="hero-lead">[\s\S]*?<\/p>/,
    `<p class="hero-lead">${escapeHtml(heroLead)}</p>`,
    'hero lead'
  );

  if (!html.includes('data-header-search-input')) {
    const navMarker = '      <nav class="global-nav" aria-label="主なメニュー">';
    const searchMarkup = `      <div class="header-search" data-header-search>\n        <label class="header-search-label">\n          <span class="sr-only">制作物を検索</span>\n          <input class="header-search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="制作物を検索" data-header-search-input aria-autocomplete="list" aria-expanded="false" aria-controls="header-search-panel">\n          <span class="header-search-icon" aria-hidden="true">⌕</span>\n        </label>\n        <div class="header-search-panel" id="header-search-panel" data-header-search-panel role="listbox" aria-label="検索候補" hidden>\n          <div class="header-search-list" data-header-search-list></div>\n        </div>\n      </div>\n`;
    if (!html.includes(navMarker)) throw new Error('Header navigation marker not found.');
    html = html.replace(navMarker, `${searchMarkup}${navMarker}`);
  }

  return html;
}

let html = readFileSync(join(root, 'src/index.template.html'), 'utf8');
if (!html.includes('window.BUILD_DIARY_DATA = __BUILD_DIARY_DATA__;')) {
  throw new Error('src/index.template.html is missing BUILD_DIARY_DATA placeholder.');
}

html = applyStaticShell(html);
const diary = buildDiaryData();
html = html.replace('__BUILD_DIARY_DATA__', scriptJson(diary));
const runtimeBlock = `<script data-worksportfolio-runtime>window.WORKS_PORTFOLIO_CONFIG=${scriptJson(config)};window.WORKS_PORTFOLIO_REPOSITORIES=${scriptJson(repositories)};window.WORKS_PORTFOLIO_START_DATES=${scriptJson(projectStartDates)};<\/script>`;
const dataScriptEnd = html.indexOf('</script>', html.indexOf('window.BUILD_DIARY_DATA'));
if (dataScriptEnd < 0) throw new Error('Inline project data script was not closed.');
html = html.slice(0, dataScriptEnd + 9) + runtimeBlock + html.slice(dataScriptEnd + 9);

const generatedAt = catalog.generatedAt || new Date().toISOString();
const stylesheetTags = cssAssets.map((path) => `<link rel="stylesheet" href="${assetUrl(path)}">`).join('');
const scriptTags = jsAssets.map((path) => `<script src="${assetUrl(path)}"><\/script>`).join('');
html = html.replace('</head>', `<meta name="worksportfolio-generated-at" content="${generatedAt}"><meta name="worksportfolio-assets-version" content="${assetVersion}">${stylesheetTags}<style>.recent-updates{display:none!important}</style></head>`);
html = html.replace('</body>', `${scriptTags}</body>`);

if (/jszip|loader\.js/i.test(html)) throw new Error('The generated page still depends on the runtime bootstrap loader.');
for (const asset of ['shell.css', 'catalog-search-redesign.js', 'shelf-priority.js', 'floating-random.js', 'random-three.js', 'comparison-view.js', 'favorites.js', 'favorite-catalog.js', 'friction-atlas.js', 'live-index.js']) {
  if (!html.includes(asset)) throw new Error(`The generated page is missing ${asset}.`);
}
if (!html.includes(`<h1 id="hero-title">${escapeHtml(String(settings.heroTitle).trim())}</h1>`)) {
  throw new Error('The generated page does not contain the canonical hero title.');
}
if (!html.includes('data-header-search-input')) throw new Error('The generated page is missing static header search markup.');
if (!html.includes('window.BUILD_DIARY_DATA')) throw new Error('The generated page lost its project data.');
if (!html.includes('startedAt')) throw new Error('The generated page lost project start dates.');
if (html.includes('__BUILD_DIARY_DATA__')) throw new Error('Unresolved template placeholder remains.');

writeFileSync(join(root, 'index.html'), html);
console.log(`Generated static index.html from explicit sources (${Buffer.byteLength(html).toLocaleString('en-US')} bytes, ${repositories.length} repositories, ${diary.projects.length} visible pre-gate projects, assets ${assetVersion}).`);
