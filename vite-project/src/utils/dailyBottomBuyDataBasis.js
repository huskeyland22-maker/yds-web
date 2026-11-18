/**
 * Daily Bottom Buy — data-basis label helpers (UI only).
 * Does not change evaluation engine or API payloads.
 */

import {
  ETF_PRICE_STALE_LAG_DAYS,
  getEtfPriceLagDays,
  pickEtfDataAsOf,
} from "../content/ydsEtfInvestDecision.js"

/**
 * Prefer first valid asOfDate from ETF cards (screen shows once).
 * FREE summary may redact card.asOfDate — fall back to quality.asOfDate.
 * @param {Array<Record<string, unknown> | null | undefined> | null | undefined} cards
 * @returns {string | null}
 */
export function pickDailyBottomAsOfDate(cards) {
  if (!Array.isArray(cards)) return null
  for (const card of cards) {
    const d = pickEtfDataAsOf(card)
    if (d) return d
  }
  return null
}

/**
 * @param {{ asOfDate?: string | null, source?: string | null, today?: string | Date }} opts
 * @returns {{ line: string, warn: string | null, isSnapshot: boolean, lagDays: number | null, isStale: boolean }}
 */
export function formatDailyBottomDataBasis({ asOfDate = null, source = null, today = new Date() } = {}) {
  const isSnapshot = source === "snapshot"
  const date = typeof asOfDate === "string" && asOfDate.trim() ? asOfDate.trim() : null
  const lagDays = getEtfPriceLagDays(date, today)
  const isStale = lagDays != null && lagDays > ETF_PRICE_STALE_LAG_DAYS

  if (isSnapshot) {
    return {
      isSnapshot: true,
      lagDays,
      isStale,
      line: date ? `기준일 ${date} · 최근 저장 데이터` : "최근 저장 데이터",
      warn: isStale
        ? `⚠️ 저장 데이터 지연 · 기준일 ${date} (${lagDays}일 전) · 정상 매수 신호로 보지 마세요`
        : "⚠️ 실시간 데이터 연결 실패 · 최근 저장 데이터 표시 중",
    }
  }

  if (date) {
    return {
      isSnapshot: false,
      lagDays,
      isStale,
      line: isStale
        ? `기준일 ${date} · 데이터 지연 (${lagDays}일)`
        : `기준일 ${date} · 미국장 최근 종가 · 실시간`,
      warn: isStale
        ? `⚠️ 데이터 지연 · 가격 기준일이 ${lagDays}일 전입니다 · 정상 매수 신호로 표시하지 않습니다`
        : null,
    }
  }
  return {
    isSnapshot: false,
    lagDays: null,
    isStale: false,
    line: "미국장 최근 종가 · 실시간",
    warn: null,
  }
}
