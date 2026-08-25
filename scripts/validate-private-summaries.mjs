import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const path = new URL('data/manual-projects-private.json', root);
const projects = JSON.parse(await readFile(path, 'utf8'));
const issues = [];
const ids = new Set();

for (const project of Array.isArray(projects) ? projects : []) {
  const id = String(project?.id || '');
  if (!id) issues.push('missing-id');
  if (ids.has(id)) issues.push(`${id}:duplicate-id`);
  ids.add(id);
  if (project?.sourceVisibility !== 'private') issues.push(`${id}:sourceVisibility-must-be-private`);
  if (project?.visibility !== 'private') issues.push(`${id}:visibility-must-be-private`);
  if (project?.summaryOnly !== true) issues.push(`${id}:summaryOnly-must-be-true`);
  if (project?.repositoryUrl) issues.push(`${id}:repositoryUrl-must-be-empty`);
  if (!project?.title || !project?.summary) issues.push(`${id}:title-and-summary-required`);

  const serialized = JSON.stringify(project);
  if (/github\.com\/silovar-uk\//i.test(serialized)) issues.push(`${id}:private-github-url-leak`);
  if (/api\.github\.com\/repos\/silovar-uk\//i.test(serialized)) issues.push(`${id}:private-github-api-url-leak`);
  if (/clone_url|git_commits_url|git_refs_url|default_branch/i.test(serialized)) issues.push(`${id}:repository-metadata-leak`);
}

if (issues.length) {
  console.error(`Private summary validation failed: ${issues.join(' | ')}`);
  process.exit(1);
}

console.log(`Private summary validation passed: ${projects.length} safe summary-only projects.`);
