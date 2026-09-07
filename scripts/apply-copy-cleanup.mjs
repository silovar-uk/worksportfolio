import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const homeRuntime = readFileSync('home-shell.js', 'utf8');
const catalogRuntime = readFileSync('catalog.js', 'utf8');
const settings = JSON.parse(readFileSync('data/settings.json', 'utf8'));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;'
}[char]));

new Script(homeRuntime, { filename: 'home-shell.js' });
new Script(catalogRuntime, { filename: 'catalog.js' });

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
  'window.BUILD_DIARY_DATA'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Stable core output is missing: ${marker}`);
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

if (homeRuntime.includes('MutationObserver')) throw new Error('home-shell.js must not repair the DOM with MutationObserver.');
if (catalogRuntime.includes('MutationObserver')) throw new Error('catalog.js must not repair the DOM with MutationObserver.');
if (homeRuntime.includes('location.reload') || catalogRuntime.includes('location.reload')) {
  throw new Error('Core navigation must not reload the page to open project details.');
}
if (!homeRuntime.includes('window.WORKS_PORTFOLIO_SEARCH')) throw new Error('Shared search engine is missing.');
if (!catalogRuntime.includes('WORKS_PORTFOLIO_SEARCH')) throw new Error('Catalog must consume the shared search meaning.');
if (!catalogRuntime.includes("const STORAGE_KEY = 'worksportfolio-catalog-v4'")) throw new Error('Catalog storage schema must be v4.');

console.log('Stable core output, shared search, and no-repair runtime boundaries verified.');
