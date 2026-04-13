# TODOS

## 認証フローのテスト整備

**What:** `backend/rate_limit.py` の `_get_real_ip` と `src/app/api/auth/login/route.ts` に対するテストを追加する。

**Why:** 認証系はバグが入りやすく、今回のレートリミット修正のような問題が無音で再発するリスクがある。テストがあれば回帰バグを PR 段階で検出できる。

**Pros:** 回帰バグ防止。rate_limit の key_func 変更が安全に行えるようになる。

**Cons:** pytest + vitest の両方をセットアップする必要がある (プロジェクト初のテスト整備)。

**Context:** 2026-04-10 のログイン不能バグ調査で判明。SlowAPI の `get_remote_address` が X-Forwarded-For を無視する仕様を知らず、BFF 経由だと全ユーザーが 127.0.0.1 に見えていた。テストがあればこの種の問題は早期発見できる。

**Depends on:** なし。独立して着手可能。

---

## Architecture Review follow-ups (2026-04-13)

### メール送信統一 (SES ベース)
- **What:** yieldlab-app の Resend を廃止し、yieldlab-lp と同じ Nodemailer + SES SMTP に統一
- **Why:** LP 側がバウンスハンドリング・配信停止リンク・特定電子メール法対応で成熟している。2系統の管理は非効率
- **Priority:** P3 (PoC 後の SaaS 統合フェーズ)
- **Added:** 2026-04-13

### テスト基盤構築 (pytest + vitest)
- **What:** 上記の認証フローテストに加え、全体的なテストフレームワーク (pytest for backend, vitest for frontend) のセットアップ
- **Why:** テストゼロの状態でクラウド移設はリスク。最低限 CI で回帰検出が必要
- **Priority:** P3 (クラウド移設前の MUST)
- **Added:** 2026-04-13
