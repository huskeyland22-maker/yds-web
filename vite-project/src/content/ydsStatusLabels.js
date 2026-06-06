/**
 * YDS V1.2 Status Labels — UI 해석 전용 (점수·구간·가중치 무관)
 * 사이클 위치 = 100 − YDS (침체↔과열) · 패닉 강도 = YDS (공포↔타점)
 */

/** @typedef {{
 *   id: string
 *   min: number
 *   max: number
 *   emoji: string
 *   label: string
 *   color: string
 * }} StatusBand */

/** @type {StatusBand[]} */
export const CYCLE_STATUS_BANDS = [
  { id: "depression", min: 0, max: 20, emoji: "🔴", label: "극단적 침체", color: "#ef4444" },
  { id: "recovery", min: 20, max: 40, emoji: "🟠", label: "회복 초기", color: "#f97316" },
  { id: "neutral", min: 40, max: 60, emoji: "🟡", label: "중립", color: "#eab308" },
  { id: "neutralHigh", min: 60, max: 80, emoji: "🟢", label: "중립 상단", color: "#22c55e" },
  { id: "overheat", min: 80, max: 100, emoji: "🔵", label: "과열", color: "#3b82f6" },
]

/** @type {StatusBand[]} */
export const PANIC_STATUS_BANDS = [
  { id: "noFear", min: 0, max: 20, emoji: "🔵", label: "공포 없음", color: "#3b82f6" },
  { id: "lowFear", min: 20, max: 40, emoji: "🟢", label: "공포 부족", color: "#22c55e" },
  { id: "interest", min: 40, max: 60, emoji: "🟡", label: "관심 구간", color: "#eab308" },
  { id: "dca", min: 60, max: 80, emoji: "🟠", label: "분할매수", color: "#f97316" },
  { id: "lifePoint", min: 80, max: 100, emoji: "🔴", label: "인생 타점", color: "#ef4444" },
]

/** @typedef {"calm"|"slowdown"|"sharpDrop"|"riskOff"} MomentumStatusTier */

/** @type {Record<MomentumStatusTier, { emoji: string; label: string; color: string }>} */
export const MOMENTUM_STATUS_LABELS = {
  calm: { emoji: "🟢", label: "단기 안정", color: "#22c55e" },
  slowdown: { emoji: "⚠️", label: "투자심리 둔화", color: "#eab308" },
  sharpDrop: { emoji: "⚠️", label: "투자심리 급랭", color: "#f97316" },
  riskOff: { emoji: "🚨", label: "급격한 위험회피", color: "#ef4444" },
}

/**
 * @param {number | null | undefined} scoreRaw
 */
function clampScore(scoreRaw) {
  if (scoreRaw == null || !Number.isFinite(Number(scoreRaw))) return null
  return Math.max(0, Math.min(100, Math.round(Number(scoreRaw))))
}

/**
 * @param {number | null | undefined} scoreRaw
 * @param {StatusBand[]} bands
 */
function resolveBandExclusive(scoreRaw, bands) {
  const score = clampScore(scoreRaw)
  if (score == null) return null
  for (const band of bands) {
    if (score < band.max) {
      return {
        score,
        id: band.id,
        min: band.min,
        max: band.max,
        emoji: band.emoji,
        label: band.label,
        color: band.color,
      }
    }
  }
  const last = bands[bands.length - 1]
  return {
    score,
    id: last.id,
    min: last.min,
    max: last.max,
    emoji: last.emoji,
    label: last.label,
    color: last.color,
  }
}

/**
 * 사이클 위치 (100 − YDS) — 침체↔과열
 * @param {number | null | undefined} ydsScore
 */
export function resolveCycleStatusLabel(ydsScore) {
  const yds = clampScore(ydsScore)
  if (yds == null) return null
  return resolveBandExclusive(100 - yds, CYCLE_STATUS_BANDS)
}

/**
 * 패닉 강도 (YDS)
 * @param {number | null | undefined} ydsScore
 */
export function resolvePanicStatusLabel(ydsScore) {
  return resolveBandExclusive(ydsScore, PANIC_STATUS_BANDS)
}

/** @typedef {typeof CYCLE_STATUS_BANDS[number]["id"]} CycleBandId */
/** @typedef {typeof PANIC_STATUS_BANDS[number]["id"]} PanicBandId */

/**
 * 사이클 × 패닉 → 최종 한줄 요약 (15~20자 · UI 전용)
 * @type {Record<CycleBandId, Record<PanicBandId, string>>}
 */
export const MARKET_HEADLINE_MAP = {
  depression: {
    noFear: "극단 침체 · 바닥 확인",
    lowFear: "극단 침체 · 관망 유지",
    interest: "깊은 침체 · 매수 검토",
    dca: "공포 확대 · 분할매수",
    lifePoint: "역사적 매수 기회",
  },
  recovery: {
    noFear: "회복 초기 · 공포 미약",
    lowFear: "회복 시작 · 매수 준비",
    interest: "회복 구간 · 분할 준비",
    dca: "공포 확대 · 분할매수 진행",
    lifePoint: "공포 정점 · 적극 매수",
  },
  neutral: {
    noFear: "중립 시장 · 안정 유지",
    lowFear: "중립 구간 · 관망",
    interest: "조정 관찰 · 분할매수 준비",
    dca: "공포 상승 · 매수 진행",
    lifePoint: "공포 정점 · 분할매수",
  },
  neutralHigh: {
    noFear: "중반 이후 · 과열 주의",
    lowFear: "중반 이후 시장 · 매수기회 부족",
    interest: "고점 근접 · 관망",
    dca: "조정 초입 · 분할매수",
    lifePoint: "급락 조정 · 매수 기회",
  },
  overheat: {
    noFear: "과열권 진입 · 현금 확보 우위",
    lowFear: "과열 지속 · 현금 비중 확대",
    interest: "고점 근접 · 현금 준비",
    dca: "과열 조정 · 분할매수",
    lifePoint: "역사적 고점 · 현금 확보",
  },
}

/**
 * @param {CycleBandId | null | undefined} cycleId
 * @param {PanicBandId | null | undefined} panicId
 */
export function resolveMarketHeadline(cycleId, panicId) {
  if (!cycleId || !panicId) return null
  const row = MARKET_HEADLINE_MAP[cycleId]
  if (!row) return null
  const text = row[panicId]
  if (!text) return null
  return { text, emoji: "📍" }
}

/**
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} momentum
 */
export function resolveMomentumStatusLabel(momentum) {
  if (!momentum) {
    return { tier: /** @type {MomentumStatusTier} */ ("calm"), ...MOMENTUM_STATUS_LABELS.calm }
  }

  const { level, cnnLevel, bofaLevel, cnnDelta3d } = momentum

  if (level === "none") {
    return { tier: "calm", ...MOMENTUM_STATUS_LABELS.calm }
  }

  const cnnCritical =
    cnnLevel === "strong" ||
    (cnnDelta3d != null && cnnDelta3d <= -25)
  const bofaStrong = bofaLevel === "strong"

  if (cnnCritical && (bofaStrong || cnnDelta3d != null && cnnDelta3d <= -25)) {
    return { tier: "riskOff", ...MOMENTUM_STATUS_LABELS.riskOff }
  }
  if (level === "strong" || cnnLevel === "strong") {
    return { tier: "sharpDrop", ...MOMENTUM_STATUS_LABELS.sharpDrop }
  }
  return { tier: "slowdown", ...MOMENTUM_STATUS_LABELS.slowdown }
}

/**
 * @param {number | null | undefined} ydsScore
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} momentum
 */
export function resolveYdsStatusSnapshot(ydsScore, momentum) {
  const yds = clampScore(ydsScore)
  const cycle = resolveCycleStatusLabel(yds)
  const panic = resolvePanicStatusLabel(yds)
  return {
    ydsScore: yds,
    cycle,
    panic,
    momentum: resolveMomentumStatusLabel(momentum),
    headline: resolveMarketHeadline(cycle?.id, panic?.id),
  }
}
