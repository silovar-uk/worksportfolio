import { readFile, writeFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const write = (path, value) => writeFile(path, value, 'utf8');

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Could not find expected source for: ${label}`);
  return source.replace(before, after);
}

async function upgradeCatalog() {
  const path = 'catalog.js';
  let source = await read(path);

  source = replaceRequired(
    source,
    "const STORAGE_KEY = 'worksportfolio-catalog-v2';",
    "const STORAGE_KEY = 'worksportfolio-catalog-v3';\n  const LEGACY_STORAGE_KEY = 'worksportfolio-catalog-v2';",
    'catalog storage version'
  );

  source = replaceRequired(
    source,
    "const yearOf = (project) => String(project.createdAt || '').slice(0, 4) || '時期不明';",
    "const chronologyDate = (project) => project?.startedAt || project?.createdAt || '';\n  const yearOf = (project) => String(chronologyDate(project)).slice(0, 4) || '時期不明';",
    'canonical chronology date'
  );

  source = replaceRequired(source, '<option value="created-desc">制作が新しい順</option>', '<option value="created-desc">制作開始が新しい順</option>', 'sort label desc');
  source = replaceRequired(source, '<option value="created-asc">制作が古い順</option>', '<option value="created-asc">制作開始が古い順</option>', 'sort label asc');
  source = replaceRequired(source, '<option value="year">制作年でまとめる</option>', '<option value="year">制作開始年でまとめる</option>', 'group label');
  source = replaceRequired(source, '<select data-cat-year><option value="">すべての制作年</option></select>', '<select data-cat-year><option value="">すべての制作開始年</option></select>', 'year filter label');
  source = replaceRequired(source, "c.year.innerHTML = '<option value=\"\">すべての制作年</option>'", "c.year.innerHTML = '<option value=\"\">すべての制作開始年</option>'", 'year filter populated label');

  source = replaceRequired(
    source,
    "    let saved = {};\n    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { saved = {}; }\n    const get = (name, fallback = '') => params.has(`cat_${name}`) ? params.get(`cat_${name}`) : (saved[name] ?? fallback);",
    "    let saved = {};\n    try {\n      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');\n      if (current && typeof current === 'object') {\n        saved = current;\n      } else {\n        const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');\n        saved = legacy && typeof legacy === 'object' ? { ...legacy } : {};\n        if (!saved.sort || saved.sort === 'updated-desc') saved.sort = 'created-desc';\n      }\n    } catch (_) { saved = {}; }\n    const get = (name, fallback = '') => params.has(`cat_${name}`) ? params.get(`cat_${name}`) : (saved[name] ?? fallback);",
    'catalog state migration'
  );

  source = replaceRequired(source, "c.sort.value = get('sort', 'updated-desc');", "c.sort.value = get('sort', 'created-desc');", 'default sort read');
  source = replaceRequired(source, "{ sort: 'updated-desc', layout: 'compact', group: 'none', quick: 'all' }", "{ sort: 'created-desc', layout: 'compact', group: 'none', quick: 'all' }", 'default sort url cleanup');

  source = replaceRequired(
    source,
    "sort === 'created-asc' ? (a, b) => dateNumber(a.createdAt).localeCompare(dateNumber(b.createdAt))\n        : sort === 'created-desc' ? (a, b) => dateNumber(b.createdAt).localeCompare(dateNumber(a.createdAt))",
    "sort === 'created-asc' ? (a, b) => dateNumber(chronologyDate(a)).localeCompare(dateNumber(chronologyDate(b)))\n        : sort === 'created-desc' ? (a, b) => dateNumber(chronologyDate(b)).localeCompare(dateNumber(chronologyDate(a)))",
    'chronology sort comparator'
  );

  source = replaceRequired(source, '<span>制作 ${esc(formatDate(project.createdAt))}</span>', '<span>開始 ${esc(formatDate(chronologyDate(project)))}</span>', 'row chronology display');
  source = replaceRequired(source, '<td>${esc(formatDate(project.createdAt))}</td>', '<td>${esc(formatDate(chronologyDate(project)))}</td>', 'table chronology display');
  source = replaceRequired(source, '<th>制作</th><th>更新</th>', '<th>制作開始</th><th>更新</th>', 'table chronology heading');

  source = replaceRequired(
    source,
    "    return [...map.entries()].map(([key, items]) => ({ key, label: label(key), items }));",
    "    const entries = [...map.entries()];\n    if (groupBy === 'year') {\n      const direction = controls().sort.value === 'created-asc' ? 1 : -1;\n      entries.sort(([a], [b]) => {\n        if (a === '時期不明') return 1;\n        if (b === '時期不明') return -1;\n        return direction * String(a).localeCompare(String(b));\n      });\n    }\n    return entries.map(([key, items]) => ({ key, label: label(key), items }));",
    'chronology group ordering'
  );

  source = replaceRequired(
    source,
    "const rows = [['タイトル', '概要', '種類', '状態', '制作日', '更新日', '公開ページ', 'GitHub']];",
    "const rows = [['タイトル', '概要', '種類', '状態', '制作開始日', '更新日', '公開ページ', 'GitHub']];",
    'tsv chronology heading'
  );
  source = replaceRequired(
    source,
    "formatDate(project.createdAt), formatDate(project.updatedAt || project.createdAt)",
    "formatDate(chronologyDate(project)), formatDate(project.updatedAt || project.createdAt)",
    'tsv chronology value'
  );
  source = replaceRequired(
    source,
    "      createdAt: project.createdAt,\n      updatedAt: project.updatedAt || project.createdAt,",
    "      startedAt: chronologyDate(project),\n      repositoryCreatedAt: project.createdAt || null,\n      updatedAt: project.updatedAt || project.createdAt,",
    'json chronology export'
  );

  source = replaceRequired(source, "c.sort.value = 'updated-desc';", "c.sort.value = 'created-desc';", 'reset chronology default');

  await write(path, source);
}

async function upgradeFavoriteCatalog() {
  const path = 'favorite-catalog.js';
  let source = await read(path);
  source = replaceRequired(source, "const BASE_STATE_KEY = 'worksportfolio-catalog-v2';", "const BASE_STATE_KEY = 'worksportfolio-catalog-v3';", 'favorite catalog base state key');
  source = replaceRequired(source, "const SORT_MIGRATION_KEY = 'worksportfolio-start-sort-default-v1';", "const SORT_MIGRATION_KEY = 'worksportfolio-start-sort-default-v2';", 'favorite catalog migration version');
  await write(path, source);
}

async function upgradeConfig() {
  const path = 'data/portfolio-config.json';
  const config = JSON.parse(await read(path));
  config.defaultSort = 'created-desc';
  await write(path, `${JSON.stringify(config, null, 2)}\n`);
}

await upgradeCatalog();
await upgradeFavoriteCatalog();
await upgradeConfig();
console.log('Chronology upgraded: startedAt is now the canonical portfolio chronology, with legacy state migration.');
