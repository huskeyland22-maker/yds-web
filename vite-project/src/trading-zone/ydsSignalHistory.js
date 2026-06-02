import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMacroStageAllocation } from "./macroStageAllocation.js"
import { PANIC_VALIDATION_EXTENDED_HISTORY } from "./panicValidationExtendedHistory.js"

/** @type {Array<{ key: "m1" | "m3" | "m6" | "m12"; minDays: number }>} */
export const YDS_FORWARD_HORIZONS = [
  { key: "m1", minDays: 30 },
  { key: "m3", minDays: 90 },
  { key: "m6", minDays: 180 },
  { key: "m12", minDays: 365 },
]

/** @param {object} row */
function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

/**
 * @param {object[]} rows
 * @returns {object[]}
 */
export function mergeYdsSourceHistory(rows) {
  const byDate = new Map()
  for (const r of [...PANIC_VALIDATION_EXTENDED_HISTORY, ...(rows ?? [])]) {
    const d = rowDateKey(r)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    byDate.set(d, { ...byDate.get(d), ...r, date: d, ts: `${d}T12:00:00.000Z` })
  }
  return sortHistoryRowsAsc([...byDate.values()])
}

/**
 * @param {object} prev
 * @param {object} cur
 */
export function estimateYdsMarketPeriodReturn(prev, cur) {
  const fg0 = Number(prev?.fearGreed)
  const fg1 = Number(cur?.fearGreed)
  const vix0 = Number(prev?.vix)
  const vix1 = Number(cur?.vix)
  let ret = 0
  if (Number.isFinite(fg0) && Number.isFinite(fg1)) ret += (fg1 - fg0) / 400
  if (Number.isFinite(vix0) && Number.isFinite(vix1) && vix0 > 0) ret += (vix0 - vix1) / (vix0 * 8)
  return ret
}

/**
 * @param {object[]} sortedAsc
 */
export function pickYdsWeeklySteps(sortedAsc) {
  if (!sortedAsc.length) return []
  const out = [sortedAsc[0]]
  let last = rowDateKey(sortedAsc[0])
  for (let i = 1; i < sortedAsc.length; i++) {
    const row = sortedAsc[i]
    const d = rowDateKey(row)
    if (!d) continue
    const gapDays =
      (new Date(`${d}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000
    if (gapDays >= 5) {
      out.push(row)
      last = d
    }
  }
  const tail = sortedAsc[sortedAsc.length - 1]
  if (rowDateKey(tail) !== rowDateKey(out[out.length - 1])) out.push(tail)
  return out
}

/**
 * @param {object[]} steps
 * @param {number} entryIdx
 * @param {Array<{ key: "m1"|"m3"|"m6"|"m12"; minDays: number }>} [horizons]
 */
export function calcForwardReturnMap(steps, entryIdx, horizons = YDS_FORWARD_HORIZONS) {
  const entry = steps[entryIdx]
  const entryDate = rowDateKey(entry)
  const entryTs = new Date(`${entryDate}T12:00:00`).getTime()
  /** @type {Record<"m1"|"m3"|"m6"|"m12", number | null>} */
  const returns = { m1: null, m3: null, m6: null, m12: null }

  for (const h of horizons) {
    let growth = 1
    let found = false
    for (let j = entryIdx + 1; j < steps.length; j++) {
      const prev = steps[j - 1]
      const cur = steps[j]
      const d = rowDateKey(cur)
      if (!d) continue
      const curTs = new Date(`${d}T12:00:00`).getTime()
      growth *= 1 + estimateYdsMarketPeriodReturn(prev, cur)
      if ((curTs - entryTs) / 86_400_000 >= h.minDays) {
        returns[h.key] = (growth - 1) * 100
        found = true
        break
      }
    }
    if (!found) returns[h.key] = null
  }
  return returns
}

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   ydsScore: number
 *   marketStageId: string
 *   marketStageLabel: string
 *   marketStageEmoji: string
 *   sp500Proxy: number
 *   allocation: { stockPct: number; cashPct: number; stockLabel: string; cashLabel: string }
 *   forwardReturns: Record<"m1"|"m3"|"m6"|"m12", number | null>
 * }} YdsSignalHistoryRecord
 */

/**
 * YDS 신호 변경 이력 공통 데이터 엔진.
 * @param {object[]} historyRows
 * @param {{ maxRecords?: number }} [options]
 * @returns {YdsSignalHistoryRecord[]}
 */
export function buildYdsSignalHistory(historyRows, options = {}) {
  const maxRecords = options.maxRecords ?? 200
  const merged = mergeYdsSourceHistory(historyRows)
  const steps = pickYdsWeeklySteps(merged)
  if (!steps.length) return []

  /** @type {YdsSignalHistoryRecord[]} */
  const out = []
  let prevStageId = null
  let bench = 100
  /** @type {number[]} */
  const benchByIndex = [bench]

  for (let i = 1; i < steps.length; i++) {
    bench *= 1 + estimateYdsMarketPeriodReturn(steps[i - 1], steps[i])
    benchByIndex.push(bench)
  }

  for (let i = 0; i < steps.length; i++) {
    const row = steps[i]
    const panic = panicDataFromCycleRow(row)
    if (!panic) continue
    const score = getFinalScore(panic)
    if (!Number.isFinite(score)) continue
    const stage = resolveMacroV1Status(score)
    if (!stage) continue

    // 신호 단계가 바뀔 때만 신규 레코드 생성
    if (stage.id === prevStageId) continue
    prevStageId = stage.id

    const alloc = resolveMacroStageAllocation(stage.id)
    if (!alloc) continue
    const date = rowDateKey(row)
    out.push({
      id: `${date}-${stage.id}`,
      date,
      ydsScore: Math.round(score),
      marketStageId: stage.id,
      marketStageLabel: stage.label,
      marketStageEmoji: stage.emoji,
      sp500Proxy: Number((benchByIndex[i] ?? 100).toFixed(2)),
      allocation: {
        stockPct: alloc.stockPct,
        cashPct: alloc.cashPct,
        stockLabel: alloc.stockLabel,
        cashLabel: alloc.cashLabel,
      },
      forwardReturns: calcForwardReturnMap(steps, i),
    })
    if (out.length >= maxRecords) break
  }

  return out
}
