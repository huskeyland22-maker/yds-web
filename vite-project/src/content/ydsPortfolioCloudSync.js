/**
 * Portfolio cloud sync — Supabase user_portfolio via /api/portfolio-sync (Firebase auth).
 */

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

import {
  PORTFOLIO_DELETED_TRADE_ID,
  normalizeDeletedIds,
  splitPortfolioDeletedMarker,
  mergePortfolioTrades,
  choosePortfolioCash,
  withSyncMarkers,
} from "../../../api/_lib/portfolioServerMerge.js"

export {
  PORTFOLIO_DELETED_TRADE_ID,
  PORTFOLIO_CASH_META_ID,
  splitPortfolioDeletedMarker,
  mergePortfolioTrades,
  choosePortfolioCash,
  countTradesWithoutId,
  mergePortfolioServerPut,
} from "../../../api/_lib/portfolioServerMerge.js"

export const PORTFOLIO_SYNC_META_KEY = "yds-portfolio-sync-meta-v1"
const PORTFOLIO_DELETED_IDS_KEY = "yds-portfolio-deleted-trades-v1"
export const PORTFOLIO_CASH_UPDATED_AT_KEY = "yds-portfolio-cash-updated-at-v1"

/**
 * @typedef {{
 *   trades: PortfolioTrade[]
 *   cashBalance: number
 *   revision: number
 *   updatedAtMs: number
 *   deletedIds?: string[]
 *   cashUpdatedAt?: number
 * }} CloudPortfolioSnapshot
 */

/**
 * @typedef {{
 *   trades: PortfolioTrade[]
 *   cashBalance: number
 *   source: "cloud" | "local" | "merged"
 *   mode: string
 *   shouldUpload: boolean
 *   deletedIds: string[]
 *   cashUpdatedAt: number
 * }} ReconcileResult
 */

/**
 * @typedef {{
 *   deletedIds?: string[]
 *   persist?: boolean
 *   cashUpdatedAt?: number
 * }} ReconcileOptions
 */

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} [cashBalance]
 */
export function portfolioRevision(trades, cashBalance = 0) {
  const tradeMax = (trades ?? []).reduce(
    (max, t) => Math.max(max, Number(t.updatedAt ?? t.createdAt ?? 0)),
    0,
  )
  return Math.max(tradeMax, Math.round(Number(cashBalance) || 0), Date.now())
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} [cashBalance]
 */
export function portfolioLocalUpdatedAtMs(trades, cashBalance = 0) {
  return portfolioRevision(trades, cashBalance)
}

/** @param {unknown} updatedAt */
export function parseCloudUpdatedAtMs(updatedAt) {
  if (updatedAt == null) return 0
  if (typeof updatedAt === "number" && Number.isFinite(updatedAt)) return updatedAt
  const ms = Date.parse(String(updatedAt))
  return Number.isFinite(ms) ? ms : 0
}

/** @returns {Storage | null} */
function browserStorage() {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

/** @returns {string[]} */
export function readDeletedPortfolioTradeIds() {
  const storage = browserStorage()
  if (!storage) return []
  try {
    return normalizeDeletedIds(JSON.parse(storage.getItem(PORTFOLIO_DELETED_IDS_KEY) || "[]"))
  } catch {
    return []
  }
}

/** @param {string[]} ids */
export function rememberDeletedPortfolioTradeIds(ids) {
  const storage = browserStorage()
  if (!storage) return readDeletedPortfolioTradeIds()
  const next = normalizeDeletedIds([...readDeletedPortfolioTradeIds(), ...ids])
  try {
    storage.setItem(PORTFOLIO_DELETED_IDS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** @returns {number} */
export function readPortfolioCashUpdatedAt() {
  const storage = browserStorage()
  if (!storage) return 0
  const n = Number(storage.getItem(PORTFOLIO_CASH_UPDATED_AT_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** @param {number} ms */
export function writePortfolioCashUpdatedAt(ms) {
  const storage = browserStorage()
  if (!storage) return
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return
  try {
    storage.setItem(PORTFOLIO_CASH_UPDATED_AT_KEY, String(Math.round(n)))
  } catch {
    /* ignore */
  }
}

/** @param {PortfolioTrade[]} trades */
function tradeSignature(trades) {
  return JSON.stringify(trades)
}

/**
 * @param {PortfolioTrade[]} localTrades
 * @param {number} localCash
 * @param {CloudPortfolioSnapshot | null | undefined} cloud
 * @returns {ReconcileResult}
 */
/**
 * @param {ReconcileOptions} [options]
 */
export function reconcilePortfolio(localTrades, localCash, cloud, options = {}) {
  const localSplit = splitPortfolioDeletedMarker(localTrades)
  const cloudSplit = splitPortfolioDeletedMarker(cloud?.trades)
  const deletedSeed = normalizeDeletedIds([
    ...(options.deletedIds ?? readDeletedPortfolioTradeIds()),
    ...(cloud?.deletedIds ?? []),
    ...localSplit.deletedIds,
    ...cloudSplit.deletedIds,
  ])
  const merged = mergePortfolioTrades(localSplit.trades, cloudSplit.trades, deletedSeed)
  const cashChoice = choosePortfolioCash(
    localCash,
    options.cashUpdatedAt ?? (localSplit.cashUpdatedAt || readPortfolioCashUpdatedAt()),
    cloud ? Number(cloud.cashBalance) || 0 : localCash,
    cloud ? cloud.cashUpdatedAt || cloudSplit.cashUpdatedAt || 0 : localSplit.cashUpdatedAt || readPortfolioCashUpdatedAt(),
  )
  const cashBalance = cashChoice.cashBalance
  if (options.persist !== false) {
    rememberDeletedPortfolioTradeIds(merged.deletedIds)
    if (cashChoice.cashUpdatedAt > 0) writePortfolioCashUpdatedAt(cashChoice.cashUpdatedAt)
  }
  const cloudMerged = mergePortfolioTrades(cloudSplit.trades, [], merged.deletedIds).trades
  const cloudDeleted = normalizeDeletedIds([...(cloud?.deletedIds ?? []), ...cloudSplit.deletedIds])
  const differsFromCloud =
    !cloud ||
    tradeSignature(merged.trades) !== tradeSignature(cloudMerged) ||
    cashBalance !== (Number(cloud.cashBalance) || 0) ||
    cloudDeleted.join("\n") !== merged.deletedIds.join("\n")

  if (!cloud) {
    const hasLocal = merged.trades.length > 0 || cashBalance > 0 || merged.deletedIds.length > 0
    return {
      trades: merged.trades,
      cashBalance,
      source: "local",
      mode: hasLocal ? "local-only-upload-pending" : "empty",
      shouldUpload: hasLocal,
      deletedIds: merged.deletedIds,
      cashUpdatedAt: cashChoice.cashUpdatedAt,
    }
  }

  const cloudHasData = cloudSplit.trades.length > 0 || (Number(cloud.cashBalance) || 0) > 0
  const localHasData = localSplit.trades.length > 0 || (Number(localCash) || 0) > 0
  if (!cloudHasData && localHasData && cloudDeleted.length === 0) {
    return {
      trades: merged.trades,
      cashBalance,
      source: "local",
      mode: "local-only-upload-pending",
      shouldUpload: true,
      deletedIds: merged.deletedIds,
      cashUpdatedAt: cashChoice.cashUpdatedAt,
    }
  }

  if (!localHasData && cloudHasData && tradeSignature(merged.trades) === tradeSignature(cloudMerged) && !differsFromCloud) {
    return {
      trades: merged.trades,
      cashBalance,
      source: "cloud",
      mode: "cloud-download",
      shouldUpload: false,
      deletedIds: merged.deletedIds,
      cashUpdatedAt: cashChoice.cashUpdatedAt,
    }
  }

  return {
    trades: merged.trades,
    cashBalance,
    source: "merged",
    mode: differsFromCloud ? "merged" : "merged-in-sync",
    shouldUpload: differsFromCloud,
    deletedIds: merged.deletedIds,
    cashUpdatedAt: cashChoice.cashUpdatedAt,
  }
}

/**
 * @param {string} idToken
 * @returns {Promise<CloudPortfolioSnapshot | null>}
 */
export async function fetchCloudPortfolio(idToken) {
  const res = await fetch("/api/portfolio-sync", {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  })
  if (res.status === 503) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `fetch_failed_${res.status}`)
  }
  const json = await res.json()
  const row = json?.portfolio
  if (!row) return null
  const split = splitPortfolioDeletedMarker(
    Array.isArray(row.trades) ? row.trades.filter((t) => t && typeof t.id === "string") : [],
  )
  return {
    trades: split.trades,
    cashBalance: Number(row.cash_balance) || 0,
    revision: Number(row.revision) || 0,
    updatedAtMs: parseCloudUpdatedAtMs(row.updated_at),
    deletedIds: split.deletedIds,
    cashUpdatedAt: split.cashUpdatedAt,
  }
}

/**
 * @param {string} idToken
 * @param {PortfolioTrade[]} trades
 * @param {number} cashBalance
 */
export async function pushCloudPortfolio(idToken, trades, cashBalance) {
  let cloud = null
  try {
    cloud = await fetchCloudPortfolio(idToken)
  } catch (e) {
    console.warn("[portfolio-sync] pre-push fetch failed — uploading this device as-is", e)
  }
  const merged = reconcilePortfolio(trades, cashBalance, cloud)
  const payloadTrades = withSyncMarkers(
    merged.trades,
    merged.deletedIds,
    readPortfolioCashUpdatedAt() || merged.cashUpdatedAt || 0,
  )
  const revision = portfolioRevision(merged.trades, merged.cashBalance)
  const res = await fetch("/api/portfolio-sync", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      trades: payloadTrades,
      cash_balance: merged.cashBalance,
      cash_updated_at: readPortfolioCashUpdatedAt(),
      revision,
    }),
    cache: "no-store",
  })
  if (res.status === 503) {
    console.warn("[portfolio-sync] Supabase not configured — device-local only")
    return null
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `save_failed_${res.status}`)
  }
  const json = await res.json()
  const row = json?.portfolio
  if (row) {
    try {
      localStorage.setItem(
        PORTFOLIO_SYNC_META_KEY,
        JSON.stringify({
          revision: row.revision ?? revision,
          updatedAtMs: parseCloudUpdatedAtMs(row.updated_at),
        }),
      )
    } catch {
      /* ignore */
    }
  }
  const omittedWithoutId = Number(json?.omittedWithoutId) || 0
  const savedSplit = Array.isArray(row?.trades) ? splitPortfolioDeletedMarker(row.trades) : null
  if (savedSplit) rememberDeletedPortfolioTradeIds(savedSplit.deletedIds)
  if (savedSplit?.cashUpdatedAt) writePortfolioCashUpdatedAt(savedSplit.cashUpdatedAt)
  const savedCash = Number(row?.cash_balance)
  return {
    ...(row && typeof row === "object" ? row : {}),
    mergedTrades: savedSplit ? savedSplit.trades : merged.trades,
    mergedCash: Number.isFinite(savedCash) ? savedCash : merged.cashBalance,
    omittedWithoutId,
  }
}

/**
 * @param {string} idToken
 * @param {PortfolioTrade[]} localTrades
 * @param {number} localCash
 * @returns {Promise<ReconcileResult>}
 */
export async function reconcilePortfolioWithCloud(idToken, localTrades, localCash) {
  let cloud = null
  try {
    cloud = await fetchCloudPortfolio(idToken)
  } catch (e) {
    console.warn("[portfolio-sync] cloud fetch failed — using local", e)
    const split = splitPortfolioDeletedMarker(localTrades)
    return {
      trades: split.trades,
      cashBalance: localCash,
      source: "local",
      mode: "cloud-fetch-error",
      shouldUpload: false,
      deletedIds: readDeletedPortfolioTradeIds(),
      cashUpdatedAt: readPortfolioCashUpdatedAt(),
    }
  }

  const result = reconcilePortfolio(localTrades, localCash, cloud)

  if (result.shouldUpload) {
    try {
      await pushCloudPortfolio(idToken, result.trades, result.cashBalance)
    } catch (e) {
      console.warn("[portfolio-sync] initial upload failed", e)
    }
  }

  console.info("[portfolio-sync] reconcile", {
    mode: result.mode,
    source: result.source,
    localTrades: localTrades.length,
    cloudTrades: cloud?.trades?.length ?? 0,
    localCash,
    cloudCash: cloud?.cashBalance ?? 0,
  })

  return result
}
