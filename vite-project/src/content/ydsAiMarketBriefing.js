/**
 * AI 시장 브리핑 — 판단 근거 (결론·행동 반복 없음)
 */

import { buildPanicCompositeVerdictReport } from "./ydsPanicCompositeVerdict.js"
import { buildMarketStatePriceStructureReport } from "./ydsMarketStatePriceStructure.js"

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   reasons: string[]
 *   narrative: string[]
 * }} AiMarketBriefingReport
 */

/**
 * @param {import("./ydsMarketStatePriceStructure.js").MarketStatePriceStructureReport | null} price
 * @param {ReturnType<typeof buildPanicCompositeVerdictReport> | null} composite
 * @returns {string[]}
 */
function buildBriefingNarrative(price, composite) {
  /** @type {string[]} */
  const lines = []

  if (price?.aboveMa60 && (price.return5d ?? 0) < 0) {
    lines.push("장기 상승추세는 유지되지만 단기 조정이 진행 중입니다.")
  } else if (price?.aboveMa60 && (price.ma60SlopePct ?? 0) > 0) {
    lines.push("장기 이동평균선이 상승하며 추세가 유지되고 있습니다.")
  } else if (price?.aboveMa60 === false && (price.ma60SlopePct ?? 0) < 0) {
    lines.push("장기 이동평균선 아래에서 약세 흐름이 이어지고 있습니다.")
  }

  if ((price?.return5d ?? 0) < -2.5) {
    lines.push("최근 5일 수익률이 마이너스로 단기 하락 압력이 있습니다.")
  } else if ((price?.return5d ?? 0) > 2 && (price?.return10d ?? 0) > 0) {
    lines.push("단기·중기 수익률이 양호해 반등 흐름이 관찰됩니다.")
  }

  if (price?.lowerHigh && (price.return5d ?? 0) <= 0) {
    lines.push("고점이 낮아지며 단기 모멘텀이 둔화되고 있습니다.")
  } else if (price?.aboveMa20 === false && (price.ma20GapPct ?? 0) > -2.5) {
    lines.push("MA20 부근에서 지지를 테스트하는 구간입니다.")
  }

  if (composite?.visible && lines.length < 3) {
    if (composite.priceLabel === "하락 진행" && !lines.some((l) => /조정|하락/.test(l))) {
      lines.push("가격 구조상 하락 흐름이 우선입니다.")
    } else if (composite.priceLabel === "지지 확인") {
      lines.push("주요 이동평균선 부근에서 지지를 확인하는 구간입니다.")
    } else if (composite.trendLabel === "약화" || composite.trendLabel === "하락") {
      lines.push("추세·모멘텀 지표가 약화 국면입니다.")
    }
  }

  return [...new Set(lines)].slice(0, 3)
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   priceContext?: { spyPrices?: Record<string, number>; qqqPrices?: Record<string, number>; asOfDate?: string | null }
 * }} input
 * @returns {AiMarketBriefingReport}
 */
export function buildAiMarketBriefing(input = {}) {
  const { panicData, dualLiquidity, priceContext } = input

  const priceReport = buildMarketStatePriceStructureReport({
    spyPrices: priceContext?.spyPrices,
    qqqPrices: priceContext?.qqqPrices,
    asOfDate: priceContext?.asOfDate ?? null,
  })
  const composite = buildPanicCompositeVerdictReport(panicData, priceContext)

  /** @type {string[]} */
  const reasons = []

  if (priceReport?.bullets?.length) {
    reasons.push(...priceReport.bullets.slice(0, 4))
  } else if (composite.visible) {
    if (composite.psychScore != null) {
      reasons.push(`패닉 ${composite.psychScore} (${composite.stateLabel})`)
    }
    if (composite.priceLabel) reasons.push(`가격 ${composite.priceLabel}`)
    if (composite.trendLabel) reasons.push(`추세 ${composite.trendLabel}`)
  }

  const marketScore = dualLiquidity?.marketScore
  const policyScore = dualLiquidity?.policyScore
  if (reasons.length < 4 && marketScore != null && policyScore != null) {
    if (marketScore >= 55 && policyScore < 45) {
      reasons.push("시장 유동성 양호 · 정책 부담")
    } else if (marketScore < 45 && policyScore >= 55) {
      reasons.push("정책 우호 · 시장 자금 제한")
    }
  }

  const narrative = buildBriefingNarrative(priceReport, composite)

  return {
    visible: reasons.length > 0 || narrative.length > 0,
    title: "AI 시장 브리핑",
    reasons: reasons.slice(0, 4),
    narrative,
  }
}
