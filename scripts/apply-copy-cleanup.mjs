import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const homeRuntime = readFileSync('home-shell.js', 'utf8');
const catalogRuntime = readFileSync('catalog.js', 'utf8');
const detailRuntime = readFileSync('project-detail.js', 'utf8');
const settings = JSON.parse(readFileSync('data/settings.json', 'utf8'));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
}[char]));

new Script(homeRuntime, { filename: 'home-shell.js' });
new Script(catalogRuntime, { filename: 'catalog.js' });
new Script(detailRuntime, { filename: 'project-detail.js' });

const heroTitle = String(settings.heroTitle || '').trim();
const heroLead = String(settings.heroLead || '').trim();
if (!heroTitle || !heroLead) throw new Error('data/settings.json must define heroTitle and heroLead.');

const required = [
  '<html lang="ja" class="home-redesign">',
  `<h1 id="hero-title">${escapeHtml(heroTitle)}</h1>`,
  `<p class="hero-lead">${escapeHtml(heroLead)}</p>`,
  'data-header-search-input',
  'data-home-friction="reduce"',
  'data-home-surprise',
  'id="home-start-title"',
  'id="home-frictions-title"',
  'id="explorer-title">すべての制作物</h2>',
  'home-shell.css',
  'home-shell.js',
  'catalog.css',
  'catalog.js',
  'project-detail.js',
  'window.WORKS_PORTFOLIO_SEARCH_INDEX',
  'search-inline-catalog-fetch-detail-on-demand'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Stable core output is missing: ${marker}`);
}

for (const marker of ['window.BUILD_DIARY_DATA', 'WORKS_PORTFOLIO_SHOWCASE', 'WORKS_PORTFOLIO_CONFIG', 'WORKS_PORTFOLIO_REPOSITORIES', 'WORKS_PORTFOLIO_START_DATES']) {
  if (html.includes(marker)) throw new Error(`Obsolete runtime global leaked into production: ${marker}`);
}

const retiredRuntimeAssets = [
  'live-index.js', 'live-index.css',
  'friction-atlas.js', 'friction-atlas.css',
  'random-three.js', 'random-three.css',
  'floating-random.js', 'floating-random.css',
  'catalog-list-first.js', 'catalog-visibility.js',
  'showcase.js', 'showcase.css',
  'private-source.js', 'private-source.css',
  'comparison-view.js', 'favorites.js', 'favorite-catalog.js',
  'copy-cleanup.js', 'copy-cleanup.css'
];
for (const asset of retiredRuntimeAssets) {
  if (html.includes(asset)) throw new Error(`Retired runtime asset leaked into production: ${asset}`);
}

for (const marker of ['requestIdleCallback', 'WORKS_PORTFOLIO_LAZY_ASSETS', 'portfolioEnhancements']) {
  if (html.includes(marker)) throw new Error(`Deferred assembly marker must not ship: ${marker}`);
}

const headerSearchCount = (html.match(/data-header-search-input/g) || []).length;
if (headerSearchCount !== 1) throw new Error(`Header search must be static and unique; found ${headerSearchCount}.`);

for (const [name, runtime] of [['home-shell.js', homeRuntime], ['catalog.js', catalogRuntime], ['project-detail.js', detailRuntime]]) {
  if (runtime.includes('MutationObserver')) throw new Error(`${name} must not repair the DOM with MutationObserver.`);
  if (runtime.includes('location.reload')) throw new Error(`${name} must not reload the page for Core navigation.`);
}
if (!homeRuntime.includes('window.WORKS_PORTFOLIO_SEARCH')) throw new Error('Shared search engine is missing.');
if (!homeRuntime.includes('WORKS_PORTFOLIO_SEARCH_INDEX')) throw new Error('Header Search must consume the inline search index.');
if (!catalogRuntime.includes('data/catalog-projects.json')) throw new Error('Catalog must load the independent catalog payload.');
if (!catalogRuntime.includes('matchesId')) throw new Error('Catalog must reuse shared search semantics by project id.');
if (!detailRuntime.includes('data/project-details/')) throw new Error('Project Detail must load individual detail payloads on demand.');
if (!catalogRuntime.includes("const STORAGE_KEY = 'worksportfolio-catalog-v5'")) throw new Error('Catalog storage schema must be v5.');

console.log('Progressive data architecture verified: inline search + fetched catalog + on-demand detail.');
