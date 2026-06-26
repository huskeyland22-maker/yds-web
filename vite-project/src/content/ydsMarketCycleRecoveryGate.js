/**
 * 시장 사이클 — 회복 확인 히스테리시스 (반등 확인 → 회복)
 * NASDAQ·S&P500 단기 변동, 20일선, 연속 반등일 반영
 */

import { normalizeSpyPriceSeries } from "./ydsEventScorecard.js"
import {
  buildCycleEtfReturnAudit,
  CYCLE_LABEL_ADJUSTMENT_STABLE,
  trailingEtfReturnPct,
} from "./ydsMarketCycleEtfSensitivity.js"

export const RECOVERY_GATE_THRESHOLDS = {
  qqq2dStable: -3,
  spy2dStable: -3,
  qqq3dStable: -4,
  minConsecutiveUpDays: 2,
  phaseDeltaEnter: 5,
  minStableDaysBeforeRecovery: 2,
}

/** @param {string} label */
export function isRecoveryPromotionLabel(label) {
  const text = String(label ?? "").trim()
  if (!text || /경고/.test(text)) return false
  return (
    text === "조정회복" ||
    text === "상승초기" ||
    (/회복/.test(text) && /조정|경계|위축/.test(text))
  )
}

/**
 * @param {Record<string, number> | null | undefined} pricesByDate
 * @param {string | null | undefined} asOfDate
 */
export function countConsecutiveUpDays(pricesByDate, asOfDate) {
  const { sortedDates, prices } = normalizeSpyPriceSeries(pricesByDate ?? {})
  if (sortedDates.length < 2) return 0

  const cutoff = asOfDate ? String(asOfDate).slice(0, 10) : sortedDates[sortedDates.length - 1]
  let endIdx = -1
  for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
    if (sortedDates[i] <= cutoff) {
      endIdx = i
      break
    }
  }
  if (endIdx < 1) return 0

  let streak = 0
  for (let i = endIdx; i >= 1; i -= 1) {
    const cur = prices[sortedDates[i]]
    const prev = prices[sortedDates[i - 1]]
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || cur <= prev) break
    streak += 1
  }
  return streak
}

/**
 * @param {Record<string, number> | null | undefined} pricesByDate
 * @param {string | null | undefined} asOfDate
 */
export function computeMa20Status(pricesByDate, asOfDate) {
  const { sortedDates, prices } = normalizeSpyPriceSeries(pricesByDate ?? {})
  if (sortedDates.length < 20) {
    return { above: null, pctFromMa: null, ma20: null, close: null }
  }

  const cutoff = asOfDate ? String(asOfDate).slice(0, 10) : sortedDates[sortedDates.length - 1]
  let endIdx = -1
  for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
    if (sortedDates[i] <= cutoff) {
      endIdx = i
      break
    }
  }
  if (endIdx < 19) {
    return { above: null, pctFromMa: null, ma20: null, close: null }
  }

  const window = sortedDates.slice(endIdx - 19, endIdx + 1)
  const closes = window.map((d) => prices[d]).filter((v) => Number.isFinite(v))
  if (closes.length < 20) {
    return { above: null, pctFromMa: null, ma20: null, close: null }
  }

  const ma20 = closes.reduce((s, v) => s + v, 0) / closes.length
  const close = closes[closes.length - 1]
  const pctFromMa = Math.round(((close - ma20) / ma20) * 1000) / 10
  return { above: close >= ma20, pctFromMa, ma20, close }
}

/**
 * @typedef {{
 *   applied: boolean
 *   label: string
 *   baseLabel: string
 *   reason: string | null
 *   consecutiveUpDays: number
 *   ma20Above: boolean | null
 *   audit: import("./ydsMarketCycleEtfSensitivity.js").CycleEtfReturnAudit & { spy: { d2: number | null; d3: number | null } }
 * }} RecoveryGateResult
 */

/**
 * @param {string} baseLabel
 * @param {{ qqqPrices?: Record<string, number> | null; soxxPrices?: Record<string, number> | null; spyPrices?: Record<string, number> | null; asOfDate?: string | null }} etfContext
 * @returns {RecoveryGateResult}
 */
export function applyRecoveryConfirmationGate(baseLabel, etfContext = null) {
  const ctx = etfContext ?? {}
  const base = String(baseLabel ?? "").trim() || "—"
  const asOfDate = ctx.asOfDate ?? null
  const audit = buildCycleEtfReturnAudit(ctx.qqqPrices, ctx.soxxPrices, asOfDate)
  const spy2 = trailingEtfReturnPct(ctx.spyPrices, asOfDate, 2)
  const spy3 = trailingEtfReturnPct(ctx.spyPrices, asOfDate, 3)
  const extendedAudit = {
    ...audit,
    spy: { d2: spy2, d3: spy3 },
  }

  const none = {
    applied: false,
    label: base,
    baseLabel: base,
    reason: null,
    consecutiveUpDays: countConsecutiveUpDays(ctx.qqqPrices, asOfDate),
    ma20Above: computeMa20Status(ctx.qqqPrices, asOfDate).above,
    audit: extendedAudit,
  }

  if (!isRecoveryPromotionLabel(base)) return none

  const q2 = audit.qqq.d2
  const q3 = audit.qqq.d3
  const upDays = countConsecutiveUpDays(ctx.qqqPrices, asOfDate)
  const ma20 = computeMa20Status(ctx.qqqPrices, asOfDate)

  const sharpDrop =
    (q2 != null && q2 <= RECOVERY_GATE_THRESHOLDS.qqq2dStable) ||
    (spy2 != null && spy2 <= RECOVERY_GATE_THRESHOLDS.spy2dStable) ||
    (q3 != null && q3 <= RECOVERY_GATE_THRESHOLDS.qqq3dStable)

  const recoveryNotConfirmed =
    upDays < RECOVERY_GATE_THRESHOLDS.minConsecutiveUpDays || ma20.above === false

  if (!sharpDrop && !recoveryNotConfirmed) return { ...none, consecutiveUpDays: upDays, ma20Above: ma20.above }

  /** @type {string[]} */
  const triggers = []
  if (q2 != null && q2 <= RECOVERY_GATE_THRESHOLDS.qqq2dStable) {
    triggers.push(`NASDAQ 2일 ${q2}%`)
  }
  if (spy2 != null && spy2 <= RECOVERY_GATE_THRESHOLDS.spy2dStable) {
    triggers.push(`S&P500 2일 ${spy2}%`)
  }
  if (upDays < RECOVERY_GATE_THRESHOLDS.minConsecutiveUpDays) {
    triggers.push(`연속 반등 ${upDays}일 (확인 ${RECOVERY_GATE_THRESHOLDS.minConsecutiveUpDays}일 필요)`)
  }
  if (ma20.above === false) {
    triggers.push("나스닥 20일선 미안착")
  }

  const stableLabel = /조정/.test(base) ? CYCLE_LABEL_ADJUSTMENT_STABLE : `${base.replace(/회복.*/, "")}안정`

  return {
    applied: true,
    label: /조정/.test(base) ? CYCLE_LABEL_ADJUSTMENT_STABLE : stableLabel.replace(/안정안정/, "안정"),
    baseLabel: base,
    reason:
      triggers.length > 0
        ? `${triggers.join(" · ")} — 회복 확인 전 · 조정안정 유지`
        : "회복 확인 조건 미충족 — 조정안정 유지",
    consecutiveUpDays: upDays,
    ma20Above: ma20.above,
    audit: extendedAudit,
  }
}
