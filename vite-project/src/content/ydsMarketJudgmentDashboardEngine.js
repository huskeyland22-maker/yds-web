/**
 * 시장 판단 대시보드 — 강세요인 · 위험요인 · 핵심근거 · 주의사항
 */

import { buildMarketJudgmentRationale } from "./ydsMarketJudgmentRationale.js"
import { buildMarketStateRationaleReport } from "./ydsMarketStateCompositeEngine.js"
import { buildMarketStateCompositeReport } from "./ydsMarketStateCompositeEngine.js"
import { resolveUnifiedMarketStateLabel } from "./ydsUnifiedMarketState.js"

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   currentStage: string
 *   strongSignals: string[]
 *   riskFactors: string[]
 *   keyRationale: string[]
 *   warnings: string[]
 * }} MarketJudgmentDashboardReport
 */

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: object | null
 * }} input
 */
export function buildMarketJudgmentDashboardReport(input = {}) {
  const { panicData, cycleFlow, dualLiquidity, etfContext } = input
  const unifiedLabel = resolveUnifiedMarketStateLabel(cycleFlow, "—")

  const judgment = buildMarketJudgmentRationale(input)
  const composite = buildMarketStateCompositeReport({
    panicData,
    etfContext,
    dualLiquidity,
    asOfDate: etfContext?.asOfDate ?? null,
  })
  const rationale = buildMarketStateRationaleReport(unifiedLabel, composite)

  if (!judgment.visible && !rationale.visible) {
    return {
      visible: false,
      title: "시장 판단",
      currentStage: unifiedLabel,
      strongSignals: [],
      riskFactors: [],
      keyRationale: [],
      warnings: [],
    }
  }

  const positives = judgment.factors.filter((f) => f.tone === "positive").map((f) => f.text)
  const negatives = judgment.factors.filter((f) => f.tone === "negative").map((f) => f.text)

  /** @type {string[]} */
  const strongSignals = []
  for (const t of positives) {
    if (strongSignals.length >= 6) break
    if (!strongSignals.includes(t)) strongSignals.push(t)
  }

  /** @type {string[]} */
  const riskFactors = []
  for (const t of negatives) {
    if (riskFactors.length >= 3) break
    if (!riskFactors.includes(t)) riskFactors.push(t)
  }

  /** @type {string[]} */
  const keyRationale = []
  for (const b of rationale.priceBullets ?? []) {
    if (keyRationale.length >= 4) break
    keyRationale.push(b)
  }
  for (const t of positives) {
    if (keyRationale.length >= 4) break
    if (!keyRationale.some((k) => k.includes(t.slice(0, 8)))) keyRationale.push(t)
  }

  /** @type {string[]} */
  const warnings = []
  for (const t of negatives) {
    if (warnings.length >= 3) break
    warnings.push(t)
  }
  if (warnings.length < 3 && /추격|과열|조정/.test(unifiedLabel)) {
    if (!warnings.includes("추격매수 금지")) warnings.push("추격매수 금지")
  }
  if (warnings.length < 3 && negatives.some((t) => /나스닥|NASDAQ|20일/.test(t))) {
    const nasdaqWarn = negatives.find((t) => /나스닥|NASDAQ|20일/.test(t))
    if (nasdaqWarn && !warnings.includes(nasdaqWarn)) warnings.push(nasdaqWarn)
  }
  if (warnings.length < 3) {
    warnings.push("단기 변동성 증가")
  }

  return {
    visible: true,
    title: "시장 판단",
    currentStage: unifiedLabel,
    strongSignals: strongSignals.slice(0, 6),
    riskFactors: riskFactors.slice(0, 3),
    keyRationale: keyRationale.slice(0, 4),
    warnings: [...new Set(warnings)].slice(0, 3),
  }
}

/** @param {{ buy: number; watch: number; cash: number }} stars */
export function starsToAllocationPct(stars) {
  const cash = Math.max(10, Math.min(70, Math.round(stars.cash * 8 + 11)))
  return { cashPct: cash, stockPct: 100 - cash }
}

/**
 * @param {import("./ydsDashboardActionGuide.js").DashboardActionGuideReport} actionGuide
 */
export function buildTodayActionDashboardReport(actionGuide) {
  if (!actionGuide?.visible) {
    return {
      visible: false,
      title: "오늘의 행동",
      strategies: [],
      cashPct: null,
      stockPct: null,
    }
  }

  const alloc = starsToAllocationPct(actionGuide.stars)
  const strategies = (actionGuide.recommendedActions ?? []).slice(0, 4)

  return {
    visible: true,
    title: "오늘의 행동",
    strategies,
    cashPct: alloc.cashPct,
    stockPct: alloc.stockPct,
  }
}
