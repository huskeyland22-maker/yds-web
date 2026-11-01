/**
 * Portfolio cloud sync — Supabase user_portfolio via /api/portfolio-sync (Firebase auth).
 *
 * ## Revision model (Phase B)
 *
 * - **Server revision** (`user_portfolio.revision`): monotonic integer owned by the server.
 *   Clients send `baseRevision` (last seen server revision). Successful PUT → server sets N+1.
 *   Stored locally in per-owner sync meta (`yds-portfolio-sync-meta-v1:uid:…`).
 *
 * - **Content clock** (`portfolioContentUpdatedAtMs`): max(trade.updatedAt|createdAt).
 *   Used only as a weak signal when comparing two local drafts — **never** as a substitute
 *   for server revision, and **never** includes Date.now() or cash balance.
 *
 * - **Conflict hold** (`conflictPending` on sync meta): set on HTTP 409. Blocks all automatic
 *   PUTs (debounce push, reconcile upload) until a future explicit resolve UX clears it.
 *   Does not clear on local edits, refresh, or re-login. Per-uid key — never shared.
 *
 * Reconcile when both sides have data:
 * - Prefer cloud if local has no known server revision (never successfully synced this slot).
 * - Prefer cloud if cloud.revision > knownServerRevision.
 * - Prefer local upload only when cloud.revision === knownServerRevision (edits since last sync).
 * - If conflictPending: keep local, no upload, no automatic cloud overwrite.
 */

import {
  canPushPortfolioToCloud,
  portfolioSyncMetaKeyForOwner,
} from "./ydsPortfolioStorageScope.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/** @deprecated Prefer portfolioSyncMetaKeyForOwner(uid) — shared key kept for orphan/debug scans */
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
 * @typedef {{
 *   revision: number | null
 *   updatedAtMs: number
 *   conflictPending?: boolean
 *   conflictAtMs?: number
 *   conflictServerRevision?: number | null
 * }} PortfolioSyncMeta
 */

export class PortfolioSyncConflictError extends Error {
  /**
   * @param {string} message
   * @param {{ revision?: number, portfolio?: CloudPortfolioSnapshot | null }} [info]
   */
  constructor(message, info = {}) {
    super(message)
    this.name = "PortfolioSyncConflictError"
    this.code = "revision_conflict"
    this.revision = info.revision
    this.portfolio = info.portfolio ?? null
  }
}

/**
 * Max trade updatedAt/createdAt — content clock only (not a server revision).
 * @param {PortfolioTrade[]} trades
 */
export function portfolioContentUpdatedAtMs(trades) {
  return (trades ?? []).reduce(
    (max, t) => Math.max(max, Number(t.updatedAt ?? t.createdAt ?? 0)),
    0,
  )
}

/**
 * @deprecated Name kept for callers. Returns content clock only — no Date.now(), no cash.
 * @param {PortfolioTrade[]} trades
 * @param {number} [_cashBalance]
 */
export function portfolioRevision(trades, _cashBalance = 0) {
  return portfolioContentUpdatedAtMs(trades)
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} [cashBalance]
 */
export function portfolioLocalUpdatedAtMs(trades, cashBalance = 0) {
  void cashBalance
  return portfolioContentUpdatedAtMs(trades)
}

/** @param {unknown} updatedAt */
export function parseCloudUpdatedAtMs(updatedAt) {
  if (updatedAt == null) return 0
  if (typeof updatedAt === "number" && Number.isFinite(updatedAt)) return updatedAt
  const ms = Date.parse(String(updatedAt))
  return Number.isFinite(ms) ? ms : 0
}

/**
 * @param {string | null | undefined} ownerUid
 * @returns {PortfolioSyncMeta | null}
 */
export function readPortfolioSyncMeta(ownerUid) {
  try {
    const raw = localStorage.getItem(portfolioSyncMetaKeyForOwner(ownerUid))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const revRaw = parsed.revision
    const revision =
      revRaw == null || revRaw === ""
        ? null
        : Number.isFinite(Number(revRaw))
          ? Math.round(Number(revRaw))
          : null
    const conflictServerRaw = parsed.conflictServerRevision
    return {
      revision,
      updatedAtMs: Number(parsed.updatedAtMs) || 0,
      conflictPending: Boolean(parsed.conflictPending),
      conflictAtMs: Number(parsed.conflictAtMs) || 0,
      conflictServerRevision:
        conflictServerRaw == null || conflictServerRaw === ""
          ? null
          : Number.isFinite(Number(conflictServerRaw))
            ? Math.round(Number(conflictServerRaw))
            : null,
    }
  } catch {
    return null
  }
}

/**
 * @param {string | null | undefined} ownerUid
 * @param {Partial<PortfolioSyncMeta> & { revision: number | null }} meta
 */
export function writePortfolioSyncMeta(ownerUid, meta) {
  try {
    const prev = readPortfolioSyncMeta(ownerUid)
    localStorage.setItem(
      portfolioSyncMetaKeyForOwner(ownerUid),
      JSON.stringify({
        revision: meta.revision,
        updatedAtMs: meta.updatedAtMs ?? Date.now(),
        conflictPending:
          meta.conflictPending !== undefined ? Boolean(meta.conflictPending) : Boolean(prev?.conflictPending),
        conflictAtMs:
          meta.conflictAtMs !== undefined ? meta.conflictAtMs : (prev?.conflictAtMs ?? 0),
        conflictServerRevision:
          meta.conflictServerRevision !== undefined
            ? meta.conflictServerRevision
            : (prev?.conflictServerRevision ?? null),
      }),
    )
  } catch {
    /* ignore */
  }
}

/**
 * @param {string | null | undefined} ownerUid
 */
export function hasPortfolioSyncConflict(ownerUid) {
  if (ownerUid == null || String(ownerUid).trim() === "") return false
  return Boolean(readPortfolioSyncMeta(ownerUid)?.conflictPending)
}

/**
 * Mark unresolved sync conflict for this account. Survives refresh/re-login.
 * Does not clear on local edits. Does not write shared/orphan keys.
 *
 * Important: does **not** advance `revision` to the winning server revision
 * (that would allow a later PUT with matching baseRevision to overwrite cloud).
 *
 * @param {string | null | undefined} ownerUid
 * @param {{ serverRevision?: number | null }} [info]
 */
export function markPortfolioSyncConflict(ownerUid, info = {}) {
  if (ownerUid == null || String(ownerUid).trim() === "") return
  const prev = readPortfolioSyncMeta(ownerUid)
  const serverRev =
    info.serverRevision == null || !Number.isFinite(Number(info.serverRevision))
      ? (prev?.conflictServerRevision ?? null)
      : Math.round(Number(info.serverRevision))
  writePortfolioSyncMeta(ownerUid, {
    revision: prev?.revision ?? null,
    updatedAtMs: Date.now(),
    conflictPending: true,
    conflictAtMs: Date.now(),
    conflictServerRevision: serverRev,
  })
}

/**
 * Explicit clear only (future resolve UX). Not called by automatic sync paths.
 * @param {string | null | undefined} ownerUid
 */
export function clearPortfolioSyncConflict(ownerUid) {
  if (ownerUid == null || String(ownerUid).trim() === "") return
  const prev = readPortfolioSyncMeta(ownerUid)
  writePortfolioSyncMeta(ownerUid, {
    revision: prev?.revision ?? null,
    updatedAtMs: Date.now(),
    conflictPending: false,
    conflictAtMs: 0,
    conflictServerRevision: null,
  })
}

/**
 * Ownership + conflict hold — false blocks every automatic cloud PUT.
 * @param {string | null | undefined} ownerUid
 */
export function canAutoPushPortfolioToCloud(ownerUid) {
  if (!canPushPortfolioToCloud(ownerUid)) return false
  if (hasPortfolioSyncConflict(ownerUid)) return false
  return true
}

/**
 * @param {PortfolioTrade[]} a
 * @param {number} cashA
 * @param {PortfolioTrade[]} b
 * @param {number} cashB
 */
function portfolioSnapshotsEqual(a, cashA, b, cashB) {
  if (Math.round(Number(cashA) || 0) !== Math.round(Number(cashB) || 0)) return false
  const left = (a ?? []).map((t) => `${t.id}:${t.updatedAt ?? t.createdAt ?? 0}`).sort()
  const right = (b ?? []).map((t) => `${t.id}:${t.updatedAt ?? t.createdAt ?? 0}`).sort()
  if (left.length !== right.length) return false
  return left.every((v, i) => v === right[i])
}

/**
 * @param {PortfolioTrade[]} localTrades
 * @param {number} localCash
 * @param {CloudPortfolioSnapshot | null | undefined} cloud
 * @param {{ knownServerRevision?: number | null, conflictPending?: boolean }} [opts]
 * @returns {ReconcileResult}
 */
export function reconcilePortfolio(localTrades, localCash, cloud, opts = {}) {
  if (opts.conflictPending) {
    return {
      trades: localTrades,
      cashBalance: localCash,
      source: "local",
      mode: "conflict-hold",
    }
  }

  const localHasData = localTrades.length > 0 || localCash > 0
  const knownServerRevision =
    opts.knownServerRevision == null || opts.knownServerRevision === ""
      ? null
      : Number(opts.knownServerRevision)

  if (!cloud || (!cloud.trades?.length && !(cloud.cashBalance > 0))) {
    return {
      trades: localTrades,
      cashBalance: localCash,
      source: "local",
      mode: localHasData ? "local-only-upload-pending" : "empty",
    }
  }

  const cloudHasData = cloud.trades.length > 0 || cloud.cashBalance > 0
  const cloudRev = Number(cloud.revision)
  const safeCloudRev = Number.isFinite(cloudRev) ? Math.round(cloudRev) : 0

  if (!localHasData && cloudHasData) {
    return { trades: cloud.trades, cashBalance: cloud.cashBalance, source: "cloud", mode: "cloud-download" }
  }

  if (localHasData && !cloudHasData) {
    return { trades: localTrades, cashBalance: localCash, source: "local", mode: "local-upload" }
  }

  if (knownServerRevision == null || !Number.isFinite(knownServerRevision)) {
    return {
      trades: cloud.trades,
      cashBalance: cloud.cashBalance,
      source: "cloud",
      mode: "cloud-newer",
    }
  }

  if (safeCloudRev > knownServerRevision) {
    return {
      trades: cloud.trades,
      cashBalance: cloud.cashBalance,
      source: "cloud",
      mode: "cloud-newer",
    }
  }

  if (safeCloudRev < knownServerRevision) {
    return {
      trades: cloud.trades,
      cashBalance: cloud.cashBalance,
      source: "cloud",
      mode: "cloud-newer",
    }
  }

  if (portfolioSnapshotsEqual(localTrades, localCash, cloud.trades, cloud.cashBalance)) {
    return {
      trades: localTrades,
      cashBalance: localCash,
      source: "local",
      mode: "in-sync",
    }
  }

  return {
    trades: localTrades,
    cashBalance: localCash,
    source: "local",
    mode: "local-newer",
  }
}

/**
 * @param {unknown} row
 * @returns {CloudPortfolioSnapshot | null}
 */
function rowToSnapshot(row) {
  if (!row || typeof row !== "object") return null
  const r = /** @type {Record<string, unknown>} */ (row)
  return {
    trades: Array.isArray(r.trades) ? r.trades.filter((t) => t && typeof t.id === "string") : [],
    cashBalance: Number(r.cash_balance) || 0,
    revision: Number(r.revision) || 0,
    updatedAtMs: parseCloudUpdatedAtMs(r.updated_at),
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
  return rowToSnapshot(json?.portfolio)
}

/**
 * @param {string} idToken
 * @param {PortfolioTrade[]} trades
 * @param {number} cashBalance
 * @param {{ ownerUid?: string | null, baseRevision?: number | null }} [opts]
 */
export async function pushCloudPortfolio(idToken, trades, cashBalance, opts = {}) {
  const ownerUid = opts.ownerUid
  if (!canAutoPushPortfolioToCloud(ownerUid)) {
    console.warn("[portfolio-sync] upload blocked — owner guard or conflict hold", {
      ownerUid: ownerUid ?? null,
      conflictPending: hasPortfolioSyncConflict(ownerUid),
    })
    return null
  }

  const meta = readPortfolioSyncMeta(ownerUid)
  const baseRevision =
    opts.baseRevision !== undefined ? opts.baseRevision : (meta?.revision ?? null)

  const res = await fetch("/api/portfolio-sync", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      trades,
      cash_balance: cashBalance,
      baseRevision,
    }),
    cache: "no-store",
  })
  if (res.status === 503) {
    console.warn("[portfolio-sync] Supabase not configured — device-local only")
    return null
  }
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}))
    const snap = rowToSnapshot(err?.portfolio)
    const serverRev =
      snap && Number.isFinite(snap.revision)
        ? snap.revision
        : err?.revision != null && Number.isFinite(Number(err.revision))
          ? Math.round(Number(err.revision))
          : null
    // Conflict hold — do not advance meta.revision to server winner (would unlock stale PUT).
    markPortfolioSyncConflict(ownerUid, { serverRevision: serverRev })
    throw new PortfolioSyncConflictError("revision_conflict", {
      revision: serverRev ?? undefined,
      portfolio: snap,
    })
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `save_failed_${res.status}`)
  }
  const json = await res.json()
  const row = json?.portfolio
  const snap = rowToSnapshot(row)
  if (snap) {
    writePortfolioSyncMeta(ownerUid, {
      revision: snap.revision,
      updatedAtMs: snap.updatedAtMs || Date.now(),
      conflictPending: false,
      conflictAtMs: 0,
      conflictServerRevision: null,
    })
  }
  return row
}

/**
 * @param {string} idToken
 * @param {PortfolioTrade[]} localTrades
 * @param {number} localCash
 * @param {{ ownerUid?: string | null }} [opts]
 * @returns {Promise<ReconcileResult>}
 */
export async function reconcilePortfolioWithCloud(idToken, localTrades, localCash, opts = {}) {
  const ownerUid = opts.ownerUid
  const syncMeta = readPortfolioSyncMeta(ownerUid)
  const conflictPending = Boolean(syncMeta?.conflictPending)

  let cloud = null
  try {
    cloud = await fetchCloudPortfolio(idToken)
  } catch (e) {
    console.warn("[portfolio-sync] cloud fetch failed — using local", e)
    return { trades: localTrades, cashBalance: localCash, source: "local", mode: "cloud-fetch-error" }
  }

  const result = reconcilePortfolio(localTrades, localCash, cloud, {
    knownServerRevision: syncMeta?.revision ?? null,
    conflictPending,
  })

  if (result.mode === "conflict-hold") {
    console.info("[portfolio-sync] reconcile held — conflict pending, no upload/overwrite", {
      ownerUid: ownerUid ?? null,
      cloudRevision: cloud?.revision ?? null,
    })
    return result
  }

  if (result.source === "cloud" && cloud && Number.isFinite(cloud.revision)) {
    writePortfolioSyncMeta(ownerUid, {
      revision: cloud.revision,
      updatedAtMs: cloud.updatedAtMs || Date.now(),
      // preserve conflictPending if somehow set (should already have returned)
      conflictPending: false,
      conflictAtMs: 0,
      conflictServerRevision: null,
    })
  }

  const wantsUpload =
    result.mode === "local-only-upload-pending" ||
    result.mode === "local-upload" ||
    result.mode === "local-newer"

  if (wantsUpload) {
    if (!canAutoPushPortfolioToCloud(ownerUid)) {
      console.warn("[portfolio-sync] reconcile upload skipped — owner guard or conflict hold", {
        mode: result.mode,
        ownerUid: ownerUid ?? null,
        conflictPending: hasPortfolioSyncConflict(ownerUid),
      })
      if (hasPortfolioSyncConflict(ownerUid)) {
        return {
          trades: localTrades,
          cashBalance: localCash,
          source: "local",
          mode: "conflict-hold",
        }
      }
    } else {
      try {
        const baseRevision =
          cloud == null
            ? null
            : Number.isFinite(Number(cloud.revision))
              ? Math.round(Number(cloud.revision))
              : (syncMeta?.revision ?? null)
        await pushCloudPortfolio(idToken, result.trades, result.cashBalance, {
          ownerUid,
          baseRevision,
        })
      } catch (e) {
        if (e instanceof PortfolioSyncConflictError) {
          console.warn("[portfolio-sync] reconcile upload conflict — hold local", e)
          return {
            trades: localTrades,
            cashBalance: localCash,
            source: "local",
            mode: "conflict-hold",
          }
        }
        console.warn("[portfolio-sync] initial upload failed", e)
      }
    }
  }

  console.info("[portfolio-sync] reconcile", {
    mode: result.mode,
    source: result.source,
    localTrades: localTrades.length,
    cloudTrades: cloud?.trades?.length ?? 0,
    localCash,
    cloudCash: cloud?.cashBalance ?? 0,
    ownerUid: ownerUid ?? null,
    knownServerRevision: syncMeta?.revision ?? null,
  })

  return result
}
