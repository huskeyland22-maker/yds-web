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
import {
  buildValidationPriceMap,
  resolveValidationLivePrice,
} from "./ydsValidationPriceResolver.js"
import {
  isValidationDummyPrice,
  sanitizeValidationPickRecord,
  sanitizeValidationPicks,
  sanitizeValidationPriceLog,
} from "./ydsValidationPriceSanitize.js"
import {
  logValidationPickPriceAudit,
  logValidationPriceLookupFailure,
  logRecommendProfitServerTrace,
} from "./ydsValidationPriceDebug.js"
import {
  backfillRecommendSnapshot,
  buildRecommendSnapshot,
  stockReadyForRecommendCapture,
} from "./ydsValidationRecommendSnapshot.js"
import { updatePickLifecycle } from "./ydsPickLifecycleEngine.js"
import {
  applyMutablePickUpdate,
  isPickImmutableSealed,
  logImmutableLedgerViolation,
  mapLifecycleToLedgerState,
  repairImmutableLedgerRecord,
  resolveRunningReturnExtremes,
  sealNewRecommendLedgerRecord,
} from "./ydsRecommendLedger.js"
import {
  resolveRecommendMarketAnchor,
  resolvePickMarketDate,
} from "./ydsRecommendMarketDate.js"
import {
  filterByCountry,
  getRankingStocks,
  getStockPickUniverse,
} from "./ydsStockPickModel.js"
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
 * @param {{ panicData?: object | null }} [options]
 */
function pickRecordFromStock(stock, marketContext, _ignoredDate, options = {}) {
  const recordedAt = Date.now()
  const createdAt = recordedAt
  const country = stock.country === "KR" ? "KR" : "US"
  const { marketDate, marketClose } = resolveRecommendMarketAnchor(stock, country)
  const anchorDate = marketDate ?? new Date().toISOString().slice(0, 10)
  const price = marketClose ?? null
  const baseSnap = buildRecommendSnapshot(stock, marketContext, anchorDate)
  const snap =
    price != null ? Object.freeze({ ...baseSnap, recommendedPrice: price }) : baseSnap
  const { regimeId, regimeLabel } = regimeFromMarketContext(marketContext)
  const statusId = stock.stockStatus?.id ?? stock.statusView?.id ?? "interest"
  const statusLabel =
    stock.stockStatus?.label ?? STOCK_STATUS_VIEWS[statusId]?.label ?? "—"

  const draft = normalizePickRecord({
    ticker: stock.ticker,
    name: snap.name,
    country,
    rank: stock.rank,
    isTop3: stock.rank > 0 && stock.rank <= 3,
    recommendedAt: anchorDate,
    marketDate: anchorDate,
    createdAt,
    recommendedPrice: price,
    recommendedScore: snap.totalScore,
    qualityGrade: snap.qualityGrade,
    timingGrade: snap.timingGrade,
    marketFitGrade: snap.marketFitGrade,
    statusId,
    statusLabel,
    currentPrice: null,
    returnPct: null,
    horizons: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    horizonPrices: { d7: null, d14: null, d30: null, d90: null, d180: null, d365: null },
    priceLog: price != null ? { [anchorDate]: price } : {},
    regimeId,
    regimeLabel,
    strategyLabel: snap.marketStateLabel,
    recommendSnapshot: snap,
    recordedAt,
    lastUpdatedAt: recordedAt,
  })

  return sealNewRecommendLedgerRecord(draft, marketContext, options.panicData ?? null)
}

/**
 * @param {Record<string, number>} priceLog
 * @param {string} recommendedAt
 * @param {number} horizonDays
 * @param {string} today
 * @param {number | null} recommendPrice
 * @param {'US' | 'KR'} country
 * @returns {{ price: number | null; targetDate: string; lookupOk: boolean; source: string }}
 */
function resolveHorizonLockPrice(
  priceLog,
  recommendedAt,
  horizonDays,
  today,
  recommendPrice,
  country,
) {
  const targetDate = addCalendarDays(recommendedAt, horizonDays)
  if (today < targetDate) {
    return { price: null, targetDate, lookupOk: false, source: "pending" }
  }

  const exact = priceLog[targetDate]
  if (
    exact != null &&
    Number.isFinite(exact) &&
    exact > 0 &&
    !isValidationDummyPrice(exact, recommendPrice, country)
  ) {
    return { price: exact, targetDate, lookupOk: true, source: "priceLog-exact" }
  }

  const onOrAfter = Object.keys(priceLog)
    .filter((d) => d >= targetDate)
    .sort()
  for (const d of onOrAfter) {
    const p = priceLog[d]
    if (
      p != null &&
      Number.isFinite(p) &&
      p > 0 &&
      !isValidationDummyPrice(p, recommendPrice, country)
    ) {
      return { price: p, targetDate, lookupOk: true, source: "priceLog-on-or-after" }
    }
  }

  return { price: null, targetDate, lookupOk: false, source: "none" }
}

/**
 * @param {ValidationPickRecord} record
 * @param {string} today
 */
function lockPickHorizons(record, today) {
  /** @type {ValidationPickRecord["horizonPrices"]} */
  const horizonPrices = { ...record.horizonPrices }
  /** @type {ValidationPickRecord["horizons"]} */
  const horizons = { ...record.horizons }
  /** @type {import("./ydsValidationPriceDebug.js").HorizonDef[]} */
  const auditHorizons = []

  const recommendPrice =
    record.recommendedPrice != null && record.recommendedPrice > 0
      ? record.recommendedPrice
      : null
  const country = record.country === "KR" ? "KR" : "US"

  for (const h of HORIZON_DAYS) {
    if (
      horizonPrices[h.key] != null &&
      Number.isFinite(horizonPrices[h.key]) &&
      isValidationDummyPrice(horizonPrices[h.key], recommendPrice, country)
    ) {
      horizonPrices[h.key] = null
      horizons[h.key] = null
    }

    if (horizonPrices[h.key] != null && Number.isFinite(horizonPrices[h.key])) {
      if (horizons[h.key] == null && recommendPrice != null) {
        const ret = calcRecommendReturnPct(recommendPrice, horizonPrices[h.key])
        horizons[h.key] = ret != null ? Math.round(ret * 10) / 10 : null
      }
      auditHorizons.push({
        key: h.key,
        label: h.label,
        target_date: addCalendarDays(record.recommendedAt, h.days),
        price: horizonPrices[h.key],
        return_pct: horizons[h.key],
        lookup_ok: true,
        source: "locked-existing",
      })
      continue
    }

    const resolved = resolveHorizonLockPrice(
      record.priceLog,
      record.recommendedAt,
      h.days,
      today,
      recommendPrice,
      country,
    )

    auditHorizons.push({
      key: h.key,
      label: h.label,
      target_date: resolved.targetDate,
      price: resolved.price,
      return_pct: null,
      lookup_ok: resolved.lookupOk,
      source: resolved.source,
    })

    if (resolved.price == null) continue

    horizonPrices[h.key] = resolved.price
    if (recommendPrice == null) continue

    const ret = calcRecommendReturnPct(recommendPrice, resolved.price)
    horizons[h.key] = ret != null ? Math.round(ret * 10) / 10 : null
    auditHorizons[auditHorizons.length - 1].return_pct = horizons[h.key]
  }

  const d7 = auditHorizons.find((x) => x.key === "d7")
  logValidationPickPriceAudit({
    symbol: record.ticker,
    recommend_price: recommendPrice,
    price7d: d7?.price ?? null,
    source: d7?.source ?? "none",
    horizons: auditHorizons.filter((x) => x.key === "d7" || x.key === "d14" || x.key === "d30"),
  })

  return { horizonPrices, horizons }
}

/**
 * @param {ValidationPickRecord} record
 * @param {string} today
 * @param {Map<string, number>} [priceMap]
 */
function refreshPickPrice(record, today, priceMap) {
  const cleaned = repairImmutableLedgerRecord(
    sanitizeValidationPickRecord(record),
    "refreshPickPrice:input",
  )
  const resolved = resolveValidationLivePrice(
    cleaned.ticker,
    cleaned.country,
    priceMap,
    cleaned.recommendedPrice,
  )
  let currentPrice = resolved?.price ?? null

  if (
    currentPrice != null &&
    isValidationDummyPrice(currentPrice, cleaned.recommendedPrice, cleaned.country)
  ) {
    logValidationPriceLookupFailure(cleaned.ticker, "rejected-dummy-100", {
      source: resolved?.source,
    })
    currentPrice = null
  }

  if (currentPrice == null && resolved == null) {
    logValidationPriceLookupFailure(cleaned.ticker, "no-live-quote", {
      country: cleaned.country,
    })
  }

  let priceLog = sanitizeValidationPriceLog(
    cleaned.priceLog,
    cleaned.recommendedPrice,
    cleaned.country,
  )
  if (currentPrice != null && priceLog[today] == null) {
    priceLog[today] = currentPrice
  }

  const withLog = { ...cleaned, priceLog }
  const { horizonPrices, horizons } = lockPickHorizons(withLog, today)
  const recommendPrice =
    cleaned.recommendedPrice != null && cleaned.recommendedPrice > 0
      ? cleaned.recommendedPrice
      : null
  const returnPct =
    recommendPrice != null && currentPrice != null
      ? calcRecommendReturnPct(recommendPrice, currentPrice)
      : null

  logRecommendProfitServerTrace({
    ticker: cleaned.ticker,
    recommendPrice,
    currentPrice,
    profitPercent: returnPct,
    source: resolved?.source ?? null,
  })

  const { maxReturnPct, minReturnPct } = resolveRunningReturnExtremes(cleaned, returnPct)

  return applyMutablePickUpdate(cleaned, {
    currentPrice,
    returnPct,
    maxReturnPct,
    minReturnPct,
    priceLog,
    horizonPrices,
    horizons,
    ledgerState: mapLifecycleToLedgerState(cleaned.lifecycleId, cleaned.statusId),
  })
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {number} [rankLimit]
 * @param {import("./ydsStockPickModel.js").StockPickView[]} [universeOverride]
 * @param {{ panicData?: object | null }} [options]
 */
export function captureTodayPickSnapshots(
  marketContext,
  rankLimit = 10,
  universeOverride = null,
  options = {},
) {
  const today = todayDateKey()
  const existing = loadValidationPicks().map((record) =>
    repairImmutableLedgerRecord(record, "captureTodayPickSnapshots:existing"),
  )

  const universe = universeOverride ?? getStockPickUniverse(marketContext ?? null)
  const usRanked = getRankingStocks(filterByCountry(universe, "US"), rankLimit)
  const krRanked = getRankingStocks(filterByCountry(universe, "KR"), rankLimit)

  const fresh = [...usRanked, ...krRanked]
    .filter((s) => {
      if (!s?.ticker) return false
      if (universeOverride) return s.dataSource === "live" && stockReadyForRecommendCapture(s)
      return stockReadyForRecommendCapture(s) || s.dataSource !== "live"
    })
    .filter((s) => {
      const country = s.country === "KR" ? "KR" : "US"
      const { marketDate } = resolveRecommendMarketAnchor(s, country)
      const anchorDate = marketDate ?? today
      return !existing.some(
        (p) =>
          p.country === country &&
          String(p.ticker).toUpperCase() === String(s.ticker).toUpperCase() &&
          resolvePickMarketDate(p) === anchorDate,
      )
    })
    .map((s) => pickRecordFromStock(s, marketContext, today, options))

  if (!fresh.length) return existing

  const merged = [...existing, ...fresh]
  saveValidationPicks(merged)
  return merged
}

/** @typedef {{ liveStocks?: import("./ydsStockPickModel.js").StockPickView[] | null; marketContext?: YdsMarketAdapterContext | null; panicData?: object | null }} RefreshValidationOptions */

/** @param {ValidationPickRecord[]} picks @param {Map<string, number>} [priceMap] @param {RefreshValidationOptions} [options] */
export function refreshValidationPicks(picks, priceMap, options = {}) {
  const today = todayDateKey()
  const map = priceMap ?? buildValidationPriceMap()
  const sanitized = sanitizeValidationPicks(picks).map((record) =>
    repairImmutableLedgerRecord(record, "refreshValidationPicks:sanitize"),
  )
  const { liveStocks = null, marketContext = null } = options
  /** @type {Map<string, import("./ydsStockPickModel.js").StockPickView>} */
  const stockByKey = new Map()
  if (liveStocks?.length) {
    for (const s of liveStocks) {
      if (!s?.ticker) continue
      const country = s.country === "KR" ? "KR" : "US"
      stockByKey.set(`${country}:${s.ticker}`, s)
    }
  }
  const refreshed = sanitized.map((r) => {
    const original = repairImmutableLedgerRecord(r, "refreshValidationPicks:before")
    const stock = stockByKey.get(`${r.country}:${r.ticker}`) ?? null
    const withSnap = isPickImmutableSealed(original)
      ? original
      : backfillRecommendSnapshot(original, stock, marketContext)
    const priced = refreshPickPrice(withSnap, today, map)
    const withLifecycle = updatePickLifecycle(priced, today, stock)
    const next = applyMutablePickUpdate(original, {
      currentPrice: withLifecycle.currentPrice,
      returnPct: withLifecycle.returnPct,
      maxReturnPct: withLifecycle.maxReturnPct,
      minReturnPct: withLifecycle.minReturnPct,
      priceLog: withLifecycle.priceLog,
      horizonPrices: withLifecycle.horizonPrices,
      horizons: withLifecycle.horizons,
      lifecycleId: withLifecycle.lifecycleId,
      lifecycleLabel: withLifecycle.lifecycleLabel,
      closedAt: withLifecycle.closedAt,
      closeReason: withLifecycle.closeReason,
      finalReturnPct: withLifecycle.finalReturnPct,
      ledgerState: mapLifecycleToLedgerState(
        withLifecycle.lifecycleId,
        withLifecycle.statusId,
      ),
    })
    if (
      isPickImmutableSealed(original) &&
      (next.recommendedPrice !== original.recommendedPrice ||
        next.lockedRecommendedPrice !== original.lockedRecommendedPrice ||
        next.recommendedAt !== original.recommendedAt)
    ) {
      logImmutableLedgerViolation("refreshValidationPicks", original, next)
    }
    return repairImmutableLedgerRecord(next, "refreshValidationPicks:after")
  })
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
