(() => {
  'use strict';
  const status=document.getElementById('status'),retry=document.getElementById('retry');
  const parts=Array.from({length:7},(_,i)=>`.bootstrap/part-${String(i).padStart(2,'0')}.b64`);
  const hiddenIds=[
    'python',
    'scrap_random',
    'pratchecker',
    'zl-logger-web',
    'jumbo',
    'gamedashboard',
    'eventmap',
    'rexanq',
    'x-event-communication-review-jan-apr',
    'npwposts',
    'vsmcintro',
    '2026eventlist',
    'predictattendance',
    'quickliks',
    'lineworks-scroll-copy',
    'x-auto-screenshot-scroll'
  ];
  const extras=[
    {id:'lineworks-scroll-copy',title:'LINE WORKS Scroll & Copy',subtitle:'トーク履歴のさかのぼり・抽出拡張',summary:'LINE WORKSの長いトーク履歴をさかのぼり、複数形式で手元に保存するChrome拡張。',friction:'長いトークを手でスクロールし、あとから整理し直す作業が重かった。',firstBuild:'高速スクロール版から始め、途中停止後のコピーと構造化保存へ広げた。',currentAnswer:'スクロール、収集、形式変換を一つにまとめた道具。',type:'chrome-extension',verbs:['記録する','整理する'],status:'active',visibility:'local',featured:false,createdAt:'2026-05-01',createdAtPrecision:'day',updatedAt:'2026-05-01',repositoryUrl:'',liveUrl:'',technologies:['Chrome Extension','JavaScript'],documentationState:'verified',map:{group:'extension',x:1320,y:398},relatedProjects:[],updates:[],aside:'まず上へ行きたい日と、全部持って帰りたい日は、別の日だった。'},
    {id:'lineworks-logger',title:'LINE WORKS Logger',subtitle:'トーク・メールのローカル記録拡張',summary:'LINE WORKSのトークやメールを端末内に記録し、JSON・CSVとして持ち出すChrome拡張。',friction:'大量の連絡を画面上だけで追うと、あとから検索しにくかった。',firstBuild:'対象画面の情報を外部送信せず、ローカルへ蓄積する仕組みを作った。',currentAnswer:'業務連絡を自分で扱える記録データへ変える入口。',type:'chrome-extension',verbs:['記録する','探す'],status:'prototype',visibility:'local',featured:false,createdAt:'2026-05',createdAtPrecision:'month',updatedAt:'2026-05',repositoryUrl:'',liveUrl:'',technologies:['Chrome Extension','JavaScript'],documentationState:'verified',map:{group:'extension',x:1460,y:398},relatedProjects:[],updates:[],aside:'連絡は流れる。ログは流したくない。'},
    {id:'x-auto-screenshot-scroll',title:'X 自動スクリーンショット＆スクロール',subtitle:'タイムライン連続撮影拡張',summary:'Xを自動スクロールしながら連続撮影し、長いタイムラインをまとめて保存するChrome拡張。',friction:'一画面ずつスクロールして撮影する作業が終わらなかった。',firstBuild:'スクロールと撮影を交互に実行する拡張を作った。',currentAnswer:'データだけでなく、見た目ごとタイムラインを記録する道具。',type:'chrome-extension',verbs:['記録する','集める'],status:'dormant',visibility:'local',featured:false,createdAt:'2025-06-02',createdAtPrecision:'day',updatedAt:'2025-06-02',repositoryUrl:'',liveUrl:'',technologies:['Chrome Extension','JavaScript'],documentationState:'verified',map:{group:'extension',x:1180,y:398},relatedProjects:[],updates:[],aside:'スクロールを自動化したら、撮る枚数まで自動で増えた。'}
  ];
  function patchData(){
    const json=JSON.stringify(extras).replace(/<\//g,'<\\/');
    const hidden=JSON.stringify(hiddenIds);
    return `<script>(function(){var d=window.BUILD_DIARY_DATA;if(!d)return;var hidden=new Set(${hidden});var xs=${json};var m=new Map(d.projects.filter(function(p){return !hidden.has(p.id)}).map(function(p){return[p.id,p]}));xs.forEach(function(p){if(!hidden.has(p.id))m.set(p.id,p)});d.projects=Array.from(m.values()).map(function(p){if(Array.isArray(p.relatedProjects))p.relatedProjects=p.relatedProjects.filter(function(r){return !hidden.has(r.id)});return p});if(Array.isArray(d.periods))d.periods.forEach(function(p){if(Array.isArray(p.projectIds))p.projectIds=p.projectIds.filter(function(id){return !hidden.has(id)});if(p.id==='2026-05'&&!p.projectIds.includes('lineworks-logger'))p.projectIds.push('lineworks-logger')});if(d.settings){if(Array.isArray(d.settings.featuredProjectIds))d.settings.featuredProjectIds=d.settings.featuredProjectIds.filter(function(id){return !hidden.has(id)});if(Array.isArray(d.settings.recentProjectIds))d.settings.recentProjectIds=d.settings.recentProjectIds.filter(function(id){return !hidden.has(id)})}var x=m.get('build-diary');if(x){x.repositoryUrl='https://github.com/silovar-uk/worksportfolio';x.liveUrl='https://silovar-uk.github.io/worksportfolio/';x.updatedAt='2026-07-19'}})();<\/script>`
  }
  function patch(html){let out=html.replace('<span class="brand-mark" aria-hidden="true">d/</span>','<img class="brand-mark" src="assets/favicon.svg" alt="" width="38" height="38">').replace('.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--ink); font: 800 .8rem "Roboto Mono", monospace; transform: rotate(-3deg); background: var(--paper); }','.brand-mark { display:block; width:38px; height:38px; object-fit:contain; flex:0 0 auto; }').replace('href="assets/icons/favicon.ico" sizes="any"','href="assets/favicon.svg" type="image/svg+xml"');
    const old='<select data-verb-filter aria-label="目的で絞り込む">\n          <option value="">すべての目的</option>\n        </select>\n        <button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
    const neu='<select data-verb-filter aria-label="目的で絞り込む"><option value="">すべての目的</option></select><select data-type-filter aria-label="種類で絞り込む"><option value="">すべての種類</option></select><select data-documentation-filter aria-label="整理状態で絞り込む"><option value="">すべての整理状態</option></select><button type="button" class="subtle-button" data-clear-filter>全部出す</button>';
    if(out.includes(old))out=out.replace(old,neu);const start=out.indexOf('window.BUILD_DIARY_DATA =');if(start<0)throw new Error('制作物データが見つかりません');const end=out.indexOf('</script>',start);if(end<0)throw new Error('制作物データの終端が見つかりません');out=out.slice(0,end+9)+patchData()+out.slice(end+9);out=out.replace('</head>','<link rel="stylesheet" href="catalog.css"><link rel="stylesheet" href="taxonomy.css"><link rel="stylesheet" href="marks.css"></head>');out=out.replace('</body>','<script src="data-audit.js"></script><script src="catalog.js"></script><script src="catalog-visibility.js"></script><script src="taxonomy.js"></script><script src="marks.js"></script></body>');return out}
  Promise.all(parts.map(async(u,i)=>{status.textContent=`制作日記を組み立てています（${i+1} / ${parts.length}）`;const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(`データ取得失敗: ${r.status}`);return r.text()})).then(a=>JSZip.loadAsync(a.join(''),{base64:true})).then(z=>{const f=z.file('index.html');if(!f)throw new Error('ZIP内にindex.htmlがありません');return f.async('string')}).then(patch).then(h=>{document.open();document.write(h);document.close()}).catch(e=>{console.error(e);status.classList.add('error');status.textContent='制作日記を読み込めませんでした。エラー: '+e.message;retry.hidden=false})
})();
