/** 서버용 패닉 점수 (vite tradingScores.js 와 동일 규칙) */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(x) {
  if (x === null || x === undefined || x === "") return NaN
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

export function scoreVIX(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return 50
  return clamp(((v - 12) / (40 - 12)) * 100, 0, 100)
}

export function scorePutCall(pc) {
  const p = toNum(pc)
  if (!Number.isFinite(p)) return 50
  return clamp(((p - 0.65) / (1.25 - 0.65)) * 100, 0, 100)
}

export function scoreFearGreed(fg) {
  const f = toNum(fg)
  if (!Number.isFinite(f)) return 50
  return clamp(100 - f, 0, 100)
}

export function scoreBofa(bofa) {
  const b = toNum(bofa)
  if (!Number.isFinite(b)) return 50
  return clamp(((6 - clamp(b, 0, 6)) / 6) * 100, 0, 100)
}

export function scoreHY(hy) {
  const h = toNum(hy)
  if (!Number.isFinite(h)) return 50
  return clamp(100 - ((h - 3) / (10 - 3)) * 100, 0, 100)
}

export function getShortScore(vix, putCall) {
  const raw = scoreVIX(vix) * 0.6 + scorePutCall(putCall) * 0.4
  return Math.round(clamp(raw, 0, 100))
}

export function getMidScore(fearGreed, bofa, highYield) {
  const raw = scoreFearGreed(fearGreed) * 0.4 + scoreBofa(bofa) * 0.35 + scoreHY(highYield) * 0.25
  return Math.round(clamp(raw, 0, 100))
}

export function getDynamicWeights(vix, highYield) {
  const h = toNum(highYield)
  const v = toNum(vix)
  if (Number.isFinite(h) && h > 6) return { wShort: 0.4, wMid: 0.6 }
  if (Number.isFinite(v) && v > 25) return { wShort: 0.7, wMid: 0.3 }
  return { wShort: 0.5, wMid: 0.5 }
}

/**
 * Panic Index V2 — VIX 점수 (결측 시 null)
 */
export function scoreVixV2(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return null
  return clamp(((v - 12) / (40 - 12)) * 100, 0, 100)
}

/** Panic Index V2 — CNN Fear & Greed (결측 시 null) */
export function scoreCnnV2(fg) {
  const f = toNum(fg)
  if (!Number.isFinite(f)) return null
  return clamp(100 - f, 0, 100)
}

/**
 * Panic Index V2 — Cboe Total Put/Call
 * ≤0.92→0 · 0.92~1.14→0~50 · 1.14~1.39→50~100 · ≥1.39→100
 */
export function scoreTotalPutCallV2(pc) {
  const x = toNum(pc)
  if (!Number.isFinite(x)) return null
  const lo = 0.92
  const mid = 1.14
  const hi = 1.39
  if (x <= lo) return 0
  if (x >= hi) return 100
  if (x <= mid) return (50 * (x - lo)) / (mid - lo)
  return 50 + (50 * (x - mid)) / (hi - mid)
}

/**
 * 최종 Panic Index (V2) = 0.45·VIX + 0.35·CNN + 0.20·Cboe Total P/C
 * 세 지표 중 하나라도 없으면 null
 */
export function getPanicScoreV2(data) {
  if (!data || typeof data !== "object") return null
  const sV = scoreVixV2(data.vix)
  const sC = scoreCnnV2(data.fearGreed)
  const sP = scoreTotalPutCallV2(data.putCall)
  if (sV == null || sC == null || sP == null) return null
  return Math.round(clamp(0.45 * sV + 0.35 * sC + 0.2 * sP, 0, 100))
}

/** Legacy getFinalScore — V2 가능 시 V2, 아니면 Legacy 동적가중 */
export function getFinalScore(data) {
  const v2 = getPanicScoreV2(data)
  if (v2 != null) return v2
  const short = getShortScore(data?.vix, data?.putCall)
  const mid = getMidScore(data?.fearGreed, data?.bofa, data?.highYield)
  const { wShort, wMid } = getDynamicWeights(data?.vix, data?.highYield)
  return Math.round(clamp(short * wShort + mid * wMid, 0, 100))
}

/** Legacy only — 덮어쓰지 않고 보존 호출용 */
export function getFinalScoreLegacy(data) {
  const short = getShortScore(data?.vix, data?.putCall)
  const mid = getMidScore(data?.fearGreed, data?.bofa, data?.highYield)
  const { wShort, wMid } = getDynamicWeights(data?.vix, data?.highYield)
  return Math.round(clamp(short * wShort + mid * wMid, 0, 100))
}

export function getAction(score) {
  const x = Number.isFinite(Number(score)) ? Number(score) : 0
  if (x >= 80) return "강한 매수"
  if (x >= 65) return "매수 구간"
  if (x >= 50) return "중립"
  if (x >= 35) return "비중 축소"
  return "위험 회피"
}
