/**
 * 시장 상태 — 최근 변경 이력 (중복 제거 · 최대 5건)
 */

import { buildMarketStateHistoryView } from "./ydsMarketStateHistory.js"
import { localCalendarDateKey, parseCalendarDateKey } from "../utils/calendarDateUtils.js"

/**
 * @typedef {{
 *   date: string
 *   daysAgo: number
 *   daysAgoLabel: string
 *   fromLabel: string
 *   toLabel: string
 *   isCurrent: boolean
 * }} MarketStateChangeItem
 */

/**
 * @param {string} dateKey
 * @param {Date} refDate
 */
function daysBetween(dateKey, refDate) {
  const end = parseCalendarDateKey(localCalendarDateKey(refDate))
  const start = parseCalendarDateKey(String(dateKey).slice(0, 10))
  if (!end || !start) return 0
  const ms = end.getTime() - start.getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** @param {number} days */
function formatDaysAgoLabel(days) {
  if (days <= 0) return "오늘"
  return `${days}일 전`
}

/**
 * @param {object[]} historyRows
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null} cycleFlow
 * @param {object | null} panicData
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 * @param {{ refDate?: Date; maxItems?: number; windowDays?: number }} [opts]
 * @returns {{ visible: boolean; items: MarketStateChangeItem[]; currentLabel: string | null }}
 */
export function buildRecentMarketStateChanges(
  historyRows,
  cycleFlow,
  panicData,
  dualLiquidity,
  opts = {},
) {
  const refDate = opts.refDate ?? new Date()
  const maxItems = opts.maxItems ?? 5
  const windowDays = opts.windowDays ?? 30

  const entries = buildMarketStateHistoryView(
    historyRows,
    cycleFlow,
    panicData,
    dualLiquidity,
    windowDays,
  )

  if (!entries.length) {
    return { visible: false, items: [], currentLabel: null }
  }

  const currentLabel = entries[entries.length - 1]?.unifiedLabel ?? null
  /** @type {MarketStateChangeItem[]} */
  const items = []
  let prevLabel = null

  for (const entry of entries) {
    const label = entry.unifiedLabel
    if (prevLabel != null && label !== prevLabel) {
      items.push({
        date: entry.date,
        daysAgo: daysBetween(entry.date, refDate),
        daysAgoLabel: formatDaysAgoLabel(daysBetween(entry.date, refDate)),
        fromLabel: prevLabel,
        toLabel: label,
        isCurrent: false,
      })
    }
    prevLabel = label
  }

  const trimmed = items.slice(-maxItems)
  if (trimmed.length) {
    trimmed[trimmed.length - 1].isCurrent = true
  }

  return {
    visible: trimmed.length > 0,
    items: trimmed,
    currentLabel,
  }
}
