# YieldLab デザインシステム

> 開発者向けリファレンス。UI実装時にこのドキュメントを参照すること。

---

## 1. デザイン哲学

- **App UI タイプ**: データ密度が高いが、視覚的に穏やかな管理画面
- **ユーティリティ重視**: 装飾より機能。ユーザーが数値を素早く読み取り、判断できることを最優先する
- **情報階層**: KPI > トレンド > 詳細テーブルの順で視線を誘導する

---

## 2. カラートークン

### ブランドカラー

| トークン | 値 | 用途 |
|---|---|---|
| `brand-navy` | `#1E3A8A` | ヘッダー、主要アクション、強調テキスト |
| `brand-gold` | `#CA8A04` | アクセント、レコメンデーション、プレミアム表示 |

### ステータスカラー

| トークン | 値 | 用途 |
|---|---|---|
| `yl-positive` | `#16A34A` | 収益増、ポジティブな変動 |
| `yl-negative` | `#DC2626` | 収益減、ネガティブな変動 |

### AI インサイト

| プロパティ | 値 |
|---|---|
| 背景 | `#F5F3FF` |
| ボーダー | `#DDD6FE` |
| テキスト | `#5B21B6` |

### BAR レベル

| レベル | カラー | 用途 |
|---|---|---|
| A | `#16A34A` (green-600) | 最安値帯 |
| B | `#2563EB` (blue-600) | 標準帯 |
| C | `#CA8A04` (yellow-600) | やや高め |
| D | `#EA580C` (orange-600) | 高価格帯 |
| E | `#DC2626` (red-600) | 最高値帯 |

### 競合カラー

| 対象 | カラー |
|---|---|
| 自社 | `brand-navy` (#1E3A8A) |
| 競合A | `#2563EB` (blue-600) |
| 競合B | `#9333EA` (purple-600) |
| 競合C | `#EA580C` (orange-600) |
| 競合D | `#059669` (emerald-600) |
| 競合E | `#DC2626` (red-600) |

---

## 3. タイポグラフィ

| プロパティ | 値 |
|---|---|
| プライマリフォント | Plus Jakarta Sans |
| フォールバック | Noto Sans JP, sans-serif |
| ベースサイズ | `14px` (`text-sm`) |
| KPI 数値 | `text-2xl font-bold` |
| セクション見出し | `text-sm font-semibold text-slate-700` |
| 補足テキスト | `text-xs text-slate-500` |

---

## 4. スペーシング

| 用途 | クラス |
|---|---|
| セクション間 | `space-y-6` |
| グリッド間隔 | `gap-4` |
| カード内パディング | `p-5` |
| インライン要素間 | `gap-2` |

---

## 5. コンポーネント

### カード `.yl-card`

```
bg-white rounded-xl border border-slate-200 shadow-sm
```

### インプット `.yl-input`

```
w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
placeholder:text-slate-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy
```

### バッジ

```
rounded-full px-2 py-0.5 text-[10px] font-medium
```

ステータスに応じて `bg-green-100 text-green-700` / `bg-red-100 text-red-700` を切り替える。

### セクション見出し

```
text-sm font-semibold text-slate-700
```

### 共有コンポーネント

| コンポーネント | パス | 用途 |
|---|---|---|
| `KpiCard` | `shared/KpiCard` | アイコン付きKPI表示。icon variant で視覚的に区別 |
| `SaveButton` | `shared/SaveButton` | 全設定パネル共通の保存ボタン |
| `AiSummaryCard` | `shared/AiSummaryCard` | AI インサイト表示。AI カラートークンを使用 |
| `EmptyState` | `shared/EmptyState` | イラスト + メッセージ + CTA ボタンの空状態表示 |

---

## 6. レイアウト

| 要素 | 仕様 |
|---|---|
| サイドバー | `w-12`（アイコンのみ） |
| ヘッダー | Navy グラデーション (`from-brand-navy to-blue-900`) |
| タブナビ | `TabNavBar` コンポーネント |
| メインコンテンツ | `max-w-[1400px] mx-auto px-6 py-5` |

---

## 7. レスポンシブ

### KPI グリッド

```
grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4
```

モバイル2列 → タブレット3列 → デスクトップ4列で段階的に拡張。

---

## 8. アクセシビリティ

- **スキップリンク**: 全プロダクトページに設置する
- **タッチターゲット**: 最小 `44px` を確保する（ボタン、リンク、インタラクティブ要素すべて）
- **カラーコントラスト**: WCAG AA 準拠。ステータスカラーはテキスト単独でなくアイコン・バッジと併用する
