/**
 * AI 시장 브리핑 — 규칙 기반 3~5줄 (상태 · 패닉 · 사이클)
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { buildPanicIntensityInterpretation } from "./ydsPanicIntensityInterpretation.js"
import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"
import {
  resolveUnifiedMarketStateGuide,
  resolveUnifiedMarketStateLabel,
} from "./ydsUnifiedMarketState.js"

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   lines: string[]
 * }} AiMarketBriefingReport
 */

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 * }} input
 * @returns {AiMarketBriefingReport}
 */
export function buildAiMarketBriefing(input = {}) {
  const { panicData, cycleFlow, dualLiquidity } = input
  const view = resolveMarketStateCenterView(panicData)
  if (!view) {
    return { visible: false, title: "AI 시장 브리핑", lines: [] }
  }

  const unifiedLabel = resolveUnifiedMarketStateLabel(cycleFlow, view.position?.label ?? "—")
  const guide = resolveUnifiedMarketStateGuide(unifiedLabel)
  const panicScore = Math.round(getFinalScore(panicData) ?? view.panicScore ?? NaN)
  const panicInterp = Number.isFinite(panicScore)
    ? buildPanicIntensityInterpretation(panicScore)
    : null

  /** @type {string[]} */
  const lines = []

  lines.push(`현재 시장은 ${unifiedLabel} 구간으로 판단됩니다.`)

  if (panicInterp) {
    lines.push(`패닉 강도 ${panicScore} · ${panicInterp.label} — ${panicInterp.actionLine}`)
  }

  const marketScore = dualLiquidity?.marketScore
  const policyScore = dualLiquidity?.policyScore
  if (marketScore != null && policyScore != null) {
    if (marketScore >= 55 && policyScore < 45) {
      lines.push("시장 유동성은 양호하지만 정책 환경은 아직 부담입니다.")
    } else if (marketScore < 45 && policyScore >= 55) {
      lines.push("정책 환경은 비교적 우호적이나 시장 자금 흐름은 제한적입니다.")
    } else if (marketScore >= 55 && policyScore >= 55) {
      lines.push("시장·정책 유동성이 함께 우호적인 환경입니다.")
    } else {
      lines.push("시장·정책 유동성 모두 중립~부담 구간입니다.")
    }
  } else if (dualLiquidity?.synthesis?.headline) {
    lines.push(String(dualLiquidity.synthesis.headline).replace(/\.$/, ""))
  }

  const strategyLine = guide.actions[0] ?? guide.strategyPhase.replace(/ 단계$/, "")
  if (/추격|분할|관망|현금|방어/.test(strategyLine)) {
    lines.push(`${strategyLine} 중심의 전략이 적합합니다.`)
  } else {
    lines.push(`${guide.strategyNarrative[0] ?? "선별적 접근을 유지하세요."}`)
  }

  return {
    visible: lines.length > 0,
    title: "AI 시장 브리핑",
    lines: lines.slice(0, 5),
  }
}
