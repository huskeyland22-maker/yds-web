/**
 * Cycle 점수 → 저점권 / 전환권 / 고점권 (공포·과열 대체)
 */

/** @typedef {"low" | "transition" | "high"} CycleZoneId */

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
  if (s <= 32) return { zone: "low", zoneLabel: "저점권" }
  if (s <= 52) return { zone: "transition", zoneLabel: "전환권" }
  return { zone: "high", zoneLabel: "고점권" }
}
