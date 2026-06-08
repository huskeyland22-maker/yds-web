/**
 * Phase 6-1 — Portfolio Quote types (클라이언트)
 */

/** @typedef {'live' | 'delayed' | 'error'} PortfolioQuoteStatus */

/**
 * @typedef {{
 *   price: number
 *   change: number | null
 *   currency: 'USD' | 'KRW'
 *   updatedAt: string
 *   status: PortfolioQuoteStatus
 *   source?: string
 *   stale?: boolean
 * }} PortfolioQuote
 */

/** @type {Record<PortfolioQuoteStatus, string>} */
export const QUOTE_STATUS_LABEL = {
  live: "실시간",
  delayed: "지연",
  error: "오류",
}

/**
 * @param {PortfolioQuoteStatus} status
 * @param {boolean} [stale]
 */
export function quoteStatusLabel(status, stale = false) {
  if (stale && status !== "error") return "지연"
  return QUOTE_STATUS_LABEL[status] ?? "오류"
}

/**
 * @param {string | null | undefined} iso
 */
export function formatQuoteUpdatedAt(iso) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d)
  } catch {
    return "—"
  }
}

/**
 * @param {number | PortfolioQuote | null | undefined} quoteOrPrice
 * @returns {number | null}
 */
export function quotePrice(quoteOrPrice) {
  if (quoteOrPrice == null) return null
  if (typeof quoteOrPrice === "number") return quoteOrPrice
  const p = quoteOrPrice.price
  return p != null && p > 0 ? p : null
}
