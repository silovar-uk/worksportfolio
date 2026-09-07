# つくって考えた

日常や仕事の小さな不便から作ったWebアプリ、Chrome拡張、学習ツール、知識の置き場をまとめるPortfolioです。

公開URL: https://silovar-uk.github.io/worksportfolio/

## Product principle

このPortfolioの主役は「作品をたくさん見せること」ではなく、**過去の「困った → 作った」を必要な瞬間に取り出せること**です。

優先順位:

1. **Find** — 名前・困りごと・技術・用途からすぐ探せる
2. **Understand** — なぜ作ったか、いま何になっているかが分かる
3. **Browse** — 目的が決まっていなくても探索できる
4. **Delight** — 便利さを壊さない範囲で意外な再発見がある

Productionは **One shell / One search / One catalog / One detail** を基本とします。

---

## Architecture contract

`index.html` は成果物であり、Source of Truthではありません。

```text
Canonical source
  ↓
Validation / GitHub discovery / editorial review
  ↓
One direct production build
  ├─ index.html + inline Search Index
  ├─ data/catalog-projects.json
  └─ data/project-details/<id>.json
  ↓
GitHub Pages
```

重要なのは、**大きなRuntimeデータを一度HTMLへ埋めてから後段Scriptで削る方式を使わないこと**です。

Source / Build / Productionのデータ境界を一致させます。

---

## Progressive data architecture

ユーザーが必要とするタイミングに合わせて、Project dataを3層に分けます。

### Layer 1 — Inline Search Index

`index.html` に `window.WORKS_PORTFOLIO_SEARCH_INDEX` として埋め込みます。

目的:

- DOMContentLoaded直後からHeader Searchを使える
- Searchのために外部JSONを待たない
- Catalog障害時でも作品検索を維持する

含めるのは検索に必要な最小情報だけです。

- Project ID
- title
- 検索候補に表示する短いhint
- type
- updated date
- alias / verb / technology / familyの検索情報
- summary / friction等から作った検索専用corpus
- summary-only判定
- summary-only Projectが直接開ける公開URLがある場合のみ、そのURL

Production byte数を抑えるため、このpayloadは短いkeyでpackし、`home-shell.js` がRuntimeで意味のあるrecordへdecodeします。

**検索対象を減らすための圧縮ではありません。**
表示しない検索専用情報の表現だけを圧縮します。

### Layer 2 — Catalog payload

`data/catalog-projects.json`

Catalogを表示するときに1回だけ取得します。

主な内容:

- title
- summary
- type / status
- started / created / updated date
- public page URL
- GitHub URL
- Private-safe source表示

Catalogが取得できない場合でもHeader Searchは利用可能なままにします。

### Layer 3 — Project Detail

`data/project-details/<id>.json`

Projectを実際に開いたときだけ取得します。

主な内容:

- subtitle / summary
- 作ったきっかけ
- firstBuild
- currentAnswer
- update history
- technologies
- relatedProjects
- extension information

`summaryOnly: true` のPrivate-safe ProjectにはDetail JSONを生成しません。

---

## Core UI ownership

### Shell

担当:

- Header
- Header Search markup
- Hero
- START HERE
- WHY I MADE THEM
- Catalog mount point
- Dialog shell

Source:

- `src/index.template.html`
- `shell.css`
- `home-shell.css`
- `data/settings.json`
- `scripts/build-static-site.mjs`

初期表示後にHeroや主要Sectionを別Runtimeが作り直すことは禁止します。

### Search

Source: `home-shell.js`

`window.WORKS_PORTFOLIO_SEARCH` が唯一の検索意味を提供します。

扱うもの:

- 日本語NFKC normalization
- カタカナ / ひらがな吸収
- alias
- weighted match
- Search resultの一致理由
- IME composition
- Arrow Up / Down
- Enter / Escape
- `/` shortcut
- friction discovery
- Surprise me

Header SearchとCatalog Searchで別々の検索意味を実装しません。
CatalogはProject IDを通してShared Searchへ問い合わせます。

### Catalog

Source:

- `catalog.js`
- `catalog.css`
- `data/catalog-projects.json`（generated）

Productionのdefault UIは1つのdense listです。

- Search
- Quick Filter
- Sort
- Advanced Filter
- Public / GitHub link
- Project Detail entry
- URL state

Card / Table / Mapなどの表示方式を最初に選ばせません。

### Project Detail

Source:

- `project-detail.js`
- `data/project-details/*.json`（generated）

`?project=<id>` で直接参照できます。

Detail fetchに失敗してもSearch / Catalogは利用可能なままにします。

---

## Static discovery

### START HERE

最大4作品をBuild時に静的生成します。

`data/settings.json` の `featuredProjectIds` を優先します。

### WHY I MADE THEM

技術ではなく「作る前の摩擦」から探す入口です。

- 手間を減らす
- 覚えて戻る
- 小さく学ぶ
- 比べて整理する
- 伝わり方を整える
- 情報を守る

別Viewを生成するのではなく、Inline Search Indexを利用したDiscovery Navigationです。

### Surprise me

目的が決まっていないときだけ、Projectを1つ引きます。

ランダムUIを複数実装しません。

---

## Project registries

人が編集するProject metadataの正本:

- `data/projects.json` — Canonical public/local Project Registry
- `data/private-projects.json` — 公開可能な情報だけに限定したPrivate-safe Summary Registry

`data/portfolio-config.json` はrepository ID mappingやhidden IDなど、Project metadataそのものではない設定だけを持ちます。

### Public GitHub discovery

`scripts/build-catalog.mjs` がPublic repositoryだけを取得し、`data/catalog.json` を生成します。

発見と公開は別です。

Editorial state:

- `discovered`
- `candidate`
- `curated`
- `published`
- `hidden`

公開判定は `data/editorial-policy.json` をSourceとして、**`scripts/build-static-site.mjs` がProduction data生成時に直接適用**します。

`scripts/build-editorial-review.mjs` はReview queueを作りますが、Production HTMLを後処理しません。

### Private-safe projects

Private repository metadataそのものはPublic catalogへ流しません。

`data/private-projects.json` には公開可能な概要だけを置きます。

必須条件:

```json
{
  "visibility": "private",
  "sourceVisibility": "private",
  "summaryOnly": true,
  "repositoryUrl": ""
}
```

公開禁止:

- Private GitHub URL / repository metadata
- source code / README本文
- branch / commit / issue / PR
- secret / API key
- internal URL
- account / database identifier
- 個人・顧客・組織の内部情報

BuildではPrivate-safe Summaryを直接最終Project集合へmergeします。

`summaryOnly` Projectには `data/project-details/<id>.json` を作りません。

---

## Taxonomy

`data/portfolio-taxonomy.json` がSourceです。

- `families`
- `principles`

Family / Principle annotationも `scripts/build-static-site.mjs` がProduction data生成時に直接適用します。

Runtime Showcase injectionは行いません。

---

## Source of Truth

### Human-edited

- `src/index.template.html`
- `shell.css`
- `home-shell.css`
- `home-shell.js`
- `catalog.css`
- `catalog.js`
- `project-detail.js`
- `data/projects.json`
- `data/private-projects.json`
- `data/settings.json`
- `data/portfolio-config.json`
- `data/portfolio-taxonomy.json`
- `data/editorial-policy.json`
- `data/project-start-dates.json`
- `data/pattern-taxonomy.json`
- `data/pattern-merge-rules.json`

### Generated

- `data/catalog.json` — Public GitHub discovery
- `data/editorial-review.json` — Review queue
- `data/pattern-audit.json`
- `data/patterns.json`
- `data/catalog-projects.json` — Catalog Runtime payload
- `data/project-details/*.json` — Detail Runtime payload
- `index.html` — Production HTML + packed inline Search Index

---

## Runtime rules

Production Coreでは以下を禁止します。

- Heroの`innerHTML` replacement
- feature間のDOM repair
- Core UIへのMutationObserver
- document-wide MutationObserver
- Runtime style injectionによるCore layout repair
- `requestIdleCallback`で後からページを完成させる
- Core navigationの`location.reload()`
- Header SearchとCatalog Searchの意味を分岐させる
- 巨大Project Diaryをinlineに戻す
- Catalog / Detail障害を理由にSearchを使えなくする

---

## Build pipeline

`.github/workflows/update-catalog.yml`

```text
Source boundary validation
  ↓
Private-safe validation
  ↓
Public GitHub discovery
  ↓
Sanitize / audit
  ↓
Global ID validation
  ↓
Portfolio model validation
  ↓
Editorial review build
  ↓
Pattern validation / build
  ↓
Clean direct production build
    ├─ editorial publication filtering
    ├─ Private-safe merge
    ├─ taxonomy annotation
    ├─ packed inline Search Index
    ├─ Catalog JSON
    └─ per-project Detail JSON
  ↓
Architecture / privacy / byte-budget validation
  ↓
Generated files commit
  ↓
GitHub Pages
```

Production dataを加工するための後段HTML mutation stageは置きません。

---

## Quality gates

### Data boundary

CIで確認すること:

- Search IndexとCatalogのProject件数が一致
- packed Search IndexにPrivate-safe summaryが存在
- summary-only ProjectにDetail JSONが存在しない
- Private repository URLがProduction HTMLへ出ない
- obsolete runtime globalsが存在しない

### Performance budgets

現在の上限:

- `index.html`: 90 KB
- inline Search Index: 50 KB
- `data/catalog-projects.json`: 70 KB
- Core JS合計: 60 KB

Budgetを超えた場合、基準を上げる前にデータ重複や責務境界を見直します。

### Browser smoke

Desktop / Mobileで確認します。

- Header Search
- Japanese IME path
- Arrow / Enter / Escape
- `/` shortcut
- Search → Detail
- Back / Forward
- Search → Catalog query handoff
- Catalog Search / Quick Filter / Sort
- Catalog JSONが失敗してもHeader Searchが使える
- legacy runtime request 0
- Long Task < 150 ms
- CLS < 0.03
- console / page error 0

---

## Production Core files

- `src/index.template.html`
- `shell.css`
- `home-shell.css`
- `home-shell.js`
- `catalog.css`
- `catalog.js`
- `project-detail.js`
- `scripts/build-static-site.mjs`
- `scripts/apply-copy-cleanup.mjs`
- `.github/workflows/update-catalog.yml`
- `.github/workflows/browser-smoke.yml`
- `tests/portfolio-smoke.spec.js`

旧post-build mutation scriptsはGit履歴に残し、現役コードとしては保持しません。

---

## Definition of Done

Portfolio改修はPR作成時点では完了しません。

1. Clean Build成功
2. Source / Privacy / ID validation成功
3. Runtime data-boundary validation成功
4. Performance Budget成功
5. Desktop Browser Smoke成功
6. Mobile Browser Smoke成功
7. PR merge
8. main Build成功
9. generated filesのmain commit確認
10. main Browser Smoke成功
11. final main SHAのGitHub Pages deploy成功
12. Production URLで最終構造確認

この12項目が揃って初めて完了です。
