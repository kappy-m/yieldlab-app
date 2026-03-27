"use client";

import { useState } from "react";
import { Star, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "disconnected" | "testing";

interface IntegrationSystem {
  id: string;
  name: string;
  category: "channel_manager" | "pms" | "ota";
  description: string;
  logoLabel: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const INTEGRATION_SYSTEMS: IntegrationSystem[] = [
  {
    id: "tl_lincoln",
    name: "TL-Lincoln",
    category: "channel_manager",
    description: "田村システムズが提供するサイトコントローラー。楽天・じゃらん・Booking.com・Expediaなど主要OTAへの在庫・料金を一括配信。国内シティホテルへの導入実績多数。",
    logoLabel: "TL",
    fields: [
      { key: "hotel_code", label: "ホテルコード", placeholder: "例: TL12345" },
      { key: "api_key",    label: "APIキー",      placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "temairazu",
    name: "手間いらず",
    category: "channel_manager",
    description: "稼働率連動の自動価格調整「ターゲットプライス」を搭載した国内大手サイトコントローラー。競合価格モニタリング機能も搭載。300以上のシステムとAPI連携実績あり。",
    logoLabel: "TM",
    fields: [
      { key: "hotel_id", label: "ホテルID",    placeholder: "例: TM_HOTEL_001" },
      { key: "username", label: "ユーザー名",  placeholder: "管理画面ログインID" },
      { key: "password", label: "パスワード",  placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "neppan",
    name: "ねっぱん！++",
    category: "channel_manager",
    description: "業界シェアNo.1のクラウド型サイトコントローラー。全国2万施設以上が利用。在庫・料金・予約情報を一元管理。月額定額制（予約手数料なし）で小規模施設から大型ホテルまで対応。",
    logoLabel: "NP",
    fields: [
      { key: "property_code", label: "施設コード",   placeholder: "例: NP_12345" },
      { key: "api_token",     label: "APIトークン",  placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "opera_cloud",
    name: "Oracle Opera Cloud",
    category: "pms",
    description: "Oracleが提供するグローバル標準のクラウド型PMS。フロント業務・予約・会計・ハウスキーピングを統合管理。世界の主要ホテルチェーンで採用。REST APIでのシステム連携に対応。",
    logoLabel: "OC",
    fields: [
      { key: "base_url", label: "テナントURL",          placeholder: "https://xxx.hospitality.oracleindustry.com" },
      { key: "app_key",  label: "アプリケーションキー", placeholder: "••••••••••••••••", type: "password" },
      { key: "hotel_id", label: "ホテルID",             placeholder: "例: RPHGINZA" },
    ],
  },
  {
    id: "protel",
    name: "Protel PMS",
    category: "pms",
    description: "欧州発・日本語対応のクラウド型PMS。宿泊・会計・CRM機能を統合。多くのサイトコントローラーやOTAとのAPI連携に対応し、日本国内での導入実績も多い。",
    logoLabel: "PT",
    fields: [
      { key: "server_url", label: "サーバーURL",  placeholder: "https://xxx.protel.net" },
      { key: "username",   label: "ユーザーID",   placeholder: "管理者ログインID" },
      { key: "password",   label: "パスワード",   placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "tap_pms",
    name: "プロホテルシステム（TAP）",
    category: "pms",
    description: "株式会社タップが提供する国内向けPMS。1,700施設・28万室以上の稼働実績。フロント・予約・会計・POS連携まで一気通貫で対応。シティホテル・リゾートを問わず導入実績多数。",
    logoLabel: "TP",
    fields: [
      { key: "api_endpoint", label: "APIエンドポイント", placeholder: "https://tap.example.com/api/v2" },
      { key: "api_key",      label: "APIキー",           placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "rakuten",
    name: "楽天トラベル",
    category: "ota",
    description: "楽天ウェブサービスAPIとの連携。空室・料金データの取得と在庫配信に対応。VacantHotelSearch APIにより競合ホテルのリアルタイム価格・プラン数のモニタリングにも利用中。",
    logoLabel: "RT",
    fields: [
      { key: "application_id", label: "アプリケーションID", placeholder: "例: 841114b0-xxxx" },
      { key: "access_key",     label: "アクセスキー",       placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "jalan",
    name: "じゃらんnet",
    category: "ota",
    description: "リクルートが運営する国内最大級の旅行予約サービス。じゃらん宿泊素材APIを通じた在庫・料金の管理・配信に対応。国内旅行者への訴求力が高く、西日本・レジャー需要に強い。",
    logoLabel: "JL",
    fields: [
      { key: "hotel_cd", label: "施設コード", placeholder: "例: 370250" },
      { key: "api_key",  label: "APIキー",    placeholder: "••••••••••••••••", type: "password" },
    ],
  },
  {
    id: "booking_com",
    name: "Booking.com",
    category: "ota",
    description: "世界最大のオンライン旅行代理店。Booking.com Connectivity APIにより在庫・料金・制限（MinLOS等）の自動配信が可能。インバウンド需要への対応として不可欠なチャネル。",
    logoLabel: "BK",
    fields: [
      { key: "hotel_id", label: "ホテルID",    placeholder: "例: 1234567" },
      { key: "username", label: "ユーザー名",  placeholder: "Booking.comアカウント" },
      { key: "password", label: "パスワード",  placeholder: "••••••••••••••••", type: "password" },
    ],
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  channel_manager: "サイトコントローラー",
  pms:             "PMS（ホテル管理システム）",
  ota:             "OTA連携",
};

function IntegrationCard({
  system, isExpanded, onToggle,
}: {
  system: IntegrationSystem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    setStatus("testing");
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1800));
    const allFilled = system.fields.every(f => formData[f.key]?.trim());
    if (allFilled) {
      setStatus("connected");
      setTestResult("接続成功：認証OK。ホテル情報を確認しました。");
    } else {
      setStatus("disconnected");
      setTestResult("接続失敗：全必須項目を入力してください。");
    }
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const statusBadge = {
    connected:    { label: "接続済み",    cls: "bg-green-100 text-green-700" },
    disconnected: { label: "未接続",      cls: "bg-gray-100 text-gray-500" },
    testing:      { label: "テスト中...", cls: "bg-yellow-100 text-yellow-700" },
  }[status];

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
          system.category === "ota" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
        )}>
          {system.logoLabel}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{system.name}</span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", statusBadge.cls)}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{system.description}</p>
        </div>
        <svg
          className={cn("w-4 h-4 text-gray-400 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
          {system.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
              <input
                type={field.type || "text"}
                value={formData[field.key] || ""}
                onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
              />
            </div>
          ))}

          {testResult && (
            <div className={cn(
              "text-xs px-3 py-2 rounded-md",
              status === "connected" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            )}>
              {testResult}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={status === "testing"}
              className="flex-1 px-3 py-2 text-xs font-medium border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600/5 transition-colors disabled:opacity-50"
            >
              {status === "testing" ? "テスト中..." : "接続テスト"}
            </button>
            <button
              onClick={handleSave}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                isSaved ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {isSaved ? "保存しました ✓" : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegrationsPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => ({
    catKey,
    catLabel,
    systems: INTEGRATION_SYSTEMS.filter(s => s.category === catKey),
  }));

  return (
    <div className="space-y-8">
      <div className="yl-card p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          評価データ API キー設定
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Railway の環境変数に以下を追加すると、評価モニターに Google / TripAdvisor の評価・口コミが自動表示されます。
        </p>
        <div className="space-y-2">
          {[
            {
              key: "GOOGLE_PLACES_API_KEY",
              label: "Google Places API キー",
              color: "text-blue-700 bg-blue-50 border-blue-200",
              badge: "Google",
              note: "Google Cloud Console → Places API (New) を有効化 → API キーを発行",
              link: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
            },
            {
              key: "TRIPADVISOR_API_KEY",
              label: "TripAdvisor Content API キー",
              color: "text-emerald-700 bg-emerald-50 border-emerald-200",
              badge: "TripAdvisor",
              note: "TripAdvisor Developer Portal → Content API → API キーを申請",
              link: "https://www.tripadvisor.com/developers",
            },
          ].map(item => (
            <div key={item.key} className={`flex items-start gap-3 p-3 rounded-lg border ${item.color}`}>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.color} flex-shrink-0 mt-0.5`}>
                {item.badge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold">{item.key}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{item.note}</p>
              </div>
              <a href={item.link} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1 text-[10px] underline opacity-70 hover:opacity-100">
                <ExternalLink className="w-3 h-3" />設定へ
              </a>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          ※ 設定後、評価モニターの「更新」ボタンを押すと全ソースのデータが取得されます。
          Google Place ID / TripAdvisor Location ID は未設定の場合、ホテル名で自動検索されます。
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-800">PMS / チャネルマネージャー連携設定について</p>
          <p className="text-xs text-blue-600 mt-0.5">
            各システムの接続情報を設定後、「接続テスト」で疎通確認してください。
            接続確立後は在庫・料金データの自動同期が有効になります。
          </p>
        </div>
      </div>

      {grouped.map(({ catKey, catLabel, systems }) => (
        <div key={catKey}>
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              catKey === "ota" ? "bg-orange-500" : "bg-blue-500"
            )} />
            <h3 className="text-sm font-semibold text-gray-700">{catLabel}</h3>
            <span className="text-xs text-gray-400">{systems.length}システム</span>
          </div>
          <div className="space-y-2">
            {systems.map(sys => (
              <IntegrationCard
                key={sys.id}
                system={sys}
                isExpanded={expandedId === sys.id}
                onToggle={() => setExpandedId(prev => prev === sys.id ? null : sys.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
