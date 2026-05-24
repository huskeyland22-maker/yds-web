/**
 * 실전 매매 존 — 손절·현재·목표 진행 (실시간 current 갱신 가능)
 */

/**
 * @typedef {{
 *   stop: number | null
 *   current: number | null
 *   target: number | null
 * }} TradingZonePriceLevels
 */

/**
 * @typedef {{
 *   levels: TradingZonePriceLevels
 *   progressPct: number | null
 *   direction: "up" | "down" | "flat"
 *   formatted: { stop: string; current: string; target: string } | null
 * }} TradingZoneProgressView
 */

/** @param {string | number | null | undefined} raw */
export function parseTradingPrice(raw) {
  if (raw == null || raw === "" || raw === "—") return null
  const s = String(raw).replace(/,/g, "").replace(/[^\d.-]/g, " ")
  const m = s.match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string | null | undefined} entryRange
 * @returns {number | null}
 */
export function parseEntryMid(entryRange) {
  if (!entryRange || entryRange === "—") return null
  const parts = String(entryRange).split(/[~\-–—]/).map((p) => parseTradingPrice(p.trim()))
  const valid = parts.filter((n) => n != null)
  if (!valid.length) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * @param {TradingZonePriceLevels} levels
 * @returns {TradingZoneProgressView | null}
 */
export function computeTradingZoneProgress(levels) {
  const { stop, current, target } = levels
  if (stop == null || current == null || target == null) return null
  if (stop === target) return null

  const lo = Math.min(stop, target)
  const hi = Math.max(stop, target)
  const span = hi - lo
  const progressPct = span > 0 ? Math.round((Math.max(lo, Math.min(hi, current)) - lo) / span * 100) : 0
  const direction = target > stop ? "up" : target < stop ? "down" : "flat"

  const fmt = (n) =>
    n >= 1000 ? Math.round(n).toLocaleString("ko-KR") : String(Math.round(n * 10) / 10)

  return {
    levels: { stop, current, target },
    progressPct: Math.max(0, Math.min(100, progressPct)),
    direction,
    formatted: {
      stop: fmt(stop),
      current: fmt(current),
      target: fmt(target),
    },
  }
}

/**
 * @param {{
 *   stopNum?: number | null
 *   currentPrice?: number | null
 *   targetNum?: number | null
 *   stop?: string
 *   target?: string
 *   entry?: string
 * }} position
 */
export function resolvePositionPriceLevels(position) {
  const stop =
    position.stopNum != null && Number.isFinite(position.stopNum)
      ? position.stopNum
      : parseTradingPrice(position.stop)
  const target =
    position.targetNum != null && Number.isFinite(position.targetNum)
      ? position.targetNum
      : parseTradingPrice(position.target)
  const current =
    position.currentPrice != null && Number.isFinite(position.currentPrice)
      ? position.currentPrice
      : parseEntryMid(position.entry)

  return { stop, current, target }
}
