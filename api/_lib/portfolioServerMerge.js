/**
 * Pure portfolio save merge for the Vercel function.
 * Kept outside vite-project so the function is not loaded as an ES module.
 * Same id keeps the newer row. Missing ids are not deletes.
 */

export const PORTFOLIO_DELETED_TRADE_ID = "yds-portfolio-deleted-v1"
export const PORTFOLIO_CASH_META_ID = "yds-portfolio-cash-meta-v1"

/** @param {unknown} raw */
export function normalizeDeletedIds(raw) {
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

/**
 * Drop sync markers from a trade list and keep their deleted ids and cash stamp.
 * @param {unknown} trades
 */
export function splitPortfolioDeletedMarker(trades) {
  if (!Array.isArray(trades)) return { trades: [], deletedIds: [], cashUpdatedAt: 0 }
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
    visible.push(trade)
  }
  return { trades: visible, deletedIds, cashUpdatedAt }
}

/** @param {object[]} trades @param {string[]} deletedIds */
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

/** @param {object | null | undefined} trade */
function usableTradeId(trade) {
  if (!trade || typeof trade.id !== "string") return ""
  const id = trade.id.trim()
  if (!id || id === PORTFOLIO_DELETED_TRADE_ID || id === PORTFOLIO_CASH_META_ID) return ""
  return id
}

/** @param {object} trade */
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
 * @param {object} a
 * @param {object} b
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

/** @param {object} a @param {object} b */
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
 * @param {object[]} localTrades
 * @param {object[]} cloudTrades
 * @param {string[]} deletedIds
 */
export function mergePortfolioTrades(localTrades, cloudTrades, deletedIds) {
  const deleted = new Set(normalizeDeletedIds(deletedIds))
  /** @type {Map<string, object>} */
  const byId = new Map()
  /** @type {object[]} */
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

/**
 * Cash follows its own stamp, never a trade edit time.
 * A missing stamp does not overwrite a stamped balance.
 * Both unstamped: keep an existing non-zero balance.
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

/** @param {object[]} trades @param {string[]} deletedIds @param {number} cashUpdatedAt */
export function withSyncMarkers(trades, deletedIds, cashUpdatedAt) {
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
 * Server save merge. Missing ids are not deletes.
 * Explicit tombstones from either side stay deleted and are not duplicated.
 * A request without a delete marker does not add deletes.
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
