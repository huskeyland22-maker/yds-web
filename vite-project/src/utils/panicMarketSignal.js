/**
 * MVP: 지표별 -1 / 0 / 1 점수 (위험·중립·유리 방향 단순 합산).
 * @param {string} type
 * @param {unknown} value
 * @returns {number}
 */
export function getScore(type, value) {
  if (value == null) return 0

  const n = Number(value)
  if (Number.isNaN(n)) return 0

  switch (type) {
    case "vix":
      if (n < 20) return 1
      if (n < 30) return 0
      return -1

    case "fearGreed":
      if (n < 20) return 1
      if (n < 40) return 0
      if (n < 60) return 0
      if (n < 80) return -1
      return -1

    case "putCall":
      if (n > 1.0) return 1
      if (n > 0.7) return 0
      return -1

    case "bofa":
      if (n < 2) return 1
      if (n < 5) return 0
      return -1

    case "highYield":
      if (n < 4) return 1
      if (n < 6) return 0
      return -1

    default:
      return 0
  }
}

/** flat panic `data`에서 5지표 합산 점수 */
export function getTotalSignalScore(data) {
  if (!data || typeof data !== "object") return 0
  return (
    getScore("vix", data.vix) +
    getScore("fearGreed", data.fearGreed) +
    getScore("putCall", data.putCall) +
    getScore("bofa", data.bofa) +
    getScore("highYield", data.highYield)
  )
}

/**
 * @param {number} score
 * @returns {{ text: string; color: string }}
 */
export function getSignal(score) {
  if (score >= 3) return { text: "🟢 강한 매수", color: "limegreen" }
  if (score >= 1) return { text: "🟡 매수", color: "yellow" }
  if (score === 0) return { text: "⚪ 중립", color: "gray" }
  if (score <= -3) return { text: "🔴 강한 매도", color: "red" }
  return { text: "🟠 매도", color: "orange" }
}

/**
 * STEP 15: 조건 기반 전략 시그널 (합산 점수와 별도 — 튜닝·백테스트 대상).
 * @param {unknown} data
 * @returns {{ text: string; color: string }}
 */
export function getAdvancedSignal(data) {
  if (!data || typeof data !== "object") return { text: "-", color: "gray" }

  const vix = Number(data.vix)
  const fearGreed = Number(data.fearGreed)
  const putCall = Number(data.putCall)
  const bofa = Number(data.bofa)

  if (
    !Number.isFinite(vix) ||
    !Number.isFinite(fearGreed) ||
    !Number.isFinite(putCall) ||
    !Number.isFinite(bofa)
  ) {
    return { text: "⚪ 중립", color: "gray" }
  }

  if (vix > 30 && fearGreed < 25 && putCall > 1.0 && bofa < 2) {
    return { text: "🟢 극단적 공포 → 강한 매수", color: "limegreen" }
  }

  if (vix < 15 && fearGreed > 75 && putCall < 0.7 && bofa > 6) {
    return { text: "🔴 과열 → 강한 매도", color: "red" }
  }

  if (vix >= 20 && vix <= 30 && fearGreed >= 40 && fearGreed <= 70) {
    return { text: "🟡 방향성 모호 (관망)", color: "orange" }
  }

  if (fearGreed < 40 && putCall > 0.9) {
    return { text: "🟡 약한 매수 구간", color: "yellow" }
  }

  return { text: "⚪ 중립", color: "gray" }
}

/**
 * 극단 공포(강매수) 패턴에 대한 조건 충족 개수 0~4.
 * @param {unknown} data
 * @returns {number}
 */
export function getConfidence(data) {
  if (!data || typeof data !== "object") return 0
  let score = 0
  if (Number(data.vix) > 30) score++
  if (Number(data.fearGreed) < 25) score++
  if (Number(data.putCall) > 1.0) score++
  if (Number(data.bofa) < 2) score++
  return Math.min(4, Math.max(0, score))
}
