/**
 * YDS V1.9 Event Scorecard — 표시·통계 전용 (점수·구간 무관)
 * 이벤트 발생 후 SPY(^GSPC) 3·7·14 거래일 수익률로 과거 적중률 산출
 */

import { scanTimelineEventsFromSeries } from "./ydsMarketTimeline.js"
import { rowDate } from "./ydsLayerHistory.js"

/** @typedef {'up' | 'down'} WinDirection */

/**
 * @typedef {{
 *   type: string
 *   title: string
 *   winDirection: WinDirection
 * }} ScorecardEventConfig
 */

/** @type {ScorecardEventConfig[]} */
export const SCORECARD_EVENT_CONFIG = [
  { type: "cnn-entry", title: "CNN 과열권 진입", winDirection: "down" },
  { type: "cnn-exit", title: "CNN 과열권 이탈", winDirection: "up" },
  { type: "bofa-entry", title: "BofA 과열권 진입", winDirection: "down" },
  { type: "bofa-exit", title: "BofA 과열권 이탈", winDirection: "up" },
  { type: "momentum-cnn-sharp", title: "투자심리 급랭", winDirection: "up" },
  { type: "momentum-bofa-weak", title: "Bull & Bear 악화", winDirection: "up" },
  { type: "overheat-cashPrep", title: "현금 준비 진입", winDirection: "down" },
  { type: "overheat-partialCash", title: "현금 확보 진입", winDirection: "down" },
  { type: "overheat-boundary", title: "과열 경계", winDirection: "down" },
]

export const SCORECARD_HORIZONS = [3, 7, 14]

export const SCORECARD_MIN_EVENTS = 3

/** @type {Record<string, ScorecardEventConfig>} */
export const SCORECARD_CONFIG_BY_TYPE = Object.fromEntries(
  SCORECARD_EVENT_CONFIG.map((c) => [c.type, c]),
)

/**
 * @typedef {{
 *   horizon: number
 *   returnPct: number
 *   win: boolean
 *   maxDrawdownPct: number
 * }} EventHorizonStat
 */

/**
 * @typedef {{
 *   type: string
 *   title: string
 *   eventCount: number
 *   winRate: number | null
 *   avgReturnPct: Record<number, number | null>
 *   maxDrawdownPct: number | null
 *   grade: string
 *   gradeLabel: string
 *   insufficient: boolean
 *   horizons: Record<number, { wins: number; total: number; avgReturn: number | null }>
 * }} EventTypeScorecard
 */

/**
 * @typedef {Record<string, EventTypeScorecard>} EventScorecardMap
 */

/**
 * @param {Record<string, number>} pricesByDate
 */
export function normalizeSpyPriceSeries(pricesByDate) {
  if (!pricesByDate || typeof pricesByDate !== "object") {
    return { sortedDates: [], prices: {} }
  }
  const sortedDates = Object.keys(pricesByDate)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Number(pricesByDate[d])))
    .sort((a, b) => a.localeCompare(b))
  const prices = {}
  for (const d of sortedDates) {
    prices[d] = Number(pricesByDate[d])
  }
  return { sortedDates, prices }
}

/**
 * @param {string[]} sortedDates
 * @param {string} eventDate
 */
function indexOnOrAfter(sortedDates, eventDate) {
  for (let i = 0; i < sortedDates.length; i += 1) {
    if (sortedDates[i] >= eventDate) return i
  }
  return -1
}

/**
 * @param {number} startPrice
 * @param {number[]} pathPrices
 */
function maxDrawdownPctFromPath(startPrice, pathPrices) {
  if (!Number.isFinite(startPrice) || startPrice <= 0 || !pathPrices.length) return null
  let peak = startPrice
  let maxDd = 0
  for (const p of pathPrices) {
    if (!Number.isFinite(p)) continue
    peak = Math.max(peak, p)
    const dd = (p - peak) / peak
    if (dd < maxDd) maxDd = dd
  }
  return Math.round(maxDd * 1000) / 10
}

/**
 * @param {string[]} sortedDates
 * @param {Record<string, number>} prices
 * @param {number} startIdx
 * @param {number} horizonDays
 */
function forwardReturnPct(sortedDates, prices, startIdx, horizonDays) {
  const startDate = sortedDates[startIdx]
  const endIdx = startIdx + horizonDays
  if (endIdx >= sortedDates.length) return null
  const start = prices[startDate]
  const end = prices[sortedDates[endIdx]]
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null
  const path = []
  for (let i = startIdx; i <= endIdx && i < sortedDates.length; i += 1) {
    path.push(prices[sortedDates[i]])
  }
  const ret = ((end - start) / start) * 100
  return {
    returnPct: Math.round(ret * 10) / 10,
    maxDrawdownPct: maxDrawdownPctFromPath(start, path),
  }
}

/**
 * @param {number | null} returnPct
 * @param {WinDirection} winDirection
 */
export function isEventWin(returnPct, winDirection) {
  if (returnPct == null || !Number.isFinite(returnPct)) return false
  return winDirection === "up" ? returnPct > 0 : returnPct <= 0
}

/**
 * @param {number | null} winRate 0–1
 * @param {number} eventCount
 */
export function resolveScorecardGrade(winRate, eventCount) {
  if (eventCount < SCORECARD_MIN_EVENTS || winRate == null) {
    return { grade: "D", label: "D", display: "D", insufficient: true }
  }
  const pct = winRate * 100
  if (pct >= 75) return { grade: "A", label: "A+", display: "A+", insufficient: false }
  if (pct >= 70) return { grade: "A", label: "A", display: "A", insufficient: false }
  if (pct >= 65) return { grade: "B", label: "B+", display: "B+", insufficient: false }
  if (pct >= 60) return { grade: "B", label: "B", display: "B", insufficient: false }
  if (pct >= 50) return { grade: "C", label: "C", display: "C", insufficient: false }
  return { grade: "C", label: "C", display: "C", insufficient: false }
}

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 * @param {Record<string, number>} pricesByDate
 * @param {{ primaryHorizon?: number }} [opts]
 */
export function buildEventScorecard(historyRows, panicData, pricesByDate, opts = {}) {
  const primaryHorizon = opts.primaryHorizon ?? 14
  const { sortedDates, prices } = normalizeSpyPriceSeries(pricesByDate)
  if (!sortedDates.length) return { byType: /** @type {EventScorecardMap} */ ({}), rows: [] }

  const map = new Map()
  for (const row of historyRows ?? []) {
    const d = rowDate(row)
    if (!d) continue
    map.set(d, { ...map.get(d), ...row, date: d })
  }
  const asOf = rowDate(panicData)
  if (asOf) map.set(asOf, { ...map.get(asOf), ...panicData, date: asOf })
  const series = [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const allEvents = scanTimelineEventsFromSeries(series).filter((ev) => SCORECARD_CONFIG_BY_TYPE[ev.type])

  /** @type {Record<string, { returns: Record<number, number[]>; drawdowns: number[]; wins: Record<number, number>; totals: Record<number, number> }>} */
  const acc = {}

  for (const cfg of SCORECARD_EVENT_CONFIG) {
    acc[cfg.type] = {
      returns: { 3: [], 7: [], 14: [] },
      drawdowns: [],
      wins: { 3: 0, 7: 0, 14: 0 },
      totals: { 3: 0, 7: 0, 14: 0 },
    }
  }

  for (const ev of allEvents) {
    const cfg = SCORECARD_CONFIG_BY_TYPE[ev.type]
    if (!cfg) continue
    const idx = indexOnOrAfter(sortedDates, ev.date)
    if (idx < 0) continue
    const bucket = acc[ev.type]
    if (!bucket) continue

    for (const h of SCORECARD_HORIZONS) {
      const fwd = forwardReturnPct(sortedDates, prices, idx, h)
      if (!fwd) continue
      bucket.returns[h].push(fwd.returnPct)
      bucket.totals[h] += 1
      if (isEventWin(fwd.returnPct, cfg.winDirection)) bucket.wins[h] += 1
      if (h === primaryHorizon && fwd.maxDrawdownPct != null) {
        bucket.drawdowns.push(fwd.maxDrawdownPct)
      }
    }
  }

  /** @type {EventTypeScorecard[]} */
  const rows = SCORECARD_EVENT_CONFIG.map((cfg) => {
    const bucket = acc[cfg.type]
    const eventCount = bucket.returns[primaryHorizon].length
    const winRate =
      bucket.totals[primaryHorizon] > 0
        ? bucket.wins[primaryHorizon] / bucket.totals[primaryHorizon]
        : null

    /** @type {Record<number, number | null>} */
    const avgReturnPct = {}
    /** @type {Record<number, { wins: number; total: number; avgReturn: number | null }>} */
    const horizons = {}
    for (const h of SCORECARD_HORIZONS) {
      const arr = bucket.returns[h]
      horizons[h] = {
        wins: bucket.wins[h],
        total: bucket.totals[h],
        avgReturn:
          arr.length > 0
            ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
            : null,
      }
      avgReturnPct[h] = horizons[h].avgReturn
    }

    const maxDrawdownPct =
      bucket.drawdowns.length > 0
        ? Math.round((bucket.drawdowns.reduce((a, b) => a + b, 0) / bucket.drawdowns.length) * 10) / 10
        : null

    const gradeInfo = resolveScorecardGrade(winRate, eventCount)

    return {
      type: cfg.type,
      title: cfg.title,
      eventCount,
      winRate,
      avgReturnPct,
      maxDrawdownPct,
      grade: gradeInfo.grade,
      gradeLabel: gradeInfo.display,
      insufficient: gradeInfo.insufficient,
      horizons,
    }
  }).filter((r) => r.eventCount > 0)

  rows.sort((a, b) => b.eventCount - a.eventCount)

  /** @type {EventScorecardMap} */
  const byType = {}
  for (const row of rows) {
    byType[row.type] = row
  }
  for (const cfg of SCORECARD_EVENT_CONFIG) {
    if (!byType[cfg.type]) {
      const gradeInfo = resolveScorecardGrade(null, 0)
      byType[cfg.type] = {
        type: cfg.type,
        title: cfg.title,
        eventCount: 0,
        winRate: null,
        avgReturnPct: { 3: null, 7: null, 14: null },
        maxDrawdownPct: null,
        grade: gradeInfo.grade,
        gradeLabel: gradeInfo.display,
        insufficient: true,
        horizons: {
          3: { wins: 0, total: 0, avgReturn: null },
          7: { wins: 0, total: 0, avgReturn: null },
          14: { wins: 0, total: 0, avgReturn: null },
        },
      }
    }
  }

  return { byType, rows }
}

/**
 * @param {string} eventTypeOrId
 * @param {EventScorecardMap | null | undefined} byType
 */
export function scorecardGradeForEvent(eventTypeOrId, byType) {
  if (!eventTypeOrId || !byType) return null
  const row = byType[eventTypeOrId]
  if (!row || row.insufficient) return null
  return row.gradeLabel
}
