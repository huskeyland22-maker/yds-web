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

export function getFinalScore(data) {
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
