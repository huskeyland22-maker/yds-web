/**
 * 실전 매매 존 V2 — 1종목 1상태, 단계 이동 히스토리 확장 가능
 */

/** @typedef {'us' | 'kr'} TradingMarketId */
/** @typedef {'interest' | 'pullback' | 'trend' | 'takeProfit' | 'risk'} TradingStageId */
/** @typedef {'interest' | 'pullback' | 'trend' | 'takeProfit'} TradingBucketId */

/**
 * @typedef {{
 *   stage: TradingStageId
 *   at?: string
 *   note?: string
 * }} TradingStageHistoryEntry
 */

/**
 * @typedef {{
 *   id: string
 *   symbol: string
 *   market: TradingMarketId
 *   stage: TradingStageId
 *   entry?: string
 *   stop?: string
 *   target?: string
 *   aux?: string[]
 *   stageHistory?: TradingStageHistoryEntry[]
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
  interest: { title: "관심종목" },
  pullback: { title: "눌림목" },
  trend: { title: "추세" },
  takeProfit: { title: "익절관리" },
}

/** @type {TradingBucketId[]} */
export const TRADING_BUCKET_ORDER = ["interest", "pullback", "trend", "takeProfit"]

/** @type {Record<TradingMarketId, { id: TradingMarketId; label: string; flag: string }>} */
export const TRADING_MARKETS = {
  us: { id: "us", label: "미국", flag: "🇺🇸" },
  kr: { id: "kr", label: "한국", flag: "🇰🇷" },
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
    aux: ["10MA", "20MA", "거래량", "RSI"],
    stageHistory: [
      { stage: "interest", at: "2026-05-18" },
      { stage: "pullback", at: "2026-05-20" },
      { stage: "trend", at: "2026-05-22" },
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
    aux: ["10MA", "20MA", "거래량"],
    stageHistory: [{ stage: "interest", at: "2026-05-22" }],
  },
  {
    id: "us-meta",
    symbol: "META",
    market: "us",
    stage: "interest",
    entry: "480 ~ 495",
    stop: "465",
    target: "520",
    aux: ["10MA", "RSI"],
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
    aux: ["10MA", "20MA", "거래량"],
    stageHistory: [{ stage: "interest", at: "2026-05-20" }],
  },
  {
    id: "us-soxl",
    symbol: "SOXL",
    market: "us",
    stage: "pullback",
    entry: "28 ~ 30",
    stop: "26",
    target: "34",
    aux: ["20MA", "거래량", "RSI"],
    stageHistory: [
      { stage: "interest", at: "2026-05-17" },
      { stage: "pullback", at: "2026-05-22" },
    ],
  },
  {
    id: "us-smh",
    symbol: "SMH",
    market: "us",
    stage: "pullback",
    entry: "218 ~ 224",
    stop: "210",
    target: "238",
    aux: ["10MA", "20MA", "거래량"],
    stageHistory: [{ stage: "pullback", at: "2026-05-22" }],
  },
  {
    id: "us-avgo",
    symbol: "AVGO",
    market: "us",
    stage: "pullback",
    entry: "168 ~ 174",
    stop: "162",
    target: "188",
    aux: ["10MA", "RSI"],
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
    aux: ["10MA", "20MA", "거래량"],
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
    aux: ["10MA", "거래량"],
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
    aux: ["20MA", "RSI"],
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
    aux: ["10MA", "RSI"],
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
  return SEED_POSITIONS
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
