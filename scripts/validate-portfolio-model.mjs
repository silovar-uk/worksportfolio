import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const files = [
  'data/manual-projects.json',
  'data/manual-projects-extra.json',
  'data/manual-projects-daily-log.json',
  'data/manual-projects-private.json'
];

const [taxonomy, policy, config, catalog, ...manualSets] = await Promise.all([
  readJson('data/portfolio-taxonomy.json'),
  readJson('data/editorial-policy.json'),
  readJson('data/portfolio-config.json'),
  readJson('data/catalog.json'),
  ...files.map(readJson)
]);

const errors = [];
const warnings = [];
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const publicIds = new Set((catalog.repositories || []).map((repo) => {
  const id = repo?.name || repo?.id || '';
  return id ? (repositoryProjectIds[id] || id) : '';
}).filter(Boolean));
const manualIds = new Set(manualSets.flat().map((project) => project?.id).filter(Boolean));
const knownIds = new Set([...publicIds, ...manualIds]);

if (!policy?.publicationGate?.baselineCreatedDateMax) errors.push('editorial-policy: publicationGate.baselineCreatedDateMax is required');
if (!Array.isArray(taxonomy.families) || !taxonomy.families.length) errors.push('portfolio-taxonomy: families are required');
if (!Array.isArray(taxonomy.principles) || !taxonomy.principles.length) errors.push('portfolio-taxonomy: principles are required');
if ((taxonomy.families || []).length > 7) warnings.push(`portfolio-taxonomy: ${taxonomy.families.length} families may be too many`);
if ((taxonomy.principles || []).length > 5) warnings.push(`portfolio-taxonomy: ${taxonomy.principles.length} principles may be too many`);

const checkRefs = (label, values) => {
  const seen = new Set();
  for (const id of values || []) {
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

const privateProjects = manualSets.at(-1) || [];
const forbidden = /(api\.github\.com\/repos\/|github\.com\/silovar-uk\/(?:private-memo|karaoke-db|uicleaner|prompt-caller|daily-log)(?:\/|"|$))/i;
for (const project of privateProjects) {
  if (project?.sourceVisibility !== 'private') errors.push(`private:${project?.id}: sourceVisibility must be private`);
  if (project?.summaryOnly !== true) errors.push(`private:${project?.id}: summaryOnly must be true`);
  if (project?.repositoryUrl) errors.push(`private:${project?.id}: repositoryUrl must be empty`);
  if (forbidden.test(JSON.stringify(project))) errors.push(`private:${project?.id}: private repository metadata detected`);
}

for (const [index, set] of manualSets.entries()) {
  const seen = new Set();
  for (const project of set) {
    if (!project?.id) errors.push(`${files[index]}: project without id`);
    else if (seen.has(project.id)) errors.push(`${files[index]}: duplicate id ${project.id}`);
    else seen.add(project.id);
  }
}

if (warnings.length) warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR ${error}`));
  process.exit(1);
}
console.log(`Portfolio model valid: ${(taxonomy.families || []).length} families, ${(taxonomy.principles || []).length} principles, ${(taxonomy.showcase?.featuredProjectIds || []).length} featured works.`);
