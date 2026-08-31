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

function distance(a, b) {
  const left = String(a || '').toLowerCase();
  const right = String(b || '').toLowerCase();
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
  return !hidden.has(repoId) && !hidden.has(projectId);
});
const review = visible.map((repo) => {
  const repoId = repo.name || repo.id;
  const projectId = repositoryProjectIds[repoId] || repoId;
  const project = canonical.get(projectId) || {};
  const reasons = [];
  if (!canonical.has(projectId)) reasons.push('no-curation');
  if ((project.documentationState || 'unreviewed') !== 'verified') reasons.push('unreviewed');
  if (!repo.description && !project.summary) reasons.push('github-description-empty');
  if (!repo.liveUrl && !project.liveUrl) reasons.push('no-live-url');
  if (!repo.language && !(Array.isArray(project.technologies) && project.technologies.length)) reasons.push('technology-unknown');
  return { id: repoId, projectId, reasons };
}).filter((item) => item.reasons.length);

const duplicateCandidates = [];
for (let i = 0; i < repositories.length; i += 1) {
  for (let j = i + 1; j < repositories.length; j += 1) {
    const a = repositories[i].name || repositories[i].id || '';
    const b = repositories[j].name || repositories[j].id || '';
    if (Math.min(a.length, b.length) < 5) continue;
    const editDistance = distance(a, b);
    if (editDistance > 0 && editDistance <= 2) duplicateCandidates.push({ a, b, distance: editDistance });
  }
}

const summary = {
  generatedAt: catalog.generatedAt || null,
  repositoryCount: repositories.length,
  visibleCount: visible.length,
  hiddenCount: repositories.length - visible.length,
  canonicalProjectCount: canonical.size,
  verifiedProjectCount: [...canonical.values()].filter((item) => item?.documentationState === 'verified').length,
  needsReviewCount: review.length,
  possibleDuplicateCount: duplicateCandidates.length
};

console.log(`Portfolio audit: ${summary.visibleCount} visible / ${summary.repositoryCount} public repositories; ${summary.needsReviewCount} need editorial review; ${summary.canonicalProjectCount} canonical projects.`);
if (review.length) console.log(`Needs review: ${review.slice(0, 25).map((item) => `${item.id}[${item.reasons.join(',')}]`).join(' | ')}${review.length > 25 ? ` | +${review.length - 25} more` : ''}`);
if (duplicateCandidates.length) console.log(`Possible duplicates: ${duplicateCandidates.map((item) => `${item.a}↔${item.b}`).join(' | ')}`);
console.log(`PORTFOLIO_AUDIT_JSON=${JSON.stringify({ summary, review, duplicateCandidates })}`);
