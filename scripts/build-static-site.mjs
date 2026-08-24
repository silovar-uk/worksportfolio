import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');

const config = readJson('data/portfolio-config.json');
const manualProjects = readJson('data/manual-projects.json');
const manualProjectExtras = readJson('data/manual-projects-extra.json');
const manualProjectDailyLog = readJson('data/manual-projects-daily-log.json');
const manualProjectsMerged = [...manualProjects, ...manualProjectExtras, ...manualProjectDailyLog];
const projectStartDates = readJson('data/project-start-dates.json');
const catalog = readJson('data/catalog.json');
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];

const cssAssets = [
  'catalog.css', 'taxonomy.css', 'floating-random.css', 'wow.css', 'random-three.css',
  'comparison-view.css', 'motion.css', 'marks.css', 'shelf-priority.css', 'favorites.css', 'copy-cleanup.css'
];
const jsAssets = [
  'data-audit.js', 'catalog.js', 'catalog-visibility.js', 'taxonomy.js', 'floating-random.js',
  'wow.js', 'random-three.js', 'comparison-view.js', 'wow-stage.js', 'motion.js', 'marks.js',
  'shelf-priority.js', 'favorites.js', 'copy-cleanup.js'
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
const overrides = config.overrides && typeof config.overrides === 'object' ? config.overrides : {};
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

function extractDiaryData(html) {
  const marker = 'window.BUILD_DIARY_DATA =';
  const markerStart = html.indexOf(marker);
  if (markerStart < 0) throw new Error('BUILD_DIARY_DATA was not found in index.html.');
  const jsonStart = markerStart + marker.length;
  const scriptEnd = html.indexOf('</script>', jsonStart);
  if (scriptEnd < 0) throw new Error('The BUILD_DIARY_DATA script was not closed.');
  const raw = html.slice(jsonStart, scriptEnd).trim().replace(/;\s*$/, '');
  return { data: JSON.parse(raw), markerStart, jsonStart, scriptEnd };
}

function buildDiaryData(seed) {
  const diary = seed && typeof seed === 'object' ? seed : {};
  const seedProjects = Array.isArray(diary.projects) ? diary.projects : [];
  const publicProjectIds = new Set(repositories.map((repo) => {
    const repositoryId = repo?.name || repo?.id || '';
    return repositoryId ? (repositoryProjectIds[repositoryId] || repositoryId) : '';
  }).filter(Boolean));
  const manualIds = new Set(manualProjectsMerged.map((project) => project?.id ? String(project.id) : '').filter(Boolean));
  const allowed = new Set([...publicProjectIds, ...manualIds]);
  const map = new Map(seedProjects.filter((project) => project?.id && allowed.has(project.id)).map((project) => [project.id, { ...project }]));

  repositories.forEach((repo) => {
    const repositoryId = repo.name || repo.id;
    if (!repositoryId) return;
    const projectId = repositoryProjectIds[repositoryId] || repositoryId;
    const existing = map.get(projectId) || null;
    const override = overrides[repositoryId] || overrides[projectId] || {};
    const start = projectStartDates[projectId] || projectStartDates[repositoryId] || {};
    const createdAt = cleanDate(repo.createdAt || repo.created_at);
    const updatedAt = cleanDate(repo.updatedAt || repo.pushedAt || repo.updated_at || createdAt);
    const language = repo.language || '';
    const liveUrl = repo.liveUrl || repo.homepage || '';
    const repositoryUrl = repo.repositoryUrl || repo.html_url || `https://github.com/${config.owner || 'silovar-uk'}/${repositoryId}`;
    const base = existing ? { ...existing } : {
      id: projectId, title: repositoryId, subtitle: 'GitHubリポジトリ',
      summary: repo.description || 'GitHub上で管理している制作物。', friction: '', firstBuild: '', currentAnswer: '',
      type: inferType(repo), verbs: ['作る'], status: repo.archived ? 'dormant' : 'development', visibility: 'public',
      featured: false, createdAt, createdAtPrecision: 'day', updatedAt: updatedAt || createdAt,
      startedAt: start.date || createdAt, startedAtPrecision: start.precision || 'day',
      startedAtBasis: start.basis || 'repository-created', repositoryUrl, liveUrl,
      technologies: language ? [language] : [], documentationState: 'unreviewed', relatedProjects: [], updates: [], aside: ''
    };
    const merged = { ...base, ...override };
    merged.id = projectId;
    merged.repositoryUrl = override.repositoryUrl !== undefined ? override.repositoryUrl : repositoryUrl;
    merged.liveUrl = override.liveUrl !== undefined ? override.liveUrl : (liveUrl || base.liveUrl || '');
    merged.createdAt = override.createdAt || base.createdAt || createdAt;
    merged.updatedAt = override.updatedAt || updatedAt || base.updatedAt || merged.createdAt;
    merged.startedAt = override.startedAt || start.date || createdAt || base.startedAt || merged.createdAt;
    merged.startedAtPrecision = override.startedAtPrecision || start.precision || (start.date ? 'day' : '') || base.startedAtPrecision || merged.createdAtPrecision || 'day';
    merged.startedAtBasis = override.startedAtBasis || start.basis || (createdAt ? 'repository-created' : 'record-created');
    merged.technologies = unique([...(base.technologies || []), ...(language ? [language] : []), ...(override.technologies || [])]);
    merged.verbs = unique(override.verbs || base.verbs || []);
    merged.searchAliases = unique(override.searchAliases || base.searchAliases || []);
    merged.relatedProjects = Array.isArray(merged.relatedProjects) ? merged.relatedProjects : [];
    map.set(projectId, merged);
  });

  manualProjectsMerged.forEach((project) => { if (project?.id) map.set(project.id, { ...(map.get(project.id) || {}), ...project }); });
  diary.projects = Array.from(map.values()).filter((project) => !hidden.has(project.id));
  const valid = new Set(diary.projects.map((project) => project.id));

  diary.projects.forEach((project) => {
    const start = projectStartDates[project.id] || {};
    if (start.date) {
      project.startedAt = start.date;
      project.startedAtPrecision = start.precision || project.startedAtPrecision || 'day';
      project.startedAtBasis = start.basis || 'conversation-log';
    }
    if (!project.startedAt) {
      project.startedAt = project.createdAt || '';
      project.startedAtPrecision = project.createdAtPrecision || 'day';
      project.startedAtBasis = project.repositoryUrl ? 'repository-created' : 'record-created';
    }
    if (Array.isArray(project.relatedProjects)) project.relatedProjects = project.relatedProjects.filter((relation) => relation && valid.has(relation.id));
  });

  if (Array.isArray(diary.periods)) diary.periods.forEach((period) => {
    const ids = Array.isArray(period.projectIds) ? period.projectIds : [];
    period.projectIds = ids.filter((id) => valid.has(id));
    if (period.id === '2026-05' && valid.has('lineworks-logger') && !period.projectIds.includes('lineworks-logger')) period.projectIds.push('lineworks-logger');
  });

  if (!diary.settings) diary.settings = {};
  diary.settings.defaultView = 'shelf';
  diary.settings.defaultSort = 'created-desc';
  diary.settings.currentNote = 'GitHubの公開リポジトリと、自作したChrome拡張を対象にしています。説明の確認状態は各制作物に表示しています。';
  ['featuredProjectIds', 'recentProjectIds'].forEach((key) => {
    if (Array.isArray(diary.settings[key])) diary.settings[key] = diary.settings[key].filter((id) => valid.has(id));
  });
  return diary;
}

function removeInjectedRuntimeBlock(html, afterIndex) {
  const start = html.indexOf('<script', afterIndex);
  if (start < 0) return html;
  const tagEnd = html.indexOf('>', start);
  const end = tagEnd >= 0 ? html.indexOf('</script>', tagEnd) : -1;
  if (tagEnd < 0 || end < 0) return html;
  const block = html.slice(start, end + 9);
  if (!block.includes('window.WORKS_PORTFOLIO_CONFIG') || !block.includes('window.WORKS_PORTFOLIO_REPOSITORIES')) return html;
  return html.slice(0, start) + html.slice(end + 9);
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripGeneratedAssets(html) {
  let next = html
    .replace(/<meta name="worksportfolio-generated-at"[^>]*>/g, '')
    .replace(/<meta name="worksportfolio-assets-version"[^>]*>/g, '')
    .replace(/<style>\.recent-updates\{display:none!important\}<\/style>/g, '')
    .replace(/<script src="favorite-catalog\.js\?v=[^"]+"><\/script>/g, '');
  cssAssets.forEach((path) => { next = next.replace(new RegExp(`<link rel="stylesheet" href="${escapeRegExp(path)}\\?v=[^"]+">`, 'g'), ''); });
  jsAssets.forEach((path) => { next = next.replace(new RegExp(`<script src="${escapeRegExp(path)}\\?v=[^"]+"><\\/script>`, 'g'), ''); });
  return next;
}

let html = readFileSync(join(root, 'index.html'), 'utf8')
  .replace('<span class="brand-mark" aria-hidden="true">d/</span>', '<img class="brand-mark" src="assets/favicon.svg" alt="" width="38" height="38">')
  .replace('.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--ink); font: 800 .8rem "Roboto Mono", monospace; transform: rotate(-3deg); background: var(--paper); }', '.brand-mark { display:block; width:38px; height:38px; object-fit:contain; flex:0 0 auto; }')
  .replace('href="assets/icons/favicon.ico" sizes="any"', 'href="assets/favicon.svg" type="image/svg+xml"')
  .replace(/<script[^>]+(?:jszip|loader\.js)[^>]*><\/script>/gi, '');

const oldFilters = '<select data-verb-filter aria-label="目的で絞り込む">\n          <option value="">すべての目的</option>\n        </select>\n        <button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
const newFilters = '<select data-verb-filter aria-label="目的で絞り込む"><option value="">すべての目的</option></select><select data-type-filter aria-label="種類で絞り込む"><option value="">すべての種類</option></select><select data-documentation-filter aria-label="整理状態で絞り込む"><option value="">すべての整理状態</option></select><button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
if (html.includes(oldFilters)) html = html.replace(oldFilters, newFilters);

const extracted = extractDiaryData(html);
const diary = buildDiaryData(extracted.data);
html = html.slice(0, extracted.jsonStart) + ` ${scriptJson(diary)};\n` + html.slice(extracted.scriptEnd);
const refreshed = extractDiaryData(html);
html = removeInjectedRuntimeBlock(html, refreshed.scriptEnd + 9);
const runtimeBlock = `<script data-worksportfolio-runtime>window.WORKS_PORTFOLIO_CONFIG=${scriptJson(config)};window.WORKS_PORTFOLIO_REPOSITORIES=${scriptJson(repositories)};window.WORKS_PORTFOLIO_START_DATES=${scriptJson(projectStartDates)};<\/script>`;
const runtimeInsertAt = html.indexOf('</script>', refreshed.markerStart) + 9;
html = html.slice(0, runtimeInsertAt) + runtimeBlock + html.slice(runtimeInsertAt);

html = stripGeneratedAssets(html);
const generatedAt = catalog.generatedAt || new Date().toISOString();
const stylesheetTags = cssAssets.map((path) => `<link rel="stylesheet" href="${assetUrl(path)}">`).join('');
const scriptTags = jsAssets.map((path) => `<script src="${assetUrl(path)}"><\/script>`).join('');
html = html.replace('</head>', `<meta name="worksportfolio-generated-at" content="${generatedAt}"><meta name="worksportfolio-assets-version" content="${assetVersion}">${stylesheetTags}<style>.recent-updates{display:none!important}</style></head>`);
html = html.replace('</body>', `${scriptTags}</body>`);

if (/jszip|loader\.js/i.test(html)) throw new Error('The generated page still depends on the runtime bootstrap loader.');
if (!html.includes('shelf-priority.js')) throw new Error('The generated page is missing the shelf enhancement script.');
if (!html.includes('floating-random.js')) throw new Error('The generated page is missing the floating random popup.');
if (!html.includes('random-three.js') || !html.includes('random-three.css')) throw new Error('The generated page is missing the random three showcase.');
if (!html.includes('comparison-view.js') || !html.includes('comparison-view.css')) throw new Error('The generated page is missing the comparison view.');
if (!html.includes('favorites.js') || !html.includes('favorites.css')) throw new Error('The generated page is missing favorite rating controls.');
if (!html.includes(`favorites.js?v=${assetVersion}`) || !html.includes(`motion.js?v=${assetVersion}`)) throw new Error('The generated page is missing cache-busted interface assets.');
if (!html.includes('window.BUILD_DIARY_DATA')) throw new Error('The generated page lost its project data.');
if (!html.includes('startedAt')) throw new Error('The generated page lost project start dates.');

writeFileSync(join(root, 'index.html'), html);
console.log(`Generated static index.html (${Buffer.byteLength(html).toLocaleString('en-US')} bytes, ${repositories.length} repositories, ${diary.projects.length} visible projects, assets ${assetVersion}).`);
