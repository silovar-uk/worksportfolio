import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const patternsData = await readJson('data/patterns.json');
const taxonomy = await readJson('data/pattern-taxonomy.json');
const audit = await readJson('data/pattern-audit.json');
const rules = await readJson('data/pattern-merge-rules.json');
const payloads = await Promise.all((audit.candidateFiles || []).map(readJson));
const candidates = payloads.flatMap((payload) => payload.candidates || []);

const validCategories = new Set((taxonomy.categories || []).map((item) => item.id));
const candidateIds = new Set(candidates.map((candidate) => candidate.id));
const patternIds = new Set();
const coveredCandidates = new Map();

if (!Array.isArray(patternsData.patterns) || !patternsData.patterns.length) throw new Error('patterns.json has no patterns.');
if (Number(patternsData.sourceCandidateCount) !== candidates.length) {
  throw new Error(`sourceCandidateCount mismatch: patterns=${patternsData.sourceCandidateCount}, candidates=${candidates.length}`);
}
if (Number(patternsData.mergeGroupCount) !== (rules.groups || []).length) {
  throw new Error(`mergeGroupCount mismatch: patterns=${patternsData.mergeGroupCount}, rules=${rules.groups.length}`);
}
if (Number(patternsData.patternCount) !== patternsData.patterns.length) {
  throw new Error(`patternCount mismatch: meta=${patternsData.patternCount}, actual=${patternsData.patterns.length}`);
}
if (patternsData.patterns.length >= candidates.length) {
  throw new Error(`Consolidation did not reduce candidates: patterns=${patternsData.patterns.length}, candidates=${candidates.length}`);
}

const requiredText = ['id', 'title', 'subtitle', 'officialName', 'summary', 'problem', 'solution', 'primaryCategory', 'verification', 'maturity'];
for (const pattern of patternsData.patterns) {
  for (const field of requiredText) {
    if (typeof pattern[field] !== 'string' || !pattern[field].trim()) throw new Error(`Pattern missing ${field}: ${pattern.id || '(no id)'}`);
  }
  if (patternIds.has(pattern.id)) throw new Error(`Duplicate pattern id: ${pattern.id}`);
  patternIds.add(pattern.id);

  if (!Array.isArray(pattern.categories) || !pattern.categories.length) throw new Error(`Pattern has no categories: ${pattern.id}`);
  for (const category of pattern.categories) {
    if (!validCategories.has(category)) throw new Error(`Unknown category '${category}' in ${pattern.id}`);
  }
  if (!pattern.categories.includes(pattern.primaryCategory)) throw new Error(`primaryCategory is not in categories: ${pattern.id}`);

  for (const field of ['useWhen', 'cautions', 'transferIdeas', 'projectIds', 'sourceCandidateIds', 'usedIn', 'links', 'relatedPatternIds']) {
    if (!Array.isArray(pattern[field])) throw new Error(`Pattern field ${field} must be an array: ${pattern.id}`);
  }
  if (!pattern.sourceCandidateIds.length) throw new Error(`Pattern has no sourceCandidateIds: ${pattern.id}`);
  if (!pattern.projectIds.length) throw new Error(`Pattern has no projectIds: ${pattern.id}`);

  for (const candidateId of pattern.sourceCandidateIds) {
    if (!candidateIds.has(candidateId)) throw new Error(`Unknown source candidate ${candidateId} in ${pattern.id}`);
    if (coveredCandidates.has(candidateId)) throw new Error(`Candidate ${candidateId} is covered by both ${coveredCandidates.get(candidateId)} and ${pattern.id}`);
    coveredCandidates.set(candidateId, pattern.id);
  }
  for (const link of pattern.links) {
    if (!link?.url || !/^https:\/\//.test(link.url)) throw new Error(`Invalid link in ${pattern.id}`);
  }
}

for (const candidateId of candidateIds) {
  if (!coveredCandidates.has(candidateId)) throw new Error(`Candidate is not represented in patterns.json: ${candidateId}`);
}
for (const pattern of patternsData.patterns) {
  for (const relatedId of pattern.relatedPatternIds) {
    if (!patternIds.has(relatedId)) throw new Error(`Unknown related pattern ${relatedId} in ${pattern.id}`);
    if (relatedId === pattern.id) throw new Error(`Pattern relates to itself: ${pattern.id}`);
  }
}

for (const group of rules.groups || []) {
  const formal = patternsData.patterns.find((pattern) => pattern.id === group.id);
  if (!formal) throw new Error(`Merge group did not produce formal pattern: ${group.id}`);
  const actual = new Set(formal.sourceCandidateIds);
  for (const member of group.members) {
    if (!actual.has(member)) throw new Error(`Merged pattern ${group.id} lost member ${member}`);
  }
}

console.log(`Formal patterns OK: ${patternsData.patterns.length} patterns / ${candidates.length} candidates fully covered.`);
