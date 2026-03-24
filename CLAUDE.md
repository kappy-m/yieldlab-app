# YieldLab — Claude Code 設定

## プロジェクト概要

**YieldLab** はホテル収益管理（Revenue Management）のSaaSアプリ。
競合価格モニタリング・レコメンデーション・ダッシュボードを提供する。

| レイヤー | 技術 | 場所 |
|---|---|---|
| フロントエンド | Next.js 14 + Tailwind CSS + Radix UI | `src/` |
| バックエンド | FastAPI + SQLAlchemy (async) | `backend/` |
| DB（ローカル） | SQLite | `yieldlab.db` |
| DB（本番） | PostgreSQL（Railway） | 環境変数で切替 |
| デプロイ先 | Vercel（フロント）+ Railway（バック） | `vercel.json` / `railway.toml` |

---

## 開発コマンド

```bash
# フロントエンド
npm run dev           # 開発サーバー（localhost:3000）
npm run build         # プロダクションビルド
npm run lint          # ESLint

# バックエンド
cd backend
uvicorn backend.main:app --reload --port 8000   # 開発サーバー（localhost:8000）
python -m pytest                                 # テスト（存在する場合）

# DB
sqlite3 yieldlab.db ".tables"   # テーブル一覧確認
```

---

## コーディング規約

### 必須ルール
- TypeScript: `any` 禁止。厳格な型定義を使う
- エラーを握りつぶさない。原因特定できるログを出す
- コメントは「なぜ（Why）」を書く。「何をしているか」は書かない
- 5ファイル以上の変更・アーキテクチャ変更は事前に変更理由と影響範囲を提示して確認を取る

### 環境変数
- `.env.local`（ローカル）と本番環境の変数を絶対に混同しない
- シークレット・APIキーはコードやログに含めない

### Git
- コミットメッセージは「Why（なぜこの変更が必要か）」を書く
- WIP状態でコミットしない

---

## gstack スキル

> gstack は `~/.claude/skills/gstack/` にグローバルインストール済み（v0.11.10.0）。
> Claude Code では `~/.claude/skills/` 以下のスキルが自動認識される。

### ✅ 使うスキル（14個）

| スキル | 用途 | 使うタイミング |
|---|---|---|
| `/office-hours` | アイデア検証・要件の強制質問6本 | 機能開発を始める前 |
| `/plan-ceo-review` | プロダクト戦略レビュー（4モード） | 機能設計の妥当性確認 |
| `/plan-eng-review` | アーキテクチャ・テスト計画の確定 | 実装前のエンジニアリングレビュー |
| `/review` | PRレビュー（SQL安全性・副作用検出） | `git diff` 後、マージ前 |
| `/investigate` | 体系的な根本原因デバッグ（4フェーズ） | バグ・エラー調査時 |
| `/ship` | シップワークフロー（テスト→レビュー→PR） | コードをPRに上げるとき |
| `/retro` | 週次レトロスペクティブ（git logベース） | 週末・スプリント終了時 |
| `/document-release` | リリース後ドキュメント更新 | マージ・デプロイ後 |
| `/cso` | セキュリティ監査（OWASP + STRIDE） | 本番リリース前・定期監査 |
| `/careful` | 破壊的コマンドの安全装置 | `rm -rf`・DB操作・force-push前 |
| `/freeze` | 編集範囲をディレクトリに限定 | デバッグで特定ファイルだけ触るとき |
| `/unfreeze` | freeze解除 | freeze後の作業完了時 |
| `/guard` | careful + freeze の統合セーフティ | 本番DB・NAS作業時 |
| `/gstack-upgrade` | gstackアップデート | gstackのバージョンアップ時 |

### ❌ このプロジェクトでは使わないスキル

以下は **browseデーモン（Claude Code専用bun実行環境）依存** または **Cursor MCP（cursor-ide-browser）と競合** するため使用しない。

```
/browse, /qa, /qa-only, /benchmark, /canary, /setup-browser-cookies
```

以下は **デプロイパイプライン（Fly.io/Render等）前提** のため使用しない（Railway/Vercelとは非互換）。

```
/land-and-deploy, /setup-deploy
```

以下は **既存スキルで代替可能** または **個人開発規模では過剰**。

```
/design-consultation   → ui-ux-pro-max スキルを使う
/design-review         → ui-ux-pro-max スキルを使う
/autoplan              → 個人開発ではoverkill
/codex                 → OpenAI Codex CLI 未使用
```

---

## スキルとKazukiカスタムスキルの使い分け

| 場面 | 使うスキル |
|---|---|
| UI/UXデザイン・コンポーネント設計 | `ui-ux-pro-max`（~/.cursor/skills/） |
| プロダクト戦略・機能設計の議論 | `strategic-pm-capability` → `/plan-ceo-review` |
| アーキテクチャ確定・実装前レビュー | `implementation-intent` → `/plan-eng-review` |
| バグ・エラーの根本原因調査 | `/investigate` |
| 業界知識・OMO戦略の検討 | `multi-domain-knowledge` |
| コードをPRにまとめて出す | `/ship` |
| 本番DB・サーバー作業 | `/guard` を先に宣言する |
