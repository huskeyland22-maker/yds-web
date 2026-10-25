import { listTradeRecords, tradeReturnPct } from "./ydsTradeRecords.js"
import { buildDbbTradeStatusView } from "./ydsTradeRecordsStatus.js"

/**
 * ETF snapshot card → the same status input the card already uses.
 * @param {{
 *   ok?: boolean
 *   symbol?: string
 *   theme?: string
 *   themeShort?: string
 *   count?: number
 *   stage?: { label?: string } | null
 *   close?: number | null
 *   asOfDate?: string | null
 * } | null | undefined} card
 */
export function etfCardProgressEntry(card) {
  if (!card?.symbol) return null
  return {
    symbol: card.symbol,
    name: card.themeShort || card.theme || card.symbol,
    card: card.ok
      ? {
          count: card.count,
          stage: card.stage,
          close: card.close,
          asOfDate: card.asOfDate,
        }
      : null,
  }
}

/**
 * Equity view uses score/price/asOf. Map onto the existing DBB status card shape.
 * @param {{ symbol?: string, name?: string } | null | undefined} meta
 * @param {{
 *   ok?: boolean
 *   symbol?: string
 *   name?: string
 *   score?: number | null
 *   price?: number | null
 *   asOf?: string | null
 *   state?: { label?: string } | null
 * } | null | undefined} view
 */
export function equityViewProgressEntry(meta, view) {
  const symbol = meta?.symbol || view?.symbol
  if (!symbol) return null
  const live = view?.ok ? view : null
  return {
    symbol,
    name: meta?.name || live?.name || symbol,
    card: live
      ? {
          count: Number(live.score) || 0,
          stage: { label: live.state?.label || "" },
          close: live.price,
          asOfDate: live.asOf,
        }
      : null,
  }
}

/**
 * Symbols with at least one dbb record. Missing live cards stay in the list
 * without a fabricated score.
 * @param {Array<{ symbol: string, name?: string, card?: object | null } | null>} entries
 */
export function collectDbbBuyProgress(entries) {
  const items = []
  for (const entry of entries || []) {
    if (!entry?.symbol) continue
    const records = listTradeRecords("dbb", entry.symbol)
    if (!records.length) continue
    const statusView = entry.card
      ? buildDbbTradeStatusView(entry.card, records, entry.card.asOfDate)
      : null
    // No live score card: keep statusView null (UI shows 준비 중) but still
    // compute weight / next step / days from records via the same status helper.
    const statusMetaView = statusView
      ? null
      : buildDbbTradeStatusView({ count: 0 }, records, null)
    items.push({
      symbol: entry.symbol,
      name: entry.name || entry.symbol,
      statusView,
      statusMetaView,
      recordedWeightPct: statusView
        ? statusView.recordedWeightPct
        : statusMetaView.recordedWeightPct,
      avgBuyPrice: statusView ? statusView.avgBuyPrice : statusMetaView.avgBuyPrice,
    })
  }
  return items
}

/**
 * New York trading date for a quote timestamp. Empty when the timestamp is missing.
 * @param {string | null | undefined} updatedAt
 * @returns {string | null}
 */
export function holdingQuoteAsOf(updatedAt) {
  if (typeof updatedAt !== "string" || !updatedAt) return null
  const ms = Date.parse(updatedAt)
  if (!Number.isFinite(ms)) {
    return /^\d{4}-\d{2}-\d{2}/.test(updatedAt) ? updatedAt.slice(0, 10) : null
  }
  try {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms))
    return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : null
  } catch {
    return /^\d{4}-\d{2}-\d{2}/.test(updatedAt) ? updatedAt.slice(0, 10) : null
  }
}

/**
 * Attach a real quote to a holdings card that has no scored status view.
 * A live score card (AAPL and the other scanned names) is left as-is.
 * @param {object | null | undefined} item
 * @param {{ price?: number | null, updatedAt?: string | null } | null | undefined} quote
 */
export function attachHoldingQuote(item, quote) {
  if (!item || item.statusView) return item
  const price = Number(quote?.price)
  if (!Number.isFinite(price) || price <= 0) return item
  return {
    ...item,
    quotePrice: price,
    quoteAsOf: holdingQuoteAsOf(quote?.updatedAt),
    quoteReturnPct: tradeReturnPct(item.avgBuyPrice, price),
  }
}
