import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const config = await readJson('data/portfolio-config.json');
const catalog = await readJson('data/catalog.json');
const manualProjects = [
  ...(await readJson('data/manual-projects.json')),
  ...(await readJson('data/manual-projects-extra.json'))
];
const audit = await readJson('data/pattern-audit.json');
const rules = await readJson('data/pattern-merge-rules.json');
const projectStartDates = await readJson('data/project-start-dates.json');

const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object'
  ? config.repositoryProjectIds
  : {};
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];
const publicProjectIds = repositories
  .map((repo) => {
    const repositoryId = repo?.name || repo?.id || '';
    return repositoryId ? (repositoryProjectIds[repositoryId] || repositoryId) : '';
  })
  .filter(Boolean);
const manualProjectIds = manualProjects.map((project) => project?.id ? String(project.id) : '').filter(Boolean);
const allowed = new Set([...publicProjectIds, ...manualProjectIds]);

const candidateFiles = Array.isArray(audit.candidateFiles) ? audit.candidateFiles : [];
const allCandidates = [];
let removedCandidates = 0;
for (const path of candidateFiles) {
  const payload = await readJson(path);
  const before = Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidates = before.filter((candidate) => candidate?.projectId && allowed.has(String(candidate.projectId)));
  removedCandidates += before.length - candidates.length;
  allCandidates.push(...candidates);
  if (candidates.length !== before.length) await writeJson(path, { ...payload, candidates });
}

const candidateIds = new Set(allCandidates.map((candidate) => candidate.id).filter(Boolean));
const nextGroups = (Array.isArray(rules.groups) ? rules.groups : [])
  .map((group) => ({ ...group, members: (Array.isArray(group.members) ? group.members : []).filter((id) => candidateIds.has(id)) }))
  .filter((group) => group.members.length >= 2);
if (JSON.stringify(nextGroups) !== JSON.stringify(rules.groups || [])) {
  await writeJson('data/pattern-merge-rules.json', { ...rules, groups: nextGroups });
}

const projectCounts = new Map();
const projectVerification = new Map();
for (const candidate of allCandidates) {
  const projectId = String(candidate.projectId);
  projectCounts.set(projectId, (projectCounts.get(projectId) || 0) + 1);
  const set = projectVerification.get(projectId) || new Set();
  set.add(candidate.verification || 'pending');
  projectVerification.set(projectId, set);
}
const originalOrder = new Map((Array.isArray(audit.coverage) ? audit.coverage : []).map((item, index) => [item.projectId, index]));
const coverage = [...projectCounts.keys()]
  .sort((a, b) => (originalOrder.get(a) ?? 9999) - (originalOrder.get(b) ?? 9999) || a.localeCompare(b))
  .map((projectId) => ({
    projectId,
    candidateCount: projectCounts.get(projectId),
    verification: [...projectVerification.get(projectId)]
  }));
const nextAudit = {
  ...audit,
  projectCount: coverage.length,
  candidateCount: allCandidates.length,
  coverage
};
if (JSON.stringify(nextAudit) !== JSON.stringify(audit)) await writeJson('data/pattern-audit.json', nextAudit);

const nextStartDates = Object.fromEntries(Object.entries(projectStartDates).filter(([projectId]) => allowed.has(projectId)));
if (JSON.stringify(nextStartDates) !== JSON.stringify(projectStartDates)) await writeJson('data/project-start-dates.json', nextStartDates);

console.log(`Sanitized project-derived data: ${allCandidates.length} pattern candidates kept, ${removedCandidates} removed, ${coverage.length} candidate source projects.`);
