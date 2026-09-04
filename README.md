# つくって考えた

日常や仕事の小さな不便から作ったWebアプリ、Chrome拡張、学習ツール、知識の置き場をまとめるPortfolioです。

公開URL: https://silovar-uk.github.io/worksportfolio/

## Architecture contract

このRepositoryでは、**生成済みHTMLを入力へ戻さないこと**を最重要ルールにしています。

```text
Canonical source
  ↓
Validation / discovery / derived data
  ↓
Clean static build
  ↓
Publication transforms
  ↓
index.html
  ↓
GitHub Pages
```

`index.html` は成果物です。日常編集のSource of Truthではなく、Build時には一度削除して `src/index.template.html` から再生成します。

### Static shell contract

Header / Header Search / 最上部のHeroは、後付けのfeature scriptで修復しません。

責務は次の3つに限定します。

```text
data/settings.json
  └─ siteTitle / heroTitle / heroLead などの表示データ

scripts/build-static-site.mjs
  └─ Header SearchとHeroを静的HTMLとして確定

shell.css
  └─ Header / Header Search / Heroの最終レイアウト
```

禁止事項:

- `copy-cleanup.js` などのruntime scriptからHero文言を書き換える
- `showcase.css` やfeature CSSから `.site-header` / `.header-search` / `.hero` を再定義する
- 生成後の `index.html` を文字列置換して上部UIを修復する
- 強制 `<br>` をHero文言へ埋め込み、viewportごとに不自然な改行を固定する
- `Element.prototype` などWeb標準APIを差し替えて局所的なselector bugを吸収する

`scripts/build-static-site.mjs` と `scripts/apply-copy-cleanup.mjs` はこれらの境界を検査し、違反が戻った場合はBuildを失敗させます。

### Runtime augmentation policy

CatalogやFavoriteなど、動的に生成されるUIへ追加機能を載せる場合も、**後から何でも直すpatch layer**を増やさないことを原則とします。

- 局所バグは局所のrenderer / helperで直す
- DOM decoratorは冪等にする
- MutationObserverは自分が所有するrootへ限定する
- document全体の監視は原則追加しない
- feature CSSは自分のfeature namespaceだけを持つ
- 別featureのDOM順序やlayoutを修復するscriptを追加しない
- 使われなくなったrepair scriptは残さない

現在は既存機能の一部にDOM decoration / MutationObserver方式が残っています。これは互換性を維持しながら、renderer側へ順次統合する移行対象です。

### Project registry

Project metadataの正本は2つだけです。

- `data/projects.json` — Public / localなど、Private summaryではない制作物のCanonical Project Registry
- `data/private-projects.json` — 公開可能な情報だけに限定したPrivate制作物のSafe Summary Registry

旧 `manual-projects*.json`、`portfolio-config.overrides`、生成済み `index.html` をProject metadataの入力にはしません。

GitHub repository名とPortfolio上のProject IDが異なる場合だけ、`data/portfolio-config.json` の `repositoryProjectIds` で **Source repository ID → Project ID** を明示します。

## Portfolioの3層

1. **Showcase** — 初見の人が「何を作る人か」を理解する
2. **Catalog** — 全制作物を検索・比較・再発見する
3. **Editorial System** — GitHub上の制作活動を発見し、安全確認して公開する

Showcaseの編集データは `data/portfolio-taxonomy.json` に置きます。

- `showcase.featuredProjectIds`: 代表作
- `families`: Project Family
- `principles`: 制作物から帰納したMaking Principles

表示側は `showcase.js` / `showcase.css`、生成時の注入は `scripts/inject-showcase.mjs` が担当します。

ShowcaseはTop Shellを所有しません。`.site-header` / `.header-search` / `.hero` は `shell.css` の責務です。

## Catalog

Catalogでは次を扱います。

- 名前・困りごと・技術から検索
- クイック絞り込み / 詳細絞り込み
- 制作開始順、更新順、名前順などの並び替え
- コンパクト、カード、表の表示切替
- Project Familyによる絞り込み
- 最近開いた作品
- ランダム3枚
- 比較
- お気に入り

初期の時系列は `startedAt` を優先し、なければ `createdAt` を使います。

Header SearchとCatalog Searchは検索の意味を分岐させず、共通の検索ロジックを利用します。Headerは数件のQuick Suggestions、CatalogはFull Searchを担当します。

## Public GitHub discovery

`scripts/build-catalog.mjs` がGitHub APIから**Public repositoryだけ**を取得し、`data/catalog.json` を生成します。

発見と公開は分離します。

Editorial State:

- `discovered`: GitHubで発見、編集前
- `candidate`: 公開候補として確認中
- `curated`: タイトル・概要・分類を編集済み
- `published`: Portfolioへ掲載
- `hidden`: 掲載しない

公開ゲートは `data/editorial-policy.json` と `scripts/apply-editorial-gate.mjs` が担当します。

`scripts/build-editorial-review.mjs` が `data/editorial-review.json` を生成します。ここに含めるのはPublic repositoryだけです。

## Private-source projects

Private repositoryの検出情報はPublic catalogへ流しません。

公開可能な概要だけを `data/private-projects.json` に手動で保存します。各recordは最低限、次を満たす必要があります。

```json
{
  "visibility": "private",
  "sourceVisibility": "private",
  "summaryOnly": true,
  "repositoryUrl": ""
}
```

公開してはいけないもの:

- Private GitHub URL / repository metadata
- source code / README本文
- file path / branch / commit / issue / PR
- secret / API key
- 内部URL
- account / database identifier
- 個人・顧客・組織の内部情報

`scripts/validate-private-summaries.mjs` と `scripts/validate-portfolio-model.mjs` が検査し、`scripts/inject-private-summaries.mjs` が最終HTMLへSafe Summaryだけを注入します。

## Source of Truth

### 人が編集するSource

- `src/index.template.html` — HTML構造のベース
- `shell.css` — Header / Header Search / Heroの最終presentation
- `data/projects.json` — Canonical Project Registry
- `data/private-projects.json` — Private-safe Summary Registry
- `data/periods.json` — 時系列区分
- `data/settings.json` — サイト設定・Top Shell copy
- `data/portfolio-config.json` — repository ID mapping、hidden等の運用設定
- `data/portfolio-taxonomy.json` — Showcase / Family / Principle
- `data/editorial-policy.json` — 公開ゲート方針
- `data/project-start-dates.json` — 制作開始日の監査データ
- `data/pattern-taxonomy.json` / `data/pattern-merge-rules.json` — Pattern生成ルール

### 生成されるもの

- `data/catalog.json` — Public GitHub repository catalog
- `data/editorial-review.json` — Public repository review queue
- `data/pattern-audit.json` / `data/patterns.json` など — Pattern派生データ
- `index.html` — 公開用完成HTML

生成物を手編集してSourceへ戻さないでください。

## Identifier integrity

`scripts/validate-global-ids.mjs` がProject IDを横断検証します。

区別するもの:

- Canonical Project ID
- Private-safe Project ID
- Source repository ID
- `repositoryProjectIds` による明示mapping

`hiddenIds` はSource repository IDまたはProject IDを取れます。一方、Showcase / Family / Principle / relationはProject IDを参照します。

存在しないID、Public/Private衝突、重複Project IDはBuildを失敗させます。旧relationに残る移行上の欠損だけは現在WARNING扱いです。

## Build pipeline

HTMLを書き出すWorkflowは `.github/workflows/update-catalog.yml` に一本化しています。

```text
Source-of-truth boundary validation
  ↓
Private-safe validation
  ↓
Public GitHub catalog build
  ↓
Sanitize / curation / audit
  ↓
Global ID validation
  ↓
Portfolio model validation
  ↓
Editorial review build
  ↓
Pattern validation / build
  ↓
rm -f index.html
  ↓
Static build from src/index.template.html + settings + shell.css
  ↓
Static-output / runtime-boundary validation
  ↓
Editorial publication gate
  ↓
Private-safe summaries injection
  ↓
Showcase / Family / Principle injection
  ↓
Generated-page integrity checks
  ↓
Commit generated files
  ↓
GitHub Pages
```

`scripts/apply-copy-cleanup.mjs` は名前を残していますが、現在は**生成HTMLを書き換えず検証だけを行います**。Top Shellを含むcopyのSource of Truthをpost-build transformへ戻さないためです。

Friction Atlas / Live Indexも通常BuildのAssetとして `scripts/build-static-site.mjs` から組み込まれます。後段の別Workflowで `index.html` をpatchしません。

`.github/workflows/audit-project-start-dates.yml` は制作開始日の監査専用で、HTML writerではありません。

## 主な実装ファイル

- `shell.css`: Header / Header Search / Heroのcanonical presentation
- `catalog.js` / `catalog.css`: Catalog
- `catalog-search-redesign.js`: Search engine / Full Search / Header Quick Search
- `friction-atlas.js` / `friction-atlas.css`: 「作った理由」ビュー
- `live-index.js` / `live-index.css`: 検索・Index体験
- `showcase.js` / `showcase.css`: Showcase / Project Family
- `private-source.js` / `private-source.css`: Private-source表示制御
- `random-three.js` / `random-three.css`: ランダム3枚
- `comparison-view.js` / `comparison-view.css`: 比較
- `favorites.js` / `favorites.css`: お気に入り度・visual signal
- `scripts/build-catalog.mjs`: Public GitHub discovery
- `scripts/build-static-site.mjs`: Canonical static build
- `scripts/apply-copy-cleanup.mjs`: Static-output / runtime-boundary validation
- `scripts/validate-global-ids.mjs`: Global ID integrity
- `scripts/validate-portfolio-model.mjs`: taxonomy / privacy / reference validation
- `scripts/inject-private-summaries.mjs`: Safe Private summary injection
- `.github/workflows/update-catalog.yml`: Main CI / HTML writer

## ローカル確認

Public GitHub APIを利用できる環境では、概ね次の順です。

```bash
node scripts/validate-private-summaries.mjs
node scripts/build-catalog.mjs
node scripts/sanitize-project-data.mjs
node scripts/validate-global-ids.mjs
node scripts/validate-portfolio-model.mjs
node scripts/build-editorial-review.mjs
node scripts/validate-pattern-candidates.mjs
node scripts/build-patterns.mjs
node scripts/validate-patterns.mjs
rm -f index.html
node scripts/build-static-site.mjs
node scripts/apply-copy-cleanup.mjs
node scripts/apply-editorial-gate.mjs
node scripts/inject-private-summaries.mjs
node scripts/inject-showcase.mjs
```

最終完了条件は、Clean Buildが成功し、そのcommitがGitHub Pagesへproduction deployされることです。
