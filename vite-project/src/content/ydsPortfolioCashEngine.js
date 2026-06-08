/**
 * 포트폴리오 현금 — 현재 보유액만 사용
 */

import { tradeAmountKrw } from "./ydsPortfolioV5Engine.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("./ydsPortfolioCashLedgerStorage.js").CashLedgerEntry} CashLedgerEntry */

/**
 * @param {number | null | undefined} amount
 * @returns {number}
 */
export function normalizeCashBalance(amount) {
  const n = Math.round(Number(amount) || 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * @param {PortfolioTrade[]} _trades
 * @param {number} cashBalance
 */
export function computePortfolioCash(_trades, cashBalance) {
  return normalizeCashBalance(cashBalance)
}

/**
 * V6-2 장부 → 단일 잔액 이전용 (신규 저장소에서만 호출)
 * @param {PortfolioTrade[]} trades
 * @param {CashLedgerEntry[]} ledger
 */
export function computePortfolioCashFromLedger(trades, ledger) {
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

/** @param {PortfolioTrade[]} trades */
export function deriveCashFromTrades(trades) {
  return computePortfolioCashFromLedger(trades, [])
}
