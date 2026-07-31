(() => {
  'use strict';

  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  const parts = Array.from({ length: 7 }, (_, index) => `.bootstrap/part-${String(index).padStart(2, '0')}.b64`);
  const dataUrls = {
    config: 'data/portfolio-config.json',
    manual: 'data/manual-projects.json',
    catalog: 'data/catalog.json'
  };

  async function fetchText(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`データ取得失敗: ${response.status} ${url}`);
    return response.text();
  }

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (error) {
      console.warn(`Optional data could not be loaded: ${url}`, error);
      return fallback;
    }
  }

  async function fetchPublicRepositories(owner) {
    const repositories = [];
    for (let page = 1; page <= 10; page += 1) {
      const url = new URL(`https://api.github.com/users/${encodeURIComponent(owner)}/repos`);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      url.searchParams.set('sort', 'updated');
      url.searchParams.set('direction', 'desc');
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'default'
      });
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const batch = await response.json();
      repositories.push(...batch.map((repo) => ({
        id: repo.name,
        name: repo.name,
        description: repo.description || '',
        repositoryUrl: repo.html_url || '',
        liveUrl: repo.homepage || (repo.has_pages ? `https://${owner}.github.io/${repo.name}/` : ''),
        language: repo.language || '',
        topics: Array.isArray(repo.topics) ? repo.topics : [],
        archived: Boolean(repo.archived),
        fork: Boolean(repo.fork),
        visibility: repo.visibility || 'public',
        createdAt: repo.created_at ? String(repo.created_at).slice(0, 10) : '',
        updatedAt: repo.pushed_at ? String(repo.pushed_at).slice(0, 10) : (repo.updated_at ? String(repo.updated_at).slice(0, 10) : ''),
        pushedAt: repo.pushed_at ? String(repo.pushed_at).slice(0, 10) : '',
        hasPages: Boolean(repo.has_pages),
        defaultBranch: repo.default_branch || 'main'
      })));
      if (batch.length < 100) break;
    }
    return repositories;
  }

  function patchData(config, manualProjects, repositoryEntries) {
    const configJson = JSON.stringify(config || {}).replace(/<\//g, '<\\/');
    const manualJson = JSON.stringify(Array.isArray(manualProjects) ? manualProjects : []).replace(/<\//g, '<\\/');
    const repositoriesJson = JSON.stringify(Array.isArray(repositoryEntries) ? repositoryEntries : []).replace(/<\//g, '<\\/');

    return `<script>(function(){
      var d=window.BUILD_DIARY_DATA;if(!d||!Array.isArray(d.projects))return;
      var cfg=${configJson};
      var manuals=${manualJson};
      var repos=${repositoriesJson};
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
      function inferType(repo){
        var topics=Array.isArray(repo.topics)?repo.topics.join(' '):'';
        var text=[repo.name,repo.description,topics].filter(Boolean).join(' ');
        for(var i=0;i<typeByName.length;i+=1){if(typeByName[i][0].test(text))return typeByName[i][1]}
        return 'web-app';
      }
      function unique(values){return Array.from(new Set((Array.isArray(values)?values:[]).filter(Boolean)))}
      function projectFromRepo(repo){
        var repoName=repo.name||repo.id;if(!repoName)return null;
        var id=repositoryProjectIds[repoName]||repoName;
        var existingMap=new Map(d.projects.map(function(project){return[project.id,project]}));
        var existing=existingMap.get(id)||null;
        var override=overrides[repoName]||overrides[id]||{};
        var createdAt=cleanDate(repo.createdAt||repo.created_at);
        var updatedAt=cleanDate(repo.updatedAt||repo.pushedAt||repo.updated_at||createdAt);
        var language=repo.language||'';
        var liveUrl=repo.liveUrl||repo.homepage||'';
        var repositoryUrl=repo.repositoryUrl||repo.html_url||('https://github.com/'+(cfg.owner||'silovar-uk')+'/'+repoName);
        var base=existing?Object.assign({},existing):{
          id:id,
          title:id,
          subtitle:'GitHubリポジトリ',
          summary:repo.description||'GitHub上で管理している制作物。',
          friction:'',
          firstBuild:'',
          currentAnswer:'',
          type:inferType(repo),
          verbs:['作る'],
          status:repo.archived?'dormant':'development',
          visibility:'public',
          featured:false,
          createdAt:createdAt,
          createdAtPrecision:'day',
          updatedAt:updatedAt||createdAt,
          repositoryUrl:repositoryUrl,
          liveUrl:liveUrl,
          technologies:language?[language]:[],
          documentationState:'unreviewed',
          relatedProjects:[],
          updates:[],
          aside:''
        };
        var merged=Object.assign({},base,override);
        merged.id=id;
        merged.repositoryUrl=override.repositoryUrl!==undefined?override.repositoryUrl:repositoryUrl;
        merged.liveUrl=override.liveUrl!==undefined?override.liveUrl:(liveUrl||base.liveUrl||'');
        merged.createdAt=override.createdAt||base.createdAt||createdAt;
        merged.updatedAt=override.updatedAt||updatedAt||base.updatedAt||merged.createdAt;
        merged.technologies=unique([].concat(base.technologies||[],language?[language]:[],override.technologies||[]));
        merged.verbs=unique(override.verbs||base.verbs||[]);
        merged.relatedProjects=Array.isArray(merged.relatedProjects)?merged.relatedProjects:[];
        merged.searchAliases=unique(override.searchAliases||base.searchAliases||[]);
        return merged;
      }
      var map=new Map(d.projects.map(function(project){return[project.id,project]}));
      repos.forEach(function(repo){var repoName=repo&&(repo.name||repo.id);if(hidden.has(repoName))return;var project=projectFromRepo(repo);if(project)map.set(project.id,project)});
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

  function patch(html, context) {
    let output = html
      .replace('<span class="brand-mark" aria-hidden="true">d/</span>', '<img class="brand-mark" src="assets/favicon.svg" alt="" width="38" height="38">')
      .replace('.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--ink); font: 800 .8rem "Roboto Mono", monospace; transform: rotate(-3deg); background: var(--paper); }', '.brand-mark { display:block; width:38px; height:38px; object-fit:contain; flex:0 0 auto; }')
      .replace('href="assets/icons/favicon.ico" sizes="any"', 'href="assets/favicon.svg" type="image/svg+xml"');

    const oldFilters = '<select data-verb-filter aria-label="目的で絞り込む">\n          <option value="">すべての目的</option>\n        </select>\n        <button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
    const newFilters = '<select data-verb-filter aria-label="目的で絞り込む"><option value="">すべての目的</option></select><select data-type-filter aria-label="種類で絞り込む"><option value="">すべての種類</option></select><select data-documentation-filter aria-label="整理状態で絞り込む"><option value="">すべての整理状態</option></select><button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
    if (output.includes(oldFilters)) output = output.replace(oldFilters, newFilters);

    const start = output.indexOf('window.BUILD_DIARY_DATA =');
    if (start < 0) throw new Error('制作物データが見つかりません');
    const end = output.indexOf('</script>', start);
    if (end < 0) throw new Error('制作物データの終端が見つかりません');
    output = output.slice(0, end + 9) + patchData(context.config, context.manualProjects, context.repositories) + output.slice(end + 9);

    output = output.replace(
      '</head>',
      '<link rel="stylesheet" href="catalog.css"><link rel="stylesheet" href="taxonomy.css"><link rel="stylesheet" href="wow.css"><link rel="stylesheet" href="motion.css"><link rel="stylesheet" href="marks.css"><link rel="stylesheet" href="shelf-priority.css"><link rel="stylesheet" href="favorites.css"><style>.recent-updates{display:none!important}</style></head>'
    );
    output = output.replace(
      '</body>',
      '<script src="data-audit.js"></script><script src="catalog.js"></script><script src="catalog-visibility.js"></script><script src="taxonomy.js"></script><script src="wow.js"></script><script src="wow-stage.js"></script><script src="motion.js"></script><script src="marks.js"></script><script src="shelf-priority.js"></script><script src="favorites.js"></script></body>'
    );
    return output;
  }

  Promise.all([
    Promise.all(parts.map(async (url, index) => {
      status.textContent = `制作日記を組み立てています（${index + 1} / ${parts.length}）`;
      return fetchText(url);
    })),
    fetchJson(dataUrls.config, { owner: 'silovar-uk', hiddenIds: [], overrides: {}, githubApiFallback: true }),
    fetchJson(dataUrls.manual, []),
    fetchJson(dataUrls.catalog, { repositories: [] })
  ]).then(async ([partTexts, config, manualProjects, catalog]) => {
    let repositories = Array.isArray(catalog?.repositories) ? catalog.repositories : [];
    if (!repositories.length && config.githubApiFallback !== false) {
      try {
        status.textContent = 'GitHubの制作物を確認しています。';
        repositories = await fetchPublicRepositories(config.owner || 'silovar-uk');
      } catch (error) {
        console.warn('GitHub API fallback failed. Embedded data will be used.', error);
      }
    }
    const zip = await JSZip.loadAsync(partTexts.join(''), { base64: true });
    const file = zip.file('index.html');
    if (!file) throw new Error('ZIP内にindex.htmlがありません');
    const html = await file.async('string');
    return patch(html, { config, manualProjects, repositories });
  }).then((html) => {
    document.open();
    document.write(html);
    document.close();
  }).catch((error) => {
    console.error(error);
    status.classList.add('error');
    status.textContent = `制作日記を読み込めませんでした。エラー: ${error.message}`;
    retry.hidden = false;
  });
})();
