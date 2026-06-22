/**
 * 성과검증 — 최대손실(MDD) 분석 (잠금·priceLog 실측 · AI 예측 없음)
 *
 * 최대 수익/손실 종목: 잠금 수익률 극값
 * MDD: 보유 구간 수익률 곡선 피크 대비 최대 낙폭 · 누적 곡선 보조
 */

import { calcRecommendReturnPct } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { addCalendarDays } from "./ydsValidationEngine.js"
import { PERF_HORIZONS } from "./ydsPickPerformanceEngine.js"
import { getLockedReturns, pickExtremesByReturn, summarizeLockedReturns } from "./ydsPickReturnStats.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */
/** @typedef {'d7' | 'd14' | 'd30'} MddHorizonKey */

/**
 * @typedef {{
 *   name: string
 *   ticker: string
 *   returnPct: number
 * } | null} MddExtremePick
 */

/**
 * @typedef {{
 *   key: MddHorizonKey
 *   label: string
 *   visible: boolean
 *   total: number
 *   maxGain: MddExtremePick
 *   maxLoss: MddExtremePick
 *   mdd: number | null
 *   avgReturn: number | null
 *   avgWin: number | null
 *   interpretations: string[]
 * }} MddHorizonRow
 */

/**
 * @typedef {{
 *   visible: boolean
 *   horizons: MddHorizonRow[]
 *   interpretations: string[]
 * }} MddAnalysisReport
 */

/** @param {number} v */
function round1(v) {
  return Math.round(v * 10) / 10
}

/** @param {number[]} returnsPct */
function computeMddFromReturnCurve(returnsPct) {
  if (!returnsPct.length) return null
  let peak = returnsPct[0]
  let mdd = 0
  for (const v of returnsPct) {
    peak = Math.max(peak, v)
    mdd = Math.min(mdd, v - peak)
  }
  return round1(mdd)
}

/**
 * @param {ValidationPickRecord} pick
 * @param {MddHorizonKey} horizonKey
 * @param {number} horizonDays
 */
function buildPickReturnPath(pick, horizonKey, horizonDays) {
  const entry = pick.recommendedPrice
  const start = pick.recommendedAt
  if (entry == null || entry <= 0 || !start) return []

  const endDate = addCalendarDays(start, horizonDays)
  /** @type {Record<string, number>} */
  const priceByDate = { ...(pick.priceLog ?? {}) }

  const lockPrice = pick.horizonPrices?.[horizonKey]
  if (lockPrice != null && Number.isFinite(lockPrice) && lockPrice > 0) {
    priceByDate[endDate] = lockPrice
  }

  const dates = Object.keys(priceByDate)
    .filter((d) => d >= start && d <= endDate)
    .sort()

  /** @type {number[]} */
  const returns = []
  for (const d of dates) {
    const p = priceByDate[d]
    if (p == null || !Number.isFinite(p) || p <= 0) continue
    const r = calcRecommendReturnPct(entry, p)
    if (r != null && Number.isFinite(r)) returns.push(round1(r))
  }
  return returns
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {MddHorizonKey} horizonKey
 */
function computePortfolioCumulativeMdd(picks, horizonKey) {
  const rows = (picks ?? [])
    .filter((p) => {
      const r = p.horizons?.[horizonKey]
      return r != null && Number.isFinite(r)
    })
    .sort((a, b) => a.recommendedAt.localeCompare(b.recommendedAt))

  if (!rows.length) return null

  let cumulative = 0
  /** @type {number[]} */
  const curve = []
  for (const p of rows) {
    cumulative = round1(cumulative + Number(p.horizons[horizonKey]))
    curve.push(cumulative)
  }
  return computeMddFromReturnCurve(curve)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {MddHorizonKey} horizonKey
 * @param {number} horizonDays
 */
function computeSystemMdd(picks, horizonKey, horizonDays) {
  const locked = (picks ?? []).filter((p) => {
    const r = p.horizons?.[horizonKey]
    return r != null && Number.isFinite(r)
  })

  /** @type {number[]} */
  const candidates = []

  for (const p of locked) {
    const path = buildPickReturnPath(p, horizonKey, horizonDays)
    if (path.length >= 2) {
      const intra = computeMddFromReturnCurve(path)
      if (intra != null) candidates.push(intra)
    }
  }

  const portfolio = computePortfolioCumulativeMdd(locked, horizonKey)
  if (portfolio != null) candidates.push(portfolio)

  if (candidates.length) return Math.min(...candidates)

  const { worst } = pickExtremesByReturn(picks, horizonKey)
  return worst?.returnPct != null ? round1(worst.returnPct) : null
}

/** @param {number[]} returns */
function avgWinOnly(returns) {
  const wins = (returns ?? []).filter((v) => v > 0)
  if (!wins.length) return null
  return round1(wins.reduce((s, v) => s + v, 0) / wins.length)
}

/**
 * @param {{
 *   mdd: number | null
 *   avgReturn: number | null
 *   avgWin: number | null
 *   maxGain: MddExtremePick
 *   maxLoss: MddExtremePick
 * }} row
 */
function deriveMddInterpretations(row) {
  if (row.mdd == null) return []

  /** @type {string[]} */
  const bullets = []
  const absMdd = Math.abs(row.mdd)

  if (row.avgWin != null && row.avgWin > absMdd && row.avgReturn != null && row.avgReturn > 0) {
    bullets.push("현재 전략은 최대 손실보다 평균 수익이 크게 우세")
  }

  if (absMdd >= 10 || (row.avgReturn != null && row.avgReturn < 0)) {
    bullets.push("손실 관리 필요")
  }

  if (row.maxGain?.returnPct != null && absMdd > 0) {
    const ratio = row.maxGain.returnPct / absMdd
    if (ratio >= 2) {
      bullets.push("최대 수익 대비 낙폭 비율이 높은 비대칭 구조")
    }
  }

  if (
    row.maxLoss?.returnPct != null &&
    absMdd > Math.abs(row.maxLoss.returnPct) + 0.5
  ) {
    bullets.push("종가 기준 손실보다 보유 중 일시 낙폭이 더 큼")
  }

  if (bullets.length < 2 && row.mdd != null && row.avgReturn != null && row.avgReturn > 0) {
    bullets.push(`기간 내 최대 낙폭 ${row.mdd}% · 평균 수익률 +${row.avgReturn}%`)
  }

  return [...new Set(bullets)].slice(0, 4)
}

/**
 * @param {ValidationPickRecord[]} picks
 * @returns {MddAnalysisReport}
 */
export function buildMddAnalysisReport(picks) {
  const horizons = PERF_HORIZONS.map((h) => {
    const returns = getLockedReturns(picks, h.key)
    const summary = summarizeLockedReturns(returns)
    const { best, worst } = pickExtremesByReturn(picks, h.key)
    const visible = summary.count > 0

    const row = {
      key: /** @type {MddHorizonKey} */ (h.key),
      label: h.label,
      visible,
      total: summary.count,
      maxGain: best,
      maxLoss: worst,
      mdd: visible ? computeSystemMdd(picks, h.key, h.days) : null,
      avgReturn: summary.avgReturn,
      avgWin: avgWinOnly(returns),
      interpretations: [],
    }

    row.interpretations = visible ? deriveMddInterpretations(row) : []
    return row
  })

  const visible = horizons.some((h) => h.visible)
  const primary =
    horizons.find((h) => h.key === "d7" && h.visible) ??
    horizons.find((h) => h.visible) ??
    null

  return {
    visible,
    horizons,
    interpretations: primary?.interpretations ?? [],
  }
}
