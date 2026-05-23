/**
 * 시장 엔진 히스토리 — 상태바·배지·가이드 (UI 전용)
 */
import { PANIC_V2_STATUS_BANDS, resolvePanicV2Status } from "./panicV2Status.js"
import { TACTICAL_EVENT_LABELS } from "./panicTacticalTradeEvents.js"
import { resolveTacticalTradeEventId } from "./panicTacticalTradeEvents.js"

/** @typedef {{ id: string; label: string; emoji: string; min: number; max: number }} StatusBarSegment */

/** 거시 V1 — 패닉 스케일 (낮을수록 안정) */
/** @type {StatusBarSegment[]} */
export const MACRO_MARKET_STATUS_BAR = [
  { id: "stable", label: "안정", emoji: "🟢", min: 0, max: 20 },
  { id: "observe", label: "관찰", emoji: "🔵", min: 20, max: 40 },
  { id: "caution", label: "경계", emoji: "🟡", min: 40, max: 60 },
  { id: "fear", label: "공포", emoji: "🟠", min: 60, max: 80 },
  { id: "panic", label: "패닉", emoji: "🔴", min: 80, max: 100 },
]

/** 실전 V2 — 관심유지(좌) → 리스크주의(우), ▲는 이벤트 ID 기준 */
/** @type {StatusBarSegment[]} */
export const TACTICAL_ACTION_STATUS_BAR = [
  { id: "maintainInterest", label: "관심유지", emoji: "🟢", min: 0, max: 100 },
  { id: "buyCandidate", label: "매수후보", emoji: "🔵", min: 0, max: 100 },
  { id: "addWeight", label: "비중확대", emoji: "🟡", min: 0, max: 100 },
  { id: "watch", label: "관망", emoji: "🟠", min: 0, max: 100 },
  { id: "riskCaution", label: "리스크주의", emoji: "🔴", min: 0, max: 100 },
]

/** @type {Record<string, { badge: string; title: string; hint: string }>} */
export const MACRO_MARKET_GUIDANCE = {
  stable: {
    badge: "안정구간",
    title: "현재 시장",
    hint: "변동성 낮음 · 선별적 진입 검토 가능",
  },
  observe: {
    badge: "위험구간",
    title: "현재 시장",
    hint: "시장 전반 리스크 존재 · 보수적 접근 권장",
  },
  caution: {
    badge: "경계구간",
    title: "현재 시장",
    hint: "방향성 혼재 · 포지션 크기 제한",
  },
  fear: {
    badge: "공포구간",
    title: "현재 시장",
    hint: "변동성 확대 · 비중 축소·헤지 검토",
  },
  panic: {
    badge: "패닉구간",
    title: "현재 시장",
    hint: "극단 공포 · 유동성·현금 우선",
  },
}

/** @type {Record<string, { badge: string; action: string; hint: string }>} */
export const TACTICAL_ACTION_GUIDANCE = {
  buyCandidate: {
    badge: "매수후보",
    action: "매수 후보 검토",
    hint: "조건 충족 · 분할 진입 검토",
  },
  maintainInterest: {
    badge: "관심유지",
    action: "관심 유지",
    hint: "신규 진입 신호 약함",
  },
  addWeight: {
    badge: "비중확대",
    action: "비중 확대 검토",
    hint: "흐름 개선 · 단계적 비중 가감",
  },
  watch: {
    badge: "관망",
    action: "관망",
    hint: "추가 확인 후 대응",
  },
  riskCaution: {
    badge: "리스크주의",
    action: "리스크 주의",
    hint: "신규 진입 자제 · 방어 우선",
  },
}

/**
 * @param {number | null | undefined} score
 * @param {StatusBarSegment[]} segments
 */
export function resolveStatusBarIndex(score, segments) {
  const s = Number(score)
  if (!Number.isFinite(s)) return -1
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const isLast = i === segments.length - 1
    if (s >= seg.min && (isLast ? s <= seg.max : s < seg.max)) return i
  }
  if (s < segments[0]?.min) return 0
  return segments.length - 1
}

/** @param {number | null | undefined} score */
export function resolveMacroMarketStatus(score) {
  const band = resolvePanicV2Status(score)
  if (!band) return null
  const guidance = MACRO_MARKET_GUIDANCE[band.id] ?? null
  return {
    bandId: band.id,
    bandLabel: band.label,
    ...guidance,
  }
}

/**
 * @param {number | null | undefined} interestScore
 * @param {number | null} [prevInterest]
 */
export function resolveTacticalActionStatus(interestScore, prevInterest = null) {
  const s = Number(interestScore)
  if (!Number.isFinite(s)) return null
  const eventId = resolveTacticalTradeEventId(s, prevInterest)
  const guidance = TACTICAL_ACTION_GUIDANCE[eventId] ?? null
  const barIndex = TACTICAL_ACTION_STATUS_BAR.findIndex((seg) => seg.id === eventId)
  return {
    eventId,
    eventLabel: TACTICAL_EVENT_LABELS[eventId],
    barId: eventId,
    barIndex: barIndex >= 0 ? barIndex : 0,
    ...guidance,
  }
}
