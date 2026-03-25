// Review プロダクト — 共有モックデータ
// 本番では backend スクレイピング API から取得する

export type Platform = "google" | "rakuten" | "expedia" | "booking";
export type Language = "ja" | "en" | "zh" | "ko" | "de";

export interface Review {
  id: number;
  platform: Platform;
  author: string;
  rating: number;
  text: string;
  date: string;
  language: Language;
  responded: boolean;
  response?: string;
}

export const MOCK_REVIEWS: Review[] = [
  {
    id: 1, platform: "google", author: "田中　恵", rating: 5,
    text: "スタッフの皆さんがとても親切で、チェックインからチェックアウトまで快適に過ごせました。部屋も清潔で、眺めが素晴らしかったです。また訪れたいと思います。",
    date: "2026-03-22", language: "ja", responded: false,
  },
  {
    id: 2, platform: "rakuten", author: "山本　隆", rating: 4,
    text: "立地が最高で、交通アクセスが便利でした。朝食のビュッフェが充実していて満足しています。ただ、部屋がやや狭く感じました。",
    date: "2026-03-20", language: "ja", responded: true,
    response: "山本様、ご宿泊いただきありがとうございます。お部屋の広さについてのご意見、真摯に受け止めます。またのご来館を心よりお待ちしております。",
  },
  {
    id: 3, platform: "expedia", author: "John Miller", rating: 4,
    text: "Excellent location near the train station. Staff was very friendly and helpful. The room was a bit small but clean and well-maintained. Breakfast had great variety.",
    date: "2026-03-19", language: "en", responded: false,
  },
  {
    id: 4, platform: "google", author: "李 明", rating: 3,
    text: "位置很好，靠近地铁站，交通方便。但是房间比较小，隔音效果不太好。早餐选择不多。服务人员态度友善。",
    date: "2026-03-17", language: "zh", responded: false,
  },
  {
    id: 5, platform: "rakuten", author: "佐藤　美幸", rating: 5,
    text: "記念日に利用させていただきました。スタッフの方がサプライズを用意してくださり、感動しました！部屋も広く、アメニティも充実していました。",
    date: "2026-03-15", language: "ja", responded: true,
    response: "佐藤様、記念日のご宿泊に選んでいただき、誠にありがとうございました。またのご来館をお待ちしております。",
  },
  {
    id: 6, platform: "booking", author: "김민준", rating: 4,
    text: "위치가 매우 좋고 직원들이 친절했습니다. 객실은 깨끗하고 편안했습니다. 아침 식사 메뉴가 더 다양하면 좋겠습니다.",
    date: "2026-03-14", language: "ko", responded: false,
  },
  {
    id: 7, platform: "google", author: "鈴木　一郎", rating: 2,
    text: "チェックイン時の待ち時間が長く、案内も不十分でした。部屋の清掃が行き届いておらず、浴室に汚れが残っていました。改善を望みます。",
    date: "2026-03-12", language: "ja", responded: true,
    response: "鈴木様、ご不便をおかけして誠に申し訳ございません。いただいたご指摘を真摯に受け止め、清掃体制の強化に努めてまいります。",
  },
  {
    id: 8, platform: "expedia", author: "Sarah Chen", rating: 5,
    text: "Absolutely wonderful stay! The concierge helped us plan our entire Tokyo itinerary. Room had a stunning view of the city. Will definitely be back on our next Japan trip.",
    date: "2026-03-10", language: "en", responded: false,
  },
  {
    id: 9, platform: "rakuten", author: "中村　健太", rating: 4,
    text: "ビジネス出張で利用。Wi-Fiが安定していて、デスクスペースも十分ありました。朝食付きプランが便利でした。次回もリピートします。",
    date: "2026-03-08", language: "ja", responded: false,
  },
  {
    id: 10, platform: "google", author: "王 建国", rating: 3,
    text: "酒店位置不错，附近有很多餐厅和购物中心。房间设施老旧，需要更新。工作人员虽然友好，但英语沟通有些困难。",
    date: "2026-03-06", language: "zh", responded: false,
  },
  {
    id: 11, platform: "booking", author: "Thomas Weber", rating: 4,
    text: "Gutes Hotel in zentraler Lage. Das Personal war freundlich und hilfsbereit. Das Frühstücksbuffet war reichhaltig. Das Zimmer war sauber, aber etwas klein.",
    date: "2026-03-05", language: "de", responded: false,
  },
  {
    id: 12, platform: "rakuten", author: "高橋　由美", rating: 5,
    text: "家族旅行で利用しました。子どもへのサービスが充実していて、子連れでも快適に過ごせました。大浴場も良かったです。",
    date: "2026-03-03", language: "ja", responded: false,
  },
  {
    id: 13, platform: "expedia", author: "Maria Garcia", rating: 3,
    text: "The hotel is in a good location but the rooms need renovation. The staff was helpful. The breakfast was disappointing with limited options. Price is a bit high for what you get.",
    date: "2026-03-01", language: "en", responded: false,
  },
  {
    id: 14, platform: "google", author: "伊藤　朋子", rating: 5,
    text: "温泉とサウナが最高でした。夕食のコース料理も美味しく、全体的に大満足です。スタッフの気配りが随所に感じられ、また来たいと思いました。",
    date: "2026-02-28", language: "ja", responded: false,
  },
  {
    id: 15, platform: "booking", author: "陈小燕", rating: 4,
    text: "酒店整体感觉不错，地理位置优越。前台服务很周到，能说简单中文。房间干净整洁，设施齐全。早餐种类丰富，性价比高。",
    date: "2026-02-25", language: "zh", responded: false,
  },
];

export const MONTHLY_TREND = [
  { month: "4月", google: 4.0, rakuten: 3.9, expedia: 4.1 },
  { month: "5月", google: 4.1, rakuten: 4.0, expedia: 4.0 },
  { month: "6月", google: 4.2, rakuten: 4.1, expedia: 4.2 },
  { month: "7月", google: 4.0, rakuten: 3.8, expedia: 4.0 },
  { month: "8月", google: 3.9, rakuten: 3.7, expedia: 3.8 },
  { month: "9月", google: 4.1, rakuten: 4.0, expedia: 4.1 },
  { month: "10月", google: 4.3, rakuten: 4.2, expedia: 4.3 },
  { month: "11月", google: 4.2, rakuten: 4.1, expedia: 4.2 },
  { month: "12月", google: 4.4, rakuten: 4.3, expedia: 4.5 },
  { month: "1月", google: 4.3, rakuten: 4.2, expedia: 4.3 },
  { month: "2月", google: 4.2, rakuten: 4.1, expedia: 4.3 },
  { month: "3月", google: 4.3, rakuten: 4.1, expedia: 4.2 },
];

export const SENTIMENT_DATA = [
  { name: "ポジティブ", value: 68, color: "#22C55E" },
  { name: "ニュートラル", value: 22, color: "#94A3B8" },
  { name: "ネガティブ", value: 10, color: "#EF4444" },
];

export const PLATFORM_SCORES = [
  { platform: "google" as Platform,  label: "Google",       score: 4.3, count: 87,  delta: +0.2, color: "#4285F4" },
  { platform: "rakuten" as Platform, label: "楽天トラベル",  score: 4.1, count: 118, delta: -0.1, color: "#BF0000" },
  { platform: "expedia" as Platform, label: "Expedia",       score: 4.2, count: 48,  delta: +0.3, color: "#FFBA00" },
  { platform: "booking" as Platform, label: "Booking.com",   score: 4.0, count: 15,  delta: 0,    color: "#003580" },
];

export const CATEGORY_RATINGS = [
  { category: "スタッフ対応", score: 4.5 },
  { category: "清潔さ",       score: 4.3 },
  { category: "立地",         score: 4.7 },
  { category: "コスパ",       score: 3.9 },
  { category: "設備",         score: 4.0 },
  { category: "食事",         score: 4.2 },
];

export const KEYWORDS = [
  { word: "スタッフ",  count: 42, sentiment: "positive" },
  { word: "清潔",     count: 38, sentiment: "positive" },
  { word: "立地",     count: 35, sentiment: "positive" },
  { word: "朝食",     count: 29, sentiment: "neutral"  },
  { word: "部屋",     count: 27, sentiment: "neutral"  },
  { word: "アクセス", count: 24, sentiment: "positive" },
  { word: "快適",     count: 21, sentiment: "positive" },
  { word: "friendly", count: 18, sentiment: "positive" },
  { word: "clean",    count: 16, sentiment: "positive" },
  { word: "location", count: 14, sentiment: "positive" },
  { word: "設備",     count: 12, sentiment: "neutral"  },
  { word: "狭い",     count: 11, sentiment: "negative" },
  { word: "待ち時間", count: 8,  sentiment: "negative" },
  { word: "価格",     count: 15, sentiment: "neutral"  },
  { word: "眺め",     count: 13, sentiment: "positive" },
];

export const LANGUAGE_DIST = [
  { lang: "日本語",  code: "ja", count: 157, pct: 58 },
  { lang: "English", code: "en", count: 65,  pct: 24 },
  { lang: "中文",    code: "zh", count: 28,  pct: 10 },
  { lang: "한국어",  code: "ko", count: 14,  pct: 5  },
  { lang: "その他",  code: "other", count: 4, pct: 3  },
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  google:   "Google",
  rakuten:  "楽天トラベル",
  expedia:  "Expedia",
  booking:  "Booking.com",
};

export const LANG_LABELS: Record<string, string> = {
  ja: "日本語", en: "English", zh: "中文", ko: "한국어", de: "Deutsch",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  google:  "bg-blue-100 text-blue-700",
  rakuten: "bg-red-100 text-red-700",
  expedia: "bg-yellow-100 text-yellow-800",
  booking: "bg-sky-100 text-sky-700",
};

export const LANG_COLORS: Record<string, string> = {
  ja: "bg-slate-100 text-slate-600",
  en: "bg-sky-100 text-sky-700",
  zh: "bg-red-50 text-red-600",
  ko: "bg-fuchsia-50 text-fuchsia-700",
  de: "bg-green-100 text-green-700",
};
