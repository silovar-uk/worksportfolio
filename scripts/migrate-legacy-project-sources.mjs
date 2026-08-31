import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path, fallback = null) => {
  try { return JSON.parse(await readFile(new URL(path, root), 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT' && fallback !== null) return fallback; throw error; }
};
const writeJson = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const config = await readJson('data/portfolio-config.json');
const current = await readJson('data/projects.json', []);
const base = await readJson('data/manual-projects.json', []);
const extra = await readJson('data/manual-projects-extra.json', []);
const daily = await readJson('data/manual-projects-daily-log.json', []);
const repositoryProjectIds = config.repositoryProjectIds && typeof config.repositoryProjectIds === 'object' ? config.repositoryProjectIds : {};
const overrides = config.overrides && typeof config.overrides === 'object' ? config.overrides : {};

const map = new Map(current.filter((project) => project?.id).map((project) => [String(project.id), { ...project }]));
const merge = (id, value) => {
  if (!id || !value || typeof value !== 'object') return;
  map.set(id, { ...(map.get(id) || { id }), ...value, id });
};

for (const [sourceId, value] of Object.entries(overrides)) {
  const projectId = repositoryProjectIds[sourceId] || sourceId;
  merge(projectId, value);
}
for (const project of [...base, ...extra, ...daily]) {
  if (project?.id) merge(String(project.id), project);
}

const projects = [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const nextConfig = { ...config };
delete nextConfig.overrides;

await writeJson('data/projects.json', projects);
await writeJson('data/portfolio-config.json', nextConfig);
console.log(`Migrated ${projects.length} canonical projects and removed legacy config.overrides.`);
