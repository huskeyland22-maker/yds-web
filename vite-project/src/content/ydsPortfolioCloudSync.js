/**
 * Portfolio cloud sync — Supabase user_portfolio via /api/portfolio-sync (Firebase auth).
 */

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

export const PORTFOLIO_SYNC_META_KEY = "yds-portfolio-sync-meta-v1"

/**
 * @typedef {{
 *   trades: PortfolioTrade[]
 *   cashBalance: number
 *   revision: number
 *   updatedAtMs: number
 * }} CloudPortfolioSnapshot
 */

/**
 * @typedef {{
 *   trades: PortfolioTrade[]
 *   cashBalance: number
 *   source: "cloud" | "local" | "merged"
 *   mode: string
 * }} ReconcileResult
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

/**
 * @param {PortfolioTrade[]} localTrades
 * @param {number} localCash
 * @param {CloudPortfolioSnapshot | null | undefined} cloud
 * @returns {ReconcileResult}
 */
export function reconcilePortfolio(localTrades, localCash, cloud) {
  const localAt = portfolioLocalUpdatedAtMs(localTrades, localCash)
  const localHasData = localTrades.length > 0 || localCash > 0

  if (!cloud || (!cloud.trades?.length && !(cloud.cashBalance > 0))) {
    return {
      trades: localTrades,
      cashBalance: localCash,
      source: "local",
      mode: localHasData ? "local-only-upload-pending" : "empty",
    }
  }

  const cloudAt = cloud.updatedAtMs || portfolioLocalUpdatedAtMs(cloud.trades, cloud.cashBalance)
  const cloudHasData = cloud.trades.length > 0 || cloud.cashBalance > 0

  if (!localHasData && cloudHasData) {
    return { trades: cloud.trades, cashBalance: cloud.cashBalance, source: "cloud", mode: "cloud-download" }
  }

  if (localHasData && !cloudHasData) {
    return { trades: localTrades, cashBalance: localCash, source: "local", mode: "local-upload" }
  }

  if (cloudAt >= localAt) {
    return { trades: cloud.trades, cashBalance: cloud.cashBalance, source: "cloud", mode: "cloud-newer" }
  }

  return { trades: localTrades, cashBalance: localCash, source: "local", mode: "local-newer" }
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
  return {
    trades: Array.isArray(row.trades) ? row.trades.filter((t) => t && typeof t.id === "string") : [],
    cashBalance: Number(row.cash_balance) || 0,
    revision: Number(row.revision) || 0,
    updatedAtMs: parseCloudUpdatedAtMs(row.updated_at),
  }
}

/**
 * @param {string} idToken
 * @param {PortfolioTrade[]} trades
 * @param {number} cashBalance
 */
export async function pushCloudPortfolio(idToken, trades, cashBalance) {
  const revision = portfolioRevision(trades, cashBalance)
  const res = await fetch("/api/portfolio-sync", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      trades,
      cash_balance: cashBalance,
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
  return row
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
    return { trades: localTrades, cashBalance: localCash, source: "local", mode: "cloud-fetch-error" }
  }

  const result = reconcilePortfolio(localTrades, localCash, cloud)

  if (result.mode === "local-only-upload-pending" || result.mode === "local-upload" || result.mode === "local-newer") {
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
