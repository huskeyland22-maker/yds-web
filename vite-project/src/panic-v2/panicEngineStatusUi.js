/**
 * 시장 엔진 히스토리 — 상태바·배지·가이드 (UI 전용)
 */
import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "./panicMacroV1Status.js"
import { TACTICAL_EVENT_LABELS } from "./panicTacticalTradeEvents.js"
import { resolveTacticalTradeEventId } from "./panicTacticalTradeEvents.js"

/** @typedef {{ id: string; label: string; emoji: string; min: number; max: number }} StatusBarSegment */

/** 거시 V1 — 패닉 상승 = 장기 매수 기회 */
/** @type {StatusBarSegment[]} */
export const MACRO_MARKET_STATUS_BAR = MACRO_V1_STATUS_BANDS.map((b) => ({
  id: b.id,
  label: b.label,
  emoji: b.emoji,
  min: b.id === "overheated" ? 0 : b.min,
  max: b.id === "panicBuy" ? 100 : b.max + 1,
}))

/** 실전 V2 — 관심유지(좌) → 리스크주의(우), ▲는 이벤트 ID 기준 */
/** @type {StatusBarSegment[]} */
export const TACTICAL_ACTION_STATUS_BAR = [
  { id: "maintainInterest", label: "관심유지", emoji: "🟢", min: 0, max: 100 },
  { id: "buyCandidate", label: "매수후보", emoji: "🔵", min: 0, max: 100 },
  { id: "addWeight", label: "비중확대", emoji: "🟡", min: 0, max: 100 },
  { id: "watch", label: "관망", emoji: "🟠", min: 0, max: 100 },
  { id: "riskCaution", label: "리스크주의", emoji: "🔴", min: 0, max: 100 },
]

/** @type {Record<string, { badge: string; hint: string }>} */
export const MACRO_MARKET_GUIDANCE = {
  overheated: {
    badge: "공포 없음",
    hint: "매수 기회 적음 · 비중 확대보다 관찰 우선",
  },
  neutral: {
    badge: "공포 부족",
    hint: "공포 미약 · 추격 자제 · 관찰",
  },
  interest: {
    badge: "관심",
    hint: "변동성 확대 가능 · 종목 발굴·현금 확보",
  },
  dca: {
    badge: "분할매수",
    hint: "공포 확대 · 장기 분할매수 시작",
  },
  panicBuy: {
    badge: "인생 타점",
    hint: "극단 공포 · 드문 보너스 기회",
  },
}

/** @type {Record<string, { badge: string; hint: string }>} */
export const TACTICAL_ACTION_GUIDANCE = {
  buyCandidate: {
    badge: "매수후보",
    hint: "조건 충족 · 분할 진입 검토",
  },
  maintainInterest: {
    badge: "관심유지",
    hint: "신규 진입 신호 약함",
  },
  addWeight: {
    badge: "비중확대",
    hint: "흐름 개선 · 단계적 비중 가감",
  },
  watch: {
    badge: "관망",
    hint: "추가 확인 후 대응",
  },
  riskCaution: {
    badge: "리스크주의",
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
  const band = resolveMacroV1Status(score)
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
