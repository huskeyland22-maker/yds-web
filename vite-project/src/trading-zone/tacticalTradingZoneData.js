/**
 * 실전 매매 존 — 초기 시드 (로컬 UI, 추후 API 연동)
 */

/** @typedef {'us' | 'kr'} TradingMarketId */
/** @typedef {'interest' | 'pullback' | 'trend' | 'takeProfit' | 'risk'} TradingStageId */
/** @typedef {'interest' | 'pullback' | 'trend' | 'takeProfit'} TradingBucketId */

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   market: TradingMarketId
 *   bucket: TradingBucketId
 *   stage: TradingStageId
 *   entry?: string
 *   stop?: string
 *   target?: string
 *   aux?: string[]
 * }} TradingZoneStock
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

/** @type {TradingZoneStock[]} */
const SEED_STOCKS = [
  {
    id: "us-nvda-interest",
    name: "NVDA",
    market: "us",
    bucket: "interest",
    stage: "interest",
    entry: "118 ~ 124",
    stop: "112",
    target: "138",
    aux: ["10MA", "20MA", "거래량", "RSI"],
  },
  {
    id: "us-pltr-interest",
    name: "PLTR",
    market: "us",
    bucket: "interest",
    stage: "interest",
    entry: "24 ~ 26",
    stop: "22",
    target: "30",
    aux: ["10MA", "20MA", "거래량"],
  },
  {
    id: "us-meta-interest",
    name: "META",
    market: "us",
    bucket: "interest",
    stage: "interest",
    entry: "480 ~ 495",
    stop: "465",
    target: "520",
    aux: ["10MA", "RSI"],
  },
  {
    id: "us-tsla-interest",
    name: "TSLA",
    market: "us",
    bucket: "interest",
    stage: "interest",
    entry: "248 ~ 258",
    stop: "238",
    target: "275",
    aux: ["10MA", "20MA", "거래량"],
  },
  {
    id: "us-soxl-pullback",
    name: "SOXL",
    market: "us",
    bucket: "pullback",
    stage: "pullback",
    entry: "28 ~ 30",
    stop: "26",
    target: "34",
    aux: ["20MA", "거래량", "RSI"],
  },
  {
    id: "us-smh-pullback",
    name: "SMH",
    market: "us",
    bucket: "pullback",
    stage: "pullback",
    entry: "218 ~ 224",
    stop: "210",
    target: "238",
    aux: ["10MA", "20MA", "거래량"],
  },
  {
    id: "us-avgo-pullback",
    name: "AVGO",
    market: "us",
    bucket: "pullback",
    stage: "pullback",
    entry: "168 ~ 174",
    stop: "162",
    target: "188",
    aux: ["10MA", "RSI"],
  },
  {
    id: "us-nvda-trend",
    name: "NVDA",
    market: "us",
    bucket: "trend",
    stage: "trend",
    entry: "126 ~ 132",
    stop: "120",
    target: "145",
    aux: ["10MA", "20MA", "거래량", "RSI"],
  },
  {
    id: "us-meta-trend",
    name: "META",
    market: "us",
    bucket: "trend",
    stage: "trend",
    entry: "500 ~ 512",
    stop: "488",
    target: "540",
    aux: ["20MA", "거래량"],
  },
  {
    id: "kr-silicon-trend",
    name: "실리콘투",
    market: "kr",
    bucket: "trend",
    stage: "trend",
    entry: "42,000 ~ 44,000",
    stop: "40,500",
    target: "48,000",
    aux: ["10MA", "20MA", "거래량"],
  },
  {
    id: "kr-hyosung-tp",
    name: "효성중공업",
    market: "kr",
    bucket: "takeProfit",
    stage: "takeProfit",
    entry: "—",
    stop: "—",
    target: "분할 익절",
    aux: ["10MA", "거래량"],
  },
  {
    id: "kr-ls-tp",
    name: "LS ELECTRIC",
    market: "kr",
    bucket: "takeProfit",
    stage: "takeProfit",
    entry: "—",
    stop: "—",
    target: "목표가 도달",
    aux: ["20MA", "RSI"],
  },
  {
    id: "kr-silicon-interest",
    name: "실리콘투",
    market: "kr",
    bucket: "interest",
    stage: "interest",
    entry: "38,000 ~ 40,000",
    stop: "36,500",
    target: "45,000",
    aux: ["10MA", "20MA", "거래량"],
  },
  {
    id: "kr-spg-interest",
    name: "에스피지",
    market: "kr",
    bucket: "interest",
    stage: "interest",
    entry: "12,500 ~ 13,200",
    stop: "11,800",
    target: "14,500",
    aux: ["10MA", "RSI"],
  },
  {
    id: "kr-ls-pullback",
    name: "LS ELECTRIC",
    market: "kr",
    bucket: "pullback",
    stage: "pullback",
    entry: "168,000 ~ 172,000",
    stop: "162,000",
    target: "185,000",
    aux: ["20MA", "거래량", "RSI"],
  },
]

/** @returns {TradingZoneStock[]} */
export function getTradingZoneStocks() {
  return SEED_STOCKS
}

/**
 * @param {TradingMarketId} market
 * @param {TradingZoneStock[]} [stocks]
 */
export function stocksByMarket(market, stocks = SEED_STOCKS) {
  return stocks.filter((s) => s.market === market)
}

/**
 * @param {TradingMarketId} market
 * @param {TradingBucketId} bucket
 * @param {TradingZoneStock[]} [stocks]
 */
export function stocksInBucket(market, bucket, stocks = SEED_STOCKS) {
  return stocks.filter((s) => s.market === market && s.bucket === bucket)
}

/**
 * @param {TradingZoneStock} stock
 */
export function tradingStageBadge(stock) {
  return TRADING_STAGE_META[stock.stage] ?? TRADING_STAGE_META.interest
}
