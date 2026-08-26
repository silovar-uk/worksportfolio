import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readText = (path) => readFile(new URL(path, root), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');

const [policy, config, catalog] = await Promise.all([
  readJson('data/editorial-policy.json'),
  readJson('data/portfolio-config.json'),
  readJson('data/catalog.json')
]);

if (!policy?.publicationGate?.enabled) {
  console.log('Editorial publication gate is disabled.');
  process.exit(0);
}

const baseline = String(policy.publicationGate.baselineCreatedDateMax || '9999-12-31');
const overrides = config.overrides && typeof config.overrides === 'object' ? config.overrides : {};
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];
const withheld = new Set();

for (const repo of repositories) {
  const repoId = repo?.name || repo?.id;
  if (!repoId) continue;
  const projectId = repositoryProjectIds[repoId] || repoId;
  const override = overrides[repoId] || overrides[projectId] || {};
  const state = override.editorialState || '';
  const createdAt = String(repo.createdAt || repo.created_at || '').slice(0, 10);
  const grandfathered = Boolean(createdAt && createdAt <= baseline);
  const explicitlyPublished = state === 'published';
  const explicitlyHidden = state === 'hidden';
  if (explicitlyHidden || (!grandfathered && !explicitlyPublished)) withheld.add(projectId);
}

if (!withheld.size) {
  console.log('Editorial gate: no public projects withheld.');
  process.exit(0);
}

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
const before = Array.isArray(diary.projects) ? diary.projects : [];
diary.projects = before.filter((project) => !withheld.has(project?.id));
const valid = new Set(diary.projects.map((project) => project.id));

diary.projects.forEach((project) => {
  if (Array.isArray(project.relatedProjects)) project.relatedProjects = project.relatedProjects.filter((relation) => relation && valid.has(relation.id));
});
if (Array.isArray(diary.periods)) diary.periods.forEach((period) => {
  if (Array.isArray(period.projectIds)) period.projectIds = period.projectIds.filter((id) => valid.has(id));
});
if (diary.settings && typeof diary.settings === 'object') {
  ['featuredProjectIds', 'recentProjectIds'].forEach((key) => {
    if (Array.isArray(diary.settings[key])) diary.settings[key] = diary.settings[key].filter((id) => valid.has(id));
  });
}

html = html.slice(0, jsonStart) + ` ${scriptJson(diary)};\n` + html.slice(scriptEnd);
await writeFile(indexUrl, html, 'utf8');
console.log(`Editorial gate withheld ${before.length - diary.projects.length} newly discovered / non-published public project(s).`);
