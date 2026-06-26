/**
 * 메인 대시보드 — 시장 사이클 흐름 (cycleMetricHistory 실측 · AI 예측 없음)
 */

import { rowsWithinDays, toNum } from "./ydsLayerHistory.js"
import {
  computeMarketPositionScore,
  MARKET_POSITION_STAGES,
  resolveMarketPositionId,
} from "./ydsMarketPositionEngine.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { applyEtfSensitivityToCycleFlow } from "./ydsMarketCycleEtfSensitivity.js"
import {
  applyRecoveryConfirmationGate,
  RECOVERY_GATE_THRESHOLDS,
} from "./ydsMarketCycleRecoveryGate.js"

export const MARKET_CYCLE_FLOW_DAYS = 30

/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */
/** @typedef {'진입' | '안정화' | '회복중' | '약화'} CyclePhase */

/**
 * @typedef {{
 *   label: string
 *   daysGap: number | null
 *   isCurrent: boolean
 *   date: string
 * }} CycleFlowStep
 */

/**
 * @typedef {{
 *   visible: boolean
 *   windowDays: number
 *   steps: CycleFlowStep[]
 *   transitionCount: number
 *   currentCycleLabel: string
 *   currentDurationDays: number
 *   longestHeldState: string
 *   etfSensitivity?: import("./ydsMarketCycleEtfSensitivity.js").CycleEtfDowngrade
 *   recoveryGate?: import("./ydsMarketCycleRecoveryGate.js").RecoveryGateResult
 * }} MarketCycleFlowReport
 */

/**
 * @typedef {{
 *   date: string
 *   positionId: MarketPositionId
 *   score: number
 *   phase: CyclePhase
 *   cycleLabel: string
 * }} CycleDayEntry
 */

/** @param {MarketPositionId} positionId @param {CyclePhase} phase */
export function cycleCompositeLabel(positionId, phase) {
  const pos = MARKET_POSITION_STAGES.find((s) => s.id === positionId)?.label ?? positionId
  if (phase === "진입") return `${pos}진입`
  if (phase === "안정화") return `${pos}안정`
  if (phase === "회복중") return `${pos}회복`
  if (phase === "약화") return `${pos}약화`
  return `${pos}${phase}`
}

/** @param {string} a @param {string} b */
function daysBetween(a, b) {
  const d0 = new Date(`${a}T12:00:00`)
  const d1 = new Date(`${b}T12:00:00`)
  return Math.max(0, Math.round((d1.getTime() - d0.getTime()) / 86400000))
}

/**
 * @param {MarketPositionId} id
 * @param {number} delta
 * @returns {CyclePhase}
 */
function resolvePhase(id, delta) {
  if (Math.abs(delta) <= 2) return "안정화"
  const recoveryFavored = id === "panic" || id === "fear" || id === "adjustment"
  if (recoveryFavored) return delta >= 0 ? "회복중" : "약화"
  return delta >= 0 ? "약화" : "회복중"
}

/** @param {object} row */
function baseEntryFromRow(row) {
  if (!row?.date) return null
  const cnn = toNum(row.fearGreed)
  const vix = toNum(row.vix)
  const bofa = toNum(row.bofa)
  if (cnn == null && vix == null && bofa == null) return null

  const positionId = resolveMarketPositionId(cnn, vix, bofa)
  const score = computeMarketPositionScore(cnn, vix, bofa, positionId)
  return {
    date: String(row.date).slice(0, 10),
    positionId,
    score,
  }
}

/** @param {Array<{ date: string; positionId: MarketPositionId; score: number }>} baseEntries */
function annotateDailyCycleLabels(baseEntries) {
  /** @type {CycleDayEntry[]} */
  const out = []
  let prevId = null
  let prevScore = null
  let currentPhase = /** @type {CyclePhase} */ ("진입")
  let daysInPhase = 0
  const enterThreshold = RECOVERY_GATE_THRESHOLDS.phaseDeltaEnter
  const minStableDays = RECOVERY_GATE_THRESHOLDS.minStableDaysBeforeRecovery

  for (const entry of baseEntries) {
    if (prevId == null || entry.positionId !== prevId) {
      currentPhase = "진입"
      daysInPhase = 1
      prevId = entry.positionId
      prevScore = entry.score
    } else {
      daysInPhase += 1
      const delta = entry.score - (prevScore ?? entry.score)
      const recoveryFavored =
        entry.positionId === "panic" ||
        entry.positionId === "fear" ||
        entry.positionId === "adjustment"

      if (currentPhase === "진입") {
        currentPhase = "안정화"
      } else if (
        currentPhase === "안정화" &&
        recoveryFavored &&
        delta >= enterThreshold &&
        daysInPhase >= minStableDays
      ) {
        currentPhase = "회복중"
        daysInPhase = 1
        prevScore = entry.score
      } else if (currentPhase === "회복중" && delta <= -enterThreshold) {
        currentPhase = "안정화"
        daysInPhase = 1
        prevScore = entry.score
      } else if (Math.abs(delta) >= enterThreshold) {
        const nextPhase = resolvePhase(entry.positionId, delta)
        if (nextPhase !== currentPhase) {
          currentPhase = nextPhase
          daysInPhase = 1
          prevScore = entry.score
        }
      }
    }

    out.push({
      ...entry,
      phase: currentPhase,
      cycleLabel: cycleCompositeLabel(entry.positionId, currentPhase),
    })
  }

  return out
}

/** @param {CycleDayEntry[]} entries */
function buildCycleTransitionEvents(entries) {
  /** @type {Array<{ date: string; label: string }>} */
  const events = []
  let prevId = null
  let prevCycleLabel = null

  for (const entry of entries) {
    if (prevId == null || entry.positionId !== prevId) {
      const label = cycleCompositeLabel(entry.positionId, "진입")
      events.push({ date: entry.date, label })
      prevId = entry.positionId
      prevCycleLabel = label
      continue
    }

    if (entry.cycleLabel !== prevCycleLabel) {
      events.push({ date: entry.date, label: entry.cycleLabel })
      prevCycleLabel = entry.cycleLabel
    }
  }

  if (entries.length) {
    const last = entries[entries.length - 1]
    const tail = events[events.length - 1]
    if (!tail || tail.label !== last.cycleLabel) {
      events.push({ date: last.date, label: last.cycleLabel })
    }
  }

  return events
}

/** @param {CycleDayEntry[]} entries */
function countDayToDayTransitions(entries) {
  let count = 0
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].cycleLabel !== entries[i - 1].cycleLabel) count++
  }
  return count
}

/** @param {CycleDayEntry[]} entries */
function countCurrentDuration(entries) {
  if (!entries.length) return 0
  const current = entries[entries.length - 1].cycleLabel
  let days = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].cycleLabel !== current) break
    days++
  }
  return days
}

/** @param {CycleDayEntry[]} entries */
function resolveLongestHeldState(entries) {
  if (!entries.length) return "—"

  /** @type {{ label: string; days: number }[]} */
  const runs = []
  for (const entry of entries) {
    const last = runs[runs.length - 1]
    if (!last || last.label !== entry.cycleLabel) {
      runs.push({ label: entry.cycleLabel, days: 1 })
    } else {
      last.days++
    }
  }

  runs.sort((a, b) => b.days - a.days)
  return runs[0]?.label ?? "—"
}

/**
 * @param {object[]} historyRows
 * @param {number} [windowDays]
 * @param {import("./ydsMarketCycleEtfSensitivity.js").CycleEtfContext | null} [etfContext]
 * @returns {MarketCycleFlowReport}
 */
export function buildMarketCycleFlowReport(
  historyRows,
  windowDays = MARKET_CYCLE_FLOW_DAYS,
  etfContext = null,
) {
  const sorted = sortHistoryRowsAsc(historyRows)
  const windowed = rowsWithinDays(sorted, windowDays)
  const baseEntries = windowed
    .map((row) => baseEntryFromRow(row))
    .filter((e) => e != null)

  const entries = annotateDailyCycleLabels(baseEntries)
  const events = buildCycleTransitionEvents(entries)

  const steps = events.map((event, index) => {
    const prev = events[index - 1]
    return {
      label: event.label,
      daysGap: prev ? daysBetween(prev.date, event.date) : null,
      isCurrent: index === events.length - 1,
      date: event.date,
    }
  })

  const last = entries[entries.length - 1]

  const baseReport = {
    visible: steps.length >= 1,
    windowDays,
    steps,
    transitionCount: countDayToDayTransitions(entries),
    currentCycleLabel: last?.cycleLabel ?? "—",
    currentDurationDays: countCurrentDuration(entries),
    longestHeldState: resolveLongestHeldState(entries),
  }

  return finalizeMarketCycleFlow(baseReport, etfContext)
}

/**
 * ETF 민감도 + 회복 확인 게이트 적용
 * @param {MarketCycleFlowReport} report
 * @param {import("./ydsMarketCycleEtfSensitivity.js").CycleEtfContext | null | undefined} etfContext
 */
export function finalizeMarketCycleFlow(report, etfContext = null) {
  const afterEtf = applyEtfSensitivityToCycleFlow(report, etfContext)
  const gate = applyRecoveryConfirmationGate(afterEtf.currentCycleLabel, etfContext)

  if (!gate.applied) {
    return { ...afterEtf, recoveryGate: gate }
  }

  const steps = Array.isArray(afterEtf.steps) ? [...afterEtf.steps] : []
  if (steps.length) {
    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      label: gate.label,
    }
  }

  return {
    ...afterEtf,
    currentCycleLabel: gate.label,
    steps,
    recoveryGate: gate,
  }
}
