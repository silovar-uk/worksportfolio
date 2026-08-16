import { readFile, writeFile } from 'node:fs/promises';

const owner = process.env.GITHUB_REPOSITORY_OWNER || process.env.PORTFOLIO_OWNER || 'silovar-uk';
const token = process.env.GITHUB_TOKEN || '';
const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'worksportfolio-start-date-audit'
};
if (token) headers.Authorization = `Bearer ${token}`;

const config = await readJson('data/portfolio-config.json');
const catalog = await readJson('data/catalog.json');
const manualProjects = [
  ...(await readJson('data/manual-projects.json')),
  ...(await readJson('data/manual-projects-extra.json'))
];
const existing = await readJson('data/project-start-dates.json');

const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object'
  ? config.repositoryProjectIds
  : {};
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];

function cleanDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function parseLastPage(linkHeader) {
  if (!linkHeader) return 1;
  const part = String(linkHeader).split(',').find((value) => /rel="last"/.test(value));
  if (!part) return 1;
  const match = part.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : 1;
}

async function fetchOldestCommit(repoName) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/commits`;
  const first = await fetch(`${base}?per_page=1`, { headers });
  if (!first.ok) {
    if (first.status === 409) return null;
    throw new Error(`${repoName}: GitHub API ${first.status}`);
  }
  const newestPage = await first.json();
  if (!Array.isArray(newestPage) || newestPage.length === 0) return null;

  const lastPage = parseLastPage(first.headers.get('link'));
  let oldest = newestPage[0];
  if (lastPage > 1) {
    const last = await fetch(`${base}?per_page=1&page=${lastPage}`, { headers });
    if (!last.ok) throw new Error(`${repoName}: GitHub API ${last.status} on oldest commit page`);
    const rows = await last.json();
    if (Array.isArray(rows) && rows[0]) oldest = rows[0];
  }

  const date = cleanDate(oldest?.commit?.author?.date || oldest?.commit?.committer?.date);
  if (!date) return null;
  return {
    date,
    sha: oldest.sha || '',
    url: oldest.html_url || `https://github.com/${owner}/${repoName}/commit/${oldest.sha || ''}`
  };
}

const candidates = new Map();
let commitBased = 0;
let repositoryFallback = 0;
let failed = 0;

for (const repo of repositories) {
  const repositoryId = repo?.name || repo?.id || '';
  if (!repositoryId) continue;
  const projectId = repositoryProjectIds[repositoryId] || repositoryId;
  if (existing[projectId] || existing[repositoryId]) continue;

  let candidate = null;
  try {
    const commit = await fetchOldestCommit(repositoryId);
    if (commit?.date) {
      candidate = {
        date: commit.date,
        precision: 'day',
        basis: 'first-repository-commit',
        repository: repositoryId,
        source: commit.url,
        commit: commit.sha
      };
      commitBased += 1;
    }
  } catch (error) {
    failed += 1;
    console.warn(`Could not inspect ${repositoryId}: ${error.message}`);
  }

  if (!candidate) {
    const createdAt = cleanDate(repo.createdAt || repo.created_at);
    if (!createdAt) continue;
    candidate = {
      date: createdAt,
      precision: 'day',
      basis: 'repository-created-fallback',
      repository: repositoryId
    };
    repositoryFallback += 1;
  }

  const current = candidates.get(projectId);
  if (!current || candidate.date < current.date) candidates.set(projectId, candidate);
}

const next = { ...existing };
for (const [projectId, candidate] of candidates) next[projectId] = candidate;

let manualFallback = 0;
for (const project of manualProjects) {
  if (!project?.id || next[project.id]) continue;
  const date = cleanDate(project.createdAt);
  if (!date) continue;
  next[project.id] = {
    date,
    precision: project.createdAtPrecision || (date.length === 10 ? 'day' : 'month'),
    basis: 'manual-record'
  };
  manualFallback += 1;
}

const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
await writeJson('data/project-start-dates.json', sorted);

const basisCounts = Object.values(sorted).reduce((acc, item) => {
  const basis = item?.basis || 'unknown';
  acc[basis] = (acc[basis] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  total: Object.keys(sorted).length,
  preserved: Object.keys(existing).length,
  added: Object.keys(sorted).length - Object.keys(existing).length,
  commitBased,
  repositoryFallback,
  manualFallback,
  failed,
  basisCounts
}, null, 2));