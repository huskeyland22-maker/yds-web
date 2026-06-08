/**
 * Phase 6-2 — 포트폴리오 현금 원장
 */

import { todayDateKey } from "./ydsPortfolioTradesStorage.js"

export const PORTFOLIO_CASH_LEDGER_KEY = "yds-portfolio-cash-ledger-v1"
const LEGACY_CASH_KEY = "yds-portfolio-cash-v1"
const LEGACY_MIGRATED_KEY = "yds-portfolio-cash-ledger-migrated-v1"

/**
 * @typedef {'deposit' | 'withdraw' | 'dividend'} CashLedgerType
 */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   type: CashLedgerType
 *   amount: number
 *   memo: string
 *   createdAt: number
 * }} CashLedgerEntry
 */

/** @returns {CashLedgerEntry[]} */
function migrateLegacyCashBalance(entries) {
  try {
    if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return entries
    const raw = localStorage.getItem(LEGACY_CASH_KEY)
    if (!raw) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, "1")
      return entries
    }
    const amount = Math.round(Number(JSON.parse(raw)) || 0)
    localStorage.setItem(LEGACY_MIGRATED_KEY, "1")
    localStorage.removeItem(LEGACY_CASH_KEY)
    if (amount <= 0) return entries
    const now = Date.now()
    return [
      {
        id: `cash-migrate-${now}`,
        date: todayDateKey(),
        type: "deposit",
        amount,
        memo: "V6-2 이전 현금 잔액",
        createdAt: now,
      },
      ...entries,
    ]
  } catch {
    return entries
  }
}

/** @returns {CashLedgerEntry[]} */
export function loadCashLedger() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_CASH_LEDGER_KEY)
    if (!raw) return migrateLegacyCashBalance([])
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return migrateLegacyCashBalance([])
    return migrateLegacyCashBalance(
      parsed.filter((e) => e && typeof e.id === "string" && typeof e.type === "string"),
    )
  } catch {
    return migrateLegacyCashBalance([])
  }
}

/** @param {CashLedgerEntry[]} entries */
export function saveCashLedger(entries) {
  try {
    localStorage.setItem(PORTFOLIO_CASH_LEDGER_KEY, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
}

export function createCashLedgerId() {
  return `cash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
