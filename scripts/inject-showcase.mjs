import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readText = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');

const [taxonomy, js, css] = await Promise.all([
  readJson('data/portfolio-taxonomy.json'),
  readText('showcase.js'),
  readText('showcase.css')
]);

const indexUrl = new URL('index.html', root);
let html = await readFile(indexUrl, 'utf8');
const marker = 'window.BUILD_DIARY_DATA =';
const markerStart = html.indexOf(marker);
if (markerStart < 0) throw new Error('BUILD_DIARY_DATA was not found in index.html.');
const jsonStart = markerStart + marker.length;
const scriptEnd = html.indexOf('</script>', jsonStart);
if (scriptEnd < 0) throw new Error('The BUILD_DIARY_DATA script was not closed.');
const raw = html.slice(jsonStart, scriptEnd).trim().replace(/;\s*$/, '');
const diary = JSON.parse(raw);
const projects = Array.isArray(diary.projects) ? diary.projects : [];
const map = new Map(projects.filter((project) => project?.id).map((project) => [project.id, project]));

for (const project of projects) {
  project.portfolioFamilies = [];
  project.makingPrinciples = [];
}
for (const family of taxonomy.families || []) {
  for (const id of family.projectIds || []) {
    const project = map.get(id);
    if (project && !project.portfolioFamilies.includes(family.label)) project.portfolioFamilies.push(family.label);
  }
}
for (const principle of taxonomy.principles || []) {
  for (const id of principle.projectIds || []) {
    const project = map.get(id);
    if (project && !project.makingPrinciples.includes(principle.label)) project.makingPrinciples.push(principle.label);
  }
}

diary.projects = projects;
html = html.slice(0, jsonStart) + ` ${scriptJson(diary)};\n` + html.slice(scriptEnd);

html = html
  .replace(/<link rel="stylesheet" href="showcase\.css\?v=[^"]+">/g, '')
  .replace(/<script data-worksportfolio-showcase>[\s\S]*?<\/script>/g, '')
  .replace(/<script src="showcase\.js\?v=[^"]+"><\/script>/g, '')
  .replace(/<script data-worksportfolio-showcase-assets>[\s\S]*?<\/script>/g, '');

const hash = createHash('sha256').update(css).update('\0').update(js).update('\0').update(JSON.stringify(taxonomy)).digest('hex').slice(0, 12);
const styleUrl = `showcase.css?v=${hash}`;
const scriptUrl = `showcase.js?v=${hash}`;
const registration = `<script data-worksportfolio-showcase>window.WORKS_PORTFOLIO_SHOWCASE=${scriptJson(taxonomy)};<\/script><script data-worksportfolio-showcase-assets>window.WORKS_PORTFOLIO_LAZY_ASSETS=window.WORKS_PORTFOLIO_LAZY_ASSETS||{styles:[],scripts:[]};window.WORKS_PORTFOLIO_LAZY_ASSETS.styles.push(${JSON.stringify(styleUrl)});window.WORKS_PORTFOLIO_LAZY_ASSETS.scripts.push(${JSON.stringify(scriptUrl)});<\/script>`;
html = html.replace('</body>', `${registration}</body>`);

await writeFile(indexUrl, html, 'utf8');
console.log(`Injected Showcase / Project Family taxonomy; presentation assets deferred (${hash}).`);
