import { formatMetricValue } from "./panicFormatMetric.js"

function interpretVix(v) {
  if (v < 20) return { statusLabel: "안정", tone: "positive" }
  if (v < 30) return { statusLabel: "경계", tone: "warning" }
  return { statusLabel: "공포", tone: "danger" }
}

function interpretPutCall(v) {
  if (v <= 0.5) return { statusLabel: "과열", tone: "warning" }
  if (v < 0.8) return { statusLabel: "중립", tone: "neutral" }
  return { statusLabel: "공포", tone: "danger" }
}

function interpretFearGreed(v) {
  if (v >= 75) return { statusLabel: "극도 탐욕", tone: "danger" }
  if (v >= 60) return { statusLabel: "탐욕", tone: "warning" }
  if (v >= 40) return { statusLabel: "중립", tone: "positive" }
  if (v > 25) return { statusLabel: "공포", tone: "warning" }
  return { statusLabel: "극도 공포", tone: "danger" }
}

function interpretHighYield(v) {
  if (v < 3) return { statusLabel: "안정", tone: "positive" }
  if (v < 5) return { statusLabel: "경계", tone: "warning" }
  return { statusLabel: "스트레스", tone: "danger" }
}

function interpretMove(v) {
  if (v < 90) return { statusLabel: "안정", tone: "positive" }
  if (v < 110) return { statusLabel: "경계", tone: "warning" }
  return { statusLabel: "위험", tone: "danger" }
}

function interpretSkew(v) {
  if (v < 125) return { statusLabel: "낮음", tone: "positive" }
  if (v < 140) return { statusLabel: "보통", tone: "neutral" }
  return { statusLabel: "꼬리위험", tone: "warning" }
}

function interpretBofa(v) {
  if (v <= 2) return { statusLabel: "극도 공포", tone: "danger" }
  if (v <= 4) return { statusLabel: "공포", tone: "warning" }
  if (v <= 6) return { statusLabel: "중립", tone: "neutral" }
  if (v < 8) return { statusLabel: "탐욕", tone: "warning" }
  return { statusLabel: "극도 탐욕", tone: "danger" }
}

function interpretGsBullBear(v) {
  if (v <= 25) return { statusLabel: "극도 약세", tone: "danger" }
  if (v <= 40) return { statusLabel: "약세", tone: "warning" }
  if (v <= 60) return { statusLabel: "중립", tone: "neutral" }
  if (v < 75) return { statusLabel: "강세", tone: "positive" }
  return { statusLabel: "극도 강세", tone: "warning" }
}

function interpretVxn(v) {
  if (v <= 18) return { statusLabel: "안정", tone: "positive" }
  if (v <= 25) return { statusLabel: "경계", tone: "warning" }
  return { statusLabel: "공포", tone: "danger" }
}

/** @param {string} metricKey @param {unknown} rawValue */
export function interpretPanicMetric(metricKey, rawValue) {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return null
  const key = metricKey === "hyOas" ? "highYield" : metricKey
  let core
  switch (key) {
    case "vix":
      core = interpretVix(value)
      break
    case "putCall":
      core = interpretPutCall(value)
      break
    case "fearGreed":
      core = interpretFearGreed(value)
      break
    case "highYield":
      core = interpretHighYield(value)
      break
    case "move":
      core = interpretMove(value)
      break
    case "skew":
      core = interpretSkew(value)
      break
    case "bofa":
      core = interpretBofa(value)
      break
    case "gsBullBear":
      core = interpretGsBullBear(value)
      break
    case "vxn":
      core = interpretVxn(value)
      break
    default:
      return null
  }
  return {
    metricKey: key,
    value,
    valueText: formatMetricValue(key, value),
    statusLabel: core.statusLabel,
    tone: core.tone,
  }
}
