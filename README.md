# つくって考えた

日常の小さな不便から作ったWebアプリ、Chrome拡張、コンテンツページ、学習ツールを、制作時期と考え方から読み直すポートフォリオです。

## 公開URL

https://silovar-uk.github.io/worksportfolio/

## 収録内容

- 制作物件数は、公開画面の実データから自動集計
- GitHubリポジトリ数、公開ページ数、手元のみの作品数も自動集計
- 種類別の内訳を、色分けしたボタンとして表示
- 閲覧方法：年代順／本棚／関連地図

GitHubのリポジトリ一覧だけでなく、ZIPで制作した拡張や、公開リポジトリを持たない手元の道具も台帳へ含めています。台帳には残しつつ、ポートフォリオへ表示しない作品は `loader.js` の `hiddenIds` で管理します。

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

`index.html`がリポジトリ内の制作物パッケージを読み込み、データ・CSS・JavaScriptをブラウザ上で組み立てます。

- `index.html`：公開用ローダー
- `loader.js`：制作物の追加・非表示設定・ページ組み立て
- `data-audit.js`：データ整合性確認と自動集計
- `catalog.js` / `catalog.css`：一覧表示・検索・ソート・選択コピー
- `taxonomy.js` / `taxonomy.css`：種類別の色分けと内訳
- `marks.js` / `marks.css`：お気に入り・あとで見る
- `.bootstrap/part-*.b64`：制作物パッケージの分割データ
- `assets/favicon.svg`：favicon・ヘッダーアイコン
- `404.html`：404ページ

## GitHub Pages

公開されていない場合は、リポジトリの `Settings → Pages` で以下を設定してください。

- Source：Deploy from a branch
- Branch：main
- Folder：/ (root)
