/**
 * 시장 상태 히스토리 — 최근 30일 상태 전환 기록
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { computeMarketPositionScore, resolveMarketPositionId } from "./ydsMarketPositionEngine.js"
import { toNum } from "./ydsLayerHistory.js"
import { buildMarketCycleFlowReport } from "./ydsMarketCycleFlow.js"

const STORAGE_KEY = "yds-market-state-history-v1"
const MAX_ENTRIES = 45

/**
 * @typedef {{
 *   date: string
 *   unifiedLabel: string
 *   panicScore: number | null
 *   marketScore: number | null
 *   liquidityScore: number | null
 *   changeReason: string | null
 *   capturedAt: string
 * }} MarketStateHistoryEntry
 */

/** @returns {MarketStateHistoryEntry[]} */
export function loadMarketStateHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** @param {MarketStateHistoryEntry[]} entries */
export function saveMarketStateHistory(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {MarketStateHistoryEntry} entry
 * @param {MarketStateHistoryEntry[]} [existing]
 */
export function appendMarketStateHistory(entry, existing = loadMarketStateHistory()) {
  const list = [...existing]
  const last = list[list.length - 1]
  if (last?.date === entry.date && last?.unifiedLabel === entry.unifiedLabel) {
    list[list.length - 1] = { ...last, ...entry, capturedAt: entry.capturedAt ?? last.capturedAt }
  } else {
    list.push(entry)
  }
  saveMarketStateHistory(list)
  return list
}

/**
 * @param {object[]} historyRows
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null} cycleFlow
 * @param {object | null} panicData
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 * @param {number} [windowDays]
 * @returns {MarketStateHistoryEntry[]}
 */
export function buildMarketStateHistoryView(
  historyRows,
  cycleFlow,
  panicData,
  dualLiquidity,
  windowDays = 30,
) {
  const sorted = [...(historyRows ?? [])]
    .filter((r) => r?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const windowed = sorted.slice(-windowDays)

  /** @type {MarketStateHistoryEntry[]} */
  const entries = []
  let prevLabel = null

  for (const row of windowed) {
    const slice = sorted.filter((r) => String(r.date).slice(0, 10) <= String(row.date).slice(0, 10))
    const flow = buildMarketCycleFlowReport(slice, windowDays)
    const label = flow.currentCycleLabel ?? "—"
    const cnn = toNum(row.fearGreed)
    const vix = toNum(row.vix)
    const bofa = toNum(row.bofa)
    const posId = resolveMarketPositionId(cnn, vix, bofa)
    const marketScore = computeMarketPositionScore(cnn, vix, bofa, posId)

    const changeReason =
      label !== prevLabel
        ? flow.recoveryGate?.reason ??
          flow.etfSensitivity?.reason ??
          (prevLabel ? `${prevLabel} → ${label}` : "초기 판정")
        : null

    entries.push({
      date: String(row.date).slice(0, 10),
      unifiedLabel: label,
      panicScore: null,
      marketScore,
      liquidityScore: dualLiquidity?.marketScore ?? null,
      changeReason,
      capturedAt: String(row.date).slice(0, 10),
    })
    prevLabel = label
  }

  if (panicData && entries.length) {
    const panic = Math.round(getFinalScore(panicData) ?? NaN)
    if (Number.isFinite(panic)) {
      entries[entries.length - 1].panicScore = panic
    }
    if (dualLiquidity?.marketScore != null) {
      entries[entries.length - 1].liquidityScore = dualLiquidity.marketScore
    }
    if (cycleFlow?.currentCycleLabel) {
      entries[entries.length - 1].unifiedLabel = cycleFlow.currentCycleLabel
    }
  }

  return entries.reverse()
}

/**
 * @param {{
 *   date: string
 *   unifiedLabel: string
 *   panicScore?: number | null
 *   marketScore?: number | null
 *   liquidityScore?: number | null
 *   changeReason?: string | null
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 * }} input
 */
export function captureTodayMarketStateHistory(input) {
  const reason =
    input.changeReason ??
    input.cycleFlow?.recoveryGate?.reason ??
    input.cycleFlow?.etfSensitivity?.reason ??
    null

  return appendMarketStateHistory({
    date: input.date,
    unifiedLabel: input.unifiedLabel,
    panicScore: input.panicScore ?? null,
    marketScore: input.marketScore ?? null,
    liquidityScore: input.liquidityScore ?? null,
    changeReason: reason,
    capturedAt: new Date().toISOString(),
  })
}
