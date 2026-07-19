# つくって考えた

日常の小さな不便から作ったWebアプリ、Chrome拡張、コンテンツページ、学習ツールを、制作時期と考え方から読み直すポートフォリオです。

## 公開URL

https://silovar-uk.github.io/worksportfolio/

## 収録内容

- 表示中の制作物：54件
- 表示中のGitHubリポジトリ：48件
- 表示中の自作Chrome拡張：10件
- 閲覧方法：年代順／本棚／関連地図

GitHubのリポジトリ一覧だけでなく、ZIPで制作した拡張や、公開リポジトリを持たない手元の道具も台帳へ含めています。台帳には残しつつ、ポートフォリオへ表示しない作品は `loader.js` の `hiddenIds` で管理します。

## favicon・ヘッダーアイコン

「小さな引っかかりが、作ることで構造へ変わる」様子を表現した専用アイコンを、faviconとヘッダー左上の両方に使用しています。

- `assets/favicon.svg`
- `site.webmanifest`

## 公開構成

`index.html`がリポジトリ内の制作物パッケージを読み込み、データ・CSS・JavaScriptをブラウザ上で組み立てます。

- `index.html`：公開用ローダー
- `loader.js`：制作物の追加・非表示設定・ページ組み立て
- `catalog.js`：一覧表示・検索・ソート・選択コピー
- `catalog.css`：一覧UI
- `.bootstrap/part-*.b64`：制作物パッケージの分割データ
- `assets/favicon.svg`：favicon・ヘッダーアイコン
- `404.html`：404ページ

## GitHub Pages

公開されていない場合は、リポジトリの `Settings → Pages` で以下を設定してください。

- Source：Deploy from a branch
- Branch：main
- Folder：/ (root)
