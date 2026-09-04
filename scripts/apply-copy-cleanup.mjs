import { existsSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const cleanupRuntime = readFileSync('copy-cleanup.js', 'utf8');
const favoritesRuntime = readFileSync('favorites.js', 'utf8');
const catalogShellRuntime = readFileSync('catalog-list-first.js', 'utf8');
const floatingRandomRuntime = readFileSync('floating-random.js', 'utf8');

for (const path of ['catalog-list-first.js', 'floating-random.js', 'favorites.js', 'copy-cleanup.js']) {
  new Script(readFileSync(path, 'utf8'), { filename: path });
}

const required = [
  '<h1 id="hero-title">小さな不便から、小さな道具を作る</h1>',
  '<p class="hero-lead">普段の作業で気になったことを、WebアプリやChrome拡張にしています。</p>',
  'data-header-search-input',
  'data-view-button="shelf">制作物を見る</button>',
  'shell.css',
  'catalog-list-first.js',
  'copy-cleanup.css',
  'copy-cleanup.js',
  "d.settings.defaultView='shelf'",
  "document.querySelector('[data-random-button]')?.addEventListener",
  "const required = ['id', 'title', 'summary', 'type', 'status', 'visibility', 'createdAt'];"
];

for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Canonical static output is missing: ${marker}`);
}

const forbidden = [
  '<h1 id="hero-title">デジタル制作物一覧</h1>',
  '<h1 id="hero-title">小さな不便から、<br>小さな道具を作る</h1>',
  '日常の小さなあれこれをWEBアプリやChrome拡張化。'
];
for (const marker of forbidden) {
  if (html.includes(marker)) throw new Error(`Legacy top-shell copy returned: ${marker}`);
}

const headerSearchCount = (html.match(/data-header-search-input/g) || []).length;
if (headerSearchCount !== 1) {
  throw new Error(`Header search must be static and unique; found ${headerSearchCount}.`);
}

if (cleanupRuntime.includes('Element.prototype.querySelector')) {
  throw new Error('Global querySelector monkey patches are forbidden. Fix the local selector instead.');
}
if (favoritesRuntime.includes('`:scope > .${className}`')) {
  throw new Error('favorites.js must compose multi-class selectors explicitly.');
}
if (floatingRandomRuntime.includes('catalog-overview') || floatingRandomRuntime.includes('catalog-filter-drawer')) {
  throw new Error('floating-random.js must not contain Catalog layout repair code.');
}
if (!catalogShellRuntime.includes('catalog-filter-drawer')) {
  throw new Error('catalog-list-first.js must own the list-first Catalog shell.');
}
if (catalogShellRuntime.includes('observe(document.body')) {
  throw new Error('Catalog shell observer must stay scoped to the explorer root.');
}
if (existsSync('catalog-layout-fix.js')) {
  throw new Error('Obsolete catalog-layout-fix.js must not return; fix canonical layout sources instead.');
}

console.log('Canonical output, runtime syntax, and patch boundaries verified.');
