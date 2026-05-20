/**
 * @typedef {import('./rawLayer.js').MetricSeries} MetricSeries
 */

/**
 * @param {Record<string, MetricSeries>} raw
 * @param {object | null} panicContext — read-only VXN 등 (패닉 저장소 미변경)
 */
export function evaluateCompositeTriggers(raw, panicContext = null) {
  const us10 = raw.US10Y
  const real = raw.REAL_YIELD
  const move = raw.MOVE
  const bei = raw.BEI
  const cpi = raw.CPI
  const dxy = raw.DXY
  const vxn = pickNum(panicContext?.vxn)

  /** @type {{ id: string; label: string; emoji: string; active: boolean; detail?: string }[]} */
  const triggers = []

  const rateShock =
    us10?.change20D != null &&
    us10.change20D > 0.3 &&
    real?.change20D != null &&
    real.change20D > 0.03 &&
    move?.slope === "up"

  triggers.push({
    id: "rate_shock",
    label: "금리쇼크",
    emoji: "🔴",
    active: Boolean(rateShock),
    detail: "US10Y·REAL·MOVE 동반 상승",
  })

  const inflReaccel =
    bei?.slope === "up" &&
    real?.change20D != null &&
    real.change20D > 0.03 &&
    cpi?.change5D != null &&
    cpi.change5D > 0

  triggers.push({
    id: "infl_reaccel",
    label: "인플레 재가속",
    emoji: "🟠",
    active: Boolean(inflReaccel),
    detail: "BEI·REAL·CPI 기대 상회",
  })

  const riskAssetPressure =
    dxy?.slope === "up" && move?.slope === "up" && vxn != null && vxn >= 18

  triggers.push({
    id: "risk_asset",
    label: "AI / 반도체 주의",
    emoji: "🟠",
    active: Boolean(riskAssetPressure),
    detail: "DXY·MOVE·VXN 동반 상승",
  })

  return triggers
}

function pickNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
