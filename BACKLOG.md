# BACKLOG.md — YieldLab App

ホテル収益管理（Revenue Management）SaaS のバックログ。
チケット番号は `BL-XXX` 形式。ステータス更新は担当エージェントが行う。

---

## IN_PROGRESS

_現在進行中のチケットはありません_

---

## TODO

### BL-005: Review バックエンド API（口コミ・問い合わせ）
- **優先度:** A（🔴 直近）
- **推奨担当:** Cursor
- **概要:** Review プロダクトのフロントは UI 先行（モックデータ）で構築済み。バックエンドに口コミ・問い合わせデータを保持する DB モデルと API を実装し、フロントを実データに接続する。
- **対象:**
  - `backend/models/review_entry.py`（新規）
  - `backend/models/inquiry_entry.py`（新規）
  - `backend/routers/review.py`（新規）
  - `src/components/review/` — apiFetch 接続
- **見積:** 1日

### BL-006: OpenAI API 連携（AI返信案生成）
- **優先度:** A（🔴 直近）
- **推奨担当:** Cursor
- **概要:** Review プロダクトの「AI返信案作成」ボタンがスタブのまま。GPT-4o を使って口コミ・問い合わせへの日本語返信案を自動生成する API を実装する。
- **対象:**
  - `backend/routers/ai_reply.py`（新規）
  - `backend/requirements.txt`（openai 追加）
  - `src/components/review/ReviewSlidePanel.tsx` — AI返信ボタン接続
- **見積:** 半日

### BL-007: Front プロダクト（チェックイン/アウト・ゲスト情報）
- **優先度:** B（🟡 中期）
- **推奨担当:** Cursor
- **概要:** Front プロダクト（`/manage`）を Coming Soon から実装する。本日のチェックイン/アウト一覧・ゲスト情報をリストビューで表示。バックエンドはモックデータで先行。
- **対象:**
  - `backend/models/guest_stay.py`（新規）
  - `backend/routers/front.py`（新規）
  - `src/app/(app)/manage/page.tsx`（実装）
  - `src/components/front/`（新規ディレクトリ）
- **見積:** 1.5日

### BL-008: Reservation プロダクト（予約一覧・カレンダー）
- **優先度:** B（🟡 中期）
- **推奨担当:** Cursor
- **概要:** Reservation プロダクト（`/reservation`）を Coming Soon から実装する。予約一覧リスト + 月次カレンダービュー。OTA 連携はスタブ（将来拡張）。
- **対象:**
  - `backend/models/reservation.py`（新規）
  - `backend/routers/reservation.py`（新規）
  - `src/app/(app)/reservation/page.tsx`（実装）
  - `src/components/reservation/`（新規ディレクトリ）
- **見積:** 1.5日

### BL-009: メール送信（問い合わせ返信・Resend API）
- **優先度:** B（🟡 中期）
- **推奨担当:** Cursor
- **概要:** Review プロダクトの問い合わせ詳細パネルから、返信メールを直接送信できる機能。Resend API を使用。メールアドレス・件名・本文を入力して送信。
- **対象:**
  - `backend/routers/mail.py`（新規）
  - `backend/requirements.txt`（resend 追加）
  - `src/components/review/ReviewSlidePanel.tsx` — 送信ボタン追加
- **見積:** 半日

### BL-010: チーム権限（TeamProductRole）
- **優先度:** C（🟡 中期）
- **推奨担当:** Cursor
- **概要:** 現在の権限管理はユーザー個別のみ。チーム単位での権限設定（`TeamProductRole` モデル）を追加し、Settings から管理できるようにする。
- **対象:**
  - `backend/models/team.py`（新規）
  - `backend/models/team_product_role.py`（新規）
  - `backend/routers/teams.py`（新規）
  - `src/components/tabs/SettingsTab.tsx` — チーム管理 UI
- **見積:** 1日

---

## DONE

### BL-001: ローカル PostgreSQL 移行 ✅
- Alembic 導入、Docker Compose に PostgreSQL 追加
- `feat(month1)` コミット済み

### BL-002: ダッシュボード・Overview 画面 ✅
- KPI カード・アラートリスト・週間トレンドグラフ・AI サマリープレースホルダー
- `feat(month1)` コミット済み

### BL-003: JWT BFF 一本化 ✅
- localStorage から HttpOnly Cookie へ移行
- BFF プロキシ（`/api/proxy/[...path]`）実装
- `feat(month1)` コミット済み

### BL-004: セキュリティ基盤 ✅
- Rate Limiting（slowapi）・CORS 厳格化・入力バリデーション強化・Security Headers
- `feat(security)` コミット済み
