import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const [projects, privateProjects, catalog, config, taxonomy, starts] = await Promise.all([
  readJson('data/projects.json'),
  readJson('data/private-projects.json'),
  readJson('data/catalog.json'),
  readJson('data/portfolio-config.json'),
  readJson('data/portfolio-taxonomy.json'),
  readJson('data/project-start-dates.json')
]);

const canonical = Array.isArray(projects) ? projects : [];
const privateSafe = Array.isArray(privateProjects) ? privateProjects : [];
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];
const hidden = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_.\-–—｜|/\\]+/g, '');
const present = (value) => Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());

function distance(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}

const familyIds = new Set();
for (const family of taxonomy.families || []) for (const id of family.projectIds || []) familyIds.add(id);

const verbCounts = new Map();
const typeCounts = new Map();
const records = [];
const consistencyIssues = [];

for (const project of canonical) {
  const checks = {
    identity: present(project.id) && present(project.title),
    description: present(project.summary) && project.summary !== 'GitHub上で管理している制作物。',
    friction: present(project.friction),
    firstBuild: present(project.firstBuild),
    currentAnswer: present(project.currentAnswer),
    chronology: present(project.startedAt),
    type: present(project.type),
    verbs: present(project.verbs),
    technology: present(project.technologies),
    documentation: project.documentationState === 'verified',
    relation: present(project.relatedProjects),
    artifact: present(project.liveUrl) || ['local', 'private'].includes(project.visibility)
  };
  const score = Object.values(checks).reduce((sum, ok) => sum + (ok ? 1 : 0), 0);
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  const technologies = (project.technologies || []).map(String);
  if (technologies.some((item) => /chrome extension|manifest v3/i.test(item)) && project.type !== 'chrome-extension') {
    consistencyIssues.push({ id: project.id, issue: 'chrome-extension-type-mismatch', type: project.type, technologies });
  }
  if (project.type === 'chrome-extension' && !technologies.some((item) => /chrome extension|manifest|javascript|typescript/i.test(item))) {
    consistencyIssues.push({ id: project.id, issue: 'chrome-extension-technology-weak', type: project.type, technologies });
  }
  if (project.documentationState === 'verified' && (!present(project.summary) || !present(project.startedAt) || !present(project.type))) {
    consistencyIssues.push({ id: project.id, issue: 'verified-but-core-metadata-missing' });
  }
  for (const verb of project.verbs || []) verbCounts.set(verb, (verbCounts.get(verb) || 0) + 1);
  if (project.type) typeCounts.set(project.type, (typeCounts.get(project.type) || 0) + 1);
  records.push({
    id: project.id,
    score,
    maxScore: Object.keys(checks).length,
    quality: score >= 11 ? 'verified-shape' : score >= 8 ? 'good' : score >= 5 ? 'needs-review' : 'poor',
    documentationState: project.documentationState || 'unreviewed',
    missing,
    hasFamily: familyIds.has(project.id),
    relationCount: Array.isArray(project.relatedProjects) ? project.relatedProjects.length : 0,
    startedAtBasis: project.startedAtBasis || starts?.[project.id]?.basis || null,
    startedAtPrecision: project.startedAtPrecision || starts?.[project.id]?.precision || null
  });
}

const duplicateCandidates = [];
for (let i = 0; i < repositories.length; i += 1) {
  for (let j = i + 1; j < repositories.length; j += 1) {
    const a = repositories[i]?.name || repositories[i]?.id || '';
    const b = repositories[j]?.name || repositories[j]?.id || '';
    if (!a || !b || Math.min(a.length, b.length) < 5) continue;
    const editDistance = distance(a, b);
    if (editDistance < 1 || editDistance > 2) continue;
    const aProject = repositoryProjectIds[a] || a;
    const bProject = repositoryProjectIds[b] || b;
    const resolution = aProject === bProject
      ? 'same-project-mapped'
      : hidden.has(a) || hidden.has(b) || hidden.has(aProject) || hidden.has(bProject)
        ? 'hidden-source-review'
        : 'unresolved';
    duplicateCandidates.push({ a, b, distance: editDistance, aProject, bProject, resolution });
  }
}

const exactTitleGroups = new Map();
for (const project of canonical) {
  const key = normalize(project.title);
  if (!key) continue;
  const ids = exactTitleGroups.get(key) || [];
  ids.push(project.id);
  exactTitleGroups.set(key, ids);
}
const duplicateTitles = [...exactTitleGroups.entries()].filter(([, ids]) => ids.length > 1).map(([normalizedTitle, ids]) => ({ normalizedTitle, ids }));

const visibleRepos = repositories.filter((repo) => {
  const repoId = repo?.name || repo?.id;
  const projectId = repositoryProjectIds[repoId] || repoId;
  return repoId && !hidden.has(repoId) && !hidden.has(projectId);
});
const mappedVisibleIds = new Set(visibleRepos.map((repo) => repositoryProjectIds[repo.name || repo.id] || repo.name || repo.id));
const canonicalWithoutPublicRepo = canonical.filter((project) => !mappedVisibleIds.has(project.id)).map((project) => project.id);
const sourceWithoutCanonical = visibleRepos.map((repo) => ({ repoId: repo.name || repo.id, projectId: repositoryProjectIds[repo.name || repo.id] || repo.name || repo.id })).filter(({ projectId }) => !canonical.some((project) => project.id === projectId));

records.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
const summary = {
  generatedAt: new Date().toISOString(),
  canonicalProjects: canonical.length,
  privateSafeProjects: privateSafe.length,
  publicRepositories: repositories.length,
  visiblePublicRepositories: visibleRepos.length,
  verifiedDocumentation: canonical.filter((project) => project.documentationState === 'verified').length,
  inferredDocumentation: canonical.filter((project) => project.documentationState === 'inferred').length,
  unreviewedDocumentation: canonical.filter((project) => !project.documentationState || project.documentationState === 'unreviewed').length,
  missingFriction: canonical.filter((project) => !present(project.friction)).length,
  missingFirstBuild: canonical.filter((project) => !present(project.firstBuild)).length,
  missingCurrentAnswer: canonical.filter((project) => !present(project.currentAnswer)).length,
  missingStartedAt: canonical.filter((project) => !present(project.startedAt)).length,
  withoutRelations: canonical.filter((project) => !present(project.relatedProjects)).length,
  consistencyIssues: consistencyIssues.length,
  unresolvedDuplicateCandidates: duplicateCandidates.filter((item) => item.resolution === 'unresolved').length,
  canonicalWithoutPublicRepo: canonicalWithoutPublicRepo.length,
  sourceWithoutCanonical: sourceWithoutCanonical.length
};

const payload = {
  summary,
  records,
  consistencyIssues,
  duplicateCandidates,
  duplicateTitles,
  canonicalWithoutPublicRepo,
  sourceWithoutCanonical,
  vocabulary: {
    types: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
    verbs: [...verbCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')).map(([value, count]) => ({ value, count }))
  }
};

await writeFile(new URL('data/data-quality-audit.json', root), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Data quality audit: ${summary.canonicalProjects} canonical / ${summary.privateSafeProjects} private-safe / ${summary.publicRepositories} repos; ${summary.consistencyIssues} consistency issues; ${summary.unresolvedDuplicateCandidates} unresolved duplicate candidates.`);
console.log(`Completeness: friction ${summary.missingFriction} missing; firstBuild ${summary.missingFirstBuild}; currentAnswer ${summary.missingCurrentAnswer}; startedAt ${summary.missingStartedAt}; no relations ${summary.withoutRelations}.`);
if (consistencyIssues.length) console.log(`Consistency issues: ${consistencyIssues.map((item) => `${item.id}[${item.issue}]`).join(' | ')}`);
if (duplicateCandidates.length) console.log(`Duplicate candidates: ${duplicateCandidates.map((item) => `${item.a}↔${item.b}[${item.resolution}]`).join(' | ')}`);
