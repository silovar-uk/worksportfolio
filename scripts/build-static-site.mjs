import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const readText = (path) => readFileSync(join(root, path), 'utf8');
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');
const byteLength = (value) => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
const escapeAttr = (value) => escapeHtml(value).replace(/'/g, '&#39;');
const SEARCH_SEP = '\u001f';

const config = readJson('data/portfolio-config.json');
const canonicalProjects = readJson('data/projects.json');
const privateProjects = readJson('data/private-projects.json');
const settings = readJson('data/settings.json');
const projectStartDates = readJson('data/project-start-dates.json');
const catalog = readJson('data/catalog.json');
const taxonomy = readJson('data/portfolio-taxonomy.json');
const editorialPolicy = readJson('data/editorial-policy.json');
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];

const coreCssAssets = ['catalog.css', 'shell.css', 'home-shell.css'];
const coreJsAssets = ['home-shell.js', 'catalog.js', 'project-detail.js'];
const assetFiles = [...coreCssAssets, ...coreJsAssets];

const HOME_FRICTIONS = [
  { id: 'reduce', code: '01', label: '手間を減らす', words: ['面倒', '手間', '操作', 'クリック', '移動', '入力', '切り替', '効率', '減ら', '便利', 'utility'] },
  { id: 'remember', code: '02', label: '覚えて戻る', words: ['忘れ', '記録', '保存', '履歴', 'ログ', '辞書', 'メモ', 'アーカイブ', '思い出', '戻る', 'archive', 'memory'] },
  { id: 'practice', code: '03', label: '小さく学ぶ', words: ['学ぶ', '練習', '復習', '反復', '問題', 'クイズ', '英語', '語彙', '音読', 'study', 'training', 'practice'] },
  { id: 'compare', code: '04', label: '比べて整理する', words: ['比べ', '比較', '差分', '構造', '整理', '関係', '可視化', '分析', 'map', 'diff', 'フロー'] },
  { id: 'communicate', code: '05', label: '伝わり方を整える', words: ['伝える', '共有', 'デザイン', '広報', '告知', '文章', '画像', 'レビュー', '見せる', '説明', 'communication', 'editorial'] },
  { id: 'protect', code: '06', label: '情報を守る', words: ['守る', '暗号', '非公開', '認証', 'private', 'security', '秘密', '限定', 'access'] }
];

const typeByName = [
  [/extension|quicklinks|tabshelter|logger/i, 'chrome-extension'],
  [/quiz|english|hangul|study|training|dictionary/i, 'learning-tool'],
  [/design|pattern|prompt/i, 'design-system'],
  [/analysis|dashboard|result|predict|calc|fourier/i, 'data-tool'],
  [/wiki|article|contents|vision/i, 'content-page']
];
const typeLabels = {
  'web-app': 'Webアプリ', 'chrome-extension': 'Chrome拡張', 'learning-tool': '学習ツール', 'design-system': '設計・デザイン',
  'content-page': '文章・知識', 'data-tool': '分析・データ', utility: '便利ツール', experiment: '実験', other: 'その他'
};
const typeCodes = { 'web-app': 'w', 'chrome-extension': 'c', 'learning-tool': 'l', 'design-system': 'd', 'content-page': 'p', 'data-tool': 'a', utility: 'u', experiment: 'e', other: 'o' };

function assertArchitectureContract() {
  const template = readText('src/index.template.html');
  const shell = readText('shell.css');
  const home = readText('home-shell.css');
  const search = readText('home-shell.js');
  if (!template.includes('window.WORKS_PORTFOLIO_SEARCH_INDEX = __WORKS_PORTFOLIO_SEARCH_INDEX__;')) throw new Error('Source template must expose only the dedicated search-index placeholder.');
  for (const forbidden of ['BUILD_DIARY_DATA', 'data-view-button="timeline"', 'data-view-button="shelf"', 'data-view-button="map"']) if (template.includes(forbidden)) throw new Error(`Legacy source architecture returned: ${forbidden}`);
  for (const marker of ['.site-header{', '.header-inner{', '.header-search{', '.hero{', '.hero-copy h1{']) if (!shell.includes(marker)) throw new Error(`shell.css lost canonical selector ${marker}`);
  if (!home.includes('.home-redesign') || !home.includes('.home-featured-grid') || !home.includes('.home-friction-grid')) throw new Error('home-shell.css must own the stable home discovery layout.');
  if (!search.includes('window.WORKS_PORTFOLIO_SEARCH') || !search.includes('data-header-search-input')) throw new Error('home-shell.js must own Header Search and the shared search meaning.');
}
assertArchitectureContract();

function createAssetVersion(paths) {
  const hash = createHash('sha256');
  for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(readFileSync(join(root, path))); hash.update('\0'); }
  return hash.digest('hex').slice(0, 12);
}
const assetVersion = createAssetVersion(assetFiles);
const assetUrl = (path) => `${path}?v=${assetVersion}`;
const hidden = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};

function cleanDate(value) { return value ? String(value).slice(0, 10) : ''; }
function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))); }
function inferType(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics.join(' ') : '';
  const text = [repo.name, repo.description, topics].filter(Boolean).join(' ');
  for (const [pattern, type] of typeByName) if (pattern.test(text)) return type;
  return 'web-app';
}
function kanaToHira(value) { return String(value || '').replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60)); }
function normalizeSearch(value) {
  return kanaToHira(String(value || '').toLowerCase().normalize('NFKC')).replace(/[・･_\-‐‑‒–—―/\\.,:;'\"“”‘’!?！？()（）[\]【】{}<>「」『』]/g, '').replace(/\s+/g, '');
}
function truncate(value, max = 120) { const text = String(value || '').trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
function normalizedList(values) { return unique(values).map(normalizeSearch).filter(Boolean).join(SEARCH_SEP); }

function buildCanonicalProjects() {
  const map = new Map((Array.isArray(canonicalProjects) ? canonicalProjects : []).filter((project) => project?.id).map((project) => [String(project.id), { ...project }]));
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
      id: projectId, title: existing.title || repositoryId, subtitle: existing.subtitle || 'GitHubリポジトリ', summary: existing.summary || repo.description || 'GitHub上で管理している制作物。',
      friction: existing.friction || '', firstBuild: existing.firstBuild || '', currentAnswer: existing.currentAnswer || '', type: existing.type || inferType(repo), verbs: unique(existing.verbs || ['作る']),
      status: existing.status || (repo.archived ? 'dormant' : 'development'), visibility: existing.visibility || 'public', featured: Boolean(existing.featured), createdAt: existing.createdAt || createdAt,
      createdAtPrecision: existing.createdAtPrecision || 'day', updatedAt: updatedAt || existing.updatedAt || existing.createdAt || createdAt, startedAt: start.date || existing.startedAt || createdAt || existing.createdAt || '',
      startedAtPrecision: start.precision || existing.startedAtPrecision || existing.createdAtPrecision || 'day', startedAtBasis: start.basis || existing.startedAtBasis || (createdAt ? 'repository-created' : 'record-created'),
      repositoryUrl, liveUrl, technologies: unique([...(existing.technologies || []), ...(language ? [language] : [])]), documentationState: existing.documentationState || 'unreviewed',
      relatedProjects: Array.isArray(existing.relatedProjects) ? existing.relatedProjects : [], updates: Array.isArray(existing.updates) ? existing.updates : [], aside: existing.aside || '', searchAliases: unique(existing.searchAliases || []),
      portfolioFamilies: [], makingPrinciples: [], ...existing, id: projectId, repositoryUrl, liveUrl, updatedAt: updatedAt || existing.updatedAt || existing.createdAt || createdAt,
      technologies: unique([...(existing.technologies || []), ...(language ? [language] : [])])
    };
    if (start.date) { project.startedAt = start.date; project.startedAtPrecision = start.precision || project.startedAtPrecision || 'day'; project.startedAtBasis = start.basis || project.startedAtBasis || 'repository-history'; }
    map.set(projectId, project);
  }
  return [...map.values()].filter((project) => project?.id && !hidden.has(project.id));
}

function editorialWithheldIds(projects) {
  const gate = editorialPolicy?.publicationGate;
  if (!gate?.enabled) return new Set();
  const baseline = String(gate.baselineCreatedDateMax || '9999-12-31');
  const canonical = new Map(projects.map((project) => [String(project.id), project]));
  const withheld = new Set();
  for (const repo of repositories) {
    const repoId = repo?.name || repo?.id;
    if (!repoId) continue;
    const projectId = repositoryProjectIds[repoId] || repoId;
    const project = canonical.get(projectId) || {};
    const state = project.editorialState || '';
    const createdAt = String(repo.createdAt || repo.created_at || '').slice(0, 10);
    const grandfathered = Boolean(createdAt && createdAt <= baseline);
    if (state === 'hidden' || (!grandfathered && state !== 'published')) withheld.add(projectId);
  }
  return withheld;
}

function mergePrivateSafeSummaries(publicProjects) {
  const map = new Map(publicProjects.map((project) => [project.id, project]));
  for (const source of Array.isArray(privateProjects) ? privateProjects : []) {
    if (!source?.id) continue;
    map.set(source.id, { ...source, visibility: 'private', sourceVisibility: 'private', summaryOnly: true, repositoryUrl: '' });
  }
  return [...map.values()];
}
function annotateTaxonomy(projects) {
  const map = new Map(projects.map((project) => [project.id, project]));
  for (const project of projects) { project.portfolioFamilies = []; project.makingPrinciples = []; }
  for (const family of taxonomy.families || []) for (const id of family.projectIds || []) { const project = map.get(id); if (project && !project.portfolioFamilies.includes(family.label)) project.portfolioFamilies.push(family.label); }
  for (const principle of taxonomy.principles || []) for (const id of principle.projectIds || []) { const project = map.get(id); if (project && !project.makingPrinciples.includes(principle.label)) project.makingPrinciples.push(principle.label); }
  return projects;
}
function pruneRelations(projects) {
  const valid = new Set(projects.map((project) => project.id));
  return projects.map((project) => ({ ...project, relatedProjects: Array.isArray(project.relatedProjects) ? project.relatedProjects.filter((relation) => relation && valid.has(relation.id || relation.target)) : [] }));
}
function buildPublishedProjects() {
  const canonical = buildCanonicalProjects();
  const withheld = editorialWithheldIds(canonical);
  const publishedPublic = canonical.filter((project) => !withheld.has(project.id));
  return { projects: pruneRelations(annotateTaxonomy(mergePrivateSafeSummaries(publishedPublic))), withheldCount: canonical.length - publishedPublic.length };
}

function searchIndexProject(project) {
  const hintRaw = project.friction || project.summary || project.subtitle || '';
  const hint = truncate(hintRaw, 120);
  const normalizedHint = normalizeSearch(hint);
  let hiddenSearch = normalizeSearch([project.subtitle, project.summary, project.friction, ...(project.makingPrinciples || [])].filter(Boolean).join(' '));
  if (normalizedHint) hiddenSearch = hiddenSearch.replace(normalizedHint, '');
  const record = { i: project.id, t: project.title || project.id, h: hint, y: typeCodes[project.type] || 'o' };
  if (project.friction) record.r = 1;
  if (project.summaryOnly && project.liveUrl) record.l = project.liveUrl;
  if (project.summaryOnly) record.s = 1;
  const aliases = normalizedList(project.searchAliases || []), verbs = normalizedList(project.verbs || []), technologies = normalizedList(project.technologies || []), families = normalizedList(project.portfolioFamilies || []);
  if (aliases) record.a = aliases;
  if (verbs) record.v = verbs;
  if (technologies) record.k = technologies;
  if (families) record.f = families;
  if (hiddenSearch) record.x = hiddenSearch;
  return record;
}

function catalogProject(project) {
  return { id: project.id, title: project.title || project.id, summary: project.summary || project.friction || '制作物の説明を整理中。', type: project.type || 'other', status: project.status || 'legacy',
    startedAt: project.startedAt || project.createdAt || '', createdAt: project.createdAt || '', updatedAt: project.updatedAt || project.createdAt || '', liveUrl: project.liveUrl || '', repositoryUrl: project.repositoryUrl || '',
    sourceVisibility: project.sourceVisibility || '', summaryOnly: Boolean(project.summaryOnly) };
}
function detailProject(project) {
  return { id: project.id, title: project.title || project.id, subtitle: project.subtitle || '', summary: project.summary || '', friction: project.friction || '', firstBuild: project.firstBuild || '', currentAnswer: project.currentAnswer || '',
    type: project.type || 'other', verbs: unique(project.verbs || []), status: project.status || 'legacy', startedAt: project.startedAt || project.createdAt || '', createdAt: project.createdAt || '', updatedAt: project.updatedAt || project.createdAt || '',
    liveUrl: project.liveUrl || '', repositoryUrl: project.repositoryUrl || '', technologies: unique(project.technologies || []), documentationState: project.documentationState || 'unreviewed',
    relatedProjects: Array.isArray(project.relatedProjects) ? project.relatedProjects : [], updates: Array.isArray(project.updates) ? project.updates : [], aside: project.aside || '', extension: project.extension || null };
}
function writeRuntimeData(projects, generatedAt) {
  const searchIndex = projects.slice().sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))).map(searchIndexProject);
  const catalogPayload = { version: 1, generatedAt, projects: projects.map(catalogProject) };
  writeFileSync(join(root, 'data/catalog-projects.json'), `${JSON.stringify(catalogPayload)}\n`);
  const detailDir = join(root, 'data/project-details'); rmSync(detailDir, { recursive: true, force: true }); mkdirSync(detailDir, { recursive: true });
  let detailCount = 0, detailBytes = 0;
  for (const project of projects) {
    if (!project?.id || project.summaryOnly) continue;
    const payload = JSON.stringify(detailProject(project)); writeFileSync(join(detailDir, `${encodeURIComponent(String(project.id))}.json`), `${payload}\n`); detailCount += 1; detailBytes += byteLength(payload);
  }
  return { searchIndex, searchBytes: byteLength(JSON.stringify(searchIndex)), catalogBytes: byteLength(JSON.stringify(catalogPayload)), detailCount, detailBytes };
}

function replaceRequired(html, pattern, replacement, label) { if (!pattern.test(html)) throw new Error(`Static shell marker not found: ${label}.`); return html.replace(pattern, replacement); }
function applyStaticShell(html) {
  const heroTitle = String(settings.heroTitle || '').trim(), heroLead = String(settings.heroLead || '').trim();
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
function themeScore(project, theme) {
  const text = normalizeSearch([project.title, project.subtitle, project.summary, project.friction, ...(project.verbs || []), ...(project.technologies || []), ...(project.portfolioFamilies || []), ...(project.makingPrinciples || [])].filter(Boolean).join(' '));
  let score = theme.words.reduce((sum, word) => sum + (text.includes(normalizeSearch(word)) ? 1 : 0), 0);
  if (project.type === 'learning-tool' && theme.id === 'practice') score += 2;
  if (project.type === 'data-tool' && theme.id === 'compare') score += 1;
  if (project.type === 'chrome-extension' && theme.id === 'reduce') score += 1;
  if (project.sourceVisibility === 'private' && theme.id === 'protect') score += 2;
  return score;
}
function featuredProjects(projects) {
  const map = new Map(projects.map((project) => [project.id, project]));
  const configured = (settings.featuredProjectIds || []).map((id) => map.get(id)).filter(Boolean);
  const fallback = projects.filter((project) => project.liveUrl || project.featured).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return unique([...configured.map((project) => project.id), ...fallback.map((project) => project.id)]).map((id) => map.get(id)).filter(Boolean).slice(0, 4);
}
function homeSectionsMarkup(projects) {
  const featuredMarkup = featuredProjects(projects).map((project) => `<article class="home-featured-card"><p class="home-featured-card-meta">${escapeHtml(typeLabels[project.type] || project.type || '制作物')} / ${escapeHtml(String(project.updatedAt || project.createdAt || '').replace(/-/g, '.'))}</p><h3>${escapeHtml(project.title || project.id)}</h3><p>${escapeHtml(project.summary || project.friction || '制作物の説明を整理中。')}</p><div class="home-featured-actions"><button type="button" data-home-open="${escapeAttr(project.id)}">制作記録を見る</button>${project.liveUrl ? `<a href="${escapeAttr(project.liveUrl)}" target="_blank" rel="noopener">公開ページ ↗</a>` : ''}</div></article>`).join('');
  const frictionMarkup = HOME_FRICTIONS.map((theme) => { const count = projects.filter((project) => themeScore(project, theme) > 0).length; return `<button type="button" class="home-friction-button" data-home-friction="${theme.id}" aria-label="${escapeAttr(theme.label)}に関係する制作物 ${count}件を見る"><span>${theme.code}</span><strong>${escapeHtml(theme.label)}</strong><b>${count}</b></button>`; }).join('');
  return `<section class="home-start section-shell" aria-labelledby="home-start-title"><div class="home-section-head"><div><p class="eyebrow">START HERE</p><h2 id="home-start-title">いま見るなら</h2></div><p>全部を見る前に、方向の違う制作物を4つだけ。公開ページへ直接行くことも、制作記録を読むこともできます。</p></div><div class="home-featured-grid">${featuredMarkup}</div></section><section class="home-frictions section-shell" aria-labelledby="home-frictions-title"><div class="home-section-head"><div><p class="eyebrow">WHY I MADE THEM</p><h2 id="home-frictions-title">何に困って作った？</h2></div><p>技術名ではなく、作る前にあった小さな引っかかりから制作物を探します。</p></div><div class="home-friction-grid">${frictionMarkup}</div><div class="home-surprise-row"><p>目的が決まっていないときは、過去の問題解決をひとつ引く。</p><button type="button" class="home-surprise" data-home-surprise>おまかせで1つ</button></div></section>`;
}
function applyHomeSections(html, projects) {
  const marker = '    <section class="explorer section-shell"';
  if (!html.includes(marker)) throw new Error('Explorer marker not found for home discovery sections.');
  html = html.replace(marker, `${homeSectionsMarkup(projects)}\n\n${marker}`);
  html = html.replace('<p class="eyebrow">EXPLORE</p>\n          <h2 id="explorer-title">制作物一覧</h2>', '<p class="eyebrow">ALL PROJECTS</p>\n          <h2 id="explorer-title">すべての制作物</h2>');
  return html;
}

const generatedAt = catalog.generatedAt || new Date().toISOString();
const { projects, withheldCount } = buildPublishedProjects();
const runtimeData = writeRuntimeData(projects, generatedAt);
let html = readText('src/index.template.html');
html = applyStaticShell(html); html = applyHomeSections(html, projects); html = html.replace('__WORKS_PORTFOLIO_SEARCH_INDEX__', scriptJson(runtimeData.searchIndex));
if (html.includes('__WORKS_PORTFOLIO_SEARCH_INDEX__')) throw new Error('Search-index template placeholder remains unresolved.');
const stylesheetTags = coreCssAssets.map((path) => `<link rel="stylesheet" href="${assetUrl(path)}">`).join('');
const scriptTags = coreJsAssets.map((path) => `<script src="${assetUrl(path)}"><\/script>`).join('');
html = html.replace('</head>', `<meta name="worksportfolio-generated-at" content="${escapeAttr(generatedAt)}"><meta name="worksportfolio-assets-version" content="${assetVersion}"><meta name="worksportfolio-data-mode" content="search-inline-catalog-fetch-detail-on-demand">${stylesheetTags}</head>`);
html = html.replace('</body>', `${scriptTags}</body>`);
for (const required of ['WORKS_PORTFOLIO_SEARCH_INDEX', 'data-header-search-input', 'data-home-friction="reduce"', 'data-home-surprise', 'home-shell.js', 'catalog.js', 'project-detail.js']) if (!html.includes(required)) throw new Error(`Generated page is missing ${required}.`);
for (const forbidden of ['BUILD_DIARY_DATA', 'WORKS_PORTFOLIO_REPOSITORIES', 'WORKS_PORTFOLIO_START_DATES', 'WORKS_PORTFOLIO_SHOWCASE', 'WORKS_PORTFOLIO_CONFIG', 'requestIdleCallback', 'MutationObserver', 'live-index.js', 'friction-atlas.js', 'catalog-list-first.js']) if (html.includes(forbidden)) throw new Error(`Generated page leaked obsolete runtime architecture: ${forbidden}.`);
writeFileSync(join(root, 'index.html'), html);
console.log(`Generated progressive portfolio: ${projects.length} projects (${withheldCount} public withheld); index ${byteLength(html).toLocaleString('en-US')} bytes; inline search ${runtimeData.searchBytes.toLocaleString('en-US')} bytes; catalog ${runtimeData.catalogBytes.toLocaleString('en-US')} bytes; ${runtimeData.detailCount} on-demand details / ${runtimeData.detailBytes.toLocaleString('en-US')} bytes; assets ${assetVersion}.`);
