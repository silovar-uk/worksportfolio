import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const owner = process.env.GITHUB_REPOSITORY_OWNER || process.env.PORTFOLIO_OWNER || 'silovar-uk';
const repositoryName = (process.env.GITHUB_REPOSITORY || `${owner}/worksportfolio`).split('/')[1] || 'worksportfolio';
const token = process.env.GITHUB_TOKEN || '';
const outputPath = new URL('../data/catalog.json', import.meta.url);
const configPath = new URL('../data/portfolio-config.json', import.meta.url);
const projectsPath = new URL('../data/projects.json', import.meta.url);

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'worksportfolio-catalog-builder'
};
if (token) headers.Authorization = `Bearer ${token}`;

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function fetchRepositories() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/users/${encodeURIComponent(owner)}/repos`);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('direction', 'desc');
    const batch = await fetchJson(url);
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories;
}

async function fetchLastHumanCommitDate() {
  try {
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/commits`);
    url.searchParams.set('per_page', '30');
    const commits = await fetchJson(url);
    const commit = commits.find((item) => {
      const login = item.author?.login || item.committer?.login || '';
      const email = item.commit?.author?.email || item.commit?.committer?.email || '';
      return login !== 'github-actions[bot]' && !email.includes('github-actions[bot]');
    });
    return commit?.commit?.author?.date || commit?.commit?.committer?.date || '';
  } catch (error) {
    console.warn(`Could not resolve the latest human commit for ${repositoryName}: ${error.message}`);
    return '';
  }
}

function cleanDate(value) { return value ? String(value).slice(0, 10) : ''; }
function toCatalogEntry(repo, selfUpdatedAt) {
  const pagesUrl = repo.has_pages ? `https://${owner}.github.io/${repo.name}/` : '';
  const updatedAt = repo.name === repositoryName && selfUpdatedAt ? selfUpdatedAt : (repo.pushed_at || repo.updated_at);
  return {
    id: repo.name,
    name: repo.name,
    description: repo.description || '',
    repositoryUrl: repo.html_url,
    liveUrl: repo.homepage || pagesUrl,
    language: repo.language || '',
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    archived: Boolean(repo.archived),
    fork: Boolean(repo.fork),
    visibility: repo.visibility || 'public',
    createdAt: cleanDate(repo.created_at),
    updatedAt: cleanDate(updatedAt),
    pushedAt: cleanDate(updatedAt),
    hasPages: Boolean(repo.has_pages),
    defaultBranch: repo.default_branch || 'main'
  };
}

async function readExistingCatalog() {
  try { return JSON.parse(await readFile(outputPath, 'utf8')); }
  catch (_) { return null; }
}

const rawConfig = JSON.parse(await readFile(configPath, 'utf8'));
const projects = JSON.parse(await readFile(projectsPath, 'utf8'));
const canonicalIds = new Set((Array.isArray(projects) ? projects : []).map((project) => String(project?.id || '')).filter(Boolean));
const selfUpdatedAt = await fetchLastHumanCommitDate();
const repositories = (await fetchRepositories())
  .filter((repo) => repo.visibility === 'public' || !repo.visibility)
  .map((repo) => toCatalogEntry(repo, selfUpdatedAt))
  .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.name.localeCompare(b.name));

const publicRepoIds = new Set(repositories.map((repo) => repo.id));
const keepId = (value) => publicRepoIds.has(String(value || '')) || canonicalIds.has(String(value || ''));
const config = {
  ...rawConfig,
  hiddenIds: Array.isArray(rawConfig.hiddenIds) ? rawConfig.hiddenIds.filter(keepId) : []
};
if (config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object') {
  config.repositoryProjectIds = Object.fromEntries(
    Object.entries(config.repositoryProjectIds).filter(([source, target]) => publicRepoIds.has(source) || canonicalIds.has(target))
  );
}
if ('overrides' in config) {
  console.warn('Legacy portfolio-config.overrides still exists; migrate it into data/projects.json.');
}

if (JSON.stringify(config) !== JSON.stringify(rawConfig)) {
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log('Removed stale repository references from portfolio-config.json');
}

const existing = await readExistingCatalog();
const nextPayload = { owner, repositoryCount: repositories.length, hiddenIds: config.hiddenIds || [], repositories };
const existingPayload = existing ? {
  owner: existing.owner,
  repositoryCount: existing.repositoryCount,
  hiddenIds: existing.hiddenIds,
  repositories: existing.repositories
} : null;
const unchanged = existingPayload && JSON.stringify(existingPayload) === JSON.stringify(nextPayload);
const output = { generatedAt: unchanged && existing.generatedAt ? existing.generatedAt : new Date().toISOString(), ...nextPayload };

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${repositories.length} public repositories to data/catalog.json${unchanged ? ' (unchanged)' : ''}`);
