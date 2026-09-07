# つくって考えた

日常や仕事の小さな不便から作ったWebアプリ、Chrome拡張、学習ツール、知識の置き場をまとめるPortfolioです。

公開URL: https://silovar-uk.github.io/worksportfolio/

## Product principle

このPortfolioの主役は「作品をたくさん見せること」ではなく、**過去の「困った → 作った」を必要な瞬間に取り出せること**です。

UIの優先順位は次の順です。

1. **Find** — 名前・困りごと・技術・用途からすぐ探せる
2. **Understand** — なぜ作ったか、いま何になっているかが分かる
3. **Browse** — 目的が決まっていなくても探索できる
4. **Delight** — 便利さを壊さない範囲で意外な再発見がある

「年代順 / カード / 地図」などの表示方法を最初に選ばせるのではなく、1つの検索と1つのCatalogを入口にします。

## Architecture contract

このRepositoryでは、**生成済みHTMLを入力へ戻さないこと**と、**初期表示後にページ構造を組み替えないこと**を最重要ルールにしています。

```text
Canonical source
  ↓
Validation / discovery / derived data
  ↓
Clean static build
  ↓
Publication gates / safe-data annotation
  ↓
Detail payload split
  ↓
index.html
  ↓
GitHub Pages
```

`index.html` は成果物です。日常編集のSource of Truthではありません。Build時には削除し、`src/index.template.html` から再生成します。

## One shell / One search / One catalog

ProductionのCore UIは次の3つに限定します。

### 1. Shell

担当:

- Header
- Header Searchの静的Markup
- Hero / Intro
- `START HERE`
- `WHY I MADE THEM`
- Catalogの配置

主なSource:

- `src/index.template.html`
- `data/settings.json`
- `scripts/build-static-site.mjs`
- `shell.css`
- `home-shell.css`

上部UIはRuntime featureから作り直しません。

### 2. Search

担当:

- Header Quick Search
- Catalog Searchと同じ検索意味
- 日本語IME
- Arrow Up / Down、Enter、Esc
- `/` で検索へフォーカス
- 名前だけでなく、困りごと・技術・用途・aliasから検索
- 検索候補に `MATCH: 困りごと` など一致理由を表示

Source:

- `home-shell.js`

`window.WORKS_PORTFOLIO_SEARCH` が唯一の検索意味を提供します。Header SearchとCatalog Searchで別々の検索実装を持ちません。

### 3. Catalog

担当:

- 1つの高密度List
- Quick Filter
- Search
- Sort
- Advanced Filter
- 公開ページ / GitHubへの直接導線
- Project Detailを開く
- URL state

Source:

- `catalog.js`
- `catalog.css`

ProductionのDefault UIでは、Compact / Card / Tableのレイアウト選択をユーザーへ要求しません。表示形式は設計側が決め、ユーザーは「探すこと」に集中します。

## Static discovery sections

### START HERE

最初に全件一覧を読ませず、方向の違う代表作を最大4件だけ出します。

- Desktop: 4列
- Tablet: 2列
- Mobile: 横スクロール

代表作は `data/settings.json` の `featuredProjectIds` を優先します。

### WHY I MADE THEM

制作物を技術ではなく、作る前の摩擦から探す入口です。

現在のレンズ:

- 手間を減らす
- 覚えて戻る
- 小さく学ぶ
- 比べて整理する
- 伝わり方を整える
- 情報を守る

ここは別ページや別Viewではなく、Header SearchへつながるDiscovery Navigationです。

### Surprise me

目的が決まっていないときの再発見用に「おまかせで1つ」を置きます。

ランダム機能は複数実装をProductionへ同時に載せません。

## Project detail

Project Detailでは次を扱います。

- 概要
- 公開ページ
- GitHub
- 作ったきっかけ
- 最初の版
- 現在の状態
- 更新履歴
- 技術
- 関連する制作物

一覧用Summaryはinlineに持ち、重いDetail fieldsは `data/project-details/<id>.json` に分割して、開いたときだけ取得します。

`?project=<id>` で直接参照でき、Core navigationからDetailを開くために `location.reload()` は使いません。

## Runtime ownership rules

Production Coreでは以下を禁止します。

- Heroの`innerHTML`を後から交換する
- 別featureのDOM順序を修復する
- 別featureのCSSを`!important`で押さえ込む
- Core UIにMutationObserverを使う
- document全体をMutationObserverで監視する
- RuntimeでCore layout用`<style>`を追加する
- `requestIdleCallback`で「あとから完成するページ」を作る
- Header SearchとCatalog Searchに別々の検索ロジックを持つ
- Detailを開くためにページ全体をreloadする

初期表示時点の主要レイアウトを完成形とします。

## Experimental assets

過去の実験コードは、検証材料としてRepositoryに残っている場合があります。

例:

- `friction-atlas.*`
- `live-index.*`
- `random-three.*`
- `floating-random.*`
- `comparison-view.*`
- `favorites.*`
- `showcase.*`
- `catalog-list-first.js`
- `catalog-visibility.js`

これらは**存在することとProductionで読み込むことを分けて扱います**。

現行Coreで必要性が証明されない限り、`index.html` の初期ロード経路には戻しません。再採用する場合も、Core DOMを修復する方式ではなく、独立したon-demand機能として実装します。

## Project taxonomy

`data/portfolio-taxonomy.json` は引き続きProject FamilyとMaking PrincipleのSourceです。

- `families`: 制作系統
- `principles`: 制作物から帰納したMaking Principles

`scripts/inject-showcase.mjs` は現在、Showcase UIをRuntime挿入しません。各Projectへtaxonomy情報を**データとして注釈するだけ**です。

検索や将来の探索機能はこのデータを利用できます。

## Project registry

Project metadataの正本は2つだけです。

- `data/projects.json` — Public / localなど、Private summaryではない制作物のCanonical Project Registry
- `data/private-projects.json` — 公開可能な情報だけに限定したPrivate制作物のSafe Summary Registry

旧 `manual-projects*.json`、`portfolio-config.overrides`、生成済み `index.html` をProject metadataの入力にはしません。

GitHub repository名とPortfolio上のProject IDが異なる場合だけ、`data/portfolio-config.json` の `repositoryProjectIds` で **Source repository ID → Project ID** を明示します。

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

公開可能な概要だけを `data/private-projects.json` に手動で保存します。各recordは最低限、次を満たします。

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

`scripts/validate-private-summaries.mjs` と `scripts/validate-portfolio-model.mjs` が検査します。

`scripts/inject-private-summaries.mjs` はSafe SummaryをProject dataへ追加するだけで、Productionへdocument-wide ObserverやPrivate専用repair runtimeを追加しません。

## Source of Truth

### 人が編集するSource

- `src/index.template.html` — HTML構造のベース
- `shell.css` — Header / Header Search / Hero
- `home-shell.css` — Home discovery / stable layout
- `home-shell.js` — Shared Search / Header Search / Home discovery interaction
- `catalog.js` / `catalog.css` — Canonical Catalog
- `data/projects.json` — Canonical Project Registry
- `data/private-projects.json` — Private-safe Summary Registry
- `data/periods.json` — 時系列データ
- `data/settings.json` — サイト設定 / Top copy / Featured IDs
- `data/portfolio-config.json` — repository ID mapping / hidden等
- `data/portfolio-taxonomy.json` — Family / Principle
- `data/editorial-policy.json` — 公開ゲート方針
- `data/project-start-dates.json` — 制作開始日の監査データ
- `data/pattern-taxonomy.json` / `data/pattern-merge-rules.json` — Pattern生成ルール

### 生成されるもの

- `data/catalog.json` — Public GitHub repository catalog
- `data/editorial-review.json` — Public repository review queue
- `data/pattern-audit.json` / `data/patterns.json` など — Pattern派生データ
- `data/project-details/*.json` — on-demand Detail payload
- `index.html` — 公開用完成HTML

## Identifier integrity

`scripts/validate-global-ids.mjs` がProject IDを横断検証します。

区別するもの:

- Canonical Project ID
- Private-safe Project ID
- Source repository ID
- `repositoryProjectIds` による明示mapping

`hiddenIds` はSource repository IDまたはProject IDを取れます。一方、Family / Principle / relationはProject IDを参照します。

存在しないID、Public/Private衝突、重複Project IDはBuildを失敗させます。

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
Stable static build
  ↓
Core architecture validation
  ↓
Editorial publication gate
  ↓
Private-safe summary injection
  ↓
Family / Principle data annotation
  ↓
Summary / on-demand detail split
  ↓
Generated-page / privacy / performance checks
  ↓
GitHub Pages
```

## Quality gates

Buildは「機能ファイルがたくさん存在すること」ではなく、Core UXを検査します。

Productionで確認すること:

- Header Searchは1つだけ
- `home-shell.js` / `catalog.js` がCore runtime
- `requestIdleCallback`による後段組み立てなし
- Core runtimeにMutationObserverなし
- Core navigationに`location.reload()`なし
- Legacy repair / experimental runtimeをProductionへ配信しない
- Private repository URLを公開しない
- Project detailsはon-demand
- index / inline dataはPerformance Budget内

Browser smoke testではDesktop / Mobileの両方で次を確認します。

- DOMContentLoaded直後からHeader Searchが使える
- Header → Detailが動く
- Header → Catalogへ検索Queryを引き継げる
- Catalogの検索解除 / Quick Filterが動く
- 初期表示後に主要Sectionの位置・高さが変わらない
- Legacy runtime assetへのNetwork Requestがない
- Console / page / local request errorがない
- Long Task / CLSが内部Budgetを超えない

## 主な実装ファイル

### Production Core

- `shell.css`
- `home-shell.css`
- `home-shell.js`
- `catalog.css`
- `catalog.js`
- `scripts/build-static-site.mjs`
- `scripts/apply-copy-cleanup.mjs`
- `scripts/split-project-data.mjs`
- `scripts/inject-private-summaries.mjs`
- `scripts/inject-showcase.mjs`
- `.github/workflows/update-catalog.yml`
- `.github/workflows/browser-smoke.yml`
- `tests/portfolio-smoke.spec.js`

### Data / Editorial

- `scripts/build-catalog.mjs`
- `scripts/validate-global-ids.mjs`
- `scripts/validate-portfolio-model.mjs`
- `scripts/apply-editorial-gate.mjs`
- `scripts/build-editorial-review.mjs`
- `scripts/validate-private-summaries.mjs`

## Definition of Done

Portfolioの改修は、見た目が変わった時点では完了としません。

完了条件:

1. Clean Buildが成功する
2. Privacy / Editorial Gateが成功する
3. Core Architecture validationが成功する
4. Browser interaction smokeがDesktop / Mobileで成功する
5. Performance Budgetを超えない
6. mainへmergeされる
7. main上の生成Buildが成功する
8. GitHub Pagesの公開URLでCore UIが確認できる

この順番を省略しません。
