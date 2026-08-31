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
const publicIds = new Set((catalog.repositories || []).map((repo) => {
  const id = repo?.name || repo?.id || '';
  return id ? (repositoryProjectIds[id] || id) : '';
}).filter(Boolean));
const canonicalIds = new Set((Array.isArray(projects) ? projects : []).map((project) => project?.id).filter(Boolean));
const privateIds = new Set((Array.isArray(privateProjects) ? privateProjects : []).map((project) => project?.id).filter(Boolean));
const knownIds = new Set([...publicIds, ...canonicalIds, ...privateIds]);

if (!policy?.publicationGate?.baselineCreatedDateMax) errors.push('editorial-policy: publicationGate.baselineCreatedDateMax is required');
if (!Array.isArray(taxonomy.families) || !taxonomy.families.length) errors.push('portfolio-taxonomy: families are required');
if (!Array.isArray(taxonomy.principles) || !taxonomy.principles.length) errors.push('portfolio-taxonomy: principles are required');
if ((taxonomy.families || []).length > 7) warnings.push(`portfolio-taxonomy: ${taxonomy.families.length} families may be too many`);
if ((taxonomy.principles || []).length > 5) warnings.push(`portfolio-taxonomy: ${taxonomy.principles.length} principles may be too many`);

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
console.log(`Portfolio model valid: ${canonicalIds.size} canonical projects, ${privateIds.size} private summaries, ${(taxonomy.families || []).length} families, ${(taxonomy.principles || []).length} principles.`);
