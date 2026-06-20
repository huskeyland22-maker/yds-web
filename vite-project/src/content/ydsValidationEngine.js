/**
 * Phase 7 — YDS 검증 레이어 (기존 분석 결과 기록·검증)
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { buildV5Analysis } from "./ydsPortfolioV5Engine.js"
import { todayDateKey } from "./ydsPortfolioTradesStorage.js"
import { loadPortfolioReview } from "./ydsPortfolioReviewStorage.js"
import { loadPortfolioStockReviews } from "./ydsPortfolioStockReviewStorage.js"
import { loadPortfolioTrades } from "./ydsPortfolioTradesStorage.js"
import { STOCK_STATUS_VIEWS } from "./ydsStockActionEngine.js"
import { marketEnvToGrade } from "./ydsStockPickV5Insights.js"
import {
  filterByCountry,
  getRankingStocks,
  getStockPickUniverse,
} from "./ydsStockPickModel.js"
import { getStockSnapshot } from "./stockPickSnapshotProvider.js"
import {
  benchmarkReturnsForHorizon,
  captureBenchmarkPrices,
  daysBetween,
  maybeAppendBenchmarkLog,
} from "./ydsValidationBenchmarks.js"
import {
  loadValidationBenchmarkLog,
  loadValidationPicks,
  loadValidationPortfolioSnapshots,
  loadValidationRegimePeriods,
  normalizePickRecord,
  saveValidationBenchmarkLog,
  saveValidationPicks,
  saveValidationPortfolioSnapshots,
  saveValidationRegimePeriods,
} from "./ydsValidationStorage.js"

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {import("./ydsValidationStorage.js").ValidationPortfolioSnapshot} ValidationPortfolioSnapshot */
/** @typedef {import("./ydsValidationStorage.js").ValidationRegimePeriod} ValidationRegimePeriod */
/** @typedef {import("./ydsValidationBenchmarks.js").BenchmarkId} BenchmarkId */

export const HORIZON_DAYS = [
  { key: "d7", label: "7일", days: 7 },
  { key: "d14", label: "14일", days: 14 },
  { key: "d30", label: "30일", days: 30 },
  { key: "d90", label: "90일", days: 90 },
  { key: "d180", label: "180일", days: 180 },
  { key: "d365", label: "365일", days: 365 },
]

/** @param {string} dateKey @param {number} days */
export function addCalendarDays(dateKey, days) {
  const d = new Date(`${String(dateKey).slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** @param {string} dateKey @param {number} days */
export function subtractCalendarDays(dateKey, days) {
  return addCalendarDays(dateKey, -days)
}

/** @type {Record<string, string>} */
export const REGIME_LABELS = {
  overheated: "방어 모드",
  neutral: "방어 모드",
  interest: "관심 구간",
  dca: "분할매수",
  panicBuy: "패닉매수",
}

export const STOCK_STATUS_IDS = ["trend", "dip", "interest", "overheat"]

/**
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 */
export function regimeFromMarketContext(ctx) {
  const macroId = ctx?.macroId ?? "neutral"
  const label =
    ctx?.isDefensive && (macroId === "neutral" || macroId === "overheated")
      ? "방어 모드"
      : (REGIME_LABELS[macroId] ?? ctx?.strategyLabel ?? "—")
  return { regimeId: macroId, regimeLabel: label }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {string} recommendedAt
 */
function pickRecordFromStock(stock, marketContext, recommendedAt) {
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const { regimeId, regimeLabel } = regimeFromMarketContext(marketContext)
  const country = stock.country === "KR" ? "KR" : "US"
  const id = `${recommendedAt}:${country}:${stock.ticker}`
  const statusId = stock.stockStatus?.id ?? stock.statusView?.id ?? "interest"
  const statusLabel =
    stock.stockStatus?.label ?? STOCK_STATUS_VIEWS[statusId]?.label ?? "—"
  const marketFitScore = Number(stock.scoreBreakdown?.marketEnv ?? stock.pickMeta?.marketFitScore ?? 0)
  const marketFitGrade =
    stock.pickMeta?.marketFitGrade ?? marketEnvToGrade(marketFitScore, 15)
  const recommendedScore = Number(stock.v4Score?.finalRankScore ?? stock.score)
  const qualityGrade = String(stock.v4Score?.qualityGrade ?? "—")
  const timingGrade = String(stock.v4Score?.timingGrade ?? "—")

  return normalizePickRecord({
    id,
    ticker: stock.ticker,
    name: stock.name,
    country,
    rank: stock.rank,
    isTop3: stock.rank > 0 && stock.rank <= 3,
    recommendedAt,
    recommendedPrice: Number.isFinite(price) && price > 0 ? price : 0,
    recommendedScore: Number.isFinite(recommendedScore) ? recommendedScore : null,
    qualityGrade,
    timingGrade,
    marketFitGrade,
    statusId,
    statusLabel,
    currentPrice: null,
    returnPct: null,
    horizons: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    horizonPrices: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    priceLog: Number.isFinite(price) && price > 0 ? { [recommendedAt]: price } : {},
    regimeId,
    regimeLabel,
    strategyLabel: marketContext?.strategyLabel ?? "—",
    recordedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  })
}

/**
 * @param {Record<string, number>} priceLog
 * @param {string} recommendedAt
 * @param {number} horizonDays
 * @param {string} today
 * @param {number | null} currentPrice
 */
function resolveHorizonLockPrice(priceLog, recommendedAt, horizonDays, today, currentPrice) {
  const targetDate = addCalendarDays(recommendedAt, horizonDays)
  if (today < targetDate) return null

  const exact = priceLog[targetDate]
  if (exact != null && Number.isFinite(exact) && exact > 0) return exact

  const onOrAfter = Object.keys(priceLog)
    .filter((d) => d >= targetDate)
    .sort()
  for (const d of onOrAfter) {
    const p = priceLog[d]
    if (p != null && Number.isFinite(p) && p > 0) return p
  }

  if (currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0) {
    return currentPrice
  }
  return null
}

/**
 * @param {ValidationPickRecord} record
 * @param {string} today
 * @param {number | null} currentPrice
 */
function lockPickHorizons(record, today, currentPrice) {
  /** @type {ValidationPickRecord["horizonPrices"]} */
  const horizonPrices = { ...record.horizonPrices }
  /** @type {ValidationPickRecord["horizons"]} */
  const horizons = { ...record.horizons }

  for (const h of HORIZON_DAYS) {
    if (horizonPrices[h.key] != null && Number.isFinite(horizonPrices[h.key])) {
      if (horizons[h.key] == null) {
        const ret = calcRecommendReturnPct(record.recommendedPrice, horizonPrices[h.key])
        horizons[h.key] = ret != null ? Math.round(ret * 10) / 10 : null
      }
      continue
    }

    const lockPrice = resolveHorizonLockPrice(
      record.priceLog,
      record.recommendedAt,
      h.days,
      today,
      currentPrice,
    )
    if (lockPrice == null) continue

    horizonPrices[h.key] = lockPrice
    const ret = calcRecommendReturnPct(record.recommendedPrice, lockPrice)
    horizons[h.key] = ret != null ? Math.round(ret * 10) / 10 : null
  }

  return { horizonPrices, horizons }
}

/**
 * @param {ValidationPickRecord} record
 * @param {string} today
 */
function refreshPickPrice(record, today) {
  const snap = getStockSnapshot({
    ticker: record.ticker,
    country: record.country,
    status: "interest",
  })
  const current = Number(snap?.price ?? snap?.close)
  const currentPrice = Number.isFinite(current) && current > 0 ? current : null
  const priceLog = { ...record.priceLog }
  if (currentPrice != null && priceLog[today] == null) priceLog[today] = currentPrice

  const withLog = { ...record, priceLog }
  const { horizonPrices, horizons } = lockPickHorizons(withLog, today, currentPrice)
  const returnPct = calcRecommendReturnPct(record.recommendedPrice, currentPrice)

  return {
    ...withLog,
    currentPrice,
    returnPct,
    horizonPrices,
    horizons,
    lastUpdatedAt: Date.now(),
  }
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {number} [rankLimit]
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [universeOverride]
 */
export function captureTodayPickSnapshots(marketContext, rankLimit = 10, universeOverride = null) {
  const today = todayDateKey()
  const existing = loadValidationPicks()
  const existingToday = new Set(
    existing.filter((r) => r.recommendedAt === today).map((r) => r.id),
  )

  const universe = universeOverride ?? getStockPickUniverse(marketContext ?? null)
  const usRanked = getRankingStocks(filterByCountry(universe, "US"), rankLimit)
  const krRanked = getRankingStocks(filterByCountry(universe, "KR"), rankLimit)

  const fresh = [...usRanked, ...krRanked]
    .filter((s) => s?.ticker)
    .map((s) => pickRecordFromStock(s, marketContext, today))
    .filter((r) => !existingToday.has(r.id))

  if (!fresh.length) return existing

  const merged = [...existing, ...fresh]
  saveValidationPicks(merged)
  return merged
}

/** @param {ValidationPickRecord[]} picks */
export function refreshValidationPicks(picks) {
  const today = todayDateKey()
  const refreshed = picks.map((r) => refreshPickPrice(r, today))
  saveValidationPicks(refreshed)
  return refreshed
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 */
export function updateMarketRegimePeriods(marketContext) {
  const today = todayDateKey()
  const { regimeId, regimeLabel } = regimeFromMarketContext(marketContext)
  const periods = loadValidationRegimePeriods()
  const open = periods.find((p) => !p.endDate) ?? null
  const benchmarks = captureBenchmarkPrices()

  if (!open) {
    const created = /** @type {ValidationRegimePeriod} */ ({
      id: `regime-${today}-${regimeId}`,
      regimeId,
      regimeLabel,
      startDate: today,
      endDate: null,
      startBenchmarks: benchmarks,
      endBenchmarks: null,
      recordedAt: Date.now(),
    })
    const next = [...periods, created]
    saveValidationRegimePeriods(next)
    return next
  }

  if (open.regimeId === regimeId) return periods

  const closed = {
    ...open,
    endDate: today,
    endBenchmarks: benchmarks,
  }
  const created = /** @type {ValidationRegimePeriod} */ ({
    id: `regime-${today}-${regimeId}`,
    regimeId,
    regimeLabel,
    startDate: today,
    endDate: null,
    startBenchmarks: benchmarks,
    endBenchmarks: null,
    recordedAt: Date.now(),
  })
  const next = [...periods.filter((p) => p.id !== open.id), closed, created]
  saveValidationRegimePeriods(next)
  return next
}

/**
 * @param {import("./ydsPortfolioV5Engine.js").ReturnType<typeof buildV5Analysis>} portfolio
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {import("./ydsPortfolioTradesStorage.js").PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {Map<string, unknown>} quoteMap
 * @param {number | null | undefined} usdkrw
 */
export function maybeRecordPortfolioSnapshot(
  portfolio,
  marketContext,
  trades,
  cashAmount,
  quoteMap,
  usdkrw,
) {
  const snapshots = loadValidationPortfolioSnapshots()
  const today = todayDateKey()
  if (snapshots.some((s) => s.date === today)) return snapshots

  const totalAssets = Number(portfolio?.totalAssets) || 0
  const hasHoldings = Array.isArray(portfolio?.rows) && portfolio.rows.length > 0
  if (totalAssets <= 0 && !hasHoldings) return snapshots

  let compliancePct = null
  try {
    const analysis = buildV5Analysis(trades ?? [], cashAmount ?? 0, marketContext, quoteMap, usdkrw)
    compliancePct = analysis.compliancePct
  } catch {
    /* ignore */
  }

  const next = [
    ...snapshots,
    {
      date: today,
      totalAssets,
      totalPnl: Number(portfolio?.totalPnl) || 0,
      totalReturnPct:
        portfolio?.totalReturnPct != null && Number.isFinite(portfolio.totalReturnPct)
          ? portfolio.totalReturnPct
          : null,
      cashPct: Number(portfolio?.cashPct) || 0,
      realizedPnl: Number(portfolio?.totalRealizedPnl) || 0,
      unrealizedPnl: Number(portfolio?.totalUnrealizedPnl) || 0,
      compliancePct,
      recordedAt: Date.now(),
    },
  ]
  saveValidationPortfolioSnapshots(next)
  return next
}

/**
 * @param {ValidationPickRecord[]} list
 */
function aggregatePickStats(list) {
  const rows = list ?? []
  const withRet = rows.filter((r) => r.returnPct != null && Number.isFinite(r.returnPct))
  const wins = withRet.filter((r) => Number(r.returnPct) > 0)
  const today = todayDateKey()
  const holdingDays = rows.length
    ? Math.round(
        rows.reduce((s, r) => s + daysBetween(r.recommendedAt, today), 0) / rows.length,
      )
    : null

  return {
    count: rows.length,
    tracked: withRet.length,
    winRate:
      withRet.length > 0 ? Math.round((wins.length / withRet.length) * 1000) / 10 : null,
    avgReturn: withRet.length
      ? Math.round((withRet.reduce((s, r) => s + Number(r.returnPct), 0) / withRet.length) * 10) /
        10
      : null,
    avgHoldingDays: holdingDays,
  }
}

/** @param {ValidationPickRecord[]} picks */
export function summarizePickPerformance(picks) {
  const stats = aggregatePickStats(picks)
  const best =
    [...(picks ?? [])]
      .filter((r) => r.returnPct != null)
      .sort((a, b) => Number(b.returnPct) - Number(a.returnPct))[0] ?? null
  return { ...stats, total: stats.count, best, top3: aggregatePickStats(picks.filter((p) => p.isTop3)) }
}

/** @param {ValidationPickRecord[]} picks */
export function summarizeStockStatusPerformance(picks) {
  return STOCK_STATUS_IDS.map((statusId) => {
    const label = STOCK_STATUS_VIEWS[statusId]?.label ?? statusId
    const subset = (picks ?? []).filter((p) => p.statusId === statusId)
    const stats = aggregatePickStats(subset)
    return { statusId, statusLabel: label, ...stats }
  })
}

/** @param {ValidationRegimePeriod[]} periods */
export function summarizeRegimePeriodPerformance(periods) {
  return (periods ?? []).map((period) => {
    const endDate = period.endDate ?? todayDateKey()
    /** @type {Record<BenchmarkId, number | null>} */
    const benchmarkReturns = {}
    for (const id of ["SPY", "QQQ", "KOSPI", "KOSDAQ"]) {
      const start = period.startBenchmarks?.[id]
      const end = period.endBenchmarks?.[id] ?? period.startBenchmarks?.[id]
      benchmarkReturns[id] = calcRecommendReturnPct(start, end)
    }
    const spy = benchmarkReturns.SPY
    return {
      ...period,
      days: daysBetween(period.startDate, endDate),
      benchmarkReturns,
      avgReturn: spy != null ? Math.round(spy * 10) / 10 : null,
    }
  })
}

/**
 * @param {ValidationPortfolioSnapshot[]} snapshots
 * @param {Record<string, Record<BenchmarkId, number | null>>} benchmarkLog
 */
export function summarizePortfolioHorizons(snapshots, benchmarkLog) {
  const list = [...(snapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const latest = list[list.length - 1] ?? null
  if (!latest) {
    return { latest: null, horizons: [], vsSpy: null }
  }

  const horizons = [30, 90, 180, 365].map((days) => {
    const targetMs = Date.parse(latest.date) - days * 86400000
    const base =
      [...list].reverse().find((s) => Date.parse(s.date) <= targetMs) ?? list[0]
    const portfolioReturn =
      base.totalAssets > 0
        ? Math.round(((latest.totalAssets - base.totalAssets) / base.totalAssets) * 1000) / 10
        : latest.totalReturnPct != null && base.totalReturnPct != null
          ? Math.round((latest.totalReturnPct - base.totalReturnPct) * 10) / 10
          : null
    const bench = benchmarkReturnsForHorizon(benchmarkLog, latest.date, days)
    const spy = bench.SPY
    return {
      days,
      label: `${days}일`,
      portfolioReturn,
      benchmarkReturns: bench,
      excessVsSpy:
        portfolioReturn != null && spy != null
          ? Math.round((portfolioReturn - spy) * 10) / 10
          : null,
    }
  })

  const h365 = horizons.find((h) => h.days === 365) ?? horizons[horizons.length - 1]
  return {
    latest,
    first: list[0],
    snapshots: list,
    horizons,
    vsSpy: h365?.excessVsSpy ?? null,
    spyReturn: h365?.benchmarkReturns?.SPY ?? null,
    portfolioReturn: h365?.portfolioReturn ?? latest.totalReturnPct,
  }
}

/**
 * @param {number} year
 * @param {ValidationPickRecord[]} picks
 * @param {ValidationPortfolioSnapshot[]} portfolioSnapshots
 * @param {Record<string, Record<BenchmarkId, number | null>>} benchmarkLog
 */
export function buildAnnualValidationReport(year, picks, portfolioSnapshots, benchmarkLog) {
  const prefix = String(year)
  const yearPicks = picks.filter((p) => p.recommendedAt.startsWith(prefix))
  const yearPf = portfolioSnapshots.filter((s) => s.date.startsWith(prefix))
  const pickStats = summarizePickPerformance(yearPicks)
  const pfHorizons = summarizePortfolioHorizons(yearPf, benchmarkLog)

  const complianceRows = yearPf.filter((s) => s.compliancePct != null)
  const compliancePct = complianceRows.length
    ? Math.round(
        complianceRows.reduce((s, r) => s + Number(r.compliancePct), 0) / complianceRows.length,
      )
    : null

  const portfolioReturn = pfHorizons.portfolioReturn
  const spyReturn = pfHorizons.spyReturn
  const excessReturn =
    portfolioReturn != null && spyReturn != null
      ? Math.round((portfolioReturn - spyReturn) * 10) / 10
      : null

  return {
    year,
    compliancePct,
    pickWinRate: pickStats.winRate,
    pickAvgReturn: pickStats.avgReturn,
    top3WinRate: pickStats.top3.winRate,
    top3AvgReturn: pickStats.top3.avgReturn,
    portfolioReturn,
    spyReturn,
    excessReturn,
    pickCount: yearPicks.length,
    trackingDays: yearPf.length,
  }
}

export function collectReviewArchive() {
  const global = loadPortfolioReview()
  const stockMap = loadPortfolioStockReviews()
  const trades = loadPortfolioTrades()

  /** @type {{ kind: string; title: string; body: string; at: number; stockName?: string; ticker?: string }[]} */
  const items = []

  for (const [field, label] of [
    ["mistakes", "실수"],
    ["lessons", "배운 점"],
    ["nextAction", "다음 행동"],
  ]) {
    const body = String(global[field] ?? "").trim()
    if (body) items.push({ kind: "global", title: label, body, at: global.updatedAt || 0 })
  }

  for (const [positionId, entry] of Object.entries(stockMap)) {
    const stockName = String(entry?.stockName ?? positionId)
    const ticker = String(entry?.ticker ?? "")
    for (const [field, label] of [
      ["buyReason", "매수 이유"],
      ["sellReason", "매도 이유"],
      ["lessons", "배운 점"],
      ["nextAction", "다음 행동"],
    ]) {
      const body = String(entry?.[field] ?? "").trim()
      if (body) {
        items.push({
          kind: "stock",
          title: `${stockName} · ${label}`,
          body,
          at: entry.updatedAt || 0,
          stockName,
          ticker,
        })
      }
    }
  }

  for (const trade of trades) {
    if (trade.action !== "sell") continue
    const memo = String(trade.memo ?? "").trim()
    if (!memo) continue
    items.push({
      kind: "trade",
      title: `${trade.name} · 매도 기록`,
      body: memo,
      at: trade.updatedAt || trade.createdAt || 0,
      stockName: trade.name,
      ticker: trade.ticker,
    })
  }

  items.sort((a, b) => b.at - a.at)

  /** @type {Record<string, { stockName: string; ticker?: string; items: typeof items }>} */
  const byStock = {}
  for (const item of items.filter((i) => i.kind === "stock" || i.kind === "trade")) {
    const key = item.stockName ?? item.title
    if (!byStock[key]) byStock[key] = { stockName: key, ticker: item.ticker, items: [] }
    byStock[key].items.push(item)
  }

  return {
    total: items.length,
    buyReasons: items.filter((i) => i.title.includes("매수 이유")).length,
    sellReasons: items.filter((i) => i.title.includes("매도")).length,
    mistakes: items.filter((i) => i.title === "실수").length,
    lessons: items.filter((i) => i.title.includes("배운 점")).length,
    recent: items.slice(0, 8),
    byStock: Object.values(byStock).slice(0, 6),
  }
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {import("./ydsPortfolioV5Engine.js").ReturnType<typeof import("./ydsPortfolioV5Engine.js").buildV5Holdings>} portfolio
 * @param {import("./ydsPortfolioTradesStorage.js").PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {Map<string, unknown>} quoteMap
 * @param {number | null | undefined} usdkrw
 */
export function buildValidationReport(marketContext, portfolio, trades, cashAmount, quoteMap, usdkrw) {
  const benchmarkLog = maybeAppendBenchmarkLog(loadValidationBenchmarkLog())
  saveValidationBenchmarkLog(benchmarkLog)

  const captured = captureTodayPickSnapshots(marketContext)
  const picks = refreshValidationPicks(captured)
  const regimePeriods = updateMarketRegimePeriods(marketContext)
  const portfolioSnapshots = maybeRecordPortfolioSnapshot(
    portfolio,
    marketContext,
    trades,
    cashAmount,
    quoteMap,
    usdkrw,
  )

  const year = new Date().getFullYear()

  return {
    picks: [...picks].sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt)),
    pickSummary: summarizePickPerformance(picks),
    stockStatusSummary: summarizeStockStatusPerformance(picks),
    regimePeriods: summarizeRegimePeriodPerformance(regimePeriods),
    portfolio: summarizePortfolioHorizons(portfolioSnapshots, benchmarkLog),
    reviews: collectReviewArchive(),
    annual: buildAnnualValidationReport(year, picks, portfolioSnapshots, benchmarkLog),
    benchmarkLog,
  }
}
