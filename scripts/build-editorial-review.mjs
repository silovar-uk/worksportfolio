import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const [policy, config, catalog, taxonomy, projects] = await Promise.all([
  readJson('data/editorial-policy.json'),
  readJson('data/portfolio-config.json'),
  readJson('data/catalog.json'),
  readJson('data/portfolio-taxonomy.json'),
  readJson('data/projects.json')
]);

const hidden = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const canonical = new Map((Array.isArray(projects) ? projects : []).filter((project) => project?.id).map((project) => [String(project.id), project]));
const baseline = String(policy?.publicationGate?.baselineCreatedDateMax || '9999-12-31');
const familyByProject = new Map();
for (const family of taxonomy.families || []) {
  for (const id of family.projectIds || []) {
    const list = familyByProject.get(id) || [];
    list.push(family.id);
    familyByProject.set(id, list);
  }
}

const artifactStatus = (repo, project) => {
  if (repo.liveUrl || project.liveUrl) return 'live-url-recorded';
  if (project.type === 'chrome-extension') return 'extension-no-public-url-expected';
  if (project.visibility === 'local') return 'local-only';
  if (project.visibility === 'private' || project.sourceVisibility === 'private') return 'private';
  return 'review-needed';
};

const validStates = new Set(['discovered', 'candidate', 'curated', 'published', 'hidden']);
const items = [];
for (const repo of Array.isArray(catalog.repositories) ? catalog.repositories : []) {
  const repoId = repo?.name || repo?.id;
  if (!repoId) continue;
  const projectId = repositoryProjectIds[repoId] || repoId;
  const project = canonical.get(projectId) || {};
  const createdAt = String(repo.createdAt || '').slice(0, 10);
  const grandfathered = Boolean(createdAt && createdAt <= baseline);
  let state = hidden.has(repoId) || hidden.has(projectId) ? 'hidden' : (validStates.has(project.editorialState) ? project.editorialState : '');
  if (!state) state = grandfathered ? 'published' : (policy?.publicationGate?.defaultNewRepositoryState || 'discovered');

  const reasons = [];
  if (!canonical.has(projectId)) reasons.push('no-curation');
  if (!repo.description && !project.summary) reasons.push('generic-summary');
  if (!repo.language && !(Array.isArray(project.technologies) && project.technologies.length)) reasons.push('technology-unknown');

  const artifact = artifactStatus(repo, project);
  items.push({
    id: repoId,
    projectId,
    state,
    reasons,
    families: familyByProject.get(projectId) || [],
    createdAt: createdAt || null,
    updatedAt: String(repo.updatedAt || repo.pushedAt || '').slice(0, 10) || null,
    hasLiveUrl: Boolean(repo.liveUrl || project.liveUrl),
    artifactStatus: artifact,
    artifactReviewNeeded: artifact === 'review-needed',
    documentationState: project.documentationState || 'unreviewed'
  });
}

const priority = { discovered: 0, candidate: 1, curated: 2, published: 3, hidden: 4 };
items.sort((a, b) => (priority[a.state] ?? 9) - (priority[b.state] ?? 9) || b.reasons.length - a.reasons.length || a.id.localeCompare(b.id));
const counts = items.reduce((result, item) => {
  result[item.state] = (result[item.state] || 0) + 1;
  return result;
}, {});
const warnings = items.filter((item) => item.state !== 'hidden' && item.reasons.length).length;
const artifactReviewCount = items.filter((item) => item.state !== 'hidden' && item.artifactReviewNeeded).length;
const payload = {
  generatedAt: catalog.generatedAt || new Date().toISOString(),
  policyVersion: policy.version || 1,
  publicRepositoriesOnly: true,
  summary: { total: items.length, ...counts, withWarnings: warnings, artifactReviewNeeded: artifactReviewCount },
  items
};

await writeFile(new URL('data/editorial-review.json', root), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Editorial review: ${counts.discovered || 0} discovered, ${counts.candidate || 0} candidate, ${counts.published || 0} published; ${warnings} metadata warnings; ${artifactReviewCount} artifact checks.`);
