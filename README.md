# クラロワ トロフィー ローソク足チャート

クラッシュ・ロワイヤルの戦績（トロフィー）を取得し、TradingView 級の UX を持つローソク足チャートで可視化するローカル Web アプリです。データ取得は **手動の「同期」ボタン**が基本。任意で自動ポーリングも可能です。

チャートには [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) を使用しています。

---

## ⚠️ 重要な前提

- 公式 API は **直近 ~25 戦のみ**を返します（履歴の一括取得・ページングは不可）。
  そのため本アプリは「**同期を繰り返して、前に向かって履歴を貯める**」方式です。最初はデータが少なく、こまめに同期するほど履歴が充実します。
- API トークンは **発行時のIPに固定**され、ブラウザからの直接呼び出しは CORS で不可。
  そのためトークンを保持・永続化する小さなローカルバックエンドを同梱しています。

---

## セットアップ

### 1. 依存インストール

    npm install

### 2. API トークンを取得（どこでも使えるプロキシ方式・推奨）

このアプリは既定で **RoyaleAPI プロキシ**（`https://proxy.royaleapi.dev/v1`）経由で動きます。
トークンを **プロキシの固定IP `45.79.218.79`** に紐づけて作れば、**自宅・外出先・別PCなど、どのネットワークからでも IP 再設定なしで使えます**。

1. https://developer.clashroyale.com/ にログイン
2. **Create New Key** で、許可IPに **`45.79.218.79`** を指定してキーを作成
3. 発行されたトークン文字列をコピー

> 💡 **なぜこれで「どこでも」動くの？**
> トークンはプロキシのIPに紐づくため、あなたの実IPが変わっても無効化されません。
> リクエストはプロキシ（固定IP）を経由して公式APIへ転送されます。
>
> （上級者向け）自分の公開IPに直接紐づけたい場合は、許可IPを自分のIPにして
> `.env` の `CR_API_BASE` を `https://api.clashroyale.com/v1` に変更してください。
> ただしIPが変わると 403 になり作り直しが必要です。

### 3. `.env` を作成

    cp .env.example .env

`.env` を開いて `CR_API_TOKEN` を貼り付けるだけ。`PLAYER_TAG`（既定 `#8LJ8PGQJQ`）と
`CR_API_BASE`（既定でプロキシ）はそのままでOKです。

### 4. 起動

    npm run dev

- バックエンド: http://localhost:3001
- フロント: **http://localhost:5173** ← ブラウザで開く

---

## 使い方

- 右上の **「同期」** ボタンで最新戦績を取得 → 重複を除いて DB に追記 → チャート更新。
- **1H / 4H / 12H / 1D / 1W** で集計間隔を切替。
- ローソクにカーソルを合わせると、始/高/安/終・戦闘数・勝率が左上に表示されます。
- **自動: N分** を選ぶと、その間隔で自動同期します（オフが既定）。
- **ライン ON/OFF** で終値ラインの重ね表示を切替。

### ローソク足の意味

各戦闘後のトロフィー（`startingTrophies + trophyChange`）を「価格」とみなし、時間バケット毎に集計:

| 要素 | 意味 |
| --- | --- |
| 始値 (open) | バケット内 最初の戦闘後トロフィー |
| 高値 (high) | バケット内 最高トロフィー |
| 安値 (low) | バケット内 最低トロフィー |
| 終値 (close) | バケット内 最後の戦闘後トロフィー |
| 出来高 (volume) | バケット内の戦闘数（勝ち越し=緑 / 負け越し=赤） |

対象は **トロフィーロード/ラダー（`type: "PvP"`）** の戦闘です。

---

## データ

- SQLite ファイル: `data/battles.db`（`.gitignore` 済み）。
- 中身の確認例:

      sqlite3 data/battles.db 'SELECT COUNT(*) FROM battles;'

## スクリプト

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | バックエンド + フロントを同時起動（開発） |
| `npm run typecheck` | 型チェック |
| `npm run build` | 本番ビルド |

## 構成

    lib/      共有ロジック（DB=libSQL / API取得 / ローソク集計 / ハンドラ）
    api/      Vercel サーバーレス関数（sync / candles / status）
    server/   ローカル開発用 Express（lib/ の同じハンドラを起動）
    client/   React + Vite + lightweight-charts（チャートUI）
    data/     ローカルSQLite（自動生成。本番は Turso）

ローカルは `data/battles.db`（libSQLのファイルモード）、本番(Vercel)は環境変数 `TURSO_DATABASE_URL` で Turso に接続します。コードは同一です。

---

## 本番デプロイ（Vercel + Turso、すべて無料）

「PCを開いていなくても、1日1回自動で戦績を収集」できる構成です。

### 1. Turso でDBを作成
1. https://turso.tech/ にサインアップ（GitHubログイン可）
2. データベースを1つ作成 → **Database URL**（`libsql://...`）と **Auth Token** を取得

### 2. GitHub にプッシュ
このリポジトリを自分の GitHub に push します（`.env` と `data/` は `.gitignore` 済みで漏れません）。

### 3. Vercel で Import
1. https://vercel.com/ に GitHub でログイン → **Add New → Project** → リポジトリを Import
2. **Environment Variables** に以下を設定:
   - `CR_API_TOKEN` … RoyaleAPIプロキシ用トークン
   - `PLAYER_TAG` … `#8LJ8PGQJQ`（Vercelでは生のままでOK、クォート不要）
   - `CR_API_BASE` … `https://proxy.royaleapi.dev/v1`
   - `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` … 手順1の値
   - （任意）`CRON_SECRET` … 任意の文字列。設定するとCron実行を保護
3. **Deploy**

### 4. 自動収集（Cron）
[vercel.json](vercel.json) に `0 18 * * *`（毎日 18:00 UTC = 03:00 JST）で `/api/sync` を叩く設定済み。
Vercel無料プランの Cron は **1日1回**。`#8LJ8PGQJQ` は1日25戦も滅多にないため、これで十分です。
たくさん遊んだ日は、デプロイ先URLの画面で手動「同期」ボタンを押せばその場で取り込めます。

## スクリプト

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | バックエンド + フロントを同時起動（開発） |
| `npm run typecheck` | 型チェック |
| `npm run build` | フロントの本番ビルド（Vercelが実行） |
