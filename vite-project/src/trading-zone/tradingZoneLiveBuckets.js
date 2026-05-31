/**
 * 실전 매매존 — 신뢰도 기반 자동 분류 (레버리지 ETF 제외 · 테마 중복 제거)
 */

import { buildTradingConfidenceBreakdown } from "./tradingZoneConfidenceEngine.js"

/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */
/** @typedef {import("./tacticalTradingZoneData.js").TradingBucketId} TradingBucketId */
/** @typedef {import("./tacticalTradingZoneData.js").TradingMarketId} TradingMarketId */

/** 레버리지 ETF — 실전 추천·관심·추세 분류 제외 */
export const LEVERAGED_ETF_SYMBOLS = new Set([
  "TSLL",
  "SOXL",
  "TQQQ",
  "NVDL",
  "NVDS",
  "SPXL",
  "UPRO",
  "QLD",
  "LABU",
  "FNGU",
  "TNA",
  "UDOW",
])

/** 동일 테마 — 원본 종목 우선 */
/** @type {Record<string, string>} */
export const SYMBOL_THEME_CANONICAL = {
  TSLL: "TSLA",
  NVDL: "NVDA",
  NVDS: "NVDA",
}

/** @type {TradingBucketId[]} */
export const LIVE_DISPLAY_BUCKET_ORDER = ["interest", "trend", "takeProfit"]

/** @type {Record<"interest" | "trend", number>} */
export const LIVE_BUCKET_LIMITS = {
  interest: 2,
  trend: 3,
}

/**
 * @param {string} symbol
 */
export function isLeveragedEtf(symbol) {
  return LEVERAGED_ETF_SYMBOLS.has(String(symbol ?? "").toUpperCase())
}

/**
 * @param {string} symbol
 */
export function getSymbolThemeKey(symbol) {
  const s = String(symbol ?? "").toUpperCase()
  return SYMBOL_THEME_CANONICAL[s] ?? s
}

/**
 * @param {TradingZonePosition} position
 * @param {Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>} evalMap
 * @param {object | null} panicData
 */
export function resolvePositionConfidence(position, evalMap, panicData = null) {
  const ev = evalMap[position.id]
  if (ev?.dataReady && Number.isFinite(ev.confidence)) return ev.confidence
  const breakdown = buildTradingConfidenceBreakdown({
    position,
    panicData,
    activeAux: new Set(position.aux ?? []),
  })
  return breakdown.score
}

/**
 * @param {TradingZonePosition[]} positions
 * @param {TradingMarketId} market
 */
export function filterLiveEligiblePositions(positions, market) {
  return positions.filter(
    (p) => p.market === market && !isLeveragedEtf(p.symbol) && p.stage !== "risk",
  )
}

/**
 * @param {TradingZonePosition} position
 * @param {import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | undefined} ev
 */
function isUptrendMaintained(position, ev) {
  if (position.stage === "trend") return true
  if (ev?.dataReady) {
    if (ev.signalId === "trend") return true
    if (ev.suggestedStage === "trend") return true
    if (ev.strengthHighlights?.some((h) => /추세/.test(h))) return true
  }
  return false
}

/**
 * @param {TradingZonePosition} position
 * @param {import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | undefined} ev
 */
function isWatchPullbackCandidate(position, ev) {
  if (position.stage === "takeProfit") return false
  if (position.stage === "interest" || position.stage === "pullback") return true
  if (ev?.dataReady) {
    return ev.signalId === "watch" || ev.signalId === "pullback"
  }
  return false
}

/**
 * @typedef {{ position: TradingZonePosition; confidence: number; ev?: import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation }} ScoredEntry
 */

/**
 * @param {ScoredEntry[]} entries
 * @returns {ScoredEntry[]}
 */
function dedupeScoredByTheme(entries) {
  /** @type {Map<string, ScoredEntry>} */
  const byTheme = new Map()
  for (const entry of entries) {
    const key = getSymbolThemeKey(entry.position.symbol)
    const prev = byTheme.get(key)
    if (!prev) {
      byTheme.set(key, entry)
      continue
    }
    const entryCanon = entry.position.symbol.toUpperCase() === key
    const prevCanon = prev.position.symbol.toUpperCase() === key
    if (entryCanon && !prevCanon) {
      byTheme.set(key, entry)
      continue
    }
    if (!entryCanon && prevCanon) continue
    if (entry.confidence > prev.confidence) byTheme.set(key, entry)
  }
  return [...byTheme.values()]
}

/**
 * @param {ScoredEntry[]} entries
 */
function sortByConfidenceDesc(entries) {
  return [...entries].sort((a, b) => b.confidence - a.confidence)
}

/**
 * @param {{
 *   positions: TradingZonePosition[]
 *   evalMap?: Record<string, import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>
 *   market?: TradingMarketId
 *   panicData?: object | null
 * }} input
 */
export function buildLiveTradingBuckets({
  positions = [],
  evalMap = {},
  market = "us",
  panicData = null,
}) {
  const eligible = filterLiveEligiblePositions(positions, market)

  /** @type {ScoredEntry[]} */
  const scored = eligible
    .map((position) => {
      const confidence = resolvePositionConfidence(position, evalMap, panicData)
      return {
        position,
        confidence,
        ev: evalMap[position.id],
      }
    })
    .filter((x) => Number.isFinite(x.confidence))

  const takeProfit = eligible.filter((p) => p.stage === "takeProfit")

  const active = sortByConfidenceDesc(
    dedupeScoredByTheme(scored.filter((x) => x.position.stage !== "takeProfit")),
  )

  const todayPickEntry = active[0] ?? null
  const todayPickId = todayPickEntry?.position.id ?? null

  const trendPool = active.filter(
    (x) =>
      x.position.id !== todayPickId &&
      x.confidence >= 80 &&
      isUptrendMaintained(x.position, x.ev),
  )

  const interestPool = active.filter(
    (x) =>
      x.position.id !== todayPickId &&
      x.confidence >= 60 &&
      x.confidence < 80 &&
      isWatchPullbackCandidate(x.position, x.ev),
  )

  const trend = sortByConfidenceDesc(dedupeScoredByTheme(trendPool))
    .slice(0, LIVE_BUCKET_LIMITS.trend)
    .map((x) => x.position)

  const interest = sortByConfidenceDesc(dedupeScoredByTheme(interestPool))
    .slice(0, LIVE_BUCKET_LIMITS.interest)
    .map((x) => x.position)

  return {
    todayPick: todayPickEntry?.position ?? null,
    todayPickConfidence: todayPickEntry?.confidence ?? null,
    buckets: {
      interest,
      trend,
      takeProfit,
    },
  }
}
