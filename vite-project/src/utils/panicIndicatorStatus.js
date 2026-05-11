/**
 * 지표 숫자 → 상태 문구 + 스타일 클래스.
 * @param {string | undefined} key
 * @param {unknown} value
 * @returns {{ label: string; className: "neutral" | "safe" | "warning" | "danger" }}
 */
export function getStatus(key, value) {
  if (value == null || value === "-") return { label: "-", className: "neutral" }

  const n = parseFloat(String(value))
  if (!Number.isFinite(n)) return { label: "-", className: "neutral" }

  switch (key) {
    case "vix":
      if (n >= 30) return { label: "공포", className: "danger" }
      if (n >= 20) return { label: "주의", className: "warning" }
      return { label: "안정", className: "safe" }
    case "vxn":
      if (n >= 35) return { label: "공포", className: "danger" }
      if (n >= 25) return { label: "주의", className: "warning" }
      return { label: "안정", className: "safe" }
    case "fearGreed":
      if (n >= 75) return { label: "극단 탐욕", className: "danger" }
      if (n >= 60) return { label: "탐욕", className: "warning" }
      if (n <= 25) return { label: "극단 공포", className: "danger" }
      return { label: "중립", className: "safe" }
    case "putCall":
      if (n >= 1) return { label: "공포", className: "danger" }
      if (n <= 0.7) return { label: "과열", className: "warning" }
      return { label: "중립", className: "safe" }
    case "bofa":
      if (n >= 8) return { label: "과열", className: "danger" }
      if (n <= 2) return { label: "공포", className: "danger" }
      return { label: "보통", className: "safe" }
    case "move":
      if (n >= 120) return { label: "위험", className: "danger" }
      if (n >= 100) return { label: "주의", className: "warning" }
      return { label: "안정", className: "safe" }
    case "skew":
      if (n >= 140) return { label: "주의", className: "warning" }
      return { label: "안정", className: "safe" }
    case "highYield":
      if (n >= 5) return { label: "위험", className: "danger" }
      if (n >= 3) return { label: "주의", className: "warning" }
      return { label: "안정", className: "safe" }
    case "gsBullBear":
      if (n >= 80) return { label: "과열", className: "danger" }
      if (n <= 20) return { label: "공포", className: "danger" }
      return { label: "중립", className: "safe" }
    default:
      return { label: "중립", className: "safe" }
  }
}
