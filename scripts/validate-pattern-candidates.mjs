import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const audit = await readJson('data/pattern-audit.json');
const taxonomy = await readJson('data/pattern-taxonomy.json');
const candidateFiles = Array.isArray(audit.candidateFiles) ? audit.candidateFiles : [];
if (!candidateFiles.length) throw new Error('pattern-audit.json has no candidateFiles.');

const payloads = await Promise.all(candidateFiles.map(readJson));
const candidates = payloads.flatMap((payload) => Array.isArray(payload.candidates) ? payload.candidates : []);
const validCategories = new Set((taxonomy.categories || []).map((item) => item.id));
const auditCoverage = new Map((audit.coverage || []).map((item) => [item.projectId, Number(item.candidateCount || 0)]));
const counts = new Map();
const ids = new Set();

for (const candidate of candidates) {
  if (!candidate?.id || !candidate?.projectId || !candidate?.title || !candidate?.officialName) {
    throw new Error(`Candidate is missing required fields: ${JSON.stringify(candidate)}`);
  }
  if (ids.has(candidate.id)) throw new Error(`Duplicate pattern candidate id: ${candidate.id}`);
  ids.add(candidate.id);

  if (!Array.isArray(candidate.categories) || !candidate.categories.length) {
    throw new Error(`Candidate has no categories: ${candidate.id}`);
  }
  for (const category of candidate.categories) {
    if (!validCategories.has(category)) throw new Error(`Unknown pattern category '${category}' in ${candidate.id}`);
  }

  if (!['verified', 'documented', 'pending'].includes(candidate.verification)) {
    throw new Error(`Unknown verification state '${candidate.verification}' in ${candidate.id}`);
  }
  if (!candidate.sourceUrl) throw new Error(`Candidate has no sourceUrl: ${candidate.id}`);
  counts.set(candidate.projectId, (counts.get(candidate.projectId) || 0) + 1);
}

if (candidates.length !== Number(audit.candidateCount)) {
  throw new Error(`Candidate count mismatch: files=${candidates.length}, audit=${audit.candidateCount}`);
}
if (counts.size !== Number(audit.projectCount)) {
  throw new Error(`Project coverage mismatch: candidates=${counts.size}, audit=${audit.projectCount}`);
}

for (const [projectId, expectedCount] of auditCoverage) {
  const actualCount = counts.get(projectId) || 0;
  if (actualCount !== expectedCount) {
    throw new Error(`Coverage mismatch for ${projectId}: candidates=${actualCount}, audit=${expectedCount}`);
  }
}
for (const projectId of counts.keys()) {
  if (!auditCoverage.has(projectId)) throw new Error(`Candidate project missing from audit coverage: ${projectId}`);
}

console.log(`Pattern candidates OK: ${candidates.length} candidates / ${counts.size} projects / ${validCategories.size} categories.`);
