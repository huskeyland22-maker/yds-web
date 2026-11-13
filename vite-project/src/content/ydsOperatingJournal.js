/**
 * Realized sells from the operating buy ledger (`yds.tradeRecords.v1`).
 * Buy rows stay in storage and are not listed here.
 * Mark-to-market quotes are not part of this report.
 */

import { replayEquityPosition } from "./ydsEquitySellLedger.js"
import { EQUITY_HOLDING_DISPLAY, EQUITY_RESEARCH_NAME_KO } from "../utils/equityResearchDisplay.js"

/**
 * @param {string} symbol
 */
export function operatingSymbolName(symbol) {
  const sym = String(symbol || "").trim().toUpperCase()
  const held = EQUITY_HOLDING_DISPLAY.find((row) => row.symbol === sym)
  if (held?.name) return held.name
  return EQUITY_RESEARCH_NAME_KO[sym] || sym
}

/**
 * @param {{ buyDate?: string }[]} links
 */
function buyDateLabel(links) {
  const dates = []
  for (const link of links || []) {
    if (link?.buyDate && !dates.includes(link.buyDate)) dates.push(link.buyDate)
  }
  return dates.join(", ")
}

/**
 * One row per stored sell. A symbol with only buys contributes nothing.
 * @param {{ records?: Record<string, object[]>, sells?: object[] }} store
 */
export function buildOperatingJournal(store) {
  /** @type {object[]} */
  const rows = []
  /** @type {object[]} */
  const sellTargets = []
  const seen = new Set()
  let soldCost = 0
  const sells = Array.isArray(store?.sells) ? store.sells : []

  for (const [key, list] of Object.entries(store?.records || {})) {
    const split = key.indexOf(":")
    if (split < 1) continue
    const system = key.slice(0, split)
    const symbol = key.slice(split + 1)
    if (system !== "dbb" && system !== "panic") continue
    const buys = Array.isArray(list) ? list : []
    if (!buys.length) continue
    const ownSells = sells.filter((row) => row?.system === system && row?.symbol === symbol)
    const position = replayEquityPosition(buys, ownSells)
    const name = operatingSymbolName(symbol)
    if (position.openShares > 1e-8) {
      sellTargets.push({ system, symbol, name, openShares: position.openShares })
    }
    for (const sell of position.settlements) {
      if (!sell.id || seen.has(sell.id)) continue
      seen.add(sell.id)
      soldCost += sell.cost
      rows.push({
        id: sell.id,
        date: sell.sellDate,
        buyDateLabel: buyDateLabel(sell.links),
        createdAt: sell.createdAt || sell.sellDate,
        system,
        symbol,
        name,
        avgBuyPrice: sell.filledShares > 0 ? sell.cost / sell.filledShares : null,
        sellPrice: sell.sellPrice,
        shares: sell.filledShares,
        cost: sell.cost,
        proceeds: sell.proceeds,
        feeUsd: sell.feeUsd,
        taxUsd: sell.taxUsd,
        memo: sell.memo || "",
        realizedPnl: sell.realizedPnl,
        returnPct: sell.returnPct,
        fullClose: sell.fullClose,
      })
    }
  }

  rows.sort(
    (a, b) =>
      String(b.date).localeCompare(String(a.date)) ||
      String(b.createdAt).localeCompare(String(a.createdAt)),
  )
  const realized = rows.reduce((sum, row) => sum + row.realizedPnl, 0)
  const wins = rows.filter((row) => row.realizedPnl > 0)
  const losses = rows.filter((row) => row.realizedPnl < 0)
  /** @type {Record<string, number>} */
  const byMonth = {}
  /** @type {Record<string, number>} */
  const byYear = {}
  for (const row of rows) {
    const month = String(row.date).slice(0, 7)
    const year = String(row.date).slice(0, 4)
    byMonth[month] = (byMonth[month] || 0) + row.realizedPnl
    byYear[year] = (byYear[year] || 0) + row.realizedPnl
  }

  return {
    realizedPnl: realized,
    cumulativeReturnPct: soldCost > 0 ? (realized / soldCost) * 100 : null,
    sellCount: rows.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRatePct: rows.length ? (wins.length / rows.length) * 100 : null,
    rows,
    sellTargets,
    months: Object.entries(byMonth)
      .map(([key, pnl]) => ({ key, pnl }))
      .sort((a, b) => b.key.localeCompare(a.key)),
    years: Object.entries(byYear)
      .map(([key, pnl]) => ({ key, pnl }))
      .sort((a, b) => b.key.localeCompare(a.key)),
  }
}

/**
 * @param {object[]} rows
 * @param {{ query?: string, year?: string, month?: string }} filter
 */
export function filterJournalRows(rows, filter = {}) {
  const query = String(filter.query || "").trim().toLowerCase()
  const year = /^\d{4}$/.test(filter.year || "") ? filter.year : ""
  const month = /^\d{4}-\d{2}$/.test(filter.month || "") ? filter.month : ""
  return (rows || []).filter((row) => {
    const date = String(row.date || "")
    if (year && !date.startsWith(year)) return false
    if (month && !date.startsWith(month)) return false
    if (!query) return true
    return (
      String(row.symbol).toLowerCase().includes(query) ||
      String(row.name).toLowerCase().includes(query) ||
      String(row.memo || "").toLowerCase().includes(query)
    )
  })
}
