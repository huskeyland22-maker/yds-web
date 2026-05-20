/**
 * @typedef {import('./normalizeLayer.js').NormalizedMetric} NormalizedMetric
 */

/**
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {Record<string, NormalizedMetric>} normalized
 * @param {object | null} panicContext
 */
export function evaluateCompositeTriggers(raw, normalized, panicContext = null) {
  const us10 = normalized.US10Y
  const us30 = normalized.US30Y
  const real = normalized.REAL_YIELD
  const move = normalized.MOVE
  const bei = normalized.BEI
  const dxy = normalized.DXY
  const vxn = normalized.VXN?.current ?? pickNum(panicContext?.vxn)

  /** @type {{ id: string; label: string; emoji: string; active: boolean; detail?: string; scoreAdd: number }[]} */
  const triggers = []

  const rateShock =
    us10?.delta20D != null &&
    us10.delta20D > 0.25 &&
    real?.slope === "up" &&
    move?.slope === "up"
  triggers.push({
    id: "rate_shock",
    label: "금리쇼크",
    emoji: "🔴",
    active: Boolean(rateShock),
    scoreAdd: 20,
    detail: "10Y 20D +0.25 초과 + REAL/MOVE 상승",
  })

  const longInflation =
    us30?.slope === "up" &&
    (bei?.slope === "up" || (bei?.delta20D != null && bei.delta20D > 0)) &&
    (us10?.slope === "up" || (us10?.delta20D != null && us10.delta20D > 0))
  triggers.push({
    id: "long_inflation",
    label: "장기인플레",
    emoji: "🟠",
    active: Boolean(longInflation),
    scoreAdd: 10,
    detail: "30Y·BEI·10Y 동반 상방",
  })

  const dollarPressure =
    dxy?.slope === "up" &&
    move?.slope === "up" &&
    Number.isFinite(Number(vxn)) &&
    Number(vxn) > 0 &&
    normalized.VXN?.slope === "up"
  triggers.push({
    id: "dollar_pressure",
    label: "위험자산 압박",
    emoji: "🔴",
    active: Boolean(dollarPressure),
    scoreAdd: 15,
    detail: "성장주 주의",
  })

  const liquidityEasing =
    (normalized.US10Y?.delta20D != null && normalized.US10Y.delta20D < 0) &&
    (normalized.REAL_YIELD?.delta20D != null && normalized.REAL_YIELD.delta20D < 0) &&
    (normalized.DXY?.delta20D != null && normalized.DXY.delta20D < 0)
  triggers.push({
    id: "liquidity_easing",
    label: "위험자산 우호",
    emoji: "🟢",
    active: Boolean(liquidityEasing),
    scoreAdd: -15,
    detail: "AI / 성장주 우세",
  })

  // 기존 UI/표현 호환: long_rate_stress 명칭 유지하되 long_inflation과 동일 신호로 매핑
  triggers.push({
    id: "long_rate_stress",
    label: "장기 인플레 경고",
    emoji: "🔴",
    active: Boolean(longInflation),
    scoreAdd: 10,
    detail: "장기인플레 트리거와 동일",
  })

  return triggers
}

function pickNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
