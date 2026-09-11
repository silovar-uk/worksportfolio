import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('./build-static-site.mjs', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const before = "let hiddenSearch = normalizeSearch([project.subtitle, project.summary, project.friction, ...(project.makingPrinciples || [])].filter(Boolean).join(' '));";
const after = "let hiddenSearch = normalizeSearch([project.summary, project.friction, ...(project.makingPrinciples || [])].filter(Boolean).join(' '));";

if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('Could not find the expected hiddenSearch source expression.');
  await writeFile(sourceUrl, source.replace(before, after), 'utf8');
  console.log('Removed redundant subtitle text from the inline hidden search payload.');
} else {
  console.log('Search index source is already optimized.');
}

execFileSync('git', ['add', 'scripts/build-static-site.mjs'], { stdio: 'inherit' });
console.log('Staged the persistent search-index optimization for the generated commit.');
