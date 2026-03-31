// Per-product モジュールからの一括エクスポート
// 既存の import { fetchProperties } from "@/lib/api" を壊さないための barrel

export {
  apiFetch,
  BFF_BASE,
  login,
  logout,
  fetchCurrentUser,
} from "./client";
export type {
  ProductCode,
  ProductRole,
  SalesRole,
  AnyProductRole,
  LoginResponse,
  UserOut,
} from "./client";

export {
  fetchProperties,
  fetchProperty,
  fetchRoomTypes,
  fetchBarLadder,
  updateBarLadderEntry,
  bulkUpdateBarLadder,
  syncGridFromBarLadder,
  updatePropertySettings,
  updatePropertySettingsFull,
} from "./properties";
export type {
  PropertyOut,
  RoomTypeOut,
  BarLadderOut,
} from "./properties";

export {
  updateApprovalSettings,
  fetchApprovalSettings,
  fetchPricingGrid,
  updatePricingCell,
  fetchRecommendations,
  generateRecommendations,
  actOnRecommendation,
  getPricingExportUrl,
  fetchPricingAiSummary,
} from "./pricing";
export type {
  ApprovalSettingOut,
  PricingCellOut,
  RecommendationOut,
  PricingAiSummaryOut,
} from "./pricing";

export {
  fetchCompSet,
  createCompHotel,
  updateCompHotel,
  deleteCompHotel,
  triggerPipeline,
  fetchCompetitorPrices,
  fetchCompetitorAverages,
  fetchCompetitorRatings,
  refreshCompetitorRatings,
} from "./competitor";
export type {
  CompSetOut,
  CompetitorAvgOut,
  CompetitorPriceOut,
  RatingCategoryOut,
  CompetitorRatingOut,
} from "./competitor";

export {
  fetchDailySummary,
  fetchDailyPerformances,
  fetchBookingCurve,
  fetchMonthlyOnhand,
  fetchBookingHeatmap,
  fetchMarketEvents,
  fetchOverview,
} from "./analytics";
export type {
  DailyPerfOut,
  DailySummaryOut,
  CurvePointOut,
  BookingCurveOut,
  MonthlyOnhandOut,
  BookingHeatmapOut,
  MarketEventOut,
  OverviewAlertOut,
  WeeklyTrendPointOut,
  OverviewOut,
} from "./analytics";

export {
  fetchCosts,
  createCost,
  updateCost,
  deleteCost,
  fetchBudget,
  upsertBudget,
  fetchCostSummary,
} from "./cost-budget";
export type {
  CostSettingOut,
  BudgetTargetOut,
  CostSummaryOut,
} from "./cost-budget";

export {
  fetchReviews,
  respondToReview,
  fetchInquiries,
  respondToInquiry,
  updateInquiryStatus,
  generateAiReply,
} from "./review";
export type {
  ReviewOut,
  ReviewListOut,
  InquiryOut,
  InquiryListOut,
  AiReplyRequest,
  AiReplyResponse,
} from "./review";

export {
  fetchGuestStays,
  updateGuestStayStatus,
} from "./front";
export type {
  GuestStayOut,
  GuestStayListOut,
} from "./front";

export {
  fetchReservations,
  updateReservationStatus,
} from "./reservation";
export type {
  ReservationOut,
  ReservationListOut,
} from "./reservation";

export {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  setUserProductRoles,
} from "./users";
export type {
  UserManageOut,
} from "./users";

export {
  sendMail,
} from "./mail";
export type {
  SendMailRequest,
  SendMailResponse,
} from "./mail";
