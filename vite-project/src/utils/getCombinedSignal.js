/**
 * 단기·중기 점수로 결합 시그널을 계산합니다.
 * @param {number} shortScore 단기
 * @param {number} midScore 중기
 * @returns {{ label: string, action: string, color: 'green' | 'lightGreen' | 'yellow' | 'red' }}
 */
export function getSignal(shortScore, midScore) {
  const s = shortScore
  const m = midScore

  if (s >= 70 && m >= 70) {
    return {
      label: "강한 매수 구간",
      action: "공격적 분할 매수",
      color: "green",
    }
  }

  if (s >= 60 && m >= 50) {
    return {
      label: "매수 기회 구간",
      action: "눌림 매수 전략",
      color: "lightGreen",
    }
  }

  if (s >= 40 && s <= 60) {
    return {
      label: "관망 구간",
      action: "대기 / 비중 유지",
      color: "yellow",
    }
  }

  if (s < 40 && m < 50) {
    return {
      label: "익절 구간",
      action: "분할 매도",
      color: "red",
    }
  }

  return {
    label: "관망 구간",
    action: "대기 / 비중 유지",
    color: "yellow",
  }
}

/** @deprecated 이름 호환 — `getSignal` 사용 권장 */
export const getCombinedSignal = getSignal

/** UI용 Tailwind 텍스트 색 클래스 */
export const combinedSignalColorClass = {
  green: "text-[#22c55e]",
  lightGreen: "text-[#4ade80]",
  yellow: "text-[#f59e0b]",
  red: "text-[#ef4444]",
}
