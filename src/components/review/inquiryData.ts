export type InquiryChannel = "email" | "form" | "phone";
export type InquiryStatus  = "new" | "in_progress" | "resolved" | "closed";
export type InquiryPriority = "high" | "medium" | "low";

export interface Inquiry {
  id: number;
  channel: InquiryChannel;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  subject: string;
  content: string;
  date: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  assignee?: string;
  language: "ja" | "en" | "zh" | "ko";
  response?: string;
  tags?: string[];
}

export const MOCK_INQUIRIES: Inquiry[] = [
  {
    id: 1,
    channel: "email",
    customerName: "田中　浩二",
    customerEmail: "koji.tanaka@example.com",
    subject: "チェックイン時間の変更について",
    content: "お世話になっております。3月28日に2名で予約をしております田中と申します。\n\n通常のチェックイン時間は15時とのことですが、当日の会議が長引く可能性があり、18時頃にチェックインになってしまう可能性があります。\n\n遅れた場合でも問題なくチェックインできますでしょうか？また、追加料金が発生する場合は教えていただけますか？",
    date: "2026-03-24",
    status: "new",
    priority: "medium",
    language: "ja",
    tags: ["チェックイン", "時間変更"],
  },
  {
    id: 2,
    channel: "form",
    customerName: "山田　花子",
    customerEmail: "hanako.yamada@example.jp",
    subject: "記念日プランについてのご相談",
    content: "来月の結婚記念日に夫婦で宿泊を予定しています。特別なアレンジ（ケーキの手配、フラワーデコレーション等）をお願いすることはできますか？\n\nご予算は1万円程度で考えていますが、どのようなオプションがありますか？詳細をお知らせいただけると幸いです。",
    date: "2026-03-23",
    status: "in_progress",
    priority: "high",
    assignee: "佐藤（フロント）",
    language: "ja",
    tags: ["記念日", "特別アレンジ"],
  },
  {
    id: 3,
    channel: "email",
    customerName: "James Wilson",
    customerEmail: "j.wilson@company.com",
    subject: "Corporate account inquiry",
    content: "Hello,\n\nI am the travel manager for Wilson & Associates (50 employees). We are looking for a preferred hotel partner for our frequent business trips to Tokyo.\n\nCould you please provide information about your corporate rates and any loyalty benefits for business accounts?\n\nWe typically need 5-10 room nights per month. Please let me know your available packages.",
    date: "2026-03-23",
    status: "new",
    priority: "high",
    language: "en",
    tags: ["法人", "コーポレート"],
  },
  {
    id: 4,
    channel: "phone",
    customerName: "鈴木　一郎",
    customerPhone: "090-1234-5678",
    subject: "【電話記録】アレルギー対応の確認",
    content: "【受電時刻】2026/03/22 14:30\n【対応者】中村\n\nお客様より電話にて問い合わせ。小麦・乳製品のアレルギーがあり、朝食ビュッフェで対応可能なメニューがあるか確認したいとのこと。\n\n現在確認中。調理担当に問い合わせ後、折り返し電話予定。",
    date: "2026-03-22",
    status: "in_progress",
    priority: "high",
    assignee: "中村（レストラン）",
    language: "ja",
    tags: ["アレルギー", "食事"],
  },
  {
    id: 5,
    channel: "form",
    customerName: "李　美玲",
    customerEmail: "li.meiling@gmail.com",
    subject: "房间设施咨询",
    content: "您好，\n\n我计划下个月来东京旅游，想预订贵酒店的客房。请问高层客房是否可以看到东京塔？另外，客房内是否提供浴缸？\n\n如果可以的话，希望预订一间带浴缸且视野较好的房间。请告知相关信息，谢谢。",
    date: "2026-03-21",
    status: "new",
    priority: "medium",
    language: "zh",
    tags: ["客室", "眺望"],
  },
  {
    id: 6,
    channel: "email",
    customerName: "伊藤　健",
    customerEmail: "ken.ito@business.co.jp",
    subject: "団体予約（30名）についての見積もり依頼",
    content: "お世話になっております。来月、弊社の新入社員研修で御ホテルの利用を検討しております。\n\n人数：30名\n宿泊日：4月10日〜11日（1泊）\n食事：夕食・朝食付き\n会議室：半日利用\n\n上記条件での見積もりをお送りいただけますか？なお、予算は1名あたり15,000円程度を想定しております。",
    date: "2026-03-20",
    status: "resolved",
    priority: "high",
    assignee: "営業担当",
    language: "ja",
    response: "伊藤様、お問い合わせありがとうございます。ご要望の条件で見積書を作成いたしました。別途メールにてお送りしておりますのでご確認ください。",
    tags: ["団体", "見積もり", "法人"],
  },
  {
    id: 7,
    channel: "phone",
    customerName: "高橋　由美",
    customerPhone: "03-5555-1234",
    subject: "【電話記録】予約キャンセルポリシーの確認",
    content: "【受電時刻】2026/03/19 11:15\n【対応者】田中\n\n4月5日の予約に関してキャンセルポリシーを確認したいとの問い合わせ。14日前キャンセル無料、7日前から50%、前日から100%の旨を案内済み。\n\nお客様は納得された様子。対応完了。",
    date: "2026-03-19",
    status: "closed",
    priority: "low",
    language: "ja",
    tags: ["キャンセル"],
  },
  {
    id: 8,
    channel: "email",
    customerName: "Yuki Nakamura",
    customerEmail: "yuki.n@overseas.com",
    subject: "Request for invoice reissue",
    content: "Dear Hotel Team,\n\nI stayed at your hotel last month (reservation #TK-20260215-003) and I need to request a reissue of the invoice for my company's expense report.\n\nThe original invoice did not include the company name. Could you please reissue it with the following details?\n\nCompany: Pacific Trading Co., Ltd.\n\nThank you for your assistance.",
    date: "2026-03-18",
    status: "resolved",
    priority: "medium",
    assignee: "経理担当",
    language: "en",
    response: "Dear Ms. Nakamura, Thank you for your request. We have reissued the invoice with your company details and sent it to your email address.",
    tags: ["請求書", "領収書"],
  },
  {
    id: 9,
    channel: "form",
    customerName: "渡辺　誠",
    customerEmail: "makoto.watanabe@home.ne.jp",
    subject: "駐車場の予約について",
    content: "4月15日〜16日で予約を入れている渡辺と申します。\n\n車で伺う予定なのですが、ホテルの駐車場は予約が必要でしょうか？また、料金はいくらになりますか？満車の場合は近隣に駐車場はありますか？",
    date: "2026-03-17",
    status: "closed",
    priority: "low",
    language: "ja",
    response: "渡辺様、お問い合わせありがとうございます。駐車場は1泊あたり2,000円（税込）にて利用可能です。台数に限りがございますので、事前予約をお勧めいたします。",
    tags: ["駐車場"],
  },
];

export const STATUS_CONFIG: Record<InquiryStatus, { label: string; color: string; dot: string }> = {
  new:         { label: "新規",   color: "bg-red-100 text-red-700 border-red-200",    dot: "bg-red-500" },
  in_progress: { label: "対応中", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  resolved:    { label: "解決済", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  closed:      { label: "クローズ", color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

export const PRIORITY_CONFIG: Record<InquiryPriority, { label: string; color: string }> = {
  high:   { label: "高",  color: "bg-red-50 text-red-600" },
  medium: { label: "中",  color: "bg-amber-50 text-amber-600" },
  low:    { label: "低",  color: "bg-slate-50 text-slate-500" },
};

export const CHANNEL_CONFIG: Record<InquiryChannel, { label: string; icon: string }> = {
  email: { label: "メール", icon: "email" },
  form:  { label: "フォーム", icon: "form" },
  phone: { label: "電話", icon: "phone" },
};
