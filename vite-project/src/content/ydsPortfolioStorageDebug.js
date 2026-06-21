/**
 * 포트폴리오 저장소 진단 — localStorage 기기별 · Supabase/계정 동기화 없음
 */

import { PORTFOLIO_CASH_BALANCE_KEY } from "./ydsPortfolioCashBalanceStorage.js"
import { PORTFOLIO_POSITIONS_KEY } from "./ydsPortfolioPositionsStorage.js"
import {
  PORTFOLIO_TRADES_KEY,
  PORTFOLIO_TRADES_MIGRATED_KEY,
} from "./ydsPortfolioTradesStorage.js"

export const PORTFOLIO_MANUAL_KEY = "yds-portfolio-manual-v1"
export const PORTFOLIO_MANUAL_MIGRATED_KEY = "yds-portfolio-manual-migrated-v1"
export const PORTFOLIO_MANUAL_TO_TRADES_KEY = "yds-portfolio-v4-manual-migrated-v1"

/** @type {readonly string[]} */
export const PORTFOLIO_STORAGE_KEYS = [
  PORTFOLIO_TRADES_KEY,
  PORTFOLIO_MANUAL_KEY,
  PORTFOLIO_POSITIONS_KEY,
  PORTFOLIO_CASH_BALANCE_KEY,
  "yds-portfolio-cash-ledger-v1",
  "yds-portfolio-cash-v1",
  "yds-portfolio-review-v1",
  "yds-portfolio-stock-review-v1",
  "yds-portfolio-quote-cache-v1",
  PORTFOLIO_TRADES_MIGRATED_KEY,
  PORTFOLIO_MANUAL_MIGRATED_KEY,
  PORTFOLIO_MANUAL_TO_TRADES_KEY,
  "yds-portfolio-cash-balance-migrated-v1",
]

/**
 * @typedef {{
 *   key: string
 *   present: boolean
 *   byteLength: number
 *   itemCount: number | null
 *   parseOk: boolean
 * }} PortfolioKeyAudit
 */

/**
 * @typedef {{
 *   storageType: "localStorage"
 *   sessionStorageUsed: boolean
 *   supabasePortfolio: boolean
 *   accountSync: boolean
 *   syncMode: "device-local"
 *   note: string
 *   keys: PortfolioKeyAudit[]
 *   tradesCount: number
 *   legacyManualCount: number
 *   legacyPositionsCount: number
 *   cashBalance: number | null
 *   hiddenLegacyOnDevice: boolean
 * }} PortfolioStorageAudit
 */

/** @param {string | null} raw */
function safeParseCount(raw) {
  if (raw == null) return { parseOk: true, itemCount: null }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { parseOk: true, itemCount: parsed.length }
    if (parsed && typeof parsed === "object") return { parseOk: true, itemCount: Object.keys(parsed).length }
    if (typeof parsed === "number") return { parseOk: true, itemCount: 1 }
    return { parseOk: true, itemCount: null }
  } catch {
    return { parseOk: false, itemCount: null }
  }
}

/** @returns {PortfolioStorageAudit} */
export function auditPortfolioStorage() {
  /** @type {PortfolioKeyAudit[]} */
  const keys = []
  let sessionStorageUsed = false

  if (typeof sessionStorage !== "undefined") {
    for (const key of PORTFOLIO_STORAGE_KEYS) {
      if (sessionStorage.getItem(key) != null) {
        sessionStorageUsed = true
        break
      }
    }
  }

  for (const key of PORTFOLIO_STORAGE_KEYS) {
    let raw = null
    try {
      raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null
    } catch {
      raw = null
    }
    const { parseOk, itemCount } = safeParseCount(raw)
    keys.push({
      key,
      present: raw != null,
      byteLength: raw != null ? raw.length : 0,
      itemCount,
      parseOk,
    })
  }

  const tradesKey = keys.find((k) => k.key === PORTFOLIO_TRADES_KEY)
  const manualKey = keys.find((k) => k.key === PORTFOLIO_MANUAL_KEY)
  const positionsKey = keys.find((k) => k.key === PORTFOLIO_POSITIONS_KEY)

  const tradesCount = tradesKey?.itemCount ?? 0
  const legacyManualCount = manualKey?.itemCount ?? 0
  const legacyPositionsCount = positionsKey?.itemCount ?? 0

  let cashBalance = null
  try {
    const raw = localStorage.getItem(PORTFOLIO_CASH_BALANCE_KEY)
    if (raw != null) cashBalance = Number(JSON.parse(raw))
  } catch {
    cashBalance = null
  }

  const hiddenLegacyOnDevice =
    tradesCount === 0 && (legacyManualCount > 0 || legacyPositionsCount > 0)

  return {
    storageType: "localStorage",
    sessionStorageUsed,
    supabasePortfolio: false,
    accountSync: false,
    syncMode: "device-local",
    note:
      "포트폴리오는 브라우저 localStorage(기기·프로필별). 모바일 PWA와 PC는 저장소가 분리되어 자동 동기화되지 않습니다. 로그인(Firebase)과 Supabase는 패닉/시장 데이터용이며 보유종목은 연동하지 않습니다.",
    keys,
    tradesCount,
    legacyManualCount,
    legacyPositionsCount,
    cashBalance,
    hiddenLegacyOnDevice,
  }
}

/** @param {import("./ydsPortfolioTradesStorage.js").PortfolioTrade[]} [loadedTrades] */
export function logPortfolioStorageAudit(loadedTrades) {
  const audit = auditPortfolioStorage()
  const buyCount = (loadedTrades ?? []).filter((t) => t.action === "buy").length
  const holdingTickers = new Set(
    (loadedTrades ?? []).filter((t) => t.action === "buy" && t.ticker).map((t) => t.ticker),
  )

  console.info("[portfolio-storage] load audit", {
    syncMode: audit.syncMode,
    storageType: audit.storageType,
    sessionStorageUsed: audit.sessionStorageUsed,
    supabasePortfolio: audit.supabasePortfolio,
    accountSync: audit.accountSync,
    primaryKey: PORTFOLIO_TRADES_KEY,
    tradesInMemory: loadedTrades?.length ?? 0,
    buyTrades: buyCount,
    uniqueTickers: holdingTickers.size,
    tradesInLocalStorage: audit.tradesCount,
    legacyManualCount: audit.legacyManualCount,
    legacyPositionsCount: audit.legacyPositionsCount,
    cashBalance: audit.cashBalance,
    hiddenLegacyOnDevice: audit.hiddenLegacyOnDevice,
    note: audit.note,
  })

  console.info(
    "[portfolio-storage] keys",
    audit.keys
      .filter((k) => k.present)
      .map((k) => ({
        key: k.key,
        items: k.itemCount,
        bytes: k.byteLength,
        parseOk: k.parseOk,
      })),
  )

  if (audit.hiddenLegacyOnDevice) {
    console.warn(
      "[portfolio-storage] trades empty but legacy holdings exist on THIS device — recovery attempted",
      {
        manualKey: PORTFOLIO_MANUAL_KEY,
        positionsKey: PORTFOLIO_POSITIONS_KEY,
      },
    )
  }

  if (audit.tradesCount === 0 && !audit.hiddenLegacyOnDevice) {
    console.warn(
      "[portfolio-storage] no portfolio data on this device/browser profile. Mobile PWA data does not sync here automatically.",
    )
  }
}
