import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);
const detailsUrl = new URL('data/project-details/', root);

const DETAIL_FIELDS = [
  'firstBuild',
  'currentAnswer',
  'updates',
  'aside',
  'extension'
];

const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');
const byteLength = (value) => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
const detailFileName = (id) => `${encodeURIComponent(String(id))}.json`;

function extractDiary(html) {
  const marker = 'window.BUILD_DIARY_DATA =';
  const markerStart = html.indexOf(marker);
  if (markerStart < 0) throw new Error('BUILD_DIARY_DATA was not found in index.html.');
  const jsonStart = markerStart + marker.length;
  const scriptEnd = html.indexOf('</script>', jsonStart);
  if (scriptEnd < 0) throw new Error('BUILD_DIARY_DATA script was not closed.');
  const raw = html.slice(jsonStart, scriptEnd).trim().replace(/;\s*$/, '');
  return { diary: JSON.parse(raw), jsonStart, scriptEnd, raw };
}

function splitProject(project) {
  const summary = { ...project };
  const detail = { id: project.id };
  for (const key of DETAIL_FIELDS) {
    if (!(key in summary)) continue;
    detail[key] = summary[key];
    delete summary[key];
  }
  return { summary, detail };
}

function stripRedundantRuntimeData(html) {
  const runtimePattern = /<script data-worksportfolio-runtime>([\s\S]*?)<\/script>/;
  const match = html.match(runtimePattern);
  if (!match) throw new Error('worksportfolio runtime block was not found.');

  let runtime = match[1];
  const before = byteLength(runtime);
  runtime = runtime
    .replace(/window\.WORKS_PORTFOLIO_REPOSITORIES=\[[\s\S]*?\];(?=window\.|$)/, '')
    .replace(/window\.WORKS_PORTFOLIO_START_DATES=\{[\s\S]*?\};(?=window\.|$)/, '');

  if (runtime.includes('WORKS_PORTFOLIO_REPOSITORIES') || runtime.includes('WORKS_PORTFOLIO_START_DATES')) {
    throw new Error('Redundant repository/start-date runtime payload survived cleanup.');
  }
  if (!runtime.includes('WORKS_PORTFOLIO_CONFIG')) {
    throw new Error('Minimal WORKS_PORTFOLIO_CONFIG runtime payload was lost.');
  }

  const after = byteLength(runtime);
  return {
    html: html.replace(runtimePattern, `<script data-worksportfolio-runtime>${runtime}</script>`),
    savedBytes: before - after
  };
}

function stripLegacyRenderer(html) {
  const startMarker = "  <script>\n(() => {\n  'use strict';\n\n  const state = {";
  const start = html.indexOf(startMarker);
  if (start < 0) throw new Error('Legacy inline renderer start marker was not found.');
  const end = html.indexOf('</script>', start);
  if (end < 0) throw new Error('Legacy inline renderer script was not closed.');
  const removedBytes = byteLength(html.slice(start, end + 9));
  const marker = '  <!-- Legacy timeline/shelf/map renderer removed from production; projectDetailCache is owned by project-detail.js. -->';
  return {
    html: html.slice(0, start) + marker + html.slice(end + 9),
    removedBytes
  };
}

async function installProjectDetailRuntime(html) {
  const source = await readFile(new URL('project-detail.js', root), 'utf8');
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const tag = `<script src="project-detail.js?v=${hash}"></script>`;
  if (!html.includes('project-detail.js')) html = html.replace('</body>', `${tag}</body>`);
  if (!html.includes('project-detail.js')) throw new Error('project-detail.js was not installed in generated output.');
  return { html, hash };
}

let html = await readFile(indexUrl, 'utf8');
const initialIndexBytes = byteLength(html);
const { diary, jsonStart, scriptEnd, raw } = extractDiary(html);
const initialDiaryBytes = byteLength(raw);
const projects = Array.isArray(diary.projects) ? diary.projects : [];

await rm(detailsUrl, { recursive: true, force: true });
await mkdir(detailsUrl, { recursive: true });

let detailBytes = 0;
const summaries = [];
for (const project of projects) {
  if (!project?.id) continue;
  const { summary, detail } = splitProject(project);
  summaries.push(summary);
  const payload = JSON.stringify(detail);
  detailBytes += byteLength(payload);
  await writeFile(new URL(detailFileName(project.id), detailsUrl), `${payload}\n`, 'utf8');
}

diary.projects = summaries;
const compactDiary = scriptJson(diary);
html = html.slice(0, jsonStart) + ` ${compactDiary};\n` + html.slice(scriptEnd);
const runtimeCleanup = stripRedundantRuntimeData(html);
html = runtimeCleanup.html;
const legacyCleanup = stripLegacyRenderer(html);
html = legacyCleanup.html;
const projectDetailRuntime = await installProjectDetailRuntime(html);
html = projectDetailRuntime.html;
if (!html.includes('name="worksportfolio-data-mode"')) {
  html = html.replace('</head>', '<meta name="worksportfolio-data-mode" content="summary-inline-detail-on-demand"></head>');
}

if (html.includes("document.addEventListener('DOMContentLoaded', init);")) {
  throw new Error('Legacy inline renderer still binds DOMContentLoaded.');
}
if (!html.includes('project-detail.js')) throw new Error('Stable project detail runtime missing.');

await writeFile(indexUrl, html, 'utf8');

const finalIndexBytes = byteLength(html);
const finalDiaryBytes = byteLength(compactDiary);
const saved = initialDiaryBytes - finalDiaryBytes;
const percent = initialDiaryBytes ? Math.round((saved / initialDiaryBytes) * 100) : 0;
console.log(
  `Split project payload: ${projects.length} summaries inline; ${projects.length} on-demand detail files. ` +
  `Inline diary ${initialDiaryBytes.toLocaleString('en-US')} -> ${finalDiaryBytes.toLocaleString('en-US')} bytes ` +
  `(-${saved.toLocaleString('en-US')}, ${percent}%); redundant runtime -${runtimeCleanup.savedBytes.toLocaleString('en-US')} bytes; ` +
  `legacy renderer -${legacyCleanup.removedBytes.toLocaleString('en-US')} bytes; ` +
  `index ${initialIndexBytes.toLocaleString('en-US')} -> ${finalIndexBytes.toLocaleString('en-US')} bytes; ` +
  `detail payload ${detailBytes.toLocaleString('en-US')} bytes fetched only when opened; project detail ${projectDetailRuntime.hash}.`
);