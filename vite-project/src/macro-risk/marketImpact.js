/**
 * @typedef {'risk'|'neutral'|'favorable'} MarketStance
 * @typedef {{ id: string; label: string; stance: MarketStance; emoji: string }} MarketImpactRow
 */

const STANCE_EMOJI = {
  risk: "🔴",
  neutral: "🟠",
  favorable: "🟢",
}

/**
 * @param {MarketStance} stance
 */
function row(id, label, stance) {
  return { id, label, stance, emoji: STANCE_EMOJI[stance] }
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
  const riskAsset = triggers.some((t) => t.id === "risk_asset" && t.active)
  const rateShock = triggers.some((t) => t.id === "rate_shock" && t.active)
  const dxyUp = raw.DXY?.slope === "up" || (raw.DXY?.change20D != null && raw.DXY.change20D > 0.5)

  const growthPressure = rateScore >= 58 || rateShock || riskAsset
  const defValueBid = rateScore >= 55 && inflScore < 65

  return [
    row("ai", "AI", growthPressure || riskAsset ? "risk" : rateScore < 45 ? "favorable" : "neutral"),
    row("semi", "반도체", growthPressure || riskAsset ? "risk" : "neutral"),
    row("growth", "성장주", growthPressure ? "risk" : rateScore < 42 ? "favorable" : "neutral"),
    row("kospi", "코스피", liqScore >= 60 && dxyUp ? "risk" : rateScore >= 50 && rateScore < 70 ? "neutral" : "favorable"),
    row("value", "가치주", defValueBid || rateScore >= 52 ? "favorable" : growthPressure ? "neutral" : "neutral"),
  ]
}
