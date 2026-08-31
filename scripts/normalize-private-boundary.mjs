import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const projects = await readJson('data/projects.json');
const privateProjects = await readJson('data/manual-projects-private.json');
const privateMap = new Map((Array.isArray(privateProjects) ? privateProjects : []).filter((project) => project?.id).map((project) => [String(project.id), { ...project }]));
const publicProjects = [];
const moved = [];

for (const source of Array.isArray(projects) ? projects : []) {
  if (!source?.id) continue;
  const isPrivateSummary = source.sourceVisibility === 'private' || source.summaryOnly === true;
  if (!isPrivateSummary) {
    publicProjects.push(source);
    continue;
  }
  const id = String(source.id);
  const prior = privateMap.get(id) || {};
  const safe = {
    ...source,
    ...prior,
    id,
    visibility: 'private',
    sourceVisibility: 'private',
    summaryOnly: true,
    repositoryUrl: ''
  };
  for (const key of ['githubId', 'defaultBranch', 'cloneUrl', 'gitUrl', 'sourceRepository', 'repository']) delete safe[key];
  privateMap.set(id, safe);
  moved.push(id);
}

publicProjects.sort((a, b) => String(a.id).localeCompare(String(b.id)));
const nextPrivate = [...privateMap.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
await writeJson('data/projects.json', publicProjects);
await writeJson('data/manual-projects-private.json', nextPrivate);
console.log(`Private boundary normalized: ${moved.length} record(s) moved from canonical public registry to safe private summaries${moved.length ? `: ${moved.join(', ')}` : '.'}`);
