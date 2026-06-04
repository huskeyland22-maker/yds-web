/** 국면 설명력 — Phase 10/12 읽기 전용 */

/**
 * @param {{
 *   regimeId: string | null
 *   regimeLabel: string | null
 *   reason?: string | null
 *   priA?: number | null
 *   priB?: number | null
 *   dominantPattern?: string | null
 *   durationLabel?: string | null
 * }} input
 */
export function buildRegimeExplainBlock(input) {
  const { regimeId, regimeLabel, reason, priA, priB, dominantPattern, durationLabel } = input

  /** @type {string[]} */
  const whyLines = []
  if (regimeLabel) whyLines.push(`현재 국면 · ${regimeLabel}`)
  if (reason) whyLines.push(reason)
  if (durationLabel && durationLabel !== "—") whyLines.push(`지속 ${durationLabel}`)
  if (priA != null) whyLines.push(`PRI-A ${Math.round(priA)} — 조기경보 강도`)
  if (priB != null) whyLines.push(`PRI-B ${Math.round(priB)} — 충격 확인`)
  if (dominantPattern) whyLines.push(`우세 패턴 · ${dominantPattern}`)

  /** @type {string[]} */
  const changeHints = []
  if (priB != null && priB >= 45) changeHints.push("PRI-B 상승 → 경계·위기 국면 전환 가능")
  if (priA != null && priA >= 40) changeHints.push("PRI-A 상승 → 조기경보 강화")
  if (regimeId === "transition") changeHints.push("전환국면 — 30일 내 패턴·PRI 변동 주시")
  if (regimeId === "risk") changeHints.push("리스크 국면 — 방어 비중·섹터 로테이션 점검")
  if (regimeId === "panic") changeHints.push("위기국면 — 분할·현금 규칙 우선")

  return {
    regimeId,
    regimeLabel: regimeLabel ?? "—",
    whyLines: whyLines.slice(0, 5),
    changeHints30d: changeHints.slice(0, 4),
    note: "30일 상세 시계열은 Research · 국면 탐지에서 확인 (V1: 스냅샷·검증 로그 기반).",
  }
}
