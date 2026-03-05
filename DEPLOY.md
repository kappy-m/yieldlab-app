# YieldLab デプロイガイド

## アーキテクチャ

```
[Vercel] Next.js フロントエンド
    ↕ HTTPS API呼び出し
[Railway] FastAPI バックエンド  ←→  [Railway] PostgreSQL DB
    ↕ スケジューラー（毎朝6時JST）
[Expedia] 競合価格スクレイプ（mock / live）
```

---

## Step 1: GitHubリポジトリ作成

```bash
cd /volume1/docker/yieldlab-app
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/{your-username}/yieldlab-app.git
git push -u origin main
```

---

## Step 2: Railway — バックエンド + PostgreSQLデプロイ

1. [railway.app](https://railway.app) にログイン
2. **New Project** → **Deploy from GitHub repo** → `yieldlab-app` を選択
3. **New Service** → **Database** → **PostgreSQL** を追加
4. バックエンドサービスの **Variables** タブで以下を設定:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
FRONTEND_URL=https://your-vercel-app.vercel.app
EXTRA_CORS_ORIGINS=https://yieldlab.dev
SCRAPER_MODE=mock
AUTO_APPROVE_THRESHOLD=1
```

5. **Settings** → **Root Directory** を `./` に設定
6. Railwayが `railway.toml` を読み込んで `backend/Dockerfile` でビルド
7. デプロイ完了後、**Networking** → **Public Domain** からバックエンドURLを控える
   - 例: `https://yieldlab-backend-production.up.railway.app`

### 初回起動時の自動シード
バックエンドが起動すると、DBが空の場合に自動でシードデータを投入します:
- 施設: 東京・渋谷ホテル
- 競合ホテル: 5社（Expedia ID設定済み）
- 部屋タイプ: 10種 / BARラダー / 90日分プライシンググリッド

---

## Step 3: Vercel — フロントエンドデプロイ

1. [vercel.com](https://vercel.com) にログイン
2. **New Project** → GitHubから `yieldlab-app` をインポート
3. **Root Directory** を `./`（プロジェクトルート）に設定
4. **Environment Variables** を設定:

```env
NEXT_PUBLIC_API_URL=https://yieldlab-backend-production.up.railway.app
```

5. **Build Command**: `npm run build`（自動検出）
6. デプロイ完了後、Vercel URLを控える
7. Railway の `FRONTEND_URL` と `EXTRA_CORS_ORIGINS` をVercel URLで更新

---

## Step 4: カスタムドメイン設定（yieldlab.dev）

### Vercel（フロントエンド）
- Vercel Dashboard → **Domains** → `yieldlab.dev` を追加
- DNSレジストラで `CNAME yieldlab.dev → cname.vercel-dns.com` を設定

### Railway（バックエンド / API）
- Networking → **Custom Domain** → `api.yieldlab.dev` を追加
- DNS: `CNAME api.yieldlab.dev → {railway-domain}`
- `vercel.json` の rewrite 先を `https://api.yieldlab.dev` に更新

---

## Step 5: 動作確認

```bash
# バックエンドヘルスチェック
curl https://api.yieldlab.dev/health

# 施設データ確認
curl https://api.yieldlab.dev/properties/

# 競合セット確認（実際のExpedia IDが入っているか）
curl https://api.yieldlab.dev/properties/1/comp-set/
```

---

## 競合ホテルのExpedia ID（確認済み）

| ホテル名 | Expedia ID | Expedia URL |
|---------|-----------|------------|
| セルリアンタワー東急ホテル | 661016 | [リンク](https://www.expedia.co.jp/Tokyo-Hotels-Cerulean-Tower-Tokyu-Hotel.h661016.Hotel-Information) |
| 渋谷エクセルホテル東急 | 486569 | [リンク](https://www.expedia.co.jp/Tokyo-Hotels-Shibuya-Excel-Hotel-Tokyu.h486569.Hotel-Information) |
| 渋谷グランベルホテル | 8150500 | [リンク](https://www.expedia.co.jp/Tokyo-Hotels-Shibuya-Granbell-Hotel.h8150500.Hotel-Information) |
| ヒルトン東京 | 22597 | [リンク](https://www.expedia.co.jp/Tokyo-Hotels-Hilton-Tokyo.h22597.Hotel-Information) |
| パークハイアット東京 | 108657 | [リンク](https://www.expedia.co.jp/Tokyo-Hotels-Park-Hyatt-Tokyo.h108657.Hotel-Information) |

---

## スクレイパーを本番モードに切り替える方法

1. 設定画面 `/settings` → **競合セット** を開く
2. 対象ホテルの **モード** を `モック → 本番（Expedia）` に変更
3. Expedia IDが設定されていることを確認
4. Railway の環境変数: `SCRAPER_MODE=playwright` に変更
5. `backend/Dockerfile` の `INSTALL_PLAYWRIGHT_BROWSERS` を `true` に変更してリデプロイ

> ⚠️ Playwright を使ったスクレイピングはメモリを多く消費します（最低512MB）。
> Railway のプランを **Hobby（$5/月）** 以上にしてください。

---

## 月次コスト目安（プロトタイプ段階）

| サービス | プラン | コスト |
|---------|------|------|
| Vercel | Hobby（無料） | $0/月 |
| Railway（バックエンド） | Hobby | ~$5/月 |
| Railway（PostgreSQL） | 使用量課金 | ~$1-3/月 |
| **合計** | | **~$6-8/月** |
