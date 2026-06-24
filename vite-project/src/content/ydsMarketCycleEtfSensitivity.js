/**
 * 시장 사이클 — NASDAQ(QQQ)·SOXX 단기 수익률 민감도 보정
 * 조정회복 구간에서 지수 급락 시 체감 시장과 표시 괴리 완화
 */

import { normalizeSpyPriceSeries } from "./ydsEventScorecard.js"

/** @typedef {{ d2: number | null; d3: number | null; d5: number | null }} EtfReturnWindow */

/**
 * @typedef {{
 *   asOfDate: string | null
 *   dataEndDate: string | null
 *   qqq: EtfReturnWindow
 *   soxx: EtfReturnWindow
 * }} CycleEtfReturnAudit
 */

/**
 * @typedef {{
 *   applied: boolean
 *   tier: "none" | "warning" | "stable"
 *   baseLabel: string
 *   label: string
 *   reason: string | null
 *   audit: CycleEtfReturnAudit
 * }} CycleEtfDowngrade
 */

export const CYCLE_ETF_THRESHOLDS = {
  qqq3dWarning: -3,
  soxx3dWarning: -5,
  qqq3dSevere: -5,
  soxx3dSevere: -8,
}

export const CYCLE_LABEL_RECOVERY_WARNING = "조정회복(경고)"
export const CYCLE_LABEL_ADJUSTMENT_STABLE = "조정안정"

/**
 * @param {Record<string, number> | null | undefined} pricesByDate
 * @param {string | null | undefined} asOfDate
 * @param {number} tradingDays
 * @returns {number | null}
 */
export function trailingEtfReturnPct(pricesByDate, asOfDate, tradingDays) {
  const { sortedDates, prices } = normalizeSpyPriceSeries(pricesByDate ?? {})
  if (!sortedDates.length || tradingDays < 1) return null

  const cutoff = asOfDate ? String(asOfDate).slice(0, 10) : sortedDates[sortedDates.length - 1]
  let endIdx = -1
  for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
    if (sortedDates[i] <= cutoff) {
      endIdx = i
      break
    }
  }
  if (endIdx < 0) return null

  const startIdx = endIdx - tradingDays
  if (startIdx < 0) return null

  const start = prices[sortedDates[startIdx]]
  const end = prices[sortedDates[endIdx]]
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null
  return Math.round(((end - start) / start) * 1000) / 10
}

/**
 * @param {Record<string, number> | null | undefined} qqqPrices
 * @param {Record<string, number> | null | undefined} soxxPrices
 * @param {string | null | undefined} asOfDate
 * @returns {CycleEtfReturnAudit}
 */
export function buildCycleEtfReturnAudit(qqqPrices, soxxPrices, asOfDate = null) {
  const { sortedDates: qDates } = normalizeSpyPriceSeries(qqqPrices ?? {})
  const { sortedDates: sDates } = normalizeSpyPriceSeries(soxxPrices ?? {})
  const dataEndDate = qDates[qDates.length - 1] ?? sDates[sDates.length - 1] ?? null

  return {
    asOfDate: asOfDate ? String(asOfDate).slice(0, 10) : dataEndDate,
    dataEndDate,
    qqq: {
      d2: trailingEtfReturnPct(qqqPrices, asOfDate, 2),
      d3: trailingEtfReturnPct(qqqPrices, asOfDate, 3),
      d5: trailingEtfReturnPct(qqqPrices, asOfDate, 5),
    },
    soxx: {
      d2: trailingEtfReturnPct(soxxPrices, asOfDate, 2),
      d3: trailingEtfReturnPct(soxxPrices, asOfDate, 3),
      d5: trailingEtfReturnPct(soxxPrices, asOfDate, 5),
    },
  }
}

/** @param {string} label */
export function isAdjustmentRecoveryCycleLabel(label) {
  const text = String(label ?? "").trim()
  if (!text || /경고/.test(text)) return false
  return text === "조정회복" || (/조정/.test(text) && /회복/.test(text))
}

/**
 * @param {string} baseLabel
 * @param {CycleEtfReturnAudit} audit
 * @returns {CycleEtfDowngrade}
 */
export function resolveEtfCycleDowngrade(baseLabel, audit) {
  const base = String(baseLabel ?? "").trim() || "—"
  const none = {
    applied: false,
    tier: /** @type {"none"} */ ("none"),
    baseLabel: base,
    label: base,
    reason: null,
    audit,
  }

  if (!isAdjustmentRecoveryCycleLabel(base)) return none

  const q3 = audit.qqq.d3
  const s3 = audit.soxx.d3
  const warnQ = q3 != null && q3 <= CYCLE_ETF_THRESHOLDS.qqq3dWarning
  const warnS = s3 != null && s3 <= CYCLE_ETF_THRESHOLDS.soxx3dWarning
  if (!warnQ && !warnS) return none

  const severeQ = q3 != null && q3 <= CYCLE_ETF_THRESHOLDS.qqq3dSevere
  const severeS = s3 != null && s3 <= CYCLE_ETF_THRESHOLDS.soxx3dSevere
  const toStable = severeQ || severeS || (warnQ && warnS)

  /** @type {string[]} */
  const triggers = []
  if (warnQ && q3 != null) triggers.push(`NASDAQ 3일 ${q3}%`)
  if (warnS && s3 != null) triggers.push(`SOXX 3일 ${s3}%`)

  if (toStable) {
    return {
      applied: true,
      tier: "stable",
      baseLabel: base,
      label: CYCLE_LABEL_ADJUSTMENT_STABLE,
      reason: `${triggers.join(" · ")} — 조정 안정 구간으로 하향`,
      audit,
    }
  }

  return {
    applied: true,
    tier: "warning",
    baseLabel: base,
    label: CYCLE_LABEL_RECOVERY_WARNING,
    reason: `${triggers.join(" · ")} — 회복 둔화 경고`,
    audit,
  }
}

/**
 * @typedef {{
 *   qqqPrices?: Record<string, number> | null
 *   soxxPrices?: Record<string, number> | null
 *   asOfDate?: string | null
 * }} CycleEtfContext
 */

/**
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport} report
 * @param {CycleEtfContext | null | undefined} etfContext
 */
export function applyEtfSensitivityToCycleFlow(report, etfContext) {
  if (!report?.visible || !etfContext) return report

  const asOfDate =
    etfContext.asOfDate ??
    report.steps?.[report.steps.length - 1]?.date ??
    null
  const audit = buildCycleEtfReturnAudit(
    etfContext.qqqPrices,
    etfContext.soxxPrices,
    asOfDate,
  )
  const downgrade = resolveEtfCycleDowngrade(report.currentCycleLabel, audit)

  if (!downgrade.applied) {
    return { ...report, etfSensitivity: downgrade }
  }

  const steps = Array.isArray(report.steps) ? [...report.steps] : []
  if (steps.length) {
    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      label: downgrade.label,
    }
  }

  return {
    ...report,
    currentCycleLabel: downgrade.label,
    steps,
    etfSensitivity: downgrade,
  }
}
