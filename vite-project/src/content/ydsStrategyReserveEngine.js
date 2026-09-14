/**
 * YDS 3.0 Strategy Reserve — 여유자금 한도 내 추가 투자 계산
 * Crash Reserve / Panic Index / MA40 엔진과 독립.
 */

import { STRATEGY_BASE_MONTHLY_KRW } from "./ydsStrategyMa40Engine.js"

export const STRATEGY_RESERVE_BASE_TOTAL_KRW = STRATEGY_BASE_MONTHLY_KRW

/** Allowed multipliers for YDS 3.0 stages */
export const STRATEGY_RESERVE_MULTIPLIERS = Object.freeze([1, 1.25, 1.5, 2])

/**
 * Non-negative integer KRW. Invalid / negative / non-finite → 0.
 * @param {unknown} value
 */
export function sanitizeStrategyKrw(value) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(0, Math.round(n))
}

/**
 * @param {unknown} multiplier
 * @returns {number}
 */
export function sanitizeStrategyMultiplier(multiplier) {
  const n = typeof multiplier === "number" ? multiplier : Number(multiplier)
  if (!Number.isFinite(n) || n <= 0) return 1
  if (STRATEGY_RESERVE_MULTIPLIERS.includes(n)) return n
  return 1
}

/**
 * @param {unknown} stage
 * @returns {1|2|3|4|null}
 */
export function sanitizeStrategyStage(stage) {
  const n = Math.round(Number(stage))
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return null
}

/**
 * Stage → multiplier (when only stage is provided).
 * @param {1|2|3|4} stage
 */
export function multiplierFromStrategyStage(stage) {
  if (stage === 2) return 1.25
  if (stage === 3) return 1.5
  if (stage === 4) return 2
  return 1
}

/**
 * Compute monthly invest amounts constrained by Strategy Reserve.
 *
 * @param {{
 *   multiplier?: unknown
 *   stage?: unknown
 *   strategyReserve?: unknown
 *   baseTotal?: unknown
 * }} input
 * @returns {{
 *   baseTotal: number
 *   multiplier: number
 *   stage: number | null
 *   targetTotal: number
 *   targetExtra: number
 *   strategyReserve: number
 *   actualExtra: number
 *   actualTotal: number
 *   reserveAfter: number
 * }}
 */
export function computeStrategyReservePlan(input = {}) {
  const baseTotal = sanitizeStrategyKrw(
    input.baseTotal == null ? STRATEGY_RESERVE_BASE_TOTAL_KRW : input.baseTotal,
  ) || STRATEGY_RESERVE_BASE_TOTAL_KRW

  const stage = sanitizeStrategyStage(input.stage)
  const multiplier =
    input.multiplier != null && input.multiplier !== ""
      ? sanitizeStrategyMultiplier(input.multiplier)
      : stage != null
        ? multiplierFromStrategyStage(stage)
        : 1

  const strategyReserve = sanitizeStrategyKrw(input.strategyReserve)
  const targetTotal = Math.max(0, Math.round(baseTotal * multiplier))
  const targetExtra = Math.max(0, targetTotal - baseTotal)
  const actualExtra = Math.min(targetExtra, strategyReserve)
  const actualTotal = Math.max(0, baseTotal + actualExtra)
  const reserveAfter = Math.max(0, strategyReserve - actualExtra)

  return {
    baseTotal,
    multiplier,
    stage,
    targetTotal,
    targetExtra,
    strategyReserve,
    actualExtra,
    actualTotal,
    reserveAfter,
  }
}
