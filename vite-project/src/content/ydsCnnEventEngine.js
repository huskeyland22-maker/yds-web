/**
 * CNN Event Engine V3 — 타임라인·Event Layer 공통 (표시 전용)
 * 시장 변화 기록: 3일·1일 변화량 + 지속 악화 감지
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
    priority: 72,
  },
  "momentum-cnn-day-bounce": {
    id: "momentum-cnn-day-bounce",
    title: "투자심리 급회복",
    action: "매수세 재유입 관찰",
    emoji: "🟢",
    severity: "low",
    priority: 71,
  },
  "momentum-cnn-soft-fall": {
    id: "momentum-cnn-soft-fall",
    title: "투자심리 추가 악화",
    action: "하락 흐름 지속",
    emoji: "🟠",
    severity: "medium",
    priority: 64,
  },
  "momentum-cnn-crash": {
    id: "momentum-cnn-crash",
    title: "조정 구간 진입",
    action: "관심 종목 탐색",
    emoji: "🔴",
    severity: "high",
    priority: 68,
  },
  "momentum-cnn-sharp": {
    id: "momentum-cnn-sharp",
    title: "과열 해소",
    action: "현금 비중 점검",
    emoji: "🟠",
    severity: "medium",
    priority: 66,
  },
  "momentum-cnn-weaken": {
    id: "momentum-cnn-weaken",
    title: "투자심리 약화",
    action: "관망 우선",
    emoji: "🟠",
    severity: "medium",
    priority: 62,
  },
  "momentum-cnn-surge": {
    id: "momentum-cnn-surge",
    title: "과열권 접근",
    action: "비중 점검",
    emoji: "🟢",
    severity: "medium",
    priority: 58,
  },
  "momentum-cnn-recovery": {
    id: "momentum-cnn-recovery",
    title: "심리 회복",
    action: "흐름 관찰",
    emoji: "🟢",
    severity: "low",
    priority: 56,
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
 * 타임라인 V3 — 그날 CNN 시장 변화 1건 (활성 tier·일일 변화 기록)
 * @param {number | null} delta3d
 * @param {number | null} delta1d
 * @returns {string | null} event type id
 */
export function resolveCnnTimelineEventType(delta3d, delta1d) {
  /** @type {string[]} */
  const candidates = []

  if (delta1d != null && delta1d <= -10) {
    candidates.push("momentum-cnn-day-shock")
  } else if (delta1d != null && delta1d >= 10) {
    candidates.push("momentum-cnn-day-bounce")
  } else if (delta1d != null && delta1d <= -5) {
    candidates.push("momentum-cnn-soft-fall")
  }

  const downType = downTierToType(resolveCnnDownTier(delta3d))
  if (downType) candidates.push(downType)

  const upType = upTierToType(resolveCnnUpTier(delta3d))
  if (upType) candidates.push(upType)

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
  else if (delta1d != null && delta1d <= -5) active.push("momentum-cnn-soft-fall")
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
