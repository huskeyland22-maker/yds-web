/**
 * Phase 6-2 — 총자산 현금 엔진
 * 현금 = 입금·배당 − 출금 + 매도대금 − 매수대금
 */

import { tradeAmountKrw } from "./ydsPortfolioV5Engine.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("./ydsPortfolioCashLedgerStorage.js").CashLedgerEntry} CashLedgerEntry */

/**
 * @param {PortfolioTrade[]} trades
 * @param {CashLedgerEntry[]} [ledger]
 */
export function computePortfolioCash(trades, ledger = []) {
  let cash = 0

  for (const entry of ledger) {
    const amt = Math.round(Number(entry.amount) || 0)
    if (amt <= 0) continue
    if (entry.type === "deposit" || entry.type === "dividend") cash += amt
    if (entry.type === "withdraw") cash -= amt
  }

  const sorted = [...trades].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.createdAt - b.createdAt
  })

  for (const trade of sorted) {
    if (trade.action === "watch") continue
    const amt = tradeAmountKrw(trade)
    if (amt <= 0) continue
    if (trade.action === "sell") cash += amt
    if (trade.action === "buy") cash -= amt
  }

  return Math.max(0, Math.round(cash))
}

/** @deprecated use computePortfolioCash */
export function deriveCashFromTrades(trades) {
  return computePortfolioCash(trades, [])
}
