/**
 * 핵심 지표 카드 — 데이터 상태(사실) / 정책 해석(엔진) 분리
 */

/** @typedef {"fearGreed" | "vix" | "bofa"} HomeV5CoreMetricKey */

/**
 * 지표 숫자만으로 판단하는 사실 기반 상태 (정책·행동 문구 금지)
 * @param {HomeV5CoreMetricKey} key
 * @param {unknown} value
 */
export function resolveCoreMetricDataStatus(key, value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"

  if (key === "fearGreed") {
    if (n >= 75) return "극단 탐욕"
    if (n >= 60) return "탐욕"
    if (n <= 25) return "극단 공포"
    if (n <= 40) return "공포 경계"
    return "중립"
  }

  if (key === "vix") {
    if (n >= 30) return "높은 변동성"
    if (n >= 22) return "확대된 변동성"
    if (n >= 18) return "보통 변동성"
    return "낮은 변동성"
  }

  if (key === "bofa") {
    if (n >= 8) return "극단 낙관"
    if (n >= 6.5) return "낙관 우세"
    if (n >= 4) return "중립"
    if (n >= 2) return "보수"
    return "극단 공포"
  }

  return "—"
}
