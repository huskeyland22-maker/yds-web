/**
 * 패닉·역발상 매매용 점수 체계 (0~100).
 * 높을수록 시장 스트레스·공포가 크다고 보고, getAction에서 매매 단계로 매핑합니다.
 */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(x) {
  if (x === null || x === undefined || x === "") return NaN
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

/** VIX ↑ → 공포 점수 ↑ (12 근처 낮음 ~ 40+ 높음) · Legacy: 결측 시 50 */
export function scoreVIX(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return 50
  const lo = 12
  const hi = 40
  return clamp(((v - lo) / (hi - lo)) * 100, 0, 100)
}

/** Put/Call ↑ → 공포 점수 ↑ · Legacy 스케일(0.65~1.25) · 결측 시 50 */
export function scorePutCall(pc) {
  const p = toNum(pc)
  if (!Number.isFinite(p)) return 50
  const lo = 0.65
  const hi = 1.25
  return clamp(((p - lo) / (hi - lo)) * 100, 0, 100)
}

/** Fear & Greed ↓ → 공포 점수 ↑ (지수 0~100 가정) · Legacy: 결측 시 50 */
export function scoreFearGreed(fg) {
  const f = toNum(fg)
  if (!Number.isFinite(f)) return 50
  return clamp(100 - f, 0, 100)
}

/** Panic Index V2 — VIX 점수 (결측 시 null, 임의 50 금지) */
export function scoreVixV2(vix) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return null
  return clamp(((v - 12) / (40 - 12)) * 100, 0, 100)
}

/** Panic Index V2 — CNN Fear & Greed 점수 (결측 시 null) */
export function scoreCnnV2(fg) {
  const f = toNum(fg)
  if (!Number.isFinite(f)) return null
  return clamp(100 - f, 0, 100)
}

/**
 * Panic Index V2 — Cboe Total Put/Call Ratio 점수
 * 0.92→0 · 1.14→50 · 1.39→100 (분포 기반 piecewise-linear)
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
 * 세 지표 중 하나라도 없으면 null (임의 50점 금지)
 * @param {{ vix?: unknown; fearGreed?: unknown; putCall?: unknown } | null | undefined} data
 * @returns {number | null}
 */
export function getPanicScoreV2(data) {
  if (!data || typeof data !== "object") return null
  const sV = scoreVixV2(data.vix)
  const sC = scoreCnnV2(data.fearGreed)
  const sP = scoreTotalPutCallV2(data.putCall)
  if (sV == null || sC == null || sP == null) return null
  return Math.round(clamp(0.45 * sV + 0.35 * sC + 0.2 * sP, 0, 100))
}

/**
 * Panic Index 표시용 — V2만 사용 (Legacy getFinalScore와 혼합하지 않음)
 * @returns {number | null}
 */
export function resolvePanicIndexScore(data) {
  return getPanicScoreV2(data)
}

/** @returns {{ id: string; label: string; min: number; max: number; color: string } | null} */
export function resolvePanicIndexStatus(score) {
  if (score == null || !Number.isFinite(Number(score))) return null
  const s = Math.max(0, Math.min(100, Math.round(Number(score))))
  if (s <= 39) return { id: "calm", label: "평상", min: 0, max: 39, color: "#22c55e" }
  if (s <= 59) return { id: "watch", label: "경계", min: 40, max: 59, color: "#eab308" }
  if (s <= 79) return { id: "strongFear", label: "강한 공포", min: 60, max: 79, color: "#f97316" }
  return { id: "panic", label: "패닉", min: 80, max: 100, color: "#ef4444" }
}

/**
 * V2 구성 분해 (입력값 + 개별 Score)
 * @returns {{
 *   ok: boolean
 *   total: number | null
 *   lines: Array<{ id: string; label: string; source: string; value: number | null; score: number | null; weight: number }>
 * } | null}
 */
export function buildPanicScoreV2Breakdown(data) {
  if (!data || typeof data !== "object") return null
  const vix = toNum(data.vix)
  const cnn = toNum(data.fearGreed)
  const pc = toNum(data.putCall)
  const sV = scoreVixV2(vix)
  const sC = scoreCnnV2(cnn)
  const sP = scoreTotalPutCallV2(pc)
  const lines = [
    {
      id: "vix",
      label: "VIX",
      source: "네이버",
      value: Number.isFinite(vix) ? vix : null,
      score: sV == null ? null : Math.round(sV * 10) / 10,
      weight: 0.45,
    },
    {
      id: "cnn",
      label: "CNN Fear & Greed",
      source: "CNN 공식",
      value: Number.isFinite(cnn) ? cnn : null,
      score: sC == null ? null : Math.round(sC * 10) / 10,
      weight: 0.35,
    },
    {
      id: "putCall",
      label: "Cboe Total P/C",
      source: "Cboe",
      value: Number.isFinite(pc) ? pc : null,
      score: sP == null ? null : Math.round(sP * 10) / 10,
      weight: 0.2,
    },
  ]
  const ok = sV != null && sC != null && sP != null
  return {
    ok,
    total: ok ? Math.round(clamp(0.45 * sV + 0.35 * sC + 0.2 * sP, 0, 100)) : null,
    lines,
  }
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

/**
 * 서버/엔진용 최종 점수.
 * VIX+CNN+Cboe Total P/C 세 값이 모두 있으면 Panic Index V2를 반환.
 * 불완전하면 Legacy 동적가중(결측 시 50 필)을 유지 — 기존 엔진 호환.
 * Panic Index UI는 getPanicScoreV2 / resolvePanicIndexScore를 직접 사용.
 */
export function getFinalScore(data) {
  const v2 = getPanicScoreV2(data)
  if (v2 != null) return v2
  const short = getShortScore(data.vix, data.putCall)
  const mid = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const { wShort, wMid } = getDynamicWeights(data.vix, data.highYield)
  const raw = short * wShort + mid * wMid
  return Math.round(clamp(raw, 0, 100))
}

/** Legacy only — historical 재계산·비교용 (덮어쓰지 않음) */
export function getFinalScoreLegacy(data) {
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
