/** 8대 패닉 지표 (Cycle 수동·LIVE 혼합) — @deprecated 파일명 panicNine, 8지표 체계 */
import { PANIC_METRIC_DEFS } from "../content/panicMetricKeys.js"

export const PANIC_NINE_KEYS = PANIC_METRIC_DEFS

/**
 * @param {object | null} panicData
 * @returns {{ label: string; stress: "high"|"mid"|"low"|"na" }[]}
 */
export function summarizePanicNine(panicData) {
  if (!panicData) {
    return PANIC_NINE_KEYS.map((m) => ({ label: m.label, stress: "na" }))
  }

  const vix = num(panicData.vix)
  const vxn = num(panicData.vxn)
  const pc = num(panicData.putCall)
  const fg = num(panicData.fearGreed)
  const move = num(panicData.move)
  const bofa = num(panicData.bofa)
  const skew = num(panicData.skew)
  const hy = num(panicData.highYield)

  return [
    { label: "VIX", stress: stressVix(vix) },
    { label: "VXN", stress: stressVix(vxn) },
    { label: "Put/Call", stress: pc >= 1.05 ? "high" : pc >= 0.85 ? "mid" : pc != null ? "low" : "na" },
    { label: "Fear&Greed", stress: fg != null && fg <= 25 ? "high" : fg != null && fg <= 45 ? "mid" : fg != null ? "low" : "na" },
    { label: "MOVE", stress: move >= 120 ? "high" : move >= 90 ? "mid" : move != null ? "low" : "na" },
    { label: "BofA", stress: bofa != null && bofa <= 1.5 ? "high" : bofa != null && bofa <= 3 ? "mid" : bofa != null ? "low" : "na" },
    { label: "SKEW", stress: skew >= 145 ? "high" : skew >= 130 ? "mid" : skew != null ? "low" : "na" },
    { label: "HY", stress: hy >= 6.5 ? "high" : hy >= 5 ? "mid" : hy != null ? "low" : "na" },
  ]
}

/** @param {object | null} panicData */
export function panicNineStressScore(panicData) {
  const rows = summarizePanicNine(panicData)
  const scored = rows.filter((r) => r.stress !== "na")
  if (!scored.length) return null
  const high = scored.filter((r) => r.stress === "high").length
  const mid = scored.filter((r) => r.stress === "mid").length
  return Math.min(100, Math.round((high * 18 + mid * 8) / scored.length))
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function stressVix(v) {
  if (v == null) return "na"
  if (v >= 28) return "high"
  if (v >= 20) return "mid"
  return "low"
}
