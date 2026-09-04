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

function patchDetailLoader(html) {
  const original = `  function openProject(id, push = true) {\n    const project = state.projects.find(item => item.id === id);\n    if (!project) return;\n    state.selectedProjectId = id;\n    els.projectDetail.innerHTML = renderProjectDetail(project);\n    if (!els.projectDialog.open) els.projectDialog.showModal();\n    bindProjectButtons();\n    if (push) updateUrl();\n  }`;

  if (!html.includes(original)) {
    if (html.includes('const projectDetailCache = new Map();')) return html;
    throw new Error('Canonical openProject function was not found for lazy-detail patching.');
  }

  const replacement = `  const projectDetailCache = new Map();\n  let projectDetailRequest = 0;\n\n  async function loadProjectDetail(id) {\n    if (projectDetailCache.has(id)) return projectDetailCache.get(id);\n    const path = \`data/project-details/\${encodeURIComponent(id)}.json\`;\n    const response = await fetch(path, { cache: 'force-cache' });\n    if (!response.ok) throw new Error(\`\${path}: \${response.status}\`);\n    const detail = await response.json();\n    projectDetailCache.set(id, detail);\n    return detail;\n  }\n\n  async function openProject(id, push = true) {\n    const summary = state.projects.find(item => item.id === id);\n    if (!summary) return;\n    state.selectedProjectId = id;\n    const requestId = ++projectDetailRequest;\n    els.projectDetail.innerHTML = '<div class="loading">詳細を読み込んでいます。</div>';\n    if (!els.projectDialog.open) els.projectDialog.showModal();\n    if (push) updateUrl();\n    try {\n      const detail = await loadProjectDetail(id);\n      if (state.selectedProjectId !== id || requestId !== projectDetailRequest) return;\n      const project = { ...summary, ...detail, id: summary.id };\n      els.projectDetail.innerHTML = renderProjectDetail(project);\n      bindProjectButtons();\n    } catch (error) {\n      console.error(error);\n      if (state.selectedProjectId !== id || requestId !== projectDetailRequest) return;\n      els.projectDetail.innerHTML = '<div class="empty-state"><h3>詳細を読み込めませんでした。</h3><p>一覧はそのまま利用できます。時間をおいてもう一度開いてください。</p></div>';\n    }\n  }`;

  return html.replace(original, replacement);
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
html = patchDetailLoader(html);
const runtimeCleanup = stripRedundantRuntimeData(html);
html = runtimeCleanup.html;
if (!html.includes('name="worksportfolio-data-mode"')) {
  html = html.replace('</head>', '<meta name="worksportfolio-data-mode" content="summary-inline-detail-on-demand"></head>');
}

await writeFile(indexUrl, html, 'utf8');

const finalIndexBytes = byteLength(html);
const finalDiaryBytes = byteLength(compactDiary);
const saved = initialDiaryBytes - finalDiaryBytes;
const percent = initialDiaryBytes ? Math.round((saved / initialDiaryBytes) * 100) : 0;
console.log(
  `Split project payload: ${projects.length} summaries inline; ${projects.length} on-demand detail files. ` +
  `Inline diary ${initialDiaryBytes.toLocaleString('en-US')} -> ${finalDiaryBytes.toLocaleString('en-US')} bytes ` +
  `(-${saved.toLocaleString('en-US')}, ${percent}%); redundant runtime -${runtimeCleanup.savedBytes.toLocaleString('en-US')} bytes; ` +
  `index ${initialIndexBytes.toLocaleString('en-US')} -> ${finalIndexBytes.toLocaleString('en-US')} bytes; ` +
  `detail payload ${detailBytes.toLocaleString('en-US')} bytes fetched only when opened.`
);
