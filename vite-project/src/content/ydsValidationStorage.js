/**
 * Phase 7 — YDS 검증 레이어 저장소
 */

export const VALIDATION_PICKS_KEY = "yds-validation-picks-v2"
export const VALIDATION_PORTFOLIO_KEY = "yds-validation-portfolio-v2"
export const VALIDATION_BENCHMARK_KEY = "yds-validation-benchmarks-v1"
export const VALIDATION_REGIME_KEY = "yds-validation-regime-periods-v1"

const LEGACY_PICKS_KEY = "yds-validation-picks-v1"
const LEGACY_PORTFOLIO_KEY = "yds-validation-portfolio-v1"

const MAX_PICKS = 600
const MAX_PORTFOLIO_SNAPSHOTS = 400
const MAX_REGIME_PERIODS = 120

/**
 * @typedef {{
 *   d7: number | null
 *   d14: number | null
 *   d30: number | null
 *   d90: number | null
 *   d180: number | null
 *   d365: number | null
 * }} ValidationHorizonReturns
 */

/**
 * @typedef {{
 *   d7: number | null
 *   d14: number | null
 *   d30: number | null
 *   d90: number | null
 *   d180: number | null
 *   d365: number | null
 * }} ValidationHorizonPrices
 */

/**
 * @typedef {{
 *   id: string
 *   ticker: string
 *   name: string
 *   country: 'US' | 'KR'
 *   rank: number
 *   isTop3: boolean
 *   recommendedAt: string
 *   recommendedPrice: number
 *   recommendedScore: number | null
 *   qualityGrade: string
 *   timingGrade: string
 *   marketFitGrade: string
 *   statusId: string
 *   statusLabel: string
 *   currentPrice: number | null
 *   returnPct: number | null
 *   horizons: ValidationHorizonReturns
 *   horizonPrices: ValidationHorizonPrices
 *   priceLog: Record<string, number>
 *   regimeId: string
 *   regimeLabel: string
 *   strategyLabel: string
 *   recordedAt: number
 *   lastUpdatedAt: number
 * }} ValidationPickRecord
 */

/**
 * @typedef {{
 *   date: string
 *   totalAssets: number
 *   totalPnl: number
 *   totalReturnPct: number | null
 *   cashPct: number
 *   realizedPnl: number
 *   unrealizedPnl: number
 *   compliancePct: number | null
 *   recordedAt: number
 * }} ValidationPortfolioSnapshot
 */

/**
 * @typedef {import("./ydsValidationBenchmarks.js").BenchmarkId} BenchmarkId
 */

/**
 * @typedef {{
 *   id: string
 *   regimeId: string
 *   regimeLabel: string
 *   startDate: string
 *   endDate: string | null
 *   startBenchmarks: Record<BenchmarkId, number | null>
 *   endBenchmarks: Record<BenchmarkId, number | null> | null
 *   recordedAt: number
 * }} ValidationRegimePeriod
 */

const EMPTY_HORIZONS = {
  d7: null,
  d14: null,
  d30: null,
  d90: null,
  d180: null,
  d365: null,
}

const EMPTY_HORIZON_PRICES = {
  d7: null,
  d14: null,
  d30: null,
  d90: null,
  d180: null,
  d365: null,
}

/** @param {unknown} raw */
export function normalizePickRecord(raw) {
  const r = raw && typeof raw === "object" ? raw : {}
  const recommendedAt = String(r.recommendedAt ?? "").slice(0, 10)
  const rank = Number(r.rank) || 0
  const snap = r.snapshot && typeof r.snapshot === "object" ? r.snapshot : r
  const recommendedScoreRaw = snap.recommendedScore ?? r.recommendedScore
  const recommendedScore =
    recommendedScoreRaw != null && Number.isFinite(Number(recommendedScoreRaw))
      ? Number(recommendedScoreRaw)
      : null

  return /** @type {ValidationPickRecord} */ ({
    id: String(r.id ?? `${recommendedAt}:${r.country}:${r.ticker}`),
    ticker: String(r.ticker ?? ""),
    name: String(r.name ?? ""),
    country: r.country === "KR" ? "KR" : "US",
    rank,
    isTop3: r.isTop3 != null ? Boolean(r.isTop3) : rank > 0 && rank <= 3,
    recommendedAt,
    recommendedPrice: Number(r.recommendedPrice) || 0,
    recommendedScore,
    qualityGrade: String(snap.qualityGrade ?? r.qualityGrade ?? "—"),
    timingGrade: String(snap.timingGrade ?? r.timingGrade ?? "—"),
    marketFitGrade: String(snap.marketFitGrade ?? r.marketFitGrade ?? "—"),
    statusId: String(r.statusId ?? "interest"),
    statusLabel: String(r.statusLabel ?? "—"),
    currentPrice: r.currentPrice != null ? Number(r.currentPrice) : null,
    returnPct: r.returnPct != null ? Number(r.returnPct) : null,
    horizons: { ...EMPTY_HORIZONS, ...(r.horizons ?? {}) },
    horizonPrices: { ...EMPTY_HORIZON_PRICES, ...(r.horizonPrices ?? {}) },
    priceLog: r.priceLog && typeof r.priceLog === "object" ? r.priceLog : {},
    regimeId: String(r.regimeId ?? "neutral"),
    regimeLabel: String(r.regimeLabel ?? "—"),
    strategyLabel: String(r.strategyLabel ?? "—"),
    recordedAt: Number(r.recordedAt) || Date.now(),
    lastUpdatedAt: Number(r.lastUpdatedAt) || Date.now(),
  })
}

/** @returns {ValidationPickRecord[]} */
export function loadValidationPicks() {
  try {
    let raw = localStorage.getItem(VALIDATION_PICKS_KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_PICKS_KEY)
      if (legacy) raw = legacy
    }
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizePickRecord).filter((r) => r.id && r.ticker)
  } catch {
    return []
  }
}

/** @param {ValidationPickRecord[]} picks */
export function saveValidationPicks(picks) {
  try {
    localStorage.setItem(VALIDATION_PICKS_KEY, JSON.stringify(picks.slice(-MAX_PICKS)))
  } catch {
    /* ignore */
  }
}

/** @returns {ValidationPortfolioSnapshot[]} */
export function loadValidationPortfolioSnapshots() {
  try {
    let raw = localStorage.getItem(VALIDATION_PORTFOLIO_KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_PORTFOLIO_KEY)
      if (legacy) raw = legacy
    }
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => s && typeof s.date === "string")
      .map((s) => ({
        date: String(s.date).slice(0, 10),
        totalAssets: Number(s.totalAssets) || 0,
        totalPnl: Number(s.totalPnl) || 0,
        totalReturnPct:
          s.totalReturnPct != null && Number.isFinite(s.totalReturnPct) ? s.totalReturnPct : null,
        cashPct: Number(s.cashPct) || 0,
        realizedPnl: Number(s.realizedPnl) || 0,
        unrealizedPnl: Number(s.unrealizedPnl) || 0,
        compliancePct:
          s.compliancePct != null && Number.isFinite(s.compliancePct) ? s.compliancePct : null,
        recordedAt: Number(s.recordedAt) || Date.now(),
      }))
  } catch {
    return []
  }
}

/** @param {ValidationPortfolioSnapshot[]} snapshots */
export function saveValidationPortfolioSnapshots(snapshots) {
  try {
    localStorage.setItem(
      VALIDATION_PORTFOLIO_KEY,
      JSON.stringify(snapshots.slice(-MAX_PORTFOLIO_SNAPSHOTS)),
    )
  } catch {
    /* ignore */
  }
}

/** @returns {Record<string, Record<BenchmarkId, number | null>>} */
export function loadValidationBenchmarkLog() {
  try {
    const raw = localStorage.getItem(VALIDATION_BENCHMARK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** @param {Record<string, Record<BenchmarkId, number | null>>} log */
export function saveValidationBenchmarkLog(log) {
  try {
    const dates = Object.keys(log).sort()
    const trimmed = dates.slice(-400).reduce((acc, d) => {
      acc[d] = log[d]
      return acc
    }, /** @type {Record<string, Record<BenchmarkId, number | null>>} */ ({}))
    localStorage.setItem(VALIDATION_BENCHMARK_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}

/** @returns {ValidationRegimePeriod[]} */
export function loadValidationRegimePeriods() {
  try {
    const raw = localStorage.getItem(VALIDATION_REGIME_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p) => p && typeof p.id === "string")
  } catch {
    return []
  }
}

/** @param {ValidationRegimePeriod[]} periods */
export function saveValidationRegimePeriods(periods) {
  try {
    localStorage.setItem(VALIDATION_REGIME_KEY, JSON.stringify(periods.slice(-MAX_REGIME_PERIODS)))
  } catch {
    /* ignore */
  }
}
