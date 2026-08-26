# つくって考えた

日常や仕事の小さな不便から作ったWebアプリ、Chrome拡張、学習ツール、知識の置き場をまとめるPortfolioです。

公開URL: https://silovar-uk.github.io/worksportfolio/

## Portfolioの3層

このサイトは、単なるGitHubリポジトリ一覧ではなく、次の3層で運用します。

1. **Showcase** — 初見の人が30〜60秒で「何を作る人か」を理解する
2. **Catalog** — 全制作物を検索・比較・再発見する
3. **Editorial System** — GitHub上の制作活動を発見し、編集・安全確認して公開する

Showcaseでは代表作、Making Principles、Project Families、最近育てた作品を表示します。Catalogでは従来の作品棚、ランダム3枚、比較、検索、絞り込みを維持します。

初期表示は「本棚」、初期の並び順は**制作開始が新しい順**です。`Ctrl + K` または `/` で検索欄へ移動できます。

## Showcase

Showcaseの編集データは `data/portfolio-taxonomy.json` に置きます。

- `showcase.featuredProjectIds`: 代表作
- `families`: Project Family（最大5〜7系統を目安）
- `principles`: 制作物から帰納したMaking Principles

表示側は `showcase.js` / `showcase.css`、生成時の注入は `scripts/inject-showcase.mjs` が担当します。

FamilyやPrincipleは公開用project dataへラベルとして注入されるため、GitHubのリポジトリ構造とは独立して整理できます。

## Catalog

作品棚は「深く探す」ための層です。

- 名前・困りごと・技術から検索
- 最近更新、公開ページ、運用・開発中などのクイック絞り込み
- 種類、状態、制作年、整理状態、公開状況による詳細絞り込み
- 更新順、制作開始順、名前順などの並び替え
- コンパクト、カード、表の表示切替
- 制作年、種類、状態ごとのグループ分け
- 最近開いた作品
- 複数作品の共有用テキスト / Markdown / TSV / JSONコピー
- ランダム3枚
- 比較
- お気に入り

ShowcaseのProject FamilyからCatalogを一時的に絞り込むこともできます。

## Public GitHub discovery

`scripts/build-catalog.mjs` がGitHub APIから**Public repositoryだけ**を取得し、`data/catalog.json` に保存します。

重要なのは、**発見と公開を分離する**ことです。

### 既存作品

2026-08-25までに存在していたPublic repositoryは移行時のbaselineとして、従来どおりPortfolioに掲載します。

### 今後の新規Public repository

新しく発見したrepositoryは、原則 `discovered` として扱い、即時公開しません。

Editorial State:

- `discovered`: GitHubで発見、編集前
- `candidate`: 公開候補として確認中
- `curated`: タイトル・概要・分類を編集済み
- `published`: Portfolioへ掲載
- `hidden`: 掲載しない

新しいrepositoryを明示的に公開する場合は `data/portfolio-config.json` のoverrideへ `editorialState: "published"` を設定します。

公開ゲートは `data/editorial-policy.json` と `scripts/apply-editorial-gate.mjs` が担当します。

## Editorial review queue

`scripts/build-editorial-review.mjs` が `data/editorial-review.json` を生成します。

ここに含めるのは**Public repositoryのみ**です。Private repository名やPrivate GitHub metadataは絶対に入れません。

レビュー理由の例:

- `no-curation`
- `generic-summary`
- `no-family`
- `no-live-url`
- `technology-unknown`

編集不足はWARNING、漏えい・schema破損・不正参照はFAILとして扱います。

## Private-source projects

Private repositoryはPublic catalogと完全に別経路で扱います。

流れ:

`Private repoを確認 → 公開可否判断 → 安全な概要を手動作成 → allowlistへ追加 → validation → publish`

公開可能な概要だけを `data/manual-projects-private.json` に保存します。

Private-source projectは必ず次を満たします。

```json
{
  "sourceVisibility": "private",
  "summaryOnly": true,
  "repositoryUrl": ""
}
```

UIでは実装事情を強く見せず、必要な箇所だけ `Source not public` と表示します。

### 公開してはいけないもの

- Private GitHub URL
- Private repository名（安全確認なし）
- README本文
- source code
- file path / branch / commit / issue / PR
- secret / API key
- 内部URL
- account / database identifier
- 個人・顧客・組織の内部情報

`scripts/validate-private-summaries.mjs` と `scripts/validate-portfolio-model.mjs` が検査します。

## データの責務

### 手書き・編集データ

- `data/portfolio-config.json`: Public作品の上書き、hidden、editorial state
- `data/portfolio-taxonomy.json`: Showcase / Family / Principle
- `data/editorial-policy.json`: Editorial Stateと公開ゲート方針
- `data/manual-projects.json`: GitHubにない制作物
- `data/manual-projects-extra.json`: 追加の手動制作物
- `data/manual-projects-daily-log.json`: Daily Logの公開用記録
- `data/manual-projects-private.json`: 安全確認済みPrivate概要

### 生成データ

- `data/catalog.json`: Public GitHub repository catalog
- `data/editorial-review.json`: Public repositoryの編集レビューキュー
- `data/patterns.json` など: 制作パターン生成物
- `index.html`: 公開用の完成版HTML

生成ファイルを日常的な編集のSource of Truthにしません。

## ビルドパイプライン

GitHub Actionsの主な流れ:

```text
Public GitHub discovery
  ↓
Catalog build
  ↓
Sanitize
  ↓
Portfolio model validation
  ↓
Editorial review queue
  ↓
Pattern validation / build
  ↓
Static portfolio build
  ↓
Editorial publication gate
  ↓
Safe Private summaries injection
  ↓
Showcase / Family / Principle injection
  ↓
Generated-page security checks
  ↓
Commit generated files
  ↓
GitHub Pages
```

Private repositoryの検出情報はこのPublic CIへ渡しません。

## 主なファイル

- `catalog.js` / `catalog.css`: Catalog
- `showcase.js` / `showcase.css`: Showcase / Project Family
- `private-source.js` / `private-source.css`: Private-source表示制御
- `random-three.js` / `random-three.css`: ランダム3枚
- `comparison-view.js` / `comparison-view.css`: 比較
- `shelf-priority.js` / `shelf-priority.css`: 本棚の初期導線
- `scripts/build-catalog.mjs`: Public GitHub discovery
- `scripts/build-static-site.mjs`: Static site build
- `scripts/apply-editorial-gate.mjs`: 新規Public repoの公開ゲート
- `scripts/build-editorial-review.mjs`: Public editorial review queue
- `scripts/validate-portfolio-model.mjs`: taxonomy / privacy / reference validation
- `scripts/inject-private-summaries.mjs`: 安全なPrivate概要の注入
- `scripts/inject-showcase.mjs`: Showcase taxonomyの注入
- `.github/workflows/update-catalog.yml`: CI / generated build

## ローカル確認

Public GitHub APIを利用できる環境では、概ね次の順で確認します。

```bash
node scripts/build-catalog.mjs
node scripts/sanitize-project-data.mjs
node scripts/validate-private-summaries.mjs
node scripts/validate-portfolio-model.mjs
node scripts/build-editorial-review.mjs
node scripts/validate-pattern-candidates.mjs
node scripts/build-patterns.mjs
node scripts/validate-patterns.mjs
node scripts/build-static-site.mjs
node scripts/apply-copy-cleanup.mjs
node scripts/apply-editorial-gate.mjs
node scripts/inject-private-summaries.mjs
node scripts/inject-showcase.mjs
```

最終的な完了条件は、CI成功だけではなくGitHub Pagesへproduction deployされたことです。
