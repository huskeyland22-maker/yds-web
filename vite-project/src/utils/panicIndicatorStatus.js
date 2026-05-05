/**
 * 지표 숫자 → 상태 문구 + 표시용 색 이름 (inline style용).
 * @param {string | undefined} type
 * @param {unknown} value
 * @returns {{ text: string; color: string }}
 */
export function getStatus(type, value) {
  if (value == null) return { text: "-", color: "gray" }

  const n = Number(value)
  if (Number.isNaN(n)) return { text: "-", color: "gray" }

  switch (type) {
    case "vix":
      if (n < 20) return { text: "안정", color: "limegreen" }
      if (n < 30) return { text: "경계", color: "orange" }
      return { text: "위험", color: "red" }

    case "fearGreed":
      if (n < 20) return { text: "극공포", color: "red" }
      if (n < 40) return { text: "공포", color: "orange" }
      if (n < 60) return { text: "중립", color: "gray" }
      if (n < 80) return { text: "탐욕", color: "orange" }
      return { text: "과열", color: "red" }

    case "putCall":
      if (n < 0.7) return { text: "과열", color: "red" }
      if (n < 1.0) return { text: "중립", color: "gray" }
      return { text: "공포", color: "orange" }

    case "bofa":
      if (n < 2) return { text: "극단적 공포", color: "red" }
      if (n < 5) return { text: "중립", color: "gray" }
      return { text: "과열", color: "orange" }

    case "highYield":
      if (n < 4) return { text: "안정", color: "limegreen" }
      if (n < 6) return { text: "경계", color: "orange" }
      return { text: "위험", color: "red" }

    default:
      return { text: "-", color: "gray" }
  }
}
