/**
 * YDS V1.8 Status Labels — UI 해석 전용 (점수·구간·가중치 무관)
 * 사이클 위치 = 100 − YDS (시장은 어디쯤?) · 패닉 강도 = YDS (얼마나 싼가?)
 */

/** @typedef {{
 *   id: string
 *   min: number
 *   max: number
 *   emoji: string
 *   label: string
 *   color: string
 * }} StatusBand */

/** @type {StatusBand[]} — 시장 위치 (20~80 구간이 실전 판단의 중심) */
export const CYCLE_STATUS_BANDS = [
  { id: "depression", min: 0, max: 20, emoji: "🔵", label: "침체", color: "#3b82f6" },
  { id: "recovery", min: 20, max: 40, emoji: "🟢", label: "회복", color: "#22c55e" },
  { id: "growth", min: 40, max: 60, emoji: "🟡", label: "성장", color: "#eab308" },
  { id: "lateCycle", min: 60, max: 80, emoji: "🟠", label: "사이클 후반", color: "#f97316" },
  { id: "peakOverheat", min: 80, max: 100, emoji: "🔴", label: "최고 과열", color: "#ef4444" },
]

/** @type {StatusBand[]} — 패닉 강도 (GO #84 공포 강도 5단계) */
export const PANIC_STATUS_BANDS = [
  { id: "noFear", min: 0, max: 21, emoji: "🔵", label: "공포 부족", color: "#3b82f6" },
  { id: "lowFear", min: 21, max: 41, emoji: "🟢", label: "약한 공포", color: "#22c55e" },
  { id: "interest", min: 41, max: 61, emoji: "🟡", label: "중립", color: "#eab308" },
  { id: "dca", min: 61, max: 81, emoji: "🟠", label: "높은 공포", color: "#f97316" },
  { id: "lifePoint", min: 81, max: 101, emoji: "🔴", label: "극심한 공포", color: "#ef4444" },
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
 * 사이클 위치 × 패닉 기회 → 한줄 요약 (UI 전용)
 * @type {Record<CycleBandId, Record<PanicBandId, string>>}
 */
export const MARKET_HEADLINE_MAP = {
  depression: {
    noFear: "침체 바닥 · 공포 없음",
    lowFear: "깊은 침체 · 관망",
    interest: "침체 구간 · 매수 검토",
    dca: "침체·공포 확대 · 분할매수",
    lifePoint: "역사적 침체 · 극단 매수",
  },
  recovery: {
    noFear: "회복 국면 · 공포 미약",
    lowFear: "회복 중 · 매수 준비",
    interest: "회복·조정 관찰 · 준비",
    dca: "회복·공포 확대 · 분할매수",
    lifePoint: "회복 중 공포 정점 · 매수",
  },
  growth: {
    noFear: "성장 국면 · 안정",
    lowFear: "성장 중 · 관망",
    interest: "성장·조정 관찰 · 준비",
    dca: "성장 중 조정 · 분할매수",
    lifePoint: "성장 중 급락 · 매수 기회",
  },
  lateCycle: {
    noFear: "사이클 후반 · 과열 주의",
    lowFear: "사이클 후반 · 매수기회 부족",
    interest: "후반 고점 근접 · 관망",
    dca: "후반 조정 · 분할매수",
    lifePoint: "후반 급락 · 매수 기회",
  },
  peakOverheat: {
    noFear: "최고 과열 · 현금 확보",
    lowFear: "극과열 · 현금 비중 확대",
    interest: "극과열 고점 · 현금 준비",
    dca: "극과열 조정 · 분할매수",
    lifePoint: "극과열·공포 정점 · 역사적 기회",
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

/** @type {Record<MomentumStatusTier, { emoji: string; title: string; color: string }>} */
export const MOMENTUM_POSITION_LABELS = {
  calm: { emoji: "🟢", title: "단기 안정", color: "#22c55e" },
  slowdown: { emoji: "⚠️", title: "단기 악재 포지션", color: "#eab308" },
  sharpDrop: { emoji: "⚠️", title: "단기 악재 포지션", color: "#f97316" },
  riskOff: { emoji: "🚨", title: "단기 위험 확대", color: "#ef4444" },
}

/**
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} momentum
 */
export function resolveMomentumPositionLabel(momentum) {
  const status = resolveMomentumStatusLabel(momentum)
  const position = MOMENTUM_POSITION_LABELS[status.tier]
  return {
    tier: status.tier,
    emoji: position.emoji,
    title: position.title,
    detail: status.label,
    color: position.color,
  }
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
