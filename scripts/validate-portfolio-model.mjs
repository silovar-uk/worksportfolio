import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const [taxonomy, policy, config, catalog, projects, privateProjects] = await Promise.all([
  readJson('data/portfolio-taxonomy.json'),
  readJson('data/editorial-policy.json'),
  readJson('data/portfolio-config.json'),
  readJson('data/catalog.json'),
  readJson('data/projects.json'),
  readJson('data/private-projects.json')
]);

const errors = [];
const warnings = [];
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const legacyRepositoryIds = config.legacyRepositoryIds && typeof config.legacyRepositoryIds === 'object' ? config.legacyRepositoryIds : {};
const hiddenIds = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const rawRepositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];
const rawRepositoryIds = new Set(rawRepositories.map((repo) => repo?.name || repo?.id || '').filter(Boolean));
const publicIds = new Set(rawRepositories.map((repo) => {
  const id = repo?.name || repo?.id || '';
  if (!id || legacyRepositoryIds[id]) return '';
  return repositoryProjectIds[id] || id;
}).filter(Boolean));
const canonicalIds = new Set((Array.isArray(projects) ? projects : []).map((project) => project?.id).filter(Boolean));
const privateIds = new Set((Array.isArray(privateProjects) ? privateProjects : []).map((project) => project?.id).filter(Boolean));
const knownIds = new Set([...publicIds, ...canonicalIds, ...privateIds]);

if (!policy?.publicationGate?.baselineCreatedDateMax) errors.push('editorial-policy: publicationGate.baselineCreatedDateMax is required');
if (!Array.isArray(taxonomy.families) || !taxonomy.families.length) errors.push('portfolio-taxonomy: families are required');
if (!Array.isArray(taxonomy.principles) || !taxonomy.principles.length) errors.push('portfolio-taxonomy: principles are required');
if ((taxonomy.families || []).length > 7) warnings.push(`portfolio-taxonomy: ${taxonomy.families.length} families may be too many`);
if ((taxonomy.principles || []).length > 5) warnings.push(`portfolio-taxonomy: ${taxonomy.principles.length} principles may be too many`);

for (const [sourceId, targetId] of Object.entries(legacyRepositoryIds)) {
  if (!targetId || !canonicalIds.has(targetId)) errors.push(`legacyRepositoryIds:${sourceId}: canonical target ${targetId || '(missing)'} does not exist`);
  if (repositoryProjectIds[sourceId]) errors.push(`legacyRepositoryIds:${sourceId}: legacy source must not also appear in repositoryProjectIds`);
  if (!hiddenIds.has(sourceId)) errors.push(`legacyRepositoryIds:${sourceId}: legacy source must also be hidden`);
  if (!rawRepositoryIds.has(sourceId)) warnings.push(`legacyRepositoryIds:${sourceId}: source repository is no longer public; historical mapping retained`);
}

const titleGroups = new Map();
for (const project of projects || []) {
  if (!project?.id || !project?.title) continue;
  const key = String(project.title).normalize('NFKC').toLowerCase().replace(/[\s_.\-–—｜|/\\]+/g, '');
  if (!key) continue;
  const ids = titleGroups.get(key) || [];
  ids.push(project.id);
  titleGroups.set(key, ids);
}
for (const [titleKey, ids] of titleGroups) {
  if (ids.length > 1) errors.push(`projects.json: duplicate visible title ${titleKey} -> ${ids.join(', ')}`);
}

const checkRefs = (label, values) => {
  const seen = new Set();
  for (const raw of values || []) {
    const id = String(raw || '');
    if (!id) continue;
    if (seen.has(id)) errors.push(`${label}: duplicate project reference ${id}`);
    seen.add(id);
    if (!knownIds.has(id)) errors.push(`${label}: unknown project reference ${id}`);
  }
};

checkRefs('showcase.featuredProjectIds', taxonomy.showcase?.featuredProjectIds || []);
for (const family of taxonomy.families || []) {
  if (!family?.id || !family?.label) errors.push('family: id and label are required');
  checkRefs(`family:${family?.id || '(missing)'}`, family?.projectIds || []);
}
for (const principle of taxonomy.principles || []) {
  if (!principle?.id || !principle?.label) errors.push('principle: id and label are required');
  checkRefs(`principle:${principle?.id || '(missing)'}`, principle?.projectIds || []);
}
for (const project of projects || []) {
  if (!project?.id) errors.push('projects.json: project without id');
  if (!project?.title || !project?.summary) warnings.push(`projects.json:${project?.id || '(missing)'}: title/summary incomplete`);
  checkRefs(`project:${project?.id || '(missing)'}:relations`, (project?.relatedProjects || []).map((relation) => relation?.id || relation?.target));
}

const owner = config.owner || 'silovar-uk';
for (const repo of rawRepositories) {
  const repoId = repo?.name || repo?.id || '';
  if (!repoId || legacyRepositoryIds[repoId]) continue;
  const projectId = repositoryProjectIds[repoId] || repoId;
  const project = (projects || []).find((item) => item?.id === projectId);
  if (!project || !repo.hasPages || !String(project.liveUrl || '').startsWith(`https://${owner}.github.io/`)) continue;
  const expected = new URL(`https://${owner}.github.io/${repoId}/`);
  let actual;
  try { actual = new URL(String(project.liveUrl)); }
  catch { errors.push(`projects.json:${projectId}: liveUrl is not a valid URL: ${project.liveUrl}`); continue; }
  const normalizePath = (path) => path.endsWith('/') ? path : `${path}/`;
  if (actual.origin !== expected.origin || normalizePath(actual.pathname) !== normalizePath(expected.pathname)) {
    errors.push(`projects.json:${projectId}: GitHub Pages path ${actual.origin}${actual.pathname} does not match source repository ${expected.origin}${expected.pathname}`);
  }
}

const forbidden = /(api\.github\.com\/repos\/|github\.com\/silovar-uk\/(?:private-memo|karaoke-db|uicleaner|prompt-caller|daily-log)(?:\/|"|$))/i;
for (const project of privateProjects || []) {
  if (project?.sourceVisibility !== 'private') errors.push(`private:${project?.id}: sourceVisibility must be private`);
  if (project?.summaryOnly !== true) errors.push(`private:${project?.id}: summaryOnly must be true`);
  if (project?.repositoryUrl) errors.push(`private:${project?.id}: repositoryUrl must be empty`);
  if (forbidden.test(JSON.stringify(project))) errors.push(`private:${project?.id}: private repository metadata detected`);
}

warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR ${error}`));
  process.exit(1);
}
console.log(`Portfolio model valid: ${canonicalIds.size} canonical projects, ${privateIds.size} private summaries, ${Object.keys(legacyRepositoryIds).length} legacy repositories, ${(taxonomy.families || []).length} families, ${(taxonomy.principles || []).length} principles.`);
