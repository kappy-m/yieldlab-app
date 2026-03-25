# YieldLab — アーキテクチャ & 開発要件ドキュメント

> **目的**: Claude / AI チャットへのインプット用。現状の設計・実装・今後の開発方針を一元整理したもの。
> **最終更新**: 2026-03-24

---

## 1. プロダクト概要

### What is YieldLab?

ホテル向けのマルチプロダクト SaaS。「Revenue Management の民主化」をミッションに、
中小規模ホテルが大手チェーンと対等に戦えるオペレーション基盤を提供する。

### プロダクト構成（現在）

| コード | 表示名 | フェーズ | 概要 |
|---|---|---|---|
| `yield` | **Manage** | ✅ MVP 実装済 | 収益管理（料金・競合・予約分析） |
| `manage` | **Front** | 🔲 Placeholder | フロント業務（チェックイン/アウト、ゲスト管理） |
| `review` | **Review** | 🟡 UI 実装済（モックデータ） | 口コミ・問い合わせ管理 |
| `reservation` | **Reservation** | 🔲 Placeholder | 予約管理 |

> **注意**: DB の `product_code` は `yield` / `manage` / `review` / `reservation` のまま。
> 表示名のみを変更（Yield→Manage, Manage→Front）。コード変更は破壊的変更のため将来検討。

---

## 2. システムアーキテクチャ

### 全体構成図

```
[ユーザーブラウザ]
    │
    │ HTTPS
    ▼
[Vercel (Next.js 14 App Router)]
    │ NEXT_PUBLIC_API_URL → Railway URL
    │ /api/auth/* → BFF (Next.js API Routes)
    │
    │ REST API (Bearer JWT)
    ▼
[Railway (FastAPI + Uvicorn)]
    │
    │ SQLAlchemy (Async)
    ▼
[SQLite (開発) / PostgreSQL (本番予定)]
```

### デプロイ環境

| 環境 | Frontend | Backend | DB |
|---|---|---|---|
| **Local Dev** | `localhost:3000` (Next.js) | `localhost:8400` (uvicorn) | SQLite (`yieldlab.db`) |
| **Production** | Vercel (`app.yieldlab.dev`) | Railway | SQLite (ephemeral) ※課題あり |

---

## 3. バックエンド（FastAPI）

### フレームワーク & ライブラリ

```
Python + FastAPI 0.115 + Uvicorn 0.30
SQLAlchemy 2.0 (Async ORM) + aiosqlite / asyncpg
Pydantic 2.9 (データバリデーション)
python-jose (JWT)
passlib + bcrypt (パスワードハッシュ)
APScheduler (定期スクレイピング)
Playwright (スクレイピング: モード切替可)
```

### ディレクトリ構成

```
backend/
├── main.py              # アプリエントリ、DB初期化、自動シード、マイグレーション
├── config.py            # 環境変数管理（DATABASE_URL, CORS, SCRAPER_MODE）
├── database.py          # AsyncEngine, AsyncSession, Base
├── dependencies.py      # 認証 Depends（get_current_user, require_product）
├── models/
│   ├── organization.py  # Organization（マルチテナント基盤）
│   ├── user.py          # User（認証ユーザー）
│   ├── user_product_role.py # プロダクト別権限
│   ├── property.py      # ホテル物件
│   ├── room_type.py     # 客室タイプ
│   ├── bar_ladder.py    # BAR料金ラダー
│   ├── pricing_grid.py  # 料金グリッド（日付×客室タイプ）
│   ├── recommendation.py # AI推薦（ルールベース）
│   ├── comp_set.py      # 競合ホテルセット
│   ├── competitor_price.py  # 競合料金
│   ├── competitor_rating.py # 競合評価（楽天/Google/TripAdvisor）
│   ├── daily_performance.py # 日次実績（OCC, ADR, RevPAR）
│   ├── booking_snapshot.py  # 予約カーブ（先行予約データ）
│   ├── budget_target.py     # 月次予算目標
│   ├── cost_setting.py      # コスト設定
│   ├── market_event.py      # マーケットイベント
│   └── approval_*.py        # 承認フロー設定・ログ
├── routers/
│   ├── auth.py          # POST /auth/login, GET /auth/me
│   ├── users.py         # CRUD /users/, PUT /users/{id}/product-roles
│   ├── properties.py    # CRUD /properties/
│   ├── pricing.py       # /properties/{id}/pricing/
│   ├── recommendations.py   # /properties/{id}/recommendations/
│   ├── competitor.py    # /properties/{id}/competitor/
│   ├── comp_set.py      # /properties/{id}/comp-set/
│   ├── competitor_ratings.py # /properties/{id}/competitor-ratings/
│   ├── daily_performance.py  # /properties/{id}/daily-performance/
│   ├── booking_curve.py     # /properties/{id}/booking-curve/
│   ├── cost_budget.py       # /properties/{id}/costs, /budget
│   └── market.py       # /properties/{id}/market/events
└── services/
    ├── scheduler.py     # APScheduler（定期実行）
    ├── scraper.py       # Playwright スクレイパー基底
    ├── mock_scraper.py  # モックスクレイパー（開発用）
    ├── rakuten_scraper.py   # 楽天トラベルスクレイパー
    ├── rakuten_rating_fetcher.py
    ├── google_rating_fetcher.py
    ├── tripadvisor_rating_fetcher.py
    ├── rule_engine.py   # 料金推薦ルールエンジン
    └── market_service.py # 祝日・イベントカレンダー
```

### データモデル（ER概要）

```
Organization (1) ─── (N) Property (1) ─── (N) RoomType
                           │                    │
                           │              (N) BarLadder
                           │              (N) PricingGrid
                           │              (N) Recommendation
                           ├── (N) CompSet ─── (N) CompetitorPrice
                           ├── (N) CompetitorRating
                           ├── (N) DailyPerformance
                           ├── (N) BookingSnapshot
                           ├── (N) BudgetTarget
                           ├── (N) CostSetting
                           └── (N) ApprovalSetting

User (N) ─── (1) Organization
User (1) ─── (N) UserProductRole
```

### 認証フロー

```
1. ログイン: POST /auth/login (form-data: username/password)
   → JWT 発行（payload: user_id, org_id, roles: {product_code: role}）
2. BFF (Next.js /api/auth/login): JWT を HttpOnly Cookie (yl_token) にセット
3. 以後のリクエスト:
   - middleware.ts: Cookie の JWT デコード → プロダクトアクセス権チェック（Edge Runtime）
   - Backend API: Authorization: Bearer <token> で署名検証
```

### 権限モデル

```python
# product_code: "yield" | "manage" | "review" | "reservation"
# role: "admin" | "editor" | "viewer"

class UserProductRole:
    user_id: int
    product_code: str
    role: str  # UniqueConstraint(user_id, product_code)
```

---

## 4. フロントエンド（Next.js 14）

### フレームワーク & ライブラリ

```
Next.js 14.2 (App Router)
React 18
TypeScript 5
Tailwind CSS 3.4
Radix UI (Dialog, Dropdown, Select, Tabs 等)
Recharts 3.7 (グラフ)
Lucide React (アイコン)
```

### ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx           # グローバルレイアウト（フォント設定）
│   ├── page.tsx             # / → /dashboard リダイレクト
│   ├── dashboard/page.tsx   # /dashboard → /yield リダイレクト
│   ├── (auth)/
│   │   └── login/page.tsx   # ログイン画面
│   ├── (app)/
│   │   ├── layout.tsx       # アプリ共通レイアウト（ProductSidebar + メインコンテンツ）
│   │   ├── yield/page.tsx   # Manage プロダクト（収益管理ダッシュボード）
│   │   ├── manage/page.tsx  # Front プロダクト（Placeholder）
│   │   ├── review/page.tsx  # Review プロダクト（口コミ・問い合わせ）
│   │   └── reservation/page.tsx # Reservation プロダクト（Placeholder）
│   ├── api/
│   │   ├── auth/login/route.ts  # BFF: JWT → HttpOnly Cookie
│   │   └── auth/logout/route.ts # BFF: Cookie クリア
│   ├── settings/page.tsx    # 設定ページ（ユーザー管理、コンプセット等）
│   └── unauthorized/page.tsx # 権限なし画面
├── components/
│   ├── layout/
│   │   ├── ProductSidebar.tsx   # 左サイドバー（プロダクト切替、2プロダクト以上で表示）
│   │   ├── DashboardHeader.tsx  # 共通ヘッダー（ホテル切替、ユーザーアバター）
│   │   ├── DashboardTabs.tsx    # タブナビ（Manage プロダクト内）
│   │   └── ProductSwitcher.tsx  # （旧：ヘッダー内プロダクト切替 → 現在は未使用）
│   ├── tabs/                # Manage プロダクトの各タブ
│   │   ├── PricingTab.tsx   # 料金グリッド
│   │   ├── CompetitorTab.tsx # 競合料金比較
│   │   ├── MarketTab.tsx    # マーケットイベント
│   │   ├── DailyTab.tsx     # 日次実績
│   │   ├── BookingTab.tsx   # 予約カーブ
│   │   ├── BudgetTab.tsx    # 予算管理
│   │   ├── CostTab.tsx      # コスト管理
│   │   ├── RatingPanel.tsx  # 競合評価
│   │   ├── SettingsTab.tsx  # 設定（コンプセット等）
│   │   └── UserAccessPanel.tsx # ユーザー権限管理
│   ├── review/              # Review プロダクトのコンポーネント
│   │   ├── reviewData.ts    # モックデータ（口コミ）
│   │   ├── inquiryData.ts   # モックデータ（問い合わせ）
│   │   ├── ReviewSummaryTab.tsx  # サマリータブ
│   │   ├── InboxTab.tsx     # 統合受信ボックス（サブタブ: 口コミ|問い合わせ）
│   │   ├── ReviewListTab.tsx    # 口コミリスト（スライドパネル方式）
│   │   ├── ReviewSlidePanel.tsx # 口コミ詳細・返信作成スライドパネル
│   │   ├── InquiryListTab.tsx   # 問い合わせリスト
│   │   ├── InquirySlidePanel.tsx # 問い合わせ詳細・返信作成スライドパネル
│   │   └── ReviewAnalyticsTab.tsx # 分析タブ
│   ├── shared/              # 共通コンポーネント
│   │   ├── KpiCard.tsx
│   │   ├── AiSummaryCard.tsx
│   │   └── Skeleton.tsx
│   ├── pricing/
│   │   └── PriceEditModal.tsx
│   └── ui/                  # Radix UI ラッパー（shadcn/ui パターン）
├── lib/
│   ├── api.ts               # バックエンド API クライアント（全エンドポイント）
│   └── utils.ts             # cn() など
└── middleware.ts            # Edge Runtime JWT 検証・ルートガード
```

### ルーティング & 認証フロー

```
/ → /dashboard → /yield（認証済の場合）

未認証でプロダクトパスにアクセス → /login へリダイレクト
権限なしプロダクトにアクセス → /unauthorized へリダイレクト

Cookie: yl_token (HttpOnly, SameSite=Lax)
localStorage: yl_token（API Bearer用）, yl_user（ユーザー情報キャッシュ）
```

### プロダクトサイドバーの動作

```typescript
// ProductSidebar.tsx
// - localStorage の product_roles を読み取り
// - アクセス可能プロダクトが 2つ以上の場合のみ表示
// - 1つ以下の場合はサイドバー非表示（シングルプロダクト利用者向け）
```

---

## 5. デザインシステム

### カラーパレット

```css
/* ブランドカラー */
--primary:    #1E3A8A (Deep Blue) /* ヘッダー、ボタン、アクティブ状態 */
--accent:     #CA8A04 (Gold)     /* アクティブインジケーター */

/* バックグラウンド */
--bg-app:     #F9FAFB            /* ページ背景 */
--bg-white:   #FFFFFF            /* カード背景 */
--border:     #E2E8F0 (slate-200)

/* テキスト */
--text-primary: #0F172A (slate-900)
--text-secondary: #475569 (slate-500)
```

### UIパターン

- **スライドパネル**: 詳細表示・編集の標準パターン（右からスライドイン）
- **サブタブ**: カード型ボタン（アクティブ時: Primary Blue 背景 + 白テキスト）
- **ステータスバッジ**: 色分け丸 + ラベル（新規=赤 / 対応中=黄 / 解決済=緑 / クローズ=グレー）
- **フィルターバー**: 白カード背景 + セレクトボックス群
- **KPIカード**: 数値・変化率・スパークラインの3点セット

---

## 6. 実装済み機能一覧

### Manage プロダクト（`/yield`）※表示名は「Manage」

| 機能 | 状態 | 備考 |
|---|---|---|
| 料金グリッド（日付×客室タイプ） | ✅ 実装済 | BAR ラダー連動、セル編集可 |
| AI 料金推薦 | ✅ 実装済 | ルールベース、承認フロー付き |
| 競合料金比較 | ✅ 実装済 | スクレイピング（Playwright/モック切替） |
| 競合評価比較 | ✅ 実装済 | 楽天/Google/TripAdvisor |
| マーケットイベント | ✅ 実装済 | 祝日・地域イベントカレンダー |
| 日次実績（OCC/ADR/RevPAR） | ✅ 実装済 | グラフ + テーブル |
| 予約カーブ分析 | ✅ 実装済 | 前年比・理想曲線比較 |
| 予算管理 | ✅ 実装済 | 月次目標 vs 実績 |
| コスト管理（GOPPAR） | ✅ 実装済 | 変動費・固定費 |
| コンプセット管理 | ✅ 実装済 | 競合ホテル登録・スクレイピング設定 |
| ユーザー権限管理 | ✅ 実装済 | プロダクト別 RBAC |

### Review プロダクト（`/review`）

| 機能 | 状態 | 備考 |
|---|---|---|
| サマリータブ（AI分析サマリー） | ✅ UI実装（モック） | バックエンド未連携 |
| 口コミ一覧（スライドパネル） | ✅ UI実装（モック） | Google/OTA 統合 |
| AI 返信案生成 | 🟡 スタブ実装 | OpenAI GPT-4o 未連携 |
| 問い合わせ管理（メール/フォーム/電話） | ✅ UI実装（モック） | バックエンド未連携 |
| 分析タブ（キーワード/言語/カテゴリ） | ✅ UI実装（モック） | バックエンド未連携 |

### Front プロダクト（`/manage`）

| 機能 | 状態 | 備考 |
|---|---|---|
| ダッシュボード | 🔲 Placeholder | 未着手 |

### Reservation プロダクト（`/reservation`）

| 機能 | 状態 | 備考 |
|---|---|---|
| ダッシュボード | 🔲 Placeholder | 未着手 |

---

## 7. 既知の技術的課題・制約

### 課題①: 本番 DB が SQLite (ephemeral)
- Railway の ephemeral ファイルシステムにより、**再デプロイでデータが消える**
- 起動時に自動シードで復元しているが、ユーザーが追加したデータは揮発する
- **解決策**: PostgreSQL への移行（Railway PostgreSQL Add-on は利用可能）

### 課題②: モックデータと実データの分離
- Review プロダクトは全てモックデータ（`reviewData.ts`, `inquiryData.ts`）
- 本番データ連携には バックエンド API + スクレイピング基盤が必要

### 課題③: AI 返信案が未実装（スタブ）
- OpenAI API キー未設定
- `ReviewSlidePanel.tsx` / `InquirySlidePanel.tsx` のテンプレートを GPT-4o で置換する必要あり

### 課題④: メール送信基盤なし
- 問い合わせへの返信「送信」ボタンはスタブ
- SMTP / SendGrid / Resend 等の連携が必要

### 課題⑤: JWT の二重管理
- HttpOnly Cookie (middleware 用) と localStorage (API Bearer 用) の両方にトークンを保持している
- セキュリティ的にはバックエンドの BFF 化（全 API を Next.js 経由にする）が理想

### 課題⑥: 多プロパティ対応が未完全
- `PropertyOut` / `propertyId` は設計済みだが、UIは1物件前提の動作が多い
- ヘッダーのホテル切替 UI はあるが、データ切替の一貫性に改善余地あり

---

## 8. 環境変数

### フロントエンド（`.env.local`）

```env
NEXT_PUBLIC_API_URL=http://localhost:8400   # ローカル開発
# 本番では Railway の URL を Vercel に設定

BASIC_AUTH_USER=kappy          # Vercel プレビュー用ベーシック認証
BASIC_AUTH_PASSWORD=kappy123
```

### バックエンド（`.env`）

```env
DATABASE_URL=sqlite+aiosqlite:///./yieldlab.db   # ローカル
# 本番: postgresql+asyncpg://...

FRONTEND_URL=http://localhost:3100
EXTRA_CORS_ORIGINS=https://app.yieldlab.dev,https://yieldlab.dev
SCRAPER_MODE=mock   # "mock" | "rakuten" | "playwright"
AUTO_APPROVE_THRESHOLD=1
```

---

## 9. 開発ロードマップ（バックログ）

### 🔴 直近の優先課題（インフラ・データ）

1. **PostgreSQL 移行**: Railway の永続 DB に切り替えてデータ揮発問題を解消
2. **Review API**: 口コミ・問い合わせデータのバックエンド実装（スクレイピング or API連携）
3. **OpenAI 連携**: AI 返信案生成の実装（GPT-4o）

### 🟡 中期課題（プロダクト拡張）

4. **Front プロダクト**: チェックイン/アウト管理、ゲスト情報
5. **Reservation プロダクト**: 予約一覧、OTA 連携、予約カレンダー
6. **メール送信**: 問い合わせ返信、通知メール（Resend / SendGrid）
7. **チーム権限**: `TeamProductRole` モデルの追加（現在はユーザー個別のみ）

### 🟢 長期課題（SaaS 基盤）

8. **マルチテナント強化**: Organization プランティア別機能制限
9. **Stripe 決済**: サブスクリプション管理
10. **CM（チャネルマネージャー）連携**: リアルタイム料金プッシュ
11. **モバイル対応**: Progressive Web App 化

---

## 10. 開発規約・方針

### コード規約

- **TypeScript**: `any` 禁止、strict モード
- **コンポーネント**: 機能単位でファイル分割、`"use client"` は最小範囲に
- **状態管理**: React useState / useMemo のみ（外部ストア未導入）
- **スタイル**: Tailwind CSS ユーティリティクラス中心、インラインスタイルはブランドカラーのみ
- **API クライアント**: `src/lib/api.ts` に全エンドポイントを集約

### Git 運用

- `main` ブランチに直接プッシュ → Vercel 自動デプロイ
- コミットメッセージ: `feat(scope): Why` 形式（何をしたかではなく、なぜ変更したか）

### テスト方針（現状）

- 自動テスト未整備（Claude による手動 QA + ビルド確認）
- `npm run build` を必ず通してからプッシュ

---

## 11. ステークホルダー & コンテキスト

- **開発者**: Kazuki Murayama（1人開発 / AI ペアプログラミング）
- **開発環境**: M4 Mac + UGREEN NAS（Docker）+ Cursor IDE
- **AI アシスタント**: Claude（Cursor 統合）、gstack スキルセット使用
- **想定顧客**: 中小規模ホテル（独立系・小型チェーン）
- **競合製品**: SynXis, Duetto, IDeaS（エンタープライズ向け高額SaaS）
- **差別化**: 低コスト・高UX・AI活用・ホテル業務オールインワン
