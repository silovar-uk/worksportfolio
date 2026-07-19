# つくって考えた

日常の小さな不便から作ったWebアプリ、Chrome拡張、コンテンツページ、学習ツールを、制作時期と考え方から読み直すポートフォリオです。

## 公開URL

https://silovar-uk.github.io/worksportfolio/

## 収録内容

- 登録制作物：67件
- GitHubリポジトリ：61件
- 自作Chrome拡張：9件
- 閲覧方法：年代順／本棚／関連地図

## favicon

「小さな引っかかりが、作ることで構造へ変わる」様子を表現した専用アイコンを使用しています。

- `assets/favicon.svg`
- `site.webmanifest`

## 現在の構成

`index.html`は、リポジトリ内の分割データから完成版を初回アクセス時に組み立てます。組み立てたページはブラウザ内に保存され、2回目以降はすぐに表示されます。

- `index.html`：公開用ローダー
- `.bootstrap/part-*.b64`：完成版サイトの分割データ
- `assets/favicon.svg`：サイトアイコン
- `404.html`：404ページ

## GitHub Pages

公開されていない場合は、リポジトリの `Settings → Pages` で以下を設定してください。

- Source：Deploy from a branch
- Branch：main
- Folder：/ (root)
