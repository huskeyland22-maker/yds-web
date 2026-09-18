/**
 * SPX 저점 공략용 Panic 분할매수 신호 (검증 비중 40 / 27 / 33)
 * — Panic 점수 구간만 사용. 산식·SPX·시간·NDX 조건 없음.
 * — 표시/참고용. 주문 자동 실행 없음.
 */

/**
 * @typedef {{
 *   stage: 0 | 1 | 2 | 3
 *   id: 'wait' | 'buy1' | 'buy2' | 'buy3'
 *   bandLabel: string
 *   addLabel: string
 *   addPct: number
 *   cumulativePct: number
 * }} PanicBottomDcaSignal
 */

/**
 * @param {number | null | undefined} score Panic Index (0–100)
 * @returns {PanicBottomDcaSignal | null}
 */
export function resolvePanicBottomDcaSignal(score) {
  if (score == null || !Number.isFinite(Number(score))) return null
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))

  if (s < 50) {
    return {
      stage: 0,
      id: "wait",
      bandLabel: "[ 매수 대기 ]",
      addLabel: "투입",
      addPct: 0,
      cumulativePct: 0,
    }
  }
  if (s < 60) {
    return {
      stage: 1,
      id: "buy1",
      bandLabel: "[ 1차 매수 구간 ]",
      addLabel: "권장 투입",
      addPct: 40,
      cumulativePct: 40,
    }
  }
  if (s < 70) {
    return {
      stage: 2,
      id: "buy2",
      bandLabel: "[ 2차 매수 구간 ]",
      addLabel: "추가 투입",
      addPct: 27,
      cumulativePct: 67,
    }
  }
  return {
    stage: 3,
    id: "buy3",
    bandLabel: "[ 3차 집중매수 구간 ]",
    addLabel: "추가 투입",
    addPct: 33,
    cumulativePct: 100,
  }
}
