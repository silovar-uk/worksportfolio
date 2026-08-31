import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readText = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));

const [privateProjects, js, css] = await Promise.all([
  readJson('data/private-projects.json'),
  readText('private-source.js'),
  readText('private-source.css')
]);

const indexUrl = new URL('index.html', root);
let html = await readFile(indexUrl, 'utf8');
const marker = 'window.BUILD_DIARY_DATA =';
const markerStart = html.indexOf(marker);
if (markerStart < 0) throw new Error('BUILD_DIARY_DATA was not found in index.html.');
const jsonStart = markerStart + marker.length;
const scriptEnd = html.indexOf('</script>', jsonStart);
if (scriptEnd < 0) throw new Error('BUILD_DIARY_DATA script was not closed.');
const raw = html.slice(jsonStart, scriptEnd).trim().replace(/;\s*$/, '');
const diary = JSON.parse(raw);
const projects = Array.isArray(diary.projects) ? diary.projects : [];
const map = new Map(projects.filter((project) => project?.id).map((project) => [project.id, project]));

for (const source of privateProjects) {
  if (!source?.id) continue;
  const project = {
    ...source,
    visibility: 'private',
    sourceVisibility: 'private',
    summaryOnly: true,
    repositoryUrl: ''
  };
  map.set(project.id, project);
}

diary.projects = [...map.values()];
if (!diary.settings || typeof diary.settings !== 'object') diary.settings = {};
diary.settings.currentNote = 'GitHubの公開リポジトリ、手元の制作物、概要のみ公開しているPrivate制作物を整理しています。Private制作物のソースや内部情報は公開していません。';

const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');
html = html.slice(0, jsonStart) + ` ${scriptJson(diary)};\n` + html.slice(scriptEnd);

html = html
  .replace(/<link rel="stylesheet" href="private-source\.css\?v=[^"]+">/g, '')
  .replace(/<script src="private-source\.js\?v=[^"]+"><\/script>/g, '');
const hash = createHash('sha256').update(css).update('\0').update(js).digest('hex').slice(0, 12);
html = html.replace('</head>', `<link rel="stylesheet" href="private-source.css?v=${hash}"></head>`);
html = html.replace('</body>', `<script src="private-source.js?v=${hash}"></script></body>`);

await writeFile(indexUrl, html, 'utf8');
console.log(`Injected ${privateProjects.length} safe Private-project summaries (assets ${hash}).`);
