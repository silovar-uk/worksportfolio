import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

const required = [
  '<h1 id="hero-title">小さな不便から、小さな道具を作る</h1>',
  '<p class="hero-lead">普段の作業で気になったことを、WebアプリやChrome拡張にしています。</p>',
  'data-header-search-input',
  'data-view-button="shelf">制作物を見る</button>',
  'shell.css',
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

console.log('Canonical static copy verified; no post-build copy mutation was necessary.');
