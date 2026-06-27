/**
 * 시장 판단 근거 — 긍정/부정/중립 요인 + 최종 판단
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { buildMarketStatePriceStructureReport, isPriceBearishStructure } from "./ydsMarketStatePriceStructure.js"
import { buildMarketStateCompositeReport } from "./ydsMarketStateCompositeEngine.js"
import { resolveUnifiedMarketStateLabel } from "./ydsUnifiedMarketState.js"
import { computeMa20Status, countConsecutiveUpDays } from "./ydsMarketCycleRecoveryGate.js"

/** @typedef {'positive' | 'negative' | 'neutral'} JudgmentTone */

/**
 * @typedef {{
 *   id: string
 *   icon: string
 *   text: string
 *   tone: JudgmentTone
 * }} JudgmentFactor
 */

/**
 * @typedef {{
 *   visible: boolean
 *   factors: JudgmentFactor[]
 *   conclusion: string
 *   unifiedLabel: string
 *   positiveCount: number
 *   negativeCount: number
 * }} MarketJudgmentRationaleReport
 */

/** @param {JudgmentTone} tone */
function iconForTone(tone) {
  if (tone === "positive") return "▲"
  if (tone === "negative") return "▼"
  return "•"
}

/** @param {number | null} v @param {number} low @param {number} high */
function toneFromBand(v, low, high) {
  if (v == null || !Number.isFinite(v)) return "neutral"
  if (v <= low) return "positive"
  if (v >= high) return "negative"
  return "neutral"
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   etfContext?: { qqqPrices?: Record<string, number> | null; spyPrices?: Record<string, number> | null; asOfDate?: string | null } | null
 * }} input
 * @returns {MarketJudgmentRationaleReport}
 */
export function buildMarketJudgmentRationale(input = {}) {
  const { panicData, cycleFlow, dualLiquidity, etfContext } = input
  const unifiedLabel = resolveUnifiedMarketStateLabel(cycleFlow, "—")

  if (!panicData && !cycleFlow?.visible) {
    return {
      visible: false,
      factors: [],
      conclusion: "—",
      unifiedLabel,
      positiveCount: 0,
      negativeCount: 0,
    }
  }

  /** @type {JudgmentFactor[]} */
  const factors = []

  const asOfDate = etfContext?.asOfDate ?? cycleFlow?.steps?.[cycleFlow.steps.length - 1]?.date ?? null
  const priceReport = buildMarketStatePriceStructureReport({
    qqqPrices: etfContext?.qqqPrices,
    spyPrices: etfContext?.spyPrices,
    asOfDate,
  })

  if (priceReport) {
    for (const bullet of priceReport.bullets.slice(0, 4)) {
      factors.push({
        id: `price-${bullet.slice(0, 12)}`,
        icon: "✓",
        text: bullet,
        tone: /하락|Lower|하회|둔화|하향/.test(bullet) ? "negative" : /상승|Higher|유지|지지/.test(bullet) ? "positive" : "neutral",
      })
    }
    if (isPriceBearishStructure(priceReport)) {
      factors.push({
        id: "price-bearish",
        icon: "▼",
        text: "가격 구조 — 하락 전환 (회복 신호 제한)",
        tone: "negative",
      })
    }
  }

  const composite = buildMarketStateCompositeReport({
    panicData,
    etfContext,
    dualLiquidity,
    asOfDate,
  })
  if (composite.visible && composite.compositeScore != null) {
    factors.push({
      id: "composite-score",
      icon: "•",
      text: `종합 점수 ${composite.compositeScore} (가격60·심리30·유동성10)`,
      tone: "neutral",
    })
  }

  const vix = Number(panicData?.vix)
  if (Number.isFinite(vix)) {
    const tone = toneFromBand(vix, 18, 28)
    factors.push({
      id: "vix",
      icon: iconForTone(tone),
      text: tone === "positive" ? `VIX 안정 (${vix})` : tone === "negative" ? `VIX 확대 (${vix})` : `VIX 중립 (${vix})`,
      tone,
    })
  }

  const hy = Number(panicData?.highYield)
  if (Number.isFinite(hy)) {
    const tone = toneFromBand(hy, 3.5, 5.5)
    factors.push({
      id: "hy",
      icon: iconForTone(tone),
      text:
        tone === "positive"
          ? `HY Spread 안정 (${hy}%)`
          : tone === "negative"
            ? `HY Spread 부담 (${hy}%)`
            : `HY Spread 중립 (${hy}%)`,
      tone,
    })
  }

  const marketScore = dualLiquidity?.marketScore
  if (Number.isFinite(marketScore)) {
    const tone = marketScore >= 60 ? "positive" : marketScore <= 40 ? "negative" : "neutral"
    factors.push({
      id: "liq-market",
      icon: iconForTone(tone),
      text:
        tone === "positive"
          ? `시장 유동성 우호 (${marketScore})`
          : tone === "negative"
            ? `시장 유동성 약세 (${marketScore})`
            : `시장 유동성 중립 (${marketScore})`,
      tone,
    })
  }

  const policyScore = dualLiquidity?.policyScore
  if (Number.isFinite(policyScore)) {
    const tone = policyScore >= 60 ? "positive" : policyScore <= 40 ? "negative" : "neutral"
    factors.push({
      id: "liq-policy",
      icon: iconForTone(tone),
      text:
        tone === "positive"
          ? `정책 유동성 우호 (${policyScore})`
          : tone === "negative"
            ? `정책 유동성 부담 (${policyScore})`
            : `정책 유동성 중립 (${policyScore})`,
      tone,
    })
  }

  const asOfDate2 = etfContext?.asOfDate ?? cycleFlow?.steps?.[cycleFlow.steps.length - 1]?.date ?? null
  const ma20 = computeMa20Status(etfContext?.qqqPrices, asOfDate2)
  if (ma20.above != null) {
    const tone = ma20.above ? "positive" : "negative"
    factors.push({
      id: "ma20",
      icon: iconForTone(tone),
      text: ma20.above
        ? `나스닥 20일선 유지 (${ma20.pctFromMa}%)`
        : `나스닥 20일선 미안착 (${ma20.pctFromMa}%)`,
      tone,
    })
  }

  const gate = cycleFlow?.recoveryGate
  const audit = gate?.audit ?? cycleFlow?.etfSensitivity?.audit
  const q2 = audit?.qqq?.d2
  if (q2 != null) {
    const tone = q2 >= 0 ? "positive" : q2 <= -3 ? "negative" : "neutral"
    factors.push({
      id: "qqq-2d",
      icon: iconForTone(tone),
      text: `최근 2일 NASDAQ ${q2}%`,
      tone,
    })
  }

  const spy2 = gate?.audit?.spy?.d2
  if (spy2 != null) {
    const tone = spy2 >= 0 ? "positive" : spy2 <= -3 ? "negative" : "neutral"
    factors.push({
      id: "spy-2d",
      icon: iconForTone(tone),
      text: `최근 2일 S&P500 ${spy2}%`,
      tone,
    })
  }

  const upDays = countConsecutiveUpDays(etfContext?.qqqPrices, asOfDate2)
  if (upDays >= 0 && etfContext?.qqqPrices) {
    const tone = upDays >= 2 ? "positive" : upDays === 0 ? "negative" : "neutral"
    factors.push({
      id: "rebound",
      icon: iconForTone(tone),
      text:
        upDays >= 2
          ? `연속 반등 ${upDays}일 확인`
          : `연속 반등 ${upDays}일 (확인 필요)`,
      tone,
    })
  }

  const panicScore = panicData ? Math.round(getFinalScore(panicData) ?? NaN) : null
  if (Number.isFinite(panicScore)) {
    factors.push({
      id: "panic",
      icon: "•",
      text: `심리 보조 — 패닉 ${panicScore}`,
      tone: "neutral",
    })
  }

  const negCount = factors.filter((f) => f.tone === "negative").length
  const posCount = factors.filter((f) => f.tone === "positive").length
  let conclusion = `→ ${unifiedLabel} 유지`
  if (cycleFlow?.recoveryGate?.applied) {
    conclusion = `→ ${unifiedLabel} (회복 확인 전)`
  } else if (negCount > posCount + 1) {
    conclusion = `→ ${unifiedLabel} · 방어적 접근`
  } else if (posCount > negCount + 1) {
    conclusion = `→ ${unifiedLabel} · 분할 접근 여지`
  }

  return {
    visible: factors.length > 0,
    factors,
    conclusion,
    unifiedLabel,
    positiveCount: posCount,
    negativeCount: negCount,
  }
}
