/**
 * 포트폴리오 — 현재 현금 보유액 (단일 값)
 *
 * Phase A: active IO uses guest/uid scoped keys only.
 * Shared key `yds-portfolio-cash-balance-v1` is preserved as orphan (no auto-migrate).
 */

import {
  getActivePortfolioOwnerUid,
  portfolioCashKeyForOwner,
  writePortfolioOwnerMeta,
} from "./ydsPortfolioStorageScope.js"

/** Shared/orphan key — preserved; not used for active account/guest IO (Phase A). */
export const PORTFOLIO_CASH_BALANCE_KEY = "yds-portfolio-cash-balance-v1"

/** @returns {number} */
export function loadCashBalance() {
  return loadCashBalanceForOwner(getActivePortfolioOwnerUid())
}

/**
 * @param {string | null | undefined} ownerUid
 * @returns {number}
 */
export function loadCashBalanceForOwner(ownerUid) {
  try {
    const raw = localStorage.getItem(portfolioCashKeyForOwner(ownerUid))
    if (raw == null) return 0
    const n = Math.round(Number(JSON.parse(raw)) || 0)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** @param {number} amount */
export function saveCashBalance(amount) {
  saveCashBalanceForOwner(getActivePortfolioOwnerUid(), amount)
}

/**
 * @param {string | null | undefined} ownerUid
 * @param {number} amount
 */
export function saveCashBalanceForOwner(ownerUid, amount) {
  const n = Math.round(Number(amount) || 0)
  const safe = Number.isFinite(n) && n >= 0 ? n : 0
  try {
    localStorage.setItem(portfolioCashKeyForOwner(ownerUid), JSON.stringify(safe))
    writePortfolioOwnerMeta(ownerUid)
  } catch {
    /* ignore */
  }
}
