/**
 * YDS Phase 2-6 — 종목추천 데이터 모델 (점수 · 행동 · 추천 이유)
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import {
  buildRecommendReasons,
  formatRecommendReasonSummary,
} from "./ydsStockRecommendReasons.js"
import {
  buildMarketFitReasons,
  computeMarketFitScore,
} from "./ydsMarketAdapter.js"
import { getStockSnapshot, toEngineSnapshot, toStockMarketSnapshot } from "./stockPickSnapshotProvider.js"
import { computeStockScores } from "./ydsStockScoreEngine.js"
import {
  actionFromStatus,
  deriveStatusFromSnapshot,
} from "./ydsStockPickStatusEngine.js"
import {
  explainStatusFromSnapshot,
  logStockPickStatusVerification,
} from "./ydsStockPickStatusDiag.js"
import {
  accumulateComputeMs,
  beginComputePass,
  flushComputePass,
  recordRenderPhase,
} from "./ydsStockPickRenderPerf.js"
import {
  formatScoreBreakdownRows,
  normalizeScoreBreakdown,
  YDS_SCORE_WEIGHTS,
} from "./ydsStockScoreConfig.js"
import { resolveStockPickThemes } from "./ydsStockPickThemes.js"
import {
  computeDecomposedStockScores,
  logDecomposedScoreDebug,
} from "./ydsStockPickDecomposedScores.js"
import { computePhase3ScoreBreakdown, logPhase3ScoreDebug } from "./ydsStockPickPhase3Breakdown.js"
import { computeTimingScore } from "./ydsStockPickTimingScore.js"
import { computeV4Score } from "./ydsStockPickV4Scoring.js"
import { computeTechnicalScore } from "./ydsStockTechnicalScore.js"
import { buildStockPickOpinion } from "./ydsStockPickOpinion.js"

/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} StockPickStatusId */
/** @typedef {'ai' | 'power' | 'defense' | 'semi' | 'robot' | 'nuclear' | 'infra'} StockPickSectorId */

export { YDS_SCORE_WEIGHTS }

export {
  STOCK_ACTION_VIEWS,
  STOCK_STATUS_VIEWS,
} from "./ydsStockActionEngine.js"

/** @deprecated JSON status — 화면은 deriveStockAction 결과 사용 */
export const STOCK_PICK_STATUS = {
  trend: { id: "trend", emoji: "🟢", label: "추세 유지", phrase: "추세 유지" },
  dip: { id: "dip", emoji: "🟡", label: "눌림 대기", phrase: "눌림 대기" },
  interest: { id: "interest", emoji: "🟠", label: "관심 구간", phrase: "관심 구간" },
  overheat: { id: "overheat", emoji: "🔴", label: "과열 구간", phrase: "과열 구간" },
}

/** @typedef {'US' | 'KR'} StockPickCountryId */

export const STOCK_PICK_COUNTRIES = [
  { id: "US", emoji: "🇺🇸", label: "미국" },
  { id: "KR", emoji: "🇰🇷", label: "한국" },
]

export const STOCK_PICK_SECTORS = [
  { id: "all", label: "전체" },
  { id: "ai", label: "AI" },
  { id: "power", label: "전력" },
  { id: "defense", label: "방산" },
  { id: "semi", label: "반도체" },
  { id: "nuclear", label: "원전" },
  { id: "robot", label: "로봇" },
  { id: "infra", label: "인프라" },
]

/** @type {Record<number, string>} */
export const RATING_STARS = {
  5: "★★★★★",
  4: "★★★★☆",
  3: "★★★☆☆",
  2: "★★☆☆☆",
  1: "★☆☆☆☆",
}

/**
 * @typedef {{
 *   ticker: string
 *   name: string
 *   nameEn: string
 *   sector: StockPickSectorId
 *   country: 'US' | 'KR'
 *   status: StockPickStatusId
 *   rating: number
 *   comment: string
 *   marketFitScore: number
 * }} StockPickRecord
 */

/**
 * @typedef {StockPickRecord & {
 *   id: string
 *   rank: number
 *   stars: string
 *   score: number
 *   scores: import("./ydsStockScoreConfig.js").YdsScoreBreakdown
 *   scoreRows: ReturnType<typeof formatScoreBreakdownRows>
 *   scoreMeta: import("./ydsStockScoreEngine.js").StockScoreComputeMeta
 *   statusView: import("./ydsStockActionEngine.js").StockStatusView
 *   statusPhrase: string
 *   stockStatus: import("./ydsStockActionEngine.js").StockStatusView
 *   stockAction: import("./ydsStockActionEngine.js").StockActionView
 *   actionReason: string
 *   recommendReasons: import("./ydsStockRecommendReasons.js").RecommendReason[]
 *   recommendReasonSummary: string
 *   marketFitSource: 'adapter' | 'manual'
 *   sectorLabel: string
 *   dataSource: 'live' | 'fallback'
 *   quoteSource: string | null
 *   statusDiag: ReturnType<typeof explainStatusFromSnapshot> | null
 *   quote: import("./ydsStockPickQuoteService.js").StockPickQuoteView | null
 *   recommendReasonsDetail: import("./ydsStockRecommendReasons.js").RecommendReason[]
 *   investThemes: string[]
 *   decomposedScores: import("./ydsStockPickDecomposedScores.js").DecomposedStockScores
 *   scoreBreakdown: import("./ydsStockPickPhase3Breakdown.js").Phase3ScoreBreakdown
 *   timingScore: import("./ydsStockPickTimingScore.js").TimingScoreResult
 *   v4Score: import("./ydsStockPickV4Scoring.js").V4StockScore
 *   technicalScore: import("./ydsStockTechnicalScore.js").TechnicalScoreResult
 *   opinion: import("./ydsStockPickOpinion.js").StockPickOpinion
 * }} StockPickView
 */

/** @param {import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry | null} liveEntry */
function resolveQuoteSource(liveEntry) {
  const raw = liveEntry?.apiBody?.dataSource ?? liveEntry?.apiBody?.dataSourceBadgeKey
  if (!raw) return liveEntry ? "API" : null
  const key = String(raw).toLowerCase()
  if (key.includes("kis") || key === "krx_close") return "KIS"
  if (key.includes("yahoo")) return "Yahoo"
  if (key.includes("naver")) return "Naver"
  return String(raw)
}

/** @param {StockPickView | null | undefined} stock */
export function isLiveStockPick(stock) {
  return stock?.dataSource === "live"
}

/** @param {StockPickView[]} stocks */
export function filterLiveStockPicks(stocks) {
  return stocks.filter(isLiveStockPick)
}

/**
 * @param {StockPickView[]} stocks
 */
export function filterRecommendableStockPicks(stocks) {
  return filterLiveStockPicks(stocks)
}

/**
 * @param {StockPickRecord} row
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry | null} [liveEntry]
 */
function enrichStock(row, marketContext = null, liveEntry = null) {
  const sectorLabel =
    STOCK_PICK_SECTORS.find((s) => s.id === row.sector)?.label ?? row.sector

  const ctx = marketContext?.ready ? marketContext : null

  const engineSnapshot = liveEntry?.engineSnapshot
    ? liveEntry.engineSnapshot
    : toEngineSnapshot(
        getStockSnapshot({
          ticker: row.ticker,
          country: row.country,
        }),
      )

  const marketSnapshot = liveEntry
    ? {
        ...toStockMarketSnapshot(engineSnapshot, {
          ticker: row.ticker,
          country: row.country,
        }),
        live: true,
        fetchedAt: liveEntry.fetchedAt,
      }
    : getStockSnapshot({
        ticker: row.ticker,
        country: row.country,
      })

  const scoreT0 = typeof performance !== "undefined" ? performance.now() : 0
  const computed = computeStockScores(engineSnapshot, {
    marketFitScore: 0,
  })
  if (typeof performance !== "undefined") {
    accumulateComputeMs("score", performance.now() - scoreT0)
  }

  const baseScores =
    normalizeScoreBreakdown(computed.scores) ?? {
      trendScore: 0,
      volumeScore: 0,
      positionScore: 0,
      marketFitScore: 0,
      totalScore: 0,
    }

  const statusT0 = typeof performance !== "undefined" ? performance.now() : 0
  const statusId = deriveStatusFromSnapshot(
    engineSnapshot,
    liveEntry?.extras ?? {},
  )
  if (typeof performance !== "undefined") {
    accumulateComputeMs("status", performance.now() - statusT0)
  }

  const marketFitScore = ctx
    ? computeMarketFitScore(ctx, statusId, baseScores)
    : row.marketFitScore ?? 0

  const scores =
    normalizeScoreBreakdown({
      trendScore: baseScores.trendScore,
      volumeScore: baseScores.volumeScore,
      positionScore: baseScores.positionScore,
      marketFitScore,
    }) ?? baseScores

  const marketFitReasons = ctx
    ? buildMarketFitReasons(ctx, statusId, marketFitScore)
    : []

  const reasonOpts = {
    skipMarketFit: Boolean(ctx),
    marketFitReasons,
    engineSnapshot,
  }

  const recommendReasonsDetail = buildRecommendReasons(scores, computed.meta, {
    ...reasonOpts,
    limit: 4,
  })

  const recommendReasons = buildRecommendReasons(scores, computed.meta, {
    ...reasonOpts,
    limit: 1,
  })

  const action = actionFromStatus(statusId, recommendReasons)
  const isLive = Boolean(liveEntry)

  const decomposedScores = computeDecomposedStockScores({
    ticker: row.ticker,
    name: row.name,
    rating: row.rating,
    marketFitScore: row.marketFitScore,
    scores,
    scoreMeta: computed.meta,
    marketFitSource: ctx ? "adapter" : "manual",
  })

  const timingScore = computeTimingScore(
    engineSnapshot,
    liveEntry?.extras ?? {},
    computed.meta,
  )

  const scoreBreakdown = computePhase3ScoreBreakdown({
    ticker: row.ticker,
    name: row.name,
    rating: row.rating,
    manualMarketFit: row.marketFitScore,
    scores,
    timingScore,
  })

  const v4Score = computeV4Score(scoreBreakdown.quality, scoreBreakdown.timing)

  const technicalScore = computeTechnicalScore(
    engineSnapshot,
    liveEntry?.extras ?? {},
  )

  scores.totalScore = scoreBreakdown.total

  const statusDiag = isLive
    ? explainStatusFromSnapshot(engineSnapshot, liveEntry.extras ?? {})
    : null

  if (isLive && statusDiag && typeof globalThis.window !== "undefined") {
    const verifyPayload = {
      name: row.name,
      ticker: row.ticker,
      dataSource: "live",
      statusDiag,
    }
    const logVerify = () => logStockPickStatusVerification(verifyPayload)
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(logVerify, { timeout: 3000 })
    } else {
      setTimeout(logVerify, 0)
    }
  }

  const enriched = {
    ...row,
    id: row.ticker,
    rank: 0,
    stars: RATING_STARS[row.rating] ?? RATING_STARS[3],
    score: scores.totalScore,
    scores,
    scoreRows: formatScoreBreakdownRows(scores),
    scoreMeta: computed.meta,
    snapshot: marketSnapshot,
    statusView: action.stockStatus,
    statusPhrase: action.stockStatus.label,
    stockStatus: action.stockStatus,
    stockAction: action.stockAction,
    actionReason: action.actionReason,
    recommendReasons,
    recommendReasonsDetail,
    recommendReasonSummary: formatRecommendReasonSummary(recommendReasons),
    marketFitSource: ctx ? "adapter" : "manual",
    sectorLabel,
    investThemes: resolveStockPickThemes(row),
    decomposedScores,
    scoreBreakdown,
    timingScore,
    v4Score,
    technicalScore,
    dataSource: isLive ? "live" : "fallback",
    quoteSource: resolveQuoteSource(liveEntry),
    statusDiag,
    quote: liveEntry?.quote ?? null,
  }

  enriched.opinion = buildStockPickOpinion(enriched)

  if (isLive) {
    const logScore = () => {
      logDecomposedScoreDebug(enriched)
      logPhase3ScoreDebug(enriched)
    }
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(logScore, { timeout: 4000 })
    } else {
      setTimeout(logScore, 0)
    }
  }

  return enriched
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} [liveSnapshots]
 * @returns {StockPickView[]}
 */
export function buildStockPickViews(marketContext = null, liveSnapshots = new Map()) {
  const canPerf = typeof performance !== "undefined"
  if (canPerf) beginComputePass()
  const t0 = canPerf ? performance.now() : 0

  const views = universe.stocks.map((row) =>
    enrichStock(row, marketContext, liveSnapshots.get(row.ticker) ?? null),
  )

  if (canPerf) {
    recordRenderPhase("view build", performance.now() - t0)
    flushComputePass()
  }

  return views
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @returns {StockPickView[]}
 */
export function getStockPickUniverse(marketContext = null) {
  const enriched = buildStockPickViews(marketContext)
  const sorted = [...enriched].sort(
    (a, b) => (b.v4Score?.finalRankScore ?? 0) - (a.v4Score?.finalRankScore ?? 0),
  )
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }))
}

/** @param {StockPickView[]} stocks */
export function assignRanks(stocks) {
  const live = filterRecommendableStockPicks(stocks)
  const sorted = [...live].sort(
    (a, b) => (b.v4Score?.finalRankScore ?? 0) - (a.v4Score?.finalRankScore ?? 0),
  )
  const rankMap = new Map(sorted.map((s, i) => [s.ticker, i + 1]))
  return stocks.map((row) => ({ ...row, rank: rankMap.get(row.ticker) ?? 0 }))
}

/** @param {StockPickView[]} stocks @param {StockPickCountryId} countryId */
export function filterByCountry(stocks, countryId) {
  if (!countryId) return stocks
  return stocks.filter((s) => s.country === countryId)
}

/** @param {StockPickCountryId} countryId @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext] */
export function getStockPicksForCountry(countryId, marketContext = null) {
  return assignRanks(filterByCountry(getStockPickUniverse(marketContext), countryId))
}

/**
 * @param {string} ticker
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 */
export function getStockPickByTicker(ticker, marketContext = null) {
  const key = String(ticker ?? "").toUpperCase()
  const all = getStockPickUniverse(marketContext)
  const stock = all.find((s) => s.ticker.toUpperCase() === key) ?? null
  if (!stock) return null
  return assignRanks(filterByCountry(all, stock.country)).find(
    (s) => s.ticker.toUpperCase() === key,
  ) ?? stock
}

/** @typedef {'totalScore' | 'trendScore' | 'volumeScore' | 'positionScore' | 'marketFitScore' | 'rating' | 'rank' | 'name'} StockPickSortKey */

/**
 * @param {StockPickView[]} stocks
 * @param {StockPickSortKey} key
 * @param {'asc' | 'desc'} dir
 */
export function sortStockPicks(stocks, key, dir = "desc") {
  const mul = dir === "asc" ? 1 : -1
  return [...stocks].sort((a, b) => {
    if (key === "name") return mul * a.name.localeCompare(b.name, "ko")
    if (key === "rank") return mul * (a.rank - b.rank)
    if (key === "totalScore") return mul * (a.scores.totalScore - b.scores.totalScore)
    if (key in a.scores) {
      return mul * (a.scores[key] - b.scores[key])
    }
    const av = a[key] ?? 0
    const bv = b[key] ?? 0
    return mul * (Number(av) - Number(bv))
  })
}

/** @param {StockPickView[]} stocks */
export function getTop3Stocks(stocks) {
  return getTop5Stocks(stocks).slice(0, 3)
}

/** @param {StockPickView[]} stocks */
export function getTop5Stocks(stocks) {
  const eligible = filterRecommendableStockPicks(stocks).filter(
    (s) => s.v4Score?.top5Eligible ?? false,
  )
  const sorted = [...eligible].sort(
    (a, b) => (b.v4Score?.finalRankScore ?? 0) - (a.v4Score?.finalRankScore ?? 0),
  )
  return sorted.slice(0, 5)
}

/** @param {StockPickView[]} stocks */
export function getTop10Stocks(stocks) {
  return getRankingStocks(stocks, 10)
}

/** @param {StockPickView[]} stocks */
export function getRankingStocks(stocks, limit = 5) {
  return sortStockPicks(filterRecommendableStockPicks(stocks), "rank", "asc").slice(0, limit)
}

/** @param {StockPickView[]} stocks @param {string} sectorId */
export function filterBySector(stocks, sectorId) {
  const base = filterRecommendableStockPicks(stocks)
  if (!sectorId || sectorId === "all") return base
  return base.filter((s) => s.sector === sectorId)
}

export { DEFAULT_MARKET_CONTEXT } from "./ydsMarketAdapter.js"

export const TOP3_MEDALS = ["🥇", "🥈", "🥉"]
export const TOP5_MEDALS = ["🥇", "🥈", "🥉", "4", "5"]
