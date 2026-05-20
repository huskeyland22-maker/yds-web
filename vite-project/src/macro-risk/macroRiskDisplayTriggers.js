/**
 * 최대 3개의 실전 트리거 카드용 (중복 long_rate_stress 제거, 금리 슬롯 병합).
 * @param {{ id: string; label: string; emoji?: string; active: boolean; detail?: string; scoreAdd: number }[]} triggers
 */
export function selectActiveTriggerCards(triggers) {
  const list = triggers.filter((t) => t.active)
  /** @type {typeof list} */
  const out = []
  const skip = new Set()

  const repricing = list.find((t) => t.id === "rate_repricing_event")
  const shock = list.find((t) => t.id === "rate_shock")
  if (repricing) {
    out.push({ ...repricing, _cardLabel: "금리 재평가", _icon: "⚡" })
    skip.add("rate_repricing_event")
    skip.add("rate_shock")
  } else if (shock) {
    out.push({ ...shock, _cardLabel: "금리 재평가", _icon: "⚡" })
    skip.add("rate_shock")
    skip.add("rate_repricing_event")
  }

  const longInfl = list.find((t) => t.id === "long_inflation")
  if (longInfl && !skip.has("long_inflation")) {
    out.push({ ...longInfl, _cardLabel: "장기 인플레", _icon: "📈" })
    skip.add("long_inflation")
    skip.add("long_rate_stress")
  }

  const dollar = list.find((t) => t.id === "dollar_pressure")
  if (dollar && !skip.has("dollar_pressure")) {
    out.push({ ...dollar, _cardLabel: "유동성 축소", _icon: "💧" })
    skip.add("dollar_pressure")
  }

  for (const t of list) {
    if (out.length >= 3) break
    if (skip.has(t.id)) continue
    if (t.id === "long_rate_stress" || t.id === "liquidity_easing") continue
    out.push({ ...t, _cardLabel: t.label, _icon: t.emoji ?? "◆" })
    skip.add(t.id)
  }

  return out.slice(0, 3)
}

/** @param {number} scoreAdd */
export function triggerSeverityTier(scoreAdd) {
  const n = Number(scoreAdd)
  const a = Number.isFinite(n) ? Math.abs(n) : 0
  if (a <= 8) return "yellow"
  if (a <= 14) return "orange"
  return "red"
}
