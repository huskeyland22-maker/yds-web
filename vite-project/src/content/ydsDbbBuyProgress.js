import {
  averageTradeBuyPrice,
  listTradeRecords,
  sumTradeWeightPct,
} from "./ydsTradeRecords.js"
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
    items.push({
      symbol: entry.symbol,
      name: entry.name || entry.symbol,
      statusView,
      recordedWeightPct: statusView
        ? statusView.recordedWeightPct
        : sumTradeWeightPct(records),
      avgBuyPrice: statusView ? statusView.avgBuyPrice : averageTradeBuyPrice(records),
    })
  }
  return items
}
