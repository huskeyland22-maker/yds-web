/**
 * @typedef {'risk'|'neutral'|'favorable'} MarketStance
 * @typedef {{ id: string; label: string; stance: MarketStance; emoji: string; riskLabel: string; hint?: string }} MarketImpactRow
 */

const STANCE_EMOJI = {
  risk: "🔴",
  neutral: "🟠",
  favorable: "🟢",
}

const STANCE_LABEL = {
  risk: "위험",
  neutral: "중립",
  favorable: "우호",
}

/**
 * @param {MarketStance} stance
 * @param {string} [hint]
 */
function row(id, label, stance, hint) {
  return { id, label, stance, emoji: STANCE_EMOJI[stance], riskLabel: STANCE_LABEL[stance], hint }
}

/**
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {{ id: string; score: number }[]} pillars
 * @param {{ id: string; active: boolean }[]} triggers
 * @returns {MarketImpactRow[]}
 */
export function buildMarketImpact(raw, pillars, triggers) {
  const rate = pillars.find((p) => p.id === "rate")
  const inflation = pillars.find((p) => p.id === "inflation")
  const liquidity = pillars.find((p) => p.id === "liquidity")
  const rateScore = rate?.score ?? 50
  const inflScore = inflation?.score ?? 50
  const liqScore = liquidity?.score ?? 50
  const riskAsset = triggers.some((t) => t.id === "dollar_pressure" && t.active)
  const rateShock = triggers.some((t) => t.id === "rate_shock" && t.active)
  const easing = triggers.some((t) => t.id === "liquidity_easing" && t.active)
  const dxyUp = raw.DXY?.slope === "up" || (raw.DXY?.change20D != null && raw.DXY.change20D > 0.5)
  const us10Surge = raw.US10Y?.slope === "up" && raw.US10Y?.change20D != null && raw.US10Y.change20D > 0.2
  const realUp = raw.REAL_YIELD?.slope === "up"
  const kospiRateRiskBoost = us10Surge && realUp

  const growthPressure = rateScore >= 58 || rateShock || riskAsset
  const defValueBid = rateScore >= 55 && inflScore < 65

  return [
    row(
      "ai",
      "AI",
      easing ? "favorable" : growthPressure || riskAsset ? "risk" : rateScore < 45 ? "favorable" : "neutral",
      growthPressure ? "금리·변동성 압박" : "균형",
    ),
    row("semi", "반도체", easing ? "favorable" : growthPressure || riskAsset ? "risk" : "neutral", "베타·금리 민감"),
    row(
      "kospi",
      "코스피",
      liqScore >= 60 && dxyUp
        ? "risk"
        : kospiRateRiskBoost || rateShock
          ? "risk"
          : rateScore >= 50 && rateScore < 70
            ? "neutral"
            : "favorable",
      kospiRateRiskBoost ? "10Y 급등 + REAL 상승" : dxyUp ? "달러·유동성" : "매크로 중립",
    ),
    row("growth", "성장주", easing ? "favorable" : growthPressure ? "risk" : rateScore < 42 ? "favorable" : "neutral", "금리 민감 순환"),
    row(
      "value",
      "가치주",
      defValueBid || rateScore >= 52 ? "favorable" : growthPressure ? "neutral" : "neutral",
      defValueBid ? "방어·배당 우위" : "선별",
    ),
  ]
}
