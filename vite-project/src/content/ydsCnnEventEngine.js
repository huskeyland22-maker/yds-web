/**
 * CNN Event Engine V2 — 타임라인·Event Layer 공통 (표시 전용)
 * 3일·1일 변화량 기반 투자심리 이벤트
 */

import { findRowDaysBefore, mergeLayerHistory, rowDate, toNum } from "./ydsLayerHistory.js"

/** @typedef {"none"|"weaken"|"sharp"|"crash"} CnnDownTier */
/** @typedef {"none"|"recovery"|"surge"} CnnUpTier */

/**
 * @typedef {{
 *   id: string
 *   title: string
 *   action: string
 *   emoji: string
 *   severity: "low"|"medium"|"high"
 *   priority: number
 * }} CnnEventSpec
 */

export const CNN_EVENT_WINDOW_DAYS = 3

/** @type {Record<string, CnnEventSpec>} */
export const CNN_EVENT_SPECS = {
  "momentum-cnn-day-shock": {
    id: "momentum-cnn-day-shock",
    title: "투자심리 급변",
    action: "단기 변동성 확대",
    emoji: "🟠",
    severity: "medium",
    priority: 100,
  },
  "momentum-cnn-day-bounce": {
    id: "momentum-cnn-day-bounce",
    title: "투자심리 급회복",
    action: "매수세 재유입 관찰",
    emoji: "🟢",
    severity: "low",
    priority: 95,
  },
  "momentum-cnn-crash": {
    id: "momentum-cnn-crash",
    title: "투자심리 급랭",
    action: "신규 진입 보류",
    emoji: "🔴",
    severity: "high",
    priority: 80,
  },
  "momentum-cnn-sharp": {
    id: "momentum-cnn-sharp",
    title: "투자심리 급락",
    action: "과열 해소 시작",
    emoji: "🟠",
    severity: "medium",
    priority: 70,
  },
  "momentum-cnn-weaken": {
    id: "momentum-cnn-weaken",
    title: "투자심리 악화",
    action: "관망 우선",
    emoji: "🟠",
    severity: "medium",
    priority: 60,
  },
  "momentum-cnn-surge": {
    id: "momentum-cnn-surge",
    title: "투자심리 급반등",
    action: "매수세 유입 관찰",
    emoji: "🟢",
    severity: "medium",
    priority: 55,
  },
  "momentum-cnn-recovery": {
    id: "momentum-cnn-recovery",
    title: "투자심리 회복",
    action: "심리 개선 관찰",
    emoji: "🟢",
    severity: "low",
    priority: 50,
  },
}

const DOWN_RANK = { none: 0, weaken: 1, sharp: 2, crash: 3 }
const UP_RANK = { none: 0, recovery: 1, surge: 2 }

/**
 * @param {object | null | undefined} row
 * @param {object[]} priorRows
 */
export function computeCnnDeltas(row, priorRows) {
  const asOf = rowDate(row)
  if (!asOf) return { delta3d: null, delta1d: null }

  const merged = mergeLayerHistory(priorRows, asOf, row)
  const cnnNow = toNum(row?.fearGreed)
  const row3d = findRowDaysBefore(merged, CNN_EVENT_WINDOW_DAYS)
  const cnn3d = toNum(row3d?.fearGreed)
  const delta3d = cnnNow != null && cnn3d != null ? cnnNow - cnn3d : null

  const prev = priorRows[priorRows.length - 1] ?? null
  const cnnPrev = toNum(prev?.fearGreed)
  const delta1d = cnnNow != null && cnnPrev != null ? cnnNow - cnnPrev : null

  return { delta3d, delta1d }
}

/** @param {number | null} delta3d @returns {CnnDownTier} */
export function resolveCnnDownTier(delta3d) {
  if (delta3d == null || !Number.isFinite(delta3d)) return "none"
  if (delta3d <= -25) return "crash"
  if (delta3d <= -15) return "sharp"
  if (delta3d <= -10) return "weaken"
  return "none"
}

/** @param {number | null} delta3d @returns {CnnUpTier} */
export function resolveCnnUpTier(delta3d) {
  if (delta3d == null || !Number.isFinite(delta3d)) return "none"
  if (delta3d >= 15) return "surge"
  if (delta3d >= 10) return "recovery"
  return "none"
}

/** @param {CnnDownTier} tier */
function downTierToType(tier) {
  if (tier === "crash") return "momentum-cnn-crash"
  if (tier === "sharp") return "momentum-cnn-sharp"
  if (tier === "weaken") return "momentum-cnn-weaken"
  return null
}

/** @param {CnnUpTier} tier */
function upTierToType(tier) {
  if (tier === "surge") return "momentum-cnn-surge"
  if (tier === "recovery") return "momentum-cnn-recovery"
  return null
}

/**
 * 타임라인 — 그날 기록할 CNN 이벤트 1건 (우선순위·전환 기준)
 * @param {number | null} delta3d
 * @param {number | null} delta1d
 * @param {CnnDownTier} prevDownTier
 * @param {CnnUpTier} prevUpTier
 * @returns {string | null} event type id
 */
export function resolveCnnTimelineEventType(delta3d, delta1d, prevDownTier, prevUpTier) {
  /** @type {string[]} */
  const candidates = []

  if (delta1d != null && delta1d <= -10) {
    candidates.push("momentum-cnn-day-shock")
  } else if (delta1d != null && delta1d >= 10) {
    candidates.push("momentum-cnn-day-bounce")
  }

  const downTier = resolveCnnDownTier(delta3d)
  const upTier = resolveCnnUpTier(delta3d)

  if (DOWN_RANK[downTier] > DOWN_RANK[prevDownTier]) {
    const type = downTierToType(downTier)
    if (type) candidates.push(type)
  }
  if (UP_RANK[upTier] > UP_RANK[prevUpTier]) {
    const type = upTierToType(upTier)
    if (type) candidates.push(type)
  }

  if (!candidates.length) return null

  candidates.sort(
    (a, b) => (CNN_EVENT_SPECS[b]?.priority ?? 0) - (CNN_EVENT_SPECS[a]?.priority ?? 0),
  )
  return candidates[0]
}

/**
 * Hero Event Layer — 현재 활성 CNN 이벤트 (가장 강한 1건)
 * @param {number | null} delta3d
 * @param {number | null} delta1d
 * @returns {CnnEventSpec | null}
 */
export function resolveActiveCnnEventSpec(delta3d, delta1d) {
  /** @type {string[]} */
  const active = []

  if (delta1d != null && delta1d <= -10) active.push("momentum-cnn-day-shock")
  if (delta1d != null && delta1d >= 10) active.push("momentum-cnn-day-bounce")

  const downType = downTierToType(resolveCnnDownTier(delta3d))
  if (downType) active.push(downType)

  const upType = upTierToType(resolveCnnUpTier(delta3d))
  if (upType) active.push(upType)

  if (!active.length) return null

  active.sort(
    (a, b) => (CNN_EVENT_SPECS[b]?.priority ?? 0) - (CNN_EVENT_SPECS[a]?.priority ?? 0),
  )
  return CNN_EVENT_SPECS[active[0]] ?? null
}

/** @param {string} type */
export function cnnEventSpec(type) {
  return CNN_EVENT_SPECS[type] ?? null
}
