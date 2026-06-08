/**
 * 포트폴리오 — 현재 현금 보유액 (단일 값)
 */

import { computePortfolioCashFromLedger } from "./ydsPortfolioCashEngine.js"
import { loadPortfolioTrades } from "./ydsPortfolioTradesStorage.js"

export const PORTFOLIO_CASH_BALANCE_KEY = "yds-portfolio-cash-balance-v1"
const LEDGER_KEY = "yds-portfolio-cash-ledger-v1"
const LEGACY_CASH_KEY = "yds-portfolio-cash-v1"
const MIGRATED_KEY = "yds-portfolio-cash-balance-migrated-v1"

/** @returns {number} */
export function loadCashBalance() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_CASH_BALANCE_KEY)
    if (raw != null) {
      const n = Math.round(Number(JSON.parse(raw)) || 0)
      return Number.isFinite(n) && n >= 0 ? n : 0
    }
  } catch {
    /* fall through to migration */
  }

  return migrateToCashBalance()
}

/** @returns {number} */
function migrateToCashBalance() {
  if (localStorage.getItem(MIGRATED_KEY)) return 0

  let balance = 0

  try {
    const ledgerRaw = localStorage.getItem(LEDGER_KEY)
    if (ledgerRaw) {
      const ledger = JSON.parse(ledgerRaw)
      if (Array.isArray(ledger) && ledger.length) {
        const trades = loadPortfolioTrades()
        balance = computePortfolioCashFromLedger(trades, ledger)
      }
    }
  } catch {
    /* ignore */
  }

  if (balance <= 0) {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_CASH_KEY)
      if (legacyRaw) {
        const n = Math.round(Number(JSON.parse(legacyRaw)) || 0)
        if (n > 0) balance = n
      }
    } catch {
      /* ignore */
    }
  }

  try {
    localStorage.setItem(MIGRATED_KEY, "1")
    localStorage.removeItem(LEDGER_KEY)
    localStorage.removeItem(LEGACY_CASH_KEY)
    saveCashBalance(balance)
  } catch {
    /* ignore */
  }

  return balance
}

/** @param {number} amount */
export function saveCashBalance(amount) {
  const n = Math.round(Number(amount) || 0)
  const safe = Number.isFinite(n) && n >= 0 ? n : 0
  try {
    localStorage.setItem(PORTFOLIO_CASH_BALANCE_KEY, JSON.stringify(safe))
  } catch {
    /* ignore */
  }
}
