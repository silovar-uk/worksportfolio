# つくって考えた

日常の小さな不便から作ったWebアプリ、Chrome拡張、コンテンツページ、学習ツールを、探し直し、使い直すための作品棚です。

## 公開URL

https://silovar-uk.github.io/worksportfolio/

## このサイトの優先順位

1. 目的の制作物をすぐ探せる
2. 最近作ったもの・更新したものが分かる
3. 公開中のツールをすぐ開ける
4. 制作背景・改善履歴・作品同士の関係を振り返れる

初期表示は「本棚」、初期の並び順は更新が新しい順です。`Ctrl + K` または `/` で検索欄へ移動できます。

## GitHub自動同期

公開リポジトリは原則すべて作品候補として取り込み、表示しないものだけ `data/portfolio-config.json` の `hiddenIds` で管理します。

- `scripts/build-catalog.mjs` がGitHub APIから公開リポジトリを取得
- `data/catalog.json` にリポジトリ名、説明、公開URL、言語、制作日、更新日などを保存
- `scripts/build-static-site.mjs` が既存の制作物データとカタログを統合し、完成版 `index.html` を生成
- GitHub Actionsが毎日1回、設定変更時、手動実行時にカタログと公開ページを更新
- ブラウザ側ではGitHub APIやZIP展開を行わず、生成済みの静的HTMLを表示
- 既存の制作日記データを優先し、GitHub側の更新日・URL・言語などの事実情報だけ更新
- 新しく作った公開リポジトリは、除外設定がなければ本棚へ自動追加

GitHubにないChrome拡張やローカル制作物は `data/manual-projects.json` で管理します。

## 作品ごとの上書き

表示名、分類、用途、状態、公開URLなど、GitHubだけでは判断できない情報は `data/portfolio-config.json` の `overrides` へ記述します。

```json
{
  "overrides": {
    "worksportfolio": {
      "title": "つくって考えた",
      "type": "web-app",
      "verbs": ["探す", "整理する", "振り返る"],
      "status": "active"
    }
  }
}
```

既存データ内のIDとGitHubリポジトリ名が違う場合は、`repositoryProjectIds` で紐づけます。

## 本棚の機能

- 名前・困りごと・技術から検索
- 最近更新、公開ページ、運用・開発中などのクイック絞り込み
- 種類、状態、制作年、整理状態、公開状況による詳細絞り込み
- 更新順、制作順、名前順などの並び替え
- コンパクト、カード、表の表示切替
- 制作年、種類、状態ごとのグループ分け
- 検索状態のURL・ブラウザ保存
- 最近開いた作品のローカル記録と絞り込み
- 複数作品の共有用テキスト、Markdown、TSV、JSONコピー
- 公開ページがある作品は「開く」ボタンから直接起動

## 制作の地層

ページ上部には、公開対象の制作物を年・種類から見渡す「制作の地層」を表示します。

- 年ごとの制作量を、種類別の色で可視化
- 年を押すと本棚へ切り替わり、その年の作品だけに絞り込み
- 全制作物数、種類数、制作年数、お気に入り数を実データから表示
- 「今日の1本」で、埋もれた作品を日替わりで再発見
- 「別の1本」または `R` キーでランダムに引き直し

年代順・関連地図は、制作の背景や流れを振り返るためのサブビューとして残しています。

## 種類の色

- Webアプリ：青
- Chrome拡張：紫
- 学習ツール：緑
- 設計ガイド：赤
- コンテンツページ：黄土
- 分析・データ：青緑
- 便利ツール：グレー
- 実験：ピンク

色だけに依存せず、種類名のラベルと左罫線を併用しています。

## データ整合性

`data-audit.js` が公開時に以下を確認・整理します。

- 重複ID
- 存在しない関連作品への参照
- 年代区分に残った非表示作品ID
- 代表作・最近の作品に残った非表示作品ID
- 種類、状態、整理状態の未設定値

一覧上部の件数、種類別内訳、公開ページ数、GitHub数は同じ監査済みデータから計算します。READMEには変動する固定件数を持たせません。

## favicon・ヘッダーアイコン

「小さな引っかかりが、作ることで構造へ変わる」様子を表現した専用アイコンを、faviconとヘッダー左上の両方に使用しています。

- `assets/favicon.svg`
- `site.webmanifest`

## 公開構成

GitHub Actionsが `.bootstrap/part-*.b64` の制作物パッケージをビルド時に展開し、GitHubカタログと手動作品を統合した完成版 `index.html` を生成します。公開時のブラウザは、この生成済みHTMLを読むだけです。

- `index.html`：GitHub Actionsが生成する完成版の静的ページ
- `data/portfolio-config.json`：非表示設定、作品ごとの上書き、IDの紐づけ
- `data/manual-projects.json`：GitHubにない制作物
- `data/catalog.json`：GitHubから自動生成した公開リポジトリ一覧
- `scripts/build-catalog.mjs`：GitHubカタログ生成スクリプト
- `scripts/build-static-site.mjs`：制作物パッケージを展開し、完成版HTMLを生成するスクリプト
- `.github/workflows/update-catalog.yml`：定期・手動・変更時のビルド
- `data-audit.js`：データ整合性確認と自動集計
- `catalog.js` / `catalog.css`：一覧表示・検索・ソート・選択コピー
- `shelf-priority.js` / `shelf-priority.css`：本棚の初期表示、検索ショートカット、最近開いた作品、公開導線
- `taxonomy.js` / `taxonomy.css`：種類別の色分けと内訳
- `wow.js` / `wow.css`：制作の地層・今日の1本
- `wow-stage.js`：全表示での共通表示とお気に入り件数連動
- `marks.js` / `marks.css`：お気に入り・あとで見る
- `.bootstrap/part-*.b64`：ビルド時だけ使用する制作物パッケージ分割データ
- `loader.js`：旧ブラウザ組み立て方式の退避ファイル。生成済み `index.html` からは読み込まない
- `assets/favicon.svg`：favicon・ヘッダーアイコン
- `404.html`：404ページ

## カタログと公開ページの手動更新

GitHubの `Actions → Build portfolio site → Run workflow` から更新できます。

ローカルで実行する場合は、`unzip` コマンドが利用できる環境で以下を実行します。

```bash
node scripts/build-catalog.mjs
node scripts/build-static-site.mjs
```

## GitHub Pages

公開されていない場合は、リポジトリの `Settings → Pages` で以下を設定してください。

- Source：Deploy from a branch
- Branch：main
- Folder：/ (root)
