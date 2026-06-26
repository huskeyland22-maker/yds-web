/**
 * 시장 상태 — 변화 이력 Vertical Timeline (구간별 · Tooltip · 최대 5건)
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { localCalendarDateKey, parseCalendarDateKey } from "../utils/calendarDateUtils.js"
import { computeMarketPositionScore, resolveMarketPositionId } from "./ydsMarketPositionEngine.js"
import { toNum } from "./ydsLayerHistory.js"
import { buildMarketCycleFlowReport } from "./ydsMarketCycleFlow.js"

/**
 * @typedef {{
 *   marketScore: number | null
 *   panicScore: number | null
 *   nasdaq: number | null
 *   sp500: number | null
 *   vix: number | null
 * }} MarketStateTimelineSnapshot
 */

/**
 * @typedef {{
 *   label: string
 *   startDate: string
 *   endDate: string
 *   durationDays: number
 *   durationLabel: string
 *   dateRangeLabel: string
 *   isCurrent: boolean
 *   snapshot: MarketStateTimelineSnapshot
 *   tooltipLines: string[]
 * }} MarketStateTimelineSegment
 */

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   segments: MarketStateTimelineSegment[]
 * }} MarketStateChangeTimelineReport
 */

/** @param {string} dateKey */
function formatDateDot(dateKey) {
  const [y, m, d] = String(dateKey).slice(0, 10).split("-")
  if (!y || !m || !d) return dateKey
  return `${y}.${m}.${d}`
}

/**
 * @param {string} startKey
 * @param {string} endKey
 */
function inclusiveDurationDays(startKey, endKey) {
  const start = parseCalendarDateKey(startKey)
  const end = parseCalendarDateKey(endKey)
  if (!start || !end) return 1
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

/**
 * @param {Record<string, number> | null | undefined} prices
 * @param {string} dateKey
 */
function lookupEtfClosePrice(prices, dateKey) {
  if (!prices || typeof prices !== "object") return null
  const key = String(dateKey).slice(0, 10)
  if (prices[key] != null && Number.isFinite(Number(prices[key]))) {
    return Number(prices[key])
  }
  const base = parseCalendarDateKey(key)
  if (!base) return null
  for (let i = 1; i <= 7; i += 1) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const probe = localCalendarDateKey(d)
    if (prices[probe] != null && Number.isFinite(Number(prices[probe]))) {
      return Number(prices[probe])
    }
  }
  return null
}

/** @param {MarketStateTimelineSnapshot} snapshot */
function buildTooltipLines(snapshot) {
  /** @type {string[]} */
  const lines = []
  if (snapshot.marketScore != null) lines.push(`시장점수 ${snapshot.marketScore}`)
  if (snapshot.panicScore != null) lines.push(`패닉점수 ${snapshot.panicScore}`)
  if (snapshot.nasdaq != null) lines.push(`NASDAQ ${snapshot.nasdaq.toLocaleString("en-US")}`)
  if (snapshot.sp500 != null) lines.push(`S&P500 ${snapshot.sp500.toLocaleString("en-US")}`)
  if (snapshot.vix != null) lines.push(`VIX ${snapshot.vix}`)
  return lines
}

/**
 * @param {object[]} historyRows
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null} cycleFlow
 * @param {object | null} panicData
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 * @param {{
 *   refDate?: Date
 *   maxItems?: number
 *   windowDays?: number
 *   etfContext?: { qqqPrices?: Record<string, number>; spyPrices?: Record<string, number> } | null
 * }} [opts]
 * @returns {MarketStateChangeTimelineReport}
 */
export function buildMarketStateChangeTimeline(
  historyRows,
  cycleFlow,
  panicData,
  dualLiquidity,
  opts = {},
) {
  const refDate = opts.refDate ?? new Date()
  const maxItems = opts.maxItems ?? 5
  const windowDays = opts.windowDays ?? 90
  const etfContext = opts.etfContext ?? null

  const sorted = [...(historyRows ?? [])]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const windowed = sorted.slice(-windowDays)

  if (!windowed.length) {
    return { visible: false, title: "시장 상태 변화 이력", segments: [] }
  }

  /** @type {Array<{
   *   date: string
   *   label: string
   *   snapshot: MarketStateTimelineSnapshot
   * }>} */
  const daily = []

  for (const row of windowed) {
    const date = String(row.date).slice(0, 10)
    const slice = sorted.filter((r) => String(r.date).slice(0, 10) <= date)
    const flow = buildMarketCycleFlowReport(slice, windowDays)
    const label = flow.currentCycleLabel ?? "—"
    const cnn = toNum(row.fearGreed)
    const vix = toNum(row.vix)
    const bofa = toNum(row.bofa)
    const posId = resolveMarketPositionId(cnn, vix, bofa)
    const marketScore = computeMarketPositionScore(cnn, vix, bofa, posId)
    const panicScore = Math.round(
      getFinalScore({
        vix: row.vix,
        fearGreed: row.fearGreed,
        bofa: row.bofa,
        putCall: row.putCall,
        highYield: row.highYield,
      }) ?? NaN,
    )

    daily.push({
      date,
      label,
      snapshot: {
        marketScore: Number.isFinite(marketScore) ? marketScore : null,
        panicScore: Number.isFinite(panicScore) ? panicScore : null,
        nasdaq: lookupEtfClosePrice(etfContext?.qqqPrices, date),
        sp500: lookupEtfClosePrice(etfContext?.spyPrices, date),
        vix: Number.isFinite(vix) ? vix : null,
      },
    })
  }

  /** @type {Array<{
   *   label: string
   *   startDate: string
   *   endDate: string
   *   snapshot: MarketStateTimelineSnapshot
   * }>} */
  const rawSegments = []

  for (const day of daily) {
    const last = rawSegments[rawSegments.length - 1]
    if (!last || last.label !== day.label) {
      rawSegments.push({
        label: day.label,
        startDate: day.date,
        endDate: day.date,
        snapshot: day.snapshot,
      })
    } else {
      last.endDate = day.date
    }
  }

  if (!rawSegments.length) {
    return { visible: false, title: "시장 상태 변화 이력", segments: [] }
  }

  const lastSegment = rawSegments[rawSegments.length - 1]
  if (cycleFlow?.currentCycleLabel) {
    lastSegment.label = cycleFlow.currentCycleLabel
  }
  if (panicData) {
    const panic = Math.round(getFinalScore(panicData) ?? NaN)
    if (Number.isFinite(panic)) {
      lastSegment.snapshot.panicScore = panic
    }
    const cnn = toNum(panicData.fearGreed)
    const vix = toNum(panicData.vix)
    const bofa = toNum(panicData.bofa)
    const posId = resolveMarketPositionId(cnn, vix, bofa)
    const marketScore = computeMarketPositionScore(cnn, vix, bofa, posId)
    if (Number.isFinite(marketScore)) {
      lastSegment.snapshot.marketScore = marketScore
    }
    const vixLive = toNum(panicData.vix)
    if (Number.isFinite(vixLive)) {
      lastSegment.snapshot.vix = vixLive
    }
  }

  const todayKey = localCalendarDateKey(refDate)
  const lastHistoryDate = daily[daily.length - 1]?.date ?? todayKey
  lastSegment.endDate = todayKey >= lastHistoryDate ? todayKey : lastHistoryDate

  const trimmed = rawSegments.slice(-maxItems)

  /** @type {MarketStateTimelineSegment[]} */
  const segments = trimmed.map((seg, index) => {
    const isCurrent = index === trimmed.length - 1
    const durationDays = inclusiveDurationDays(seg.startDate, seg.endDate)
    const dateRangeLabel = isCurrent
      ? `${formatDateDot(seg.startDate)} ~ 진행중`
      : `${formatDateDot(seg.startDate)} ~ ${formatDateDot(seg.endDate)}`

    return {
      label: seg.label,
      startDate: seg.startDate,
      endDate: seg.endDate,
      durationDays,
      durationLabel: `${durationDays}일 유지`,
      dateRangeLabel,
      isCurrent,
      snapshot: seg.snapshot,
      tooltipLines: buildTooltipLines(seg.snapshot),
    }
  })

  return {
    visible: segments.length > 0,
    title: "시장 상태 변화 이력",
    segments,
  }
}

/** @deprecated use buildMarketStateChangeTimeline */
export function buildRecentMarketStateChanges(
  historyRows,
  cycleFlow,
  panicData,
  dualLiquidity,
  opts = {},
) {
  const report = buildMarketStateChangeTimeline(
    historyRows,
    cycleFlow,
    panicData,
    dualLiquidity,
    opts,
  )
  return {
    visible: report.visible,
    items: report.segments.map((seg) => ({
      date: seg.startDate,
      daysAgo: 0,
      daysAgoLabel: seg.isCurrent ? "현재" : formatDateDot(seg.startDate),
      fromLabel: seg.label,
      toLabel: seg.label,
      isCurrent: seg.isCurrent,
    })),
    currentLabel: report.segments[report.segments.length - 1]?.label ?? null,
  }
}
