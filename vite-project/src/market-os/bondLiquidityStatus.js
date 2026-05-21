/**
 * Bond / Liquidity Monitor — 상태형 표시 (점수 대신 보조 확인)
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @returns {string[]}
 */
export function deriveBondLiquidityStatuses(snapshot) {
  if (!snapshot) return ["데이터 수집 중"]

  /** @type {string[]} */
  const out = []
  const triggers = snapshot.triggers ?? []
  const active = (id) => triggers.some((t) => t.active && t.id === id)

  if (active("rate_repricing_event") || active("rate_shock")) out.push("금리 재평가")
  if (active("long_inflation") || active("long_rate_stress")) out.push("장기채 경고")
  if (active("dollar_pressure")) out.push("유동성 주의")

  const rateStatus = snapshot.pillars?.find((p) => p.id === "rate")?.status ?? ""
  if (rateStatus.includes("성장주") && !out.includes("성장주 압박")) out.push("성장주 압박")

  const liqStatus = snapshot.pillars?.find((p) => p.id === "liquidity")?.status ?? ""
  if (liqStatus.includes("축소") && !out.includes("유동성 축소")) out.push("유동성 축소")
  else if (liqStatus.includes("압박") && !out.includes("유동성 주의")) out.push("유동성 주의")

  if (!out.length) out.push("보조 확인 양호")

  return out
}

/**
 * Bond 레이어가 Cycle 판단을 강화할 때만 true (최종 판단권 없음)
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 */
/**
 * CORE 3카드 보조 문구
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 */
export function bondCoreCardHints(snapshot) {
  const statuses = deriveBondLiquidityStatuses(snapshot)
  const has = (s) => statuses.includes(s)
  const ratePillar = snapshot?.pillars?.find((p) => p.id === "rate")
  const liqPillar = snapshot?.pillars?.find((p) => p.id === "liquidity")

  return {
    US10Y: has("금리 재평가")
      ? "↗ 금리 재평가"
      : ratePillar?.status?.includes("압박")
        ? "↗ 금리 상방"
        : "금리 보합",
    US30Y: has("장기채 경고") ? "⚠ 장기채 경고" : has("금리 재평가") ? "⚠ 장기 주의" : "장기 안정",
    DXY: has("유동성 주의") || has("유동성 축소")
      ? "유동성 주의"
      : liqPillar?.status ?? "유동성 중립",
  }
}

export function isBondLiquidityConfirming(snapshot) {
  if (!snapshot) return false
  const statuses = deriveBondLiquidityStatuses(snapshot)
  const stress = new Set(["금리 재평가", "장기채 경고", "유동성 주의", "성장주 압박", "유동성 축소"])
  return statuses.some((s) => stress.has(s))
}
