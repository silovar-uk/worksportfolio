import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const scriptJson = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');

const config = readJson('data/portfolio-config.json');
const manualProjects = readJson('data/manual-projects.json');
const catalog = readJson('data/catalog.json');
const repositories = Array.isArray(catalog.repositories) ? catalog.repositories : [];

const bootstrapDir = join(root, '.bootstrap');
const partNames = readdirSync(bootstrapDir)
  .filter((name) => /^part-\d+\.b64$/.test(name))
  .sort((a, b) => a.localeCompare(b, 'en'));

if (!partNames.length) throw new Error('No bootstrap parts were found.');

const encoded = partNames
  .map((name) => readFileSync(join(bootstrapDir, name), 'utf8'))
  .join('')
  .replace(/\s+/g, '');

const workDir = mkdtempSync(join(tmpdir(), 'worksportfolio-'));
const archivePath = join(workDir, 'site.zip');
writeFileSync(archivePath, Buffer.from(encoded, 'base64'));

const extracted = spawnSync('unzip', ['-p', archivePath, 'index.html'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
rmSync(workDir, { recursive: true, force: true });

if (extracted.status !== 0 || !extracted.stdout) {
  throw new Error(`Could not extract index.html: ${extracted.stderr || 'unknown unzip error'}`);
}

function dataPatch() {
  return `<script>(function(){
    var d=window.BUILD_DIARY_DATA;if(!d||!Array.isArray(d.projects))return;
    var cfg=${scriptJson(config)};
    var manuals=${scriptJson(manualProjects)};
    var repos=${scriptJson(repositories)};
    var hidden=new Set(Array.isArray(cfg.hiddenIds)?cfg.hiddenIds:[]);
    var overrides=cfg.overrides&&typeof cfg.overrides==='object'?cfg.overrides:{};
    var repositoryProjectIds=cfg.repositoryProjectIds&&typeof cfg.repositoryProjectIds==='object'?cfg.repositoryProjectIds:{};
    var typeByName=[
      [/extension|quicklinks|tabshelter|logger/i,'chrome-extension'],
      [/quiz|english|hangul|study|training|dictionary/i,'learning-tool'],
      [/design|pattern|prompt/i,'design-system'],
      [/analysis|dashboard|result|predict|calc|fourier/i,'data-tool'],
      [/wiki|article|contents|vision/i,'content-page']
    ];
    function cleanDate(value){return value?String(value).slice(0,10):''}
    function unique(values){return Array.from(new Set((Array.isArray(values)?values:[]).filter(Boolean)))}
    function inferType(repo){
      var topics=Array.isArray(repo.topics)?repo.topics.join(' '):'';
      var text=[repo.name,repo.description,topics].filter(Boolean).join(' ');
      for(var i=0;i<typeByName.length;i+=1){if(typeByName[i][0].test(text))return typeByName[i][1]}
      return 'web-app';
    }
    var map=new Map(d.projects.map(function(project){return[project.id,project]}));
    repos.forEach(function(repo){
      var repositoryId=repo.name||repo.id;if(!repositoryId)return;
      var projectId=repositoryProjectIds[repositoryId]||repositoryId;
      var existing=map.get(projectId)||null;
      var override=overrides[repositoryId]||overrides[projectId]||{};
      var createdAt=cleanDate(repo.createdAt||repo.created_at);
      var updatedAt=cleanDate(repo.updatedAt||repo.pushedAt||repo.updated_at||createdAt);
      var language=repo.language||'';
      var liveUrl=repo.liveUrl||repo.homepage||'';
      var repositoryUrl=repo.repositoryUrl||repo.html_url||('https://github.com/'+(cfg.owner||'silovar-uk')+'/'+repositoryId);
      var base=existing?Object.assign({},existing):{
        id:projectId,title:repositoryId,subtitle:'GitHubリポジトリ',
        summary:repo.description||'GitHub上で管理している制作物。',friction:'',firstBuild:'',currentAnswer:'',
        type:inferType(repo),verbs:['作る'],status:repo.archived?'dormant':'development',visibility:'public',
        featured:false,createdAt:createdAt,createdAtPrecision:'day',updatedAt:updatedAt||createdAt,
        repositoryUrl:repositoryUrl,liveUrl:liveUrl,technologies:language?[language]:[],
        documentationState:'unreviewed',relatedProjects:[],updates:[],aside:''
      };
      var merged=Object.assign({},base,override);
      merged.id=projectId;
      merged.repositoryUrl=override.repositoryUrl!==undefined?override.repositoryUrl:repositoryUrl;
      merged.liveUrl=override.liveUrl!==undefined?override.liveUrl:(liveUrl||base.liveUrl||'');
      merged.createdAt=override.createdAt||base.createdAt||createdAt;
      merged.updatedAt=override.updatedAt||updatedAt||base.updatedAt||merged.createdAt;
      merged.technologies=unique([].concat(base.technologies||[],language?[language]:[],override.technologies||[]));
      merged.verbs=unique(override.verbs||base.verbs||[]);
      merged.searchAliases=unique(override.searchAliases||base.searchAliases||[]);
      merged.relatedProjects=Array.isArray(merged.relatedProjects)?merged.relatedProjects:[];
      map.set(projectId,merged);
    });
    manuals.forEach(function(project){if(project&&project.id)map.set(project.id,Object.assign({},map.get(project.id)||{},project))});
    d.projects=Array.from(map.values()).filter(function(project){return!hidden.has(project.id)});
    var valid=new Set(d.projects.map(function(project){return project.id}));
    d.projects.forEach(function(project){
      if(Array.isArray(project.relatedProjects))project.relatedProjects=project.relatedProjects.filter(function(relation){return relation&&valid.has(relation.id)});
    });
    if(Array.isArray(d.periods))d.periods.forEach(function(period){
      var ids=Array.isArray(period.projectIds)?period.projectIds:[];
      period.projectIds=ids.filter(function(id){return valid.has(id)});
      if(period.id==='2026-05'&&valid.has('lineworks-logger')&&!period.projectIds.includes('lineworks-logger'))period.projectIds.push('lineworks-logger');
    });
    if(d.settings){
      ['featuredProjectIds','recentProjectIds'].forEach(function(key){
        if(Array.isArray(d.settings[key]))d.settings[key]=d.settings[key].filter(function(id){return valid.has(id)});
      });
    }
    window.WORKS_PORTFOLIO_CONFIG=cfg;
    window.WORKS_PORTFOLIO_REPOSITORIES=repos;
  })();<\/script>`;
}

let html = extracted.stdout
  .replace('<span class="brand-mark" aria-hidden="true">d/</span>', '<img class="brand-mark" src="assets/favicon.svg" alt="" width="38" height="38">')
  .replace('.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--ink); font: 800 .8rem "Roboto Mono", monospace; transform: rotate(-3deg); background: var(--paper); }', '.brand-mark { display:block; width:38px; height:38px; object-fit:contain; flex:0 0 auto; }')
  .replace('href="assets/icons/favicon.ico" sizes="any"', 'href="assets/favicon.svg" type="image/svg+xml"')
  .replace(/<script[^>]+(?:jszip|loader\.js)[^>]*><\/script>/gi, '');

const oldFilters = '<select data-verb-filter aria-label="目的で絞り込む">\n          <option value="">すべての目的</option>\n        </select>\n        <button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
const newFilters = '<select data-verb-filter aria-label="目的で絞り込む"><option value="">すべての目的</option></select><select data-type-filter aria-label="種類で絞り込む"><option value="">すべての種類</option></select><select data-documentation-filter aria-label="整理状態で絞り込む"><option value="">すべての整理状態</option></select><button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
if (html.includes(oldFilters)) html = html.replace(oldFilters, newFilters);

const dataStart = html.indexOf('window.BUILD_DIARY_DATA =');
if (dataStart < 0) throw new Error('BUILD_DIARY_DATA was not found in the extracted page.');
const dataEnd = html.indexOf('</script>', dataStart);
if (dataEnd < 0) throw new Error('The BUILD_DIARY_DATA script was not closed.');
html = html.slice(0, dataEnd + 9) + dataPatch() + html.slice(dataEnd + 9);

const generatedAt = catalog.generatedAt || new Date().toISOString();
html = html.replace(
  '</head>',
  `<meta name="worksportfolio-generated-at" content="${generatedAt}">` +
  '<link rel="stylesheet" href="catalog.css"><link rel="stylesheet" href="taxonomy.css"><link rel="stylesheet" href="wow.css"><link rel="stylesheet" href="motion.css"><link rel="stylesheet" href="marks.css"><link rel="stylesheet" href="shelf-priority.css"><style>.recent-updates{display:none!important}</style></head>'
);
html = html.replace(
  '</body>',
  '<script src="data-audit.js"></script><script src="catalog.js"></script><script src="catalog-visibility.js"></script><script src="taxonomy.js"></script><script src="wow.js"></script><script src="wow-stage.js"></script><script src="motion.js"></script><script src="marks.js"></script><script src="shelf-priority.js"></script></body>'
);

if (/jszip|loader\.js/i.test(html)) throw new Error('The generated page still depends on the runtime bootstrap loader.');
if (!html.includes('shelf-priority.js')) throw new Error('The generated page is missing the shelf enhancement script.');
if (!html.includes('window.BUILD_DIARY_DATA')) throw new Error('The generated page lost its project data.');

writeFileSync(join(root, 'index.html'), html);
console.log(`Generated static index.html (${Buffer.byteLength(html).toLocaleString('en-US')} bytes, ${repositories.length} repositories).`);
