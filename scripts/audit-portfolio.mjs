import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const config = await readJson('data/portfolio-config.json');
const catalog = await readJson('data/catalog.json');

const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];
const hidden = new Set(Array.isArray(config.hiddenIds) ? config.hiddenIds : []);
const overrides = config.overrides && typeof config.overrides === 'object' ? config.overrides : {};

function distance(a, b) {
  const left = String(a || '').toLowerCase();
  const right = String(b || '').toLowerCase();
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
      previous = saved;
    }
  }
  return row[right.length];
}

const visible = repositories.filter((repo) => !hidden.has(repo.name || repo.id));
const review = visible.map((repo) => {
  const id = repo.name || repo.id;
  const override = overrides[id] || {};
  const reasons = [];
  if (!Object.keys(override).length) reasons.push('no-curation');
  if ((override.documentationState || 'unreviewed') !== 'verified') reasons.push('unreviewed');
  if (!repo.description) reasons.push('github-description-empty');
  if (!repo.liveUrl && !override.liveUrl) reasons.push('no-live-url');
  if (!repo.language && !(Array.isArray(override.technologies) && override.technologies.length)) reasons.push('technology-unknown');
  return { id, reasons };
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
  verifiedOverrideCount: Object.values(overrides).filter((item) => item?.documentationState === 'verified').length,
  needsReviewCount: review.length,
  possibleDuplicateCount: duplicateCandidates.length
};

console.log(`Portfolio audit: ${summary.visibleCount} visible / ${summary.repositoryCount} public repositories; ${summary.needsReviewCount} need editorial review.`);
if (review.length) console.log(`Needs review: ${review.slice(0, 25).map((item) => `${item.id}[${item.reasons.join(',')}]`).join(' | ')}${review.length > 25 ? ` | +${review.length - 25} more` : ''}`);
if (duplicateCandidates.length) console.log(`Possible duplicates: ${duplicateCandidates.map((item) => `${item.a}↔${item.b}`).join(' | ')}`);
console.log(`PORTFOLIO_AUDIT_JSON=${JSON.stringify({ summary, review, duplicateCandidates })}`);
