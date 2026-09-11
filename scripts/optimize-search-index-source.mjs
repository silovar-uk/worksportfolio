import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('./build-static-site.mjs', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const before = "let hiddenSearch = normalizeSearch([project.subtitle, project.summary, project.friction, ...(project.makingPrinciples || [])].filter(Boolean).join(' '));";
const after = "let hiddenSearch = normalizeSearch([project.summary, project.friction, ...(project.makingPrinciples || [])].filter(Boolean).join(' '));";

if (source.includes(after)) {
  console.log('Search index source is already optimized.');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Could not find the expected hiddenSearch source expression.');

await writeFile(sourceUrl, source.replace(before, after), 'utf8');
console.log('Removed redundant subtitle text from the inline hidden search payload.');
