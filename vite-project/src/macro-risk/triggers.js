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

  const us10Current = toNum(us10?.current)
  const us10d1 = toNum(us10?.delta1D)
  const us10d5 = toNum(us10?.delta5D)
  const us10d20 = toNum(us10?.delta20D)
  const moveD1 = toNum(move?.delta1D)
  const moveD5 = toNum(move?.delta5D)
  const us10Acceleration = Number.isFinite(us10d1) && Number.isFinite(us10d5) ? us10d1 - us10d5 / 5 : null

  const rateStable =
    Number.isFinite(us10d1) &&
    Number.isFinite(us10d5) &&
    us10d1 < 1 &&
    us10d5 < 3
  const rateWarning =
    !rateStable &&
    ((Number.isFinite(us10d1) && us10d1 >= 1 && us10d1 < 3) || (Number.isFinite(us10d5) && us10d5 >= 3 && us10d5 < 7))
  const moveSurge =
    (Number.isFinite(moveD1) && moveD1 >= 8) ||
    (Number.isFinite(moveD5) && moveD5 >= 20) ||
    (move?.slope === "up" && Number.isFinite(toNum(move?.delta20D)) && toNum(move?.delta20D) >= 40)
  const rateShock =
    (Number.isFinite(us10d1) && us10d1 >= 3) ||
    (Number.isFinite(us10d5) && us10d5 >= 7) ||
    moveSurge
  const rateShockExtreme =
    (Number.isFinite(us10d1) && us10d1 >= 4) ||
    (Number.isFinite(us10d5) && us10d5 >= 9) ||
    (moveSurge && move?.slope === "up" && real?.slope === "up")
  const rateShockAdd = rateShock ? (rateShockExtreme ? 20 : 15) : 0

  const ratePhase = rateShock ? "금리 쇼크" : rateWarning ? "금리 경고" : "금리 안정"
  const ratePhaseOutputs = rateShock
    ? "금리 재평가 · 채권 압박 · 성장주 압박 · AI / 반도체 주의"
    : rateWarning
      ? "금리 재평가 · 성장주 압박"
      : "금리 안정"
  triggers.push({
    id: "rate_shock",
    label: "금리 재평가",
    emoji: "🔴",
    active: Boolean(rateShock),
    scoreAdd: rateShockAdd,
    detail: [
      `${ratePhase} · ${ratePhaseOutputs}`,
      `10Y 현재 ${fmt(us10Current)} · 1D ${fmt(us10d1)}% · 5D ${fmt(us10d5)}% · 20D ${fmt(us10d20)}% · 가속도 ${fmt(us10Acceleration)}`,
    ].join(" / "),
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

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(2) : "—"
}
