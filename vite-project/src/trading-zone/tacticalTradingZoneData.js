/**
 * 실전 매매 존 V2 — 1종목 1상태, 단계 이동 히스토리 확장 가능
 */

import { mergePersistIntoPositions } from "./tradingZoneStagePersist.js"

/** @typedef {'us' | 'kr'} TradingMarketId */
/** @typedef {'interest' | 'pullback' | 'trend' | 'takeProfit' | 'risk'} TradingStageId */
/** @typedef {'interest' | 'pullback' | 'trend' | 'takeProfit'} TradingBucketId */

/**
 * @typedef {{
 *   stage: TradingStageId
 *   at?: string
 *   note?: string
 *   price?: string | number
 *   score?: string | number
 * }} TradingStageHistoryEntry
 */

/** @type {Record<TradingStageId, string>} */
export const TRADING_STAGE_TIMELINE_COLOR = {
  interest: "#22c55e",
  pullback: "#facc15",
  trend: "#3b82f6",
  takeProfit: "#f97316",
  risk: "#ef4444",
}

/**
 * @typedef {{
 *   id: string
 *   symbol: string
 *   market: TradingMarketId
 *   stage: TradingStageId
 *   entry?: string
 *   stop?: string
 *   target?: string
 *   stopNum?: number | null
 *   targetNum?: number | null
 *   currentPrice?: number | null
 *   aux?: string[]
 *   stageHistory?: TradingStageHistoryEntry[]
 *   rr?: string
 *   expectedReturn?: string
 *   partialTakeProfit?: string
 *   holdingDays?: number
 *   weight?: string
 * }} TradingZonePosition
 */

/** @type {Record<TradingStageId, { label: string; emoji: string }>} */
export const TRADING_STAGE_META = {
  interest: { label: "관심", emoji: "🟢" },
  pullback: { label: "눌림", emoji: "🟡" },
  trend: { label: "추세", emoji: "🔵" },
  takeProfit: { label: "익절", emoji: "🟠" },
  risk: { label: "위험", emoji: "🔴" },
}

/** @type {TradingStageId[]} */
export const TRADING_STAGE_FLOW = ["interest", "pullback", "trend", "takeProfit"]

/** @type {Record<TradingBucketId, { title: string }>} */
export const TRADING_BUCKET_META = {
  interest: { title: "관심종목", hint: "신뢰도 60~79 · 눌림·관망" },
  pullback: { title: "눌림목" },
  trend: { title: "추세종목", hint: "신뢰도 80+ · 추세 유지" },
  takeProfit: { title: "익절관리" },
}

/** @type {TradingBucketId[]} */
export const TRADING_BUCKET_ORDER = ["interest", "pullback", "trend", "takeProfit"]

/** 상세 패널 보조지표 — 실전 핵심세트 (추가 지표 보류: 볼린저, ADX, OBV, Stoch RSI) */
export const TRADING_ZONE_STANDARD_AUX = ["10MA", "20MA", "RSI", "MACD", "거래량"]

/** 기본 ON — 추세 우선 (10MA 눌림 · 20MA 추세) */
export const TRADING_ZONE_DEFAULT_ACTIVE_AUX = ["10MA", "20MA"]

/** 익절관리 버킷 빈 상태 기본 문구 */
export const TRADING_ZONE_TAKE_PROFIT_EMPTY = {
  status: "대기중",
  partial: "부분익절 없음",
}

/** 실전 필드 미입력 시 표시 */
export const TRADING_ZONE_FIELD_PENDING = "계산대기"

/** @type {Record<TradingMarketId, { id: TradingMarketId; label: string; flag: string }>} */
export const TRADING_MARKETS = {
  us: { id: "us", label: "미국", flag: "🇺🇸" },
  kr: { id: "kr", label: "한국", flag: "🇰🇷" },
}

/** 시장 탭 진입 시 자동 선택·상세 오픈 대표 종목 */
export const TRADING_ZONE_DEFAULT_POSITION_ID = {
  us: "us-smh",
  kr: "kr-silicon",
}

/**
 * @param {TradingMarketId} market
 * @param {TradingZonePosition[]} positions
 * @returns {string | null}
 */
export function resolveDefaultTradingPositionId(market, positions) {
  const preferred = TRADING_ZONE_DEFAULT_POSITION_ID[market]
  if (preferred && positions.some((p) => p.id === preferred)) return preferred
  return positions[0]?.id ?? null
}

/** @type {TradingZonePosition[]} */
const SEED_POSITIONS = [
  {
    id: "us-nvda",
    symbol: "NVDA",
    market: "us",
    stage: "trend",
    entry: "126 ~ 132",
    stop: "120",
    target: "145",
    stopNum: 120,
    targetNum: 145,
    currentPrice: 138,
    aux: ["10MA", "20MA"],
    stageHistory: [
      { stage: "interest", at: "2026-05-18", price: 128, score: 62 },
      { stage: "pullback", at: "2026-05-20", price: 131, score: 68 },
      { stage: "trend", at: "2026-05-22", price: 138, score: 74 },
    ],
  },
  {
    id: "us-pltr",
    symbol: "PLTR",
    market: "us",
    stage: "interest",
    entry: "24 ~ 26",
    stop: "22",
    target: "30",
    stopNum: 22,
    targetNum: 30,
    currentPrice: 156,
    aux: ["10MA", "20MA"],
    stageHistory: [{ stage: "interest", at: "2026-05-22", price: 133, score: 58 }],
  },
  {
    id: "us-meta",
    symbol: "META",
    market: "us",
    stage: "interest",
    entry: "480 ~ 495",
    stop: "465",
    target: "520",
    aux: ["10MA", "20MA"],
    stageHistory: [{ stage: "interest", at: "2026-05-21" }],
  },
  {
    id: "us-tsla",
    symbol: "TSLA",
    market: "us",
    stage: "interest",
    entry: "248 ~ 258",
    stop: "238",
    target: "275",
    aux: ["10MA", "20MA"],
    stageHistory: [{ stage: "interest", at: "2026-05-20" }],
  },
  {
    id: "us-smh",
    symbol: "SMH",
    market: "us",
    stage: "pullback",
    entry: "218 ~ 224",
    stop: "210",
    target: "238",
    stopNum: 210,
    targetNum: 238,
    currentPrice: 221,
    aux: ["10MA", "20MA"],
    stageHistory: [
      { stage: "interest", at: "2026-05-18", price: 215, score: 58 },
      { stage: "pullback", at: "2026-05-20", price: 219, score: 64 },
      { stage: "interest", at: "2026-05-22", price: 221, score: 61 },
    ],
  },
  {
    id: "us-avgo",
    symbol: "AVGO",
    market: "us",
    stage: "pullback",
    entry: "168 ~ 174",
    stop: "162",
    target: "188",
    aux: ["10MA", "20MA"],
    stageHistory: [{ stage: "pullback", at: "2026-05-21" }],
  },
  {
    id: "kr-silicon",
    symbol: "실리콘투",
    market: "kr",
    stage: "trend",
    entry: "42,000 ~ 44,000",
    stop: "40,500",
    target: "48,000",
    stopNum: 40500,
    targetNum: 48000,
    currentPrice: 43500,
    aux: ["10MA", "20MA"],
    stageHistory: [
      { stage: "interest", at: "2026-05-15" },
      { stage: "pullback", at: "2026-05-19" },
      { stage: "trend", at: "2026-05-22" },
    ],
  },
  {
    id: "kr-hyosung",
    symbol: "효성중공업",
    market: "kr",
    stage: "takeProfit",
    entry: "—",
    stop: "—",
    target: "분할 익절",
    aux: ["10MA", "20MA"],
    stageHistory: [
      { stage: "interest", at: "2026-05-01" },
      { stage: "trend", at: "2026-05-12" },
      { stage: "takeProfit", at: "2026-05-22" },
    ],
  },
  {
    id: "kr-ls",
    symbol: "LS ELECTRIC",
    market: "kr",
    stage: "takeProfit",
    entry: "—",
    stop: "—",
    target: "목표가 도달",
    aux: ["10MA", "20MA"],
    stageHistory: [
      { stage: "pullback", at: "2026-05-10" },
      { stage: "trend", at: "2026-05-18" },
      { stage: "takeProfit", at: "2026-05-23" },
    ],
  },
  {
    id: "kr-spg",
    symbol: "에스피지",
    market: "kr",
    stage: "interest",
    entry: "12,500 ~ 13,200",
    stop: "11,800",
    target: "14,500",
    aux: ["10MA", "20MA"],
    stageHistory: [{ stage: "interest", at: "2026-05-22" }],
  },
]

/**
 * 현재 단계 → 표시 버킷 (1종목 1버킷)
 * @param {TradingStageId} stage
 * @returns {TradingBucketId | null}
 */
export function stageToDisplayBucket(stage) {
  if (stage === "interest" || stage === "pullback" || stage === "trend" || stage === "takeProfit") {
    return stage
  }
  return null
}

/** @returns {TradingZonePosition[]} */
export function getTradingZonePositions() {
  return mergePersistIntoPositions(SEED_POSITIONS)
}

/**
 * @param {TradingMarketId} market
 * @param {TradingZonePosition[]} [positions]
 */
export function positionsByMarket(market, positions = SEED_POSITIONS) {
  return positions.filter((p) => p.market === market)
}

/**
 * @param {TradingMarketId} market
 * @param {TradingBucketId} bucket
 * @param {TradingZonePosition[]} [positions]
 */
export function positionsInBucket(market, bucket, positions = SEED_POSITIONS) {
  return positions.filter((p) => p.market === market && stageToDisplayBucket(p.stage) === bucket)
}

/**
 * @param {TradingMarketId} market
 * @param {TradingZonePosition[]} [positions]
 * @returns {Record<TradingBucketId, TradingZonePosition[]>}
 */
export function groupPositionsByBucket(market, positions = SEED_POSITIONS) {
  /** @type {Record<TradingBucketId, TradingZonePosition[]>} */
  const groups = { interest: [], pullback: [], trend: [], takeProfit: [] }
  for (const p of positions) {
    if (p.market !== market) continue
    const bucket = stageToDisplayBucket(p.stage)
    if (bucket) groups[bucket].push(p)
  }
  return groups
}

/** @param {TradingZonePosition} position */
export function tradingStageBadge(position) {
  return TRADING_STAGE_META[position.stage] ?? TRADING_STAGE_META.interest
}

/** @deprecated */
export function getTradingZoneStocks() {
  return getTradingZonePositions()
}

/** @deprecated */
export function stocksInBucket(market, bucket, stocks) {
  return positionsInBucket(market, bucket, stocks)
}
