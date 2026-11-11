/**
 * Portfolio cloud sync — Supabase user_portfolio via /api/portfolio-sync (Firebase auth).
 */

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

export const PORTFOLIO_SYNC_META_KEY = "yds-portfolio-sync-meta-v1"
/** Tombstones only. Not a trade row. Synced inside the trades JSON so no schema change. */
export const PORTFOLIO_DELETED_TRADE_ID = "yds-portfolio-deleted-v1"
export const PORTFOLIO_CASH_META_ID = "yds-portfolio-cash-meta-v1"
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

/** @param {unknown} raw */
function normalizeDeletedIds(raw) {
  if (!Array.isArray(raw)) return []
  /** @type {string[]} */
  const out = []
  const seen = new Set()
  for (const id of raw) {
    if (typeof id !== "string") continue
    const trimmed = id.trim()
    if (!trimmed || trimmed === PORTFOLIO_DELETED_TRADE_ID || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
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

/**
 * Drop the sync marker from a trade list and keep its deleted ids.
 * @param {unknown} trades
 * @returns {{ trades: PortfolioTrade[], deletedIds: string[] }}
 */
export function splitPortfolioDeletedMarker(trades) {
  if (!Array.isArray(trades)) return { trades: [], deletedIds: [], cashUpdatedAt: 0 }
  /** @type {PortfolioTrade[]} */
  const visible = []
  /** @type {string[]} */
  const deletedIds = []
  let cashUpdatedAt = 0
  for (const trade of trades) {
    if (!trade || typeof trade !== "object") continue
    if (trade.id === PORTFOLIO_DELETED_TRADE_ID) {
      deletedIds.push(...normalizeDeletedIds(trade.deletedIds))
      continue
    }
    if (trade.id === PORTFOLIO_CASH_META_ID) {
      const stamp = Number(trade.cashUpdatedAt)
      if (Number.isFinite(stamp) && stamp > cashUpdatedAt) cashUpdatedAt = stamp
      continue
    }
    visible.push(/** @type {PortfolioTrade} */ (trade))
  }
  return { trades: visible, deletedIds, cashUpdatedAt }
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

/** @param {PortfolioTrade[]} trades @param {string[]} deletedIds */
function withDeletedMarker(trades, deletedIds) {
  const ids = normalizeDeletedIds(deletedIds)
  if (!ids.length) return trades
  return [
    ...trades,
    {
      id: PORTFOLIO_DELETED_TRADE_ID,
      action: "watch",
      name: "",
      date: "1970-01-01",
      quantity: null,
      unitPrice: null,
      amount: null,
      memo: "",
      createdAt: 0,
      updatedAt: 0,
      deletedIds: ids,
    },
  ]
}

/** @param {PortfolioTrade | null | undefined} trade */
function usableTradeId(trade) {
  if (!trade || typeof trade.id !== "string") return ""
  const id = trade.id.trim()
  if (!id || id === PORTFOLIO_DELETED_TRADE_ID || id === PORTFOLIO_CASH_META_ID) return ""
  return id
}

/** @param {PortfolioTrade} trade */
function tradeStamp(trade) {
  const updated = Number(trade.updatedAt)
  const created = Number(trade.createdAt)
  return {
    updated: Number.isFinite(updated) ? updated : 0,
    created: Number.isFinite(created) ? created : 0,
  }
}

/**
 * Same id: keep the newer edit. Equal timestamps pick one JSON value so either
 * side order returns the same row. Objects are not field-merged.
 * @param {PortfolioTrade} a
 * @param {PortfolioTrade} b
 */
function preferTrade(a, b) {
  const sa = tradeStamp(a)
  const sb = tradeStamp(b)
  if (sa.updated !== sb.updated) return sa.updated > sb.updated ? a : b
  if (sa.created !== sb.created) return sa.created > sb.created ? a : b
  const ja = JSON.stringify(a)
  const jb = JSON.stringify(b)
  if (ja === jb) return a
  return ja > jb ? a : b
}

/** @param {PortfolioTrade} a @param {PortfolioTrade} b */
function compareTradeOrder(a, b) {
  const byDate = String(b.date ?? "").localeCompare(String(a.date ?? ""))
  if (byDate !== 0) return byDate
  const byCreated = (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  if (byCreated !== 0) return byCreated
  return String(b.id ?? "").localeCompare(String(a.id ?? ""))
}

/**
 * Union by string id. Rows with no string id are all kept and never matched
 * against each other. Deleted ids are removed only when the id matches.
 * @param {PortfolioTrade[]} localTrades
 * @param {PortfolioTrade[]} cloudTrades
 * @param {string[]} deletedIds
 */
export function mergePortfolioTrades(localTrades, cloudTrades, deletedIds) {
  const deleted = new Set(normalizeDeletedIds(deletedIds))
  /** @type {Map<string, PortfolioTrade>} */
  const byId = new Map()
  /** @type {PortfolioTrade[]} */
  const noId = []

  for (const source of [cloudTrades, localTrades]) {
    const split = splitPortfolioDeletedMarker(source)
    for (const id of split.deletedIds) deleted.add(id)
    for (const trade of split.trades) {
      const id = usableTradeId(trade)
      if (!id) {
        noId.push(trade)
        continue
      }
      const prev = byId.get(id)
      byId.set(id, prev ? preferTrade(prev, trade) : trade)
    }
  }

  for (const id of deleted) byId.delete(id)

  const trades = [...byId.values(), ...noId].sort(compareTradeOrder)
  return { trades, deletedIds: [...deleted].sort() }
}

/** @param {PortfolioTrade[]} trades */
function tradeSignature(trades) {
  return JSON.stringify(trades)
}

/**
 * @param {PortfolioTrade[]} localTrades
 * @param {number} localCash
 * @param {CloudPortfolioSnapshot | null | undefined} cloud
 * @param {PortfolioTrade[]} cloudTrades
 */
/**
 * Cash follows its own stamp, never a trade edit time.
 * A missing stamp does not overwrite a stamped balance.
 * Both unstamped: keep an existing non-zero balance.
 * @param {number} requestCash
 * @param {number} requestStamp
 * @param {number} existingCash
 * @param {number} existingStamp
 */
export function choosePortfolioCash(requestCash, requestStamp, existingCash, existingStamp) {
  const requestCashN = Number.isFinite(Number(requestCash)) ? Math.max(0, Math.round(Number(requestCash))) : 0
  const existingCashN = Number.isFinite(Number(existingCash)) ? Math.max(0, Math.round(Number(existingCash))) : 0
  const requestAt = Number.isFinite(Number(requestStamp)) && Number(requestStamp) > 0 ? Number(requestStamp) : 0
  const existingAt = Number.isFinite(Number(existingStamp)) && Number(existingStamp) > 0 ? Number(existingStamp) : 0
  if (requestAt > existingAt) return { cashBalance: requestCashN, cashUpdatedAt: requestAt }
  if (existingAt > requestAt) return { cashBalance: existingCashN, cashUpdatedAt: existingAt }
  if (existingCashN === 0 && requestCashN > 0) return { cashBalance: requestCashN, cashUpdatedAt: requestAt }
  return { cashBalance: existingCashN, cashUpdatedAt: existingAt }
}

/** @param {unknown} trades */
export function countTradesWithoutId(trades) {
  if (!Array.isArray(trades)) return 0
  let count = 0
  for (const trade of trades) {
    if (!trade || typeof trade !== "object") continue
    if (trade.id === PORTFOLIO_DELETED_TRADE_ID || trade.id === PORTFOLIO_CASH_META_ID) continue
    if (typeof trade.id === "string" && trade.id.trim()) continue
    count += 1
  }
  return count
}

/**
 * Server save merge. Missing ids are not deletes.
 * Explicit tombstones from either side stay deleted and are not duplicated.
 * @param {{
 *   existingTrades?: unknown
 *   existingCash?: number
 *   requestTrades?: unknown
 *   requestCash?: number
 *   requestCashUpdatedAt?: number
 * }} input
 */
export function mergePortfolioServerPut(input) {
  const existingSplit = splitPortfolioDeletedMarker(input?.existingTrades)
  const requestSplit = splitPortfolioDeletedMarker(input?.requestTrades)
  const requestHasDeleteMarker =
    Array.isArray(input?.requestTrades) &&
    input.requestTrades.some((trade) => trade && trade.id === PORTFOLIO_DELETED_TRADE_ID)
  const deletedIds = normalizeDeletedIds([
    ...existingSplit.deletedIds,
    ...(requestHasDeleteMarker ? requestSplit.deletedIds : []),
  ])
  const merged = mergePortfolioTrades(existingSplit.trades, requestSplit.trades, deletedIds)
  const requestStamp = requestSplit.cashUpdatedAt || Number(input?.requestCashUpdatedAt) || 0
  const cash = choosePortfolioCash(
    Number(input?.requestCash) || 0,
    requestStamp,
    Number(input?.existingCash) || 0,
    existingSplit.cashUpdatedAt || 0,
  )
  const storable = merged.trades.filter((trade) => typeof trade.id === "string" && trade.id.trim())
  return {
    visibleTrades: storable,
    storedTrades: withSyncMarkers(storable, merged.deletedIds, cash.cashUpdatedAt),
    cashBalance: cash.cashBalance,
    cashUpdatedAt: cash.cashUpdatedAt,
    deletedIds: merged.deletedIds,
    omittedWithoutId: countTradesWithoutId(input?.requestTrades),
  }
}

/** @param {PortfolioTrade[]} trades @param {string[]} deletedIds @param {number} cashUpdatedAt */
function withSyncMarkers(trades, deletedIds, cashUpdatedAt) {
  const next = withDeletedMarker(trades, deletedIds)
  const stamp = Number(cashUpdatedAt)
  if (!Number.isFinite(stamp) || stamp <= 0) return next
  return [
    ...next,
    {
      id: PORTFOLIO_CASH_META_ID,
      action: "watch",
      name: "",
      date: "1970-01-01",
      quantity: null,
      unitPrice: null,
      amount: null,
      memo: "",
      createdAt: 0,
      updatedAt: 0,
      cashUpdatedAt: Math.round(stamp),
    },
  ]
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
