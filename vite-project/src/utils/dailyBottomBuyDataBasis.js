/**
 * Daily Bottom Buy — data-basis label helpers (UI only).
 * Does not change evaluation engine or API payloads.
 */

/**
 * Prefer first valid asOfDate from ETF cards (screen shows once).
 * @param {Array<{ asOfDate?: string | null }> | null | undefined} cards
 * @returns {string | null}
 */
export function pickDailyBottomAsOfDate(cards) {
  if (!Array.isArray(cards)) return null
  for (const card of cards) {
    const d = card?.asOfDate
    if (typeof d === "string" && d.trim()) return d.trim()
  }
  return null
}

/**
 * @param {{ asOfDate?: string | null, source?: string | null }} opts
 * @returns {{ line: string, warn: string | null, isSnapshot: boolean }}
 */
export function formatDailyBottomDataBasis({ asOfDate = null, source = null } = {}) {
  const isSnapshot = source === "snapshot"
  const date = typeof asOfDate === "string" && asOfDate.trim() ? asOfDate.trim() : null

  if (isSnapshot) {
    return {
      isSnapshot: true,
      line: date ? `기준일 ${date} · 최근 저장 데이터` : "최근 저장 데이터",
      warn: "시세 연결에 실패해 최근 저장 데이터를 표시합니다.",
    }
  }

  // live / api / unknown non-snapshot — US session close asOf (not intraday stream)
  if (date) {
    return {
      isSnapshot: false,
      line: `기준일 ${date} · 미국장 종가 기준`,
      warn: null,
    }
  }
  return {
    isSnapshot: false,
    line: "미국장 종가 기준",
    warn: null,
  }
}
