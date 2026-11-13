/**
 * Read-only report over the real buy ledger (`yds.tradeRecords.v1`).
 * Does not create buys or sells and does not read the portfolio analysis store.
 */

import { recordedShareCount, replayEquityPosition } from "./ydsEquitySellLedger.js"
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
 * @param {number} shares
 * @param {number} price
 * @param {number} amount
 */
function buyCash(shares, price, amount) {
  if (Number.isFinite(amount) && amount > 0) return amount
  if (shares > 0 && price > 0) return shares * price
  return 0
}

/**
 * @param {{ records?: Record<string, object[]>, sells?: object[] }} store
 * @param {Record<string, number | null | undefined>} [prices]
 */
export function buildOperatingJournal(store, prices = {}) {
  /** @type {object[]} */
  const holdings = []
  /** @type {object[]} */
  const closed = []
  /** @type {object[]} */
  const rows = []
  /** @type {object[]} */
  const settlements = []
  let totalBuyUsd = 0
  let soldCost = 0
  let missingPriceCount = 0

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
    const quote = Number(prices[symbol])
    const price = Number.isFinite(quote) && quote > 0 ? quote : null
    const unrealized =
      position.openShares > 1e-8 && position.avgPrice != null && price != null
        ? position.openShares * (price - position.avgPrice)
        : null
    if (position.openShares > 1e-8 && price == null) missingPriceCount += 1

    for (const buy of buys) {
      const shares = recordedShareCount(buy) || 0
      const amount = buyCash(shares, Number(buy.buyPrice), Number(buy.buyAmountUsd))
      totalBuyUsd += amount
      rows.push({
        id: buy.id,
        date: buy.buyDate,
        createdAt: buy.createdAt || buy.buyDate,
        system,
        symbol,
        name,
        kind: "buy",
        typeLabel: "매수",
        buyPrice: Number(buy.buyPrice),
        sellPrice: null,
        shares,
        buyAmount: amount,
        sellAmount: null,
        realizedPnl: null,
        returnPct: null,
        holding: position.openShares > 1e-8,
        closed: position.settlements.length > 0 && position.openShares <= 1e-8,
        order: 0,
      })
    }

    for (const sell of position.settlements) {
      soldCost += sell.cost
      const entry = {
        id: sell.id,
        date: sell.sellDate,
        createdAt: sell.createdAt || sell.sellDate,
        system,
        symbol,
        name,
        kind: "sell",
        typeLabel: sell.fullClose ? "전량 매도" : "부분 매도",
        buyPrice: sell.filledShares > 0 ? sell.cost / sell.filledShares : null,
        sellPrice: sell.sellPrice,
        shares: sell.filledShares,
        buyAmount: sell.cost,
        sellAmount: sell.proceeds,
        realizedPnl: sell.realizedPnl,
        returnPct: sell.returnPct,
        feeUsd: sell.feeUsd,
        taxUsd: sell.taxUsd,
        chargesKnown: sell.chargesKnown,
        links: sell.links,
        holding: position.openShares > 1e-8,
        closed: position.openShares <= 1e-8,
        order: 1,
      }
      rows.push(entry)
      settlements.push(entry)
    }

    const book = {
      system,
      symbol,
      name,
      openShares: position.openShares,
      avgPrice: position.avgPrice,
      openCost: position.openCost,
      price,
      unrealizedPnl: unrealized,
      realizedPnl: position.settlements.length ? position.realizedPnl : 0,
      sellCount: position.settlements.length,
    }
    if (position.openShares > 1e-8) holdings.push(book)
    else if (position.settlements.length) closed.push(book)
  }

  rows.sort(
    (a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      a.order - b.order ||
      String(a.createdAt).localeCompare(String(b.createdAt)),
  )
  const realized = settlements.reduce((sum, row) => sum + row.realizedPnl, 0)
  const unrealizedKnown = holdings.reduce(
    (sum, row) => (row.unrealizedPnl == null ? sum : sum + row.unrealizedPnl),
    0,
  )
  const wins = settlements.filter((row) => row.realizedPnl > 0)
  const losses = settlements.filter((row) => row.realizedPnl < 0)

  /** @type {Record<string, number>} */
  const byMonth = {}
  /** @type {Record<string, number>} */
  const byYear = {}
  /** @type {Record<string, { symbol: string, name: string, realizedPnl: number, sellCount: number }>} */
  const bySymbol = {}
  for (const row of settlements) {
    const month = String(row.date).slice(0, 7)
    const year = String(row.date).slice(0, 4)
    byMonth[month] = (byMonth[month] || 0) + row.realizedPnl
    byYear[year] = (byYear[year] || 0) + row.realizedPnl
    const key = `${row.system}:${row.symbol}`
    if (!bySymbol[key]) {
      bySymbol[key] = { symbol: row.symbol, name: row.name, realizedPnl: 0, sellCount: 0 }
    }
    bySymbol[key].realizedPnl += row.realizedPnl
    bySymbol[key].sellCount += 1
  }

  const nee = [...holdings, ...closed].filter((row) => row.symbol === "NEE")
  return {
    totalBuyUsd,
    realizedPnl: realized,
    unrealizedPnl: holdings.some((row) => row.unrealizedPnl != null) ? unrealizedKnown : null,
    missingPriceCount,
    cumulativeReturnPct: soldCost > 0 ? (realized / soldCost) * 100 : null,
    sellCount: settlements.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRatePct: settlements.length ? (wins.length / settlements.length) * 100 : null,
    holdingCount: holdings.length,
    holdings,
    closed,
    rows,
    months: Object.entries(byMonth)
      .map(([key, pnl]) => ({ key, pnl }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    years: Object.entries(byYear)
      .map(([key, pnl]) => ({ key, pnl }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    symbols: Object.values(bySymbol).sort((a, b) => b.realizedPnl - a.realizedPnl),
    winners: wins,
    losers: losses,
    recentSells: settlements
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 8),
    nee,
  }
}

/**
 * @param {object[]} rows
 * @param {{ kind?: string, query?: string, from?: string, to?: string }} filter
 */
export function filterJournalRows(rows, filter = {}) {
  const kind = filter.kind || "all"
  const query = String(filter.query || "").trim().toLowerCase()
  const from = /^\d{4}-\d{2}-\d{2}$/.test(filter.from || "") ? filter.from : ""
  const to = /^\d{4}-\d{2}-\d{2}$/.test(filter.to || "") ? filter.to : ""
  return (rows || []).filter((row) => {
    if (kind === "buy" && row.kind !== "buy") return false
    if (kind === "sell" && row.kind !== "sell") return false
    if (kind === "open" && !row.holding) return false
    if (kind === "closed" && !row.closed) return false
    if (from && String(row.date) < from) return false
    if (to && String(row.date) > to) return false
    if (!query) return true
    return (
      String(row.symbol).toLowerCase().includes(query) ||
      String(row.name).toLowerCase().includes(query)
    )
  })
}
