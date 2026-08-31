import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);
const dataDir = new URL('data/', root);
const srcDir = new URL('src/', root);

const html = await readFile(indexUrl, 'utf8');
const marker = 'window.BUILD_DIARY_DATA =';
const markerStart = html.indexOf(marker);
if (markerStart < 0) throw new Error('BUILD_DIARY_DATA was not found in index.html.');
const jsonStart = markerStart + marker.length;
const scriptEnd = html.indexOf('</script>', jsonStart);
if (scriptEnd < 0) throw new Error('BUILD_DIARY_DATA script was not closed.');
const raw = html.slice(jsonStart, scriptEnd).trim().replace(/;\s*$/, '');
const diary = JSON.parse(raw);

const projects = (Array.isArray(diary.projects) ? diary.projects : [])
  .filter((project) => project?.id && project?.sourceVisibility !== 'private' && project?.summaryOnly !== true);
const periods = Array.isArray(diary.periods) ? diary.periods : [];
const settings = diary.settings && typeof diary.settings === 'object' ? diary.settings : {};

await mkdir(dataDir, { recursive: true });
await mkdir(srcDir, { recursive: true });
await writeFile(new URL('projects.json', dataDir), `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
await writeFile(new URL('periods.json', dataDir), `${JSON.stringify(periods, null, 2)}\n`, 'utf8');
await writeFile(new URL('settings.json', dataDir), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

let template = html.slice(0, jsonStart) + ' __BUILD_DIARY_DATA__;\n' + html.slice(scriptEnd);
template = template
  .replace(/<script data-worksportfolio-runtime>[\s\S]*?<\/script>/g, '')
  .replace(/<meta name="worksportfolio-generated-at"[^>]*>/g, '')
  .replace(/<meta name="worksportfolio-assets-version"[^>]*>/g, '')
  .replace(/<style>\.recent-updates\{display:none!important\}<\/style>/g, '')
  .replace(/<link rel="stylesheet" href="[^"]+\.css\?v=[^"]+">/g, '')
  .replace(/<script src="[^"]+\.js\?v=[^"]+"><\/script>/g, '');

if (!template.includes('window.BUILD_DIARY_DATA = __BUILD_DIARY_DATA__;')) {
  throw new Error('Template placeholder was not created.');
}
await writeFile(new URL('index.template.html', srcDir), template, 'utf8');

console.log(`Bootstrapped canonical sources: ${projects.length} non-private projects, ${periods.length} periods.`);
