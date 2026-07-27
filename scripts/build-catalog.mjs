import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const owner = process.env.GITHUB_REPOSITORY_OWNER || process.env.PORTFOLIO_OWNER || 'silovar-uk';
const token = process.env.GITHUB_TOKEN || '';
const outputPath = new URL('../data/catalog.json', import.meta.url);
const configPath = new URL('../data/portfolio-config.json', import.meta.url);

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

function cleanDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function toCatalogEntry(repo) {
  const pagesUrl = repo.has_pages ? `https://${owner}.github.io/${repo.name}/` : '';
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
    updatedAt: cleanDate(repo.pushed_at || repo.updated_at),
    pushedAt: cleanDate(repo.pushed_at),
    hasPages: Boolean(repo.has_pages),
    defaultBranch: repo.default_branch || 'main'
  };
}

const config = JSON.parse(await readFile(configPath, 'utf8'));
const repositories = (await fetchRepositories())
  .filter((repo) => repo.visibility === 'public' || !repo.visibility)
  .map(toCatalogEntry)
  .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.name.localeCompare(b.name));

const output = {
  generatedAt: new Date().toISOString(),
  owner,
  repositoryCount: repositories.length,
  hiddenIds: Array.isArray(config.hiddenIds) ? config.hiddenIds : [],
  repositories
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${repositories.length} repositories to data/catalog.json`);
