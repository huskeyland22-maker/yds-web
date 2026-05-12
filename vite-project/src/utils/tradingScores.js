/**
 * 패닉·역발상 매매용 점수 체계 (0~100).
 * 높을수록 시장 스트레스·공포가 크다고 보고, getAction에서 매매 단계로 매핑합니다.
 */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(x) {
  if (x === null || x === undefined || x === "") return NaN
  if (typeof x === "object" && x !== null && "value" in x) {
    return toNum(x.value)
  }
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

/** VIX ↑ → 공포 점수 ↑ (12 근처 낮음 ~ 40+ 높음) */
export function scoreVIX(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return 50
  const lo = 12
  const hi = 40
  return clamp(((v - lo) / (hi - lo)) * 100, 0, 100)
}

/** Put/Call ↑ → 공포 점수 ↑ */
export function scorePutCall(pc) {
  const p = toNum(pc)
  if (!Number.isFinite(p)) return 50
  const lo = 0.65
  const hi = 1.25
  return clamp(((p - lo) / (hi - lo)) * 100, 0, 100)
}

/** Fear & Greed ↓ → 공포 점수 ↑ (지수 0~100 가정) */
export function scoreFearGreed(fg) {
  const f = toNum(fg)
  if (!Number.isFinite(f)) return 50
  return clamp(100 - f, 0, 100)
}

/** BofA ↓ → 공포 점수 ↑ (0~6 스케일 가정) */
export function scoreBofa(bofa) {
  const b = toNum(bofa)
  if (!Number.isFinite(b)) return 50
  const hi = 6
  return clamp(((hi - clamp(b, 0, hi)) / hi) * 100, 0, 100)
}

/** High yield 스프레드 ↑ → 점수 ↓ (신용 스트레스 시 중기 가중 완화) */
export function scoreHY(hy) {
  const h = toNum(hy)
  if (!Number.isFinite(h)) return 50
  const lo = 3
  const hi = 10
  return clamp(100 - ((h - lo) / (hi - lo)) * 100, 0, 100)
}

/** 단기: VIX 60% + Put/Call 40% */
export function getShortScore(vix, putCall) {
  const raw = scoreVIX(vix) * 0.6 + scorePutCall(putCall) * 0.4
  return Math.round(clamp(raw, 0, 100))
}

/** 중기: Fear&Greed 40% + BofA 35% + HY 25% */
export function getMidScore(fearGreed, bofa, highYield) {
  const raw =
    scoreFearGreed(fearGreed) * 0.4 +
    scoreBofa(bofa) * 0.35 +
    scoreHY(highYield) * 0.25
  return Math.round(clamp(raw, 0, 100))
}

/**
 * 동적 가중치 (합 1).
 * - VIX > 25 → 단기 70% / 중기 30%
 * - HighYield > 6 → 단기 40% / 중기 60% (신용 국면 우선)
 * - 둘 다 해당 시 HY 조건 우선
 */
export function getDynamicWeights(vix, highYield) {
  const h = toNum(highYield)
  const v = toNum(vix)
  if (Number.isFinite(h) && h > 6) {
    return { wShort: 0.4, wMid: 0.6, reason: "highYield>6" }
  }
  if (Number.isFinite(v) && v > 25) {
    return { wShort: 0.7, wMid: 0.3, reason: "vix>25" }
  }
  return { wShort: 0.5, wMid: 0.5, reason: "balanced" }
}

/** UI용 가중치 설명 */
export function describeDynamicWeights(vix, highYield) {
  const { wShort, wMid, reason } = getDynamicWeights(vix, highYield)
  const pct = (x) => `${Math.round(x * 100)}%`
  if (reason === "highYield>6") {
    return `동적 가중: 단기 ${pct(wShort)} · 중기 ${pct(wMid)} (HY>6, 중기 비중↑)`
  }
  if (reason === "vix>25") {
    return `동적 가중: 단기 ${pct(wShort)} · 중기 ${pct(wMid)} (VIX>25, 단기 비중↑)`
  }
  return `동적 가중: 단기 ${pct(wShort)} · 중기 ${pct(wMid)}`
}

/** 서버 data → 최종 0~100 */
export function getFinalScore(data) {
  const short = getShortScore(data.vix, data.putCall)
  const mid = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const { wShort, wMid } = getDynamicWeights(data.vix, data.highYield)
  const raw = short * wShort + mid * wMid
  return Math.round(clamp(raw, 0, 100))
}

/** 최종 점수 → 매매 행동 문구 */
export function getAction(score) {
  const s = toNum(score)
  const x = Number.isFinite(s) ? s : 0
  if (x >= 80) return "🔥 강한 매수"
  if (x >= 65) return "매수 구간"
  if (x >= 50) return "중립"
  if (x >= 35) return "비중 축소"
  return "🚨 위험 회피"
}

export function getActionTone(score) {
  const s = toNum(score)
  const x = Number.isFinite(s) ? s : 0
  if (x >= 80) return "text-emerald-400"
  if (x >= 65) return "text-green-400"
  if (x >= 50) return "text-amber-400"
  if (x >= 35) return "text-orange-400"
  return "text-red-400"
}
