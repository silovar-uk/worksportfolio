import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const config = await readJson('data/portfolio-config.json');
const catalog = await readJson('data/catalog.json');
const projects = await readJson('data/projects.json');

const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];
const hidden = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const canonical = new Map((Array.isArray(projects) ? projects : []).filter((project) => project?.id).map((project) => [String(project.id), project]));
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s_.\-–—｜|/\\]+/g, '');

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

const visible = repositories.filter((repo) => {
  const repoId = repo.name || repo.id;
  const projectId = repositoryProjectIds[repoId] || repoId;
  return repoId && !hidden.has(repoId) && !hidden.has(projectId);
});

const artifactStatus = (repo, project) => {
  if (repo.liveUrl || project.liveUrl) return 'live-url-recorded';
  if (project.type === 'chrome-extension') return 'extension-no-public-url-expected';
  if (project.visibility === 'local') return 'local-only';
  if (project.visibility === 'private' || project.sourceVisibility === 'private') return 'private';
  return 'review-needed';
};

const metadataReview = [];
const confidenceReview = [];
const artifactReview = [];
for (const repo of visible) {
  const repoId = repo.name || repo.id;
  const projectId = repositoryProjectIds[repoId] || repoId;
  const project = canonical.get(projectId) || {};
  const reasons = [];
  if (!canonical.has(projectId)) reasons.push('no-curation');
  if (!repo.description && !project.summary) reasons.push('github-description-empty');
  if (!repo.language && !(Array.isArray(project.technologies) && project.technologies.length)) reasons.push('technology-unknown');
  if (reasons.length) metadataReview.push({ id: repoId, projectId, reasons });
  if (!project.documentationState || project.documentationState === 'unreviewed') confidenceReview.push({ id: repoId, projectId, state: project.documentationState || 'unreviewed' });
  const artifact = artifactStatus(repo, project);
  if (artifact === 'review-needed') artifactReview.push({ id: repoId, projectId, status: artifact });
}

const duplicateCandidates = [];
for (let i = 0; i < repositories.length; i += 1) {
  for (let j = i + 1; j < repositories.length; j += 1) {
    const a = repositories[i].name || repositories[i].id || '';
    const b = repositories[j].name || repositories[j].id || '';
    if (Math.min(a.length, b.length) < 5) continue;
    const editDistance = distance(a, b);
    if (editDistance <= 0 || editDistance > 2) continue;
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
const unresolvedDuplicates = duplicateCandidates.filter((item) => item.resolution === 'unresolved');

const summary = {
  generatedAt: catalog.generatedAt || null,
  repositoryCount: repositories.length,
  visibleCount: visible.length,
  hiddenCount: repositories.length - visible.length,
  canonicalProjectCount: canonical.size,
  verifiedProjectCount: [...canonical.values()].filter((item) => item?.documentationState === 'verified').length,
  inferredProjectCount: [...canonical.values()].filter((item) => item?.documentationState === 'inferred').length,
  metadataReviewCount: metadataReview.length,
  confidenceReviewCount: confidenceReview.length,
  artifactReviewCount: artifactReview.length,
  unresolvedDuplicateCount: unresolvedDuplicates.length
};

console.log(`Portfolio audit: ${summary.visibleCount} visible / ${summary.repositoryCount} public repositories; ${summary.metadataReviewCount} metadata issues; ${summary.confidenceReviewCount} unreviewed confidence records; ${summary.artifactReviewCount} artifact checks; ${summary.unresolvedDuplicateCount} unresolved duplicates.`);
if (metadataReview.length) console.log(`Metadata review: ${metadataReview.slice(0, 25).map((item) => `${item.id}[${item.reasons.join(',')}]`).join(' | ')}${metadataReview.length > 25 ? ` | +${metadataReview.length - 25} more` : ''}`);
if (confidenceReview.length) console.log(`Confidence review: ${confidenceReview.slice(0, 25).map((item) => `${item.id}[${item.state}]`).join(' | ')}`);
if (artifactReview.length) console.log(`Artifact check: ${artifactReview.slice(0, 25).map((item) => item.id).join(' | ')}${artifactReview.length > 25 ? ` | +${artifactReview.length - 25} more` : ''}`);
if (duplicateCandidates.length) console.log(`Duplicate candidates: ${duplicateCandidates.map((item) => `${item.a}↔${item.b}[${item.resolution}]`).join(' | ')}`);
console.log(`PORTFOLIO_AUDIT_JSON=${JSON.stringify({ summary, metadataReview, confidenceReview, artifactReview, duplicateCandidates })}`);
