/**
 * @typedef {{ key: string; label: string; active: boolean; tone: 'risk'|'neutral'|'favorable' }} MarketRegimeRow
 */

/**
 * @param {Record<string, import('./normalizeLayer.js').NormalizedMetric>} normalized
 * @param {{ id: string; active: boolean }[]} triggers
 * @param {number} score
 * @returns {MarketRegimeRow[]}
 */
export function buildMarketRegime(normalized, triggers, score) {
  const isActive = (id) => triggers.some((t) => t.id === id && t.active)
  const dxyDown = normalized.DXY?.slope === "down"
  const y10Down = normalized.US10Y?.slope === "down"
  const realDown = normalized.REAL_YIELD?.slope === "down"

  const rateShock = isActive("rate_shock")
  const longInfl = isActive("long_inflation")
  const dollarPressure = isActive("dollar_pressure")
  const easing = isActive("liquidity_easing")

  return [
    { key: "liq", label: "유동성 장세", active: easing || (dxyDown && score <= 60), tone: "favorable" },
    { key: "rate", label: "금리 압박", active: rateShock || score >= 65, tone: "risk" },
    { key: "infl", label: "인플레 재가속", active: longInfl, tone: "risk" },
    { key: "riskon", label: "위험자산 우호", active: easing || (y10Down && realDown && dxyDown), tone: "favorable" },
    { key: "growth", label: "성장주 압박", active: rateShock || dollarPressure, tone: "risk" },
    { key: "def", label: "방어장세", active: score >= 70 || rateShock, tone: "neutral" },
  ]
}
