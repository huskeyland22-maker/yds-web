/**
 * Cycle 패닉 점수 → 바닥권 / 저점권 / 전환권 / 고점권 / 과열권
 * (점수 높을수록 공포·저점 쪽)
 */

/** @typedef {"floor" | "low" | "transition" | "high" | "peak"} CycleZoneId */

/**
 * @typedef {{
 *   zone: CycleZoneId | null
 *   zoneLabel: string
 * }} CycleZone
 */

/** @param {number|null|undefined} score */
export function resolveCycleZone(score) {
  if (!Number.isFinite(Number(score))) {
    return { zone: null, zoneLabel: "데이터 대기" }
  }
  const s = Number(score)
  if (s >= 80) return { zone: "floor", zoneLabel: "바닥권" }
  if (s >= 60) return { zone: "low", zoneLabel: "저점권" }
  if (s >= 40) return { zone: "transition", zoneLabel: "전환권" }
  if (s >= 20) return { zone: "high", zoneLabel: "고점권" }
  return { zone: "peak", zoneLabel: "과열권" }
}
