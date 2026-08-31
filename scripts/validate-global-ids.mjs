import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path, fallback = null) => {
  try { return JSON.parse(await readFile(new URL(path, root), 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT' && fallback !== null) return fallback; throw error; }
};

const [config, catalog, projects, privateProjects, taxonomy, starts] = await Promise.all([
  readJson('data/portfolio-config.json'),
  readJson('data/catalog.json'),
  readJson('data/projects.json', []),
  readJson('data/manual-projects-private.json', []),
  readJson('data/portfolio-taxonomy.json'),
  readJson('data/project-start-dates.json', {})
]);

const errors = [];
const warnings = [];
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const projectIds = new Set();
const privateIds = new Set();

for (const project of projects) {
  const id = String(project?.id || '');
  if (!id) { errors.push('projects.json: missing project id'); continue; }
  if (projectIds.has(id)) errors.push(`projects.json: duplicate project id ${id}`);
  projectIds.add(id);
}
for (const project of privateProjects) {
  const id = String(project?.id || '');
  if (!id) { errors.push('manual-projects-private.json: missing project id'); continue; }
  if (privateIds.has(id)) errors.push(`manual-projects-private.json: duplicate project id ${id}`);
  if (projectIds.has(id)) errors.push(`global-id: private/public collision ${id}`);
  privateIds.add(id);
}

const repoNames = new Set();
const mappedTargets = new Map();
for (const repo of catalog.repositories || []) {
  const repoId = String(repo?.name || repo?.id || '');
  if (!repoId) continue;
  if (repoNames.has(repoId)) errors.push(`catalog.json: duplicate repository id ${repoId}`);
  repoNames.add(repoId);
  const target = String(repositoryProjectIds[repoId] || repoId);
  const sources = mappedTargets.get(target) || [];
  sources.push(repoId);
  mappedTargets.set(target, sources);
}
for (const [target, sources] of mappedTargets) {
  if (sources.length > 1) warnings.push(`source-alias: ${sources.join(', ')} -> ${target}`);
}
for (const [repoId, projectId] of Object.entries(repositoryProjectIds)) {
  if (!repoNames.has(repoId)) warnings.push(`repositoryProjectIds: source repository not currently discovered: ${repoId}`);
  if (!projectIds.has(projectId) && !repoNames.has(projectId)) warnings.push(`repositoryProjectIds: target project has no canonical record yet: ${repoId} -> ${projectId}`);
}

const known = new Set([...projectIds, ...privateIds, ...mappedTargets.keys()]);
const checkRefs = (label, ids) => {
  const seen = new Set();
  for (const raw of ids || []) {
    const id = String(raw || '');
    if (!id) continue;
    if (seen.has(id)) errors.push(`${label}: duplicate reference ${id}`);
    seen.add(id);
    if (!known.has(id)) errors.push(`${label}: unknown project reference ${id}`);
  }
};

checkRefs('hiddenIds', config.hiddenIds || []);
checkRefs('showcase.featuredProjectIds', taxonomy.showcase?.featuredProjectIds || []);
for (const family of taxonomy.families || []) checkRefs(`family:${family.id}`, family.projectIds || []);
for (const principle of taxonomy.principles || []) checkRefs(`principle:${principle.id}`, principle.projectIds || []);
for (const project of projects) {
  checkRefs(`relations:${project.id}`, (project.relatedProjects || []).map((relation) => relation?.id || relation?.target));
}
for (const projectId of Object.keys(starts || {})) {
  if (!known.has(projectId)) warnings.push(`project-start-dates: orphan record ${projectId}`);
}

warnings.forEach((message) => console.warn(`WARNING ${message}`));
if (errors.length) {
  errors.forEach((message) => console.error(`ERROR ${message}`));
  process.exit(1);
}
console.log(`Global ID validation passed: ${projectIds.size} canonical projects, ${privateIds.size} private summaries, ${repoNames.size} public repositories.`);
