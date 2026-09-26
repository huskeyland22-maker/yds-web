/**
 * Trade records cloud sync — Supabase user_trade_records via /api/trade-records-sync.
 * Firebase ID token auth. localStorage `yds.tradeRecords.v1` shape unchanged (cache when logged in).
 */

import {
  readTradeRecordsStore,
  writeTradeRecordsStore,
} from "./ydsTradeRecords.js"

export const TRADE_RECORDS_SYNC_META_KEY = "yds.tradeRecords.syncMeta.v1"
export const TRADE_RECORDS_API_PATH = "/api/trade-records-sync"

/**
 * @typedef {{ version: 1, records: Record<string, object[]> }} TradeRecordsStore
 */

/**
 * @typedef {{
 *   records: TradeRecordsStore
 *   revision: number
 *   updatedAt: string | null
 *   syncMode: string
 * }} CloudTradeRecordsSnapshot
 */

/**
 * @typedef {{
 *   store: TradeRecordsStore
 *   revision: number
 *   source: "cloud" | "local"
 *   mode: string
 *   shouldUpload: boolean
 * }} TradeRecordsReconcileResult
 */

/**
 * @typedef {{ getIdToken: () => Promise<string> } | null} TradeRecordsAuthSession
 */

/** @type {TradeRecordsAuthSession} */
let authSession = null
/** @type {ReturnType<typeof setTimeout> | null} */
let pushTimer = null
let skipCloudPush = true
/** @type {number} */
let knownRevision = 0

/**
 * @param {TradeRecordsStore | null | undefined} store
 * @returns {boolean}
 */
export function tradeRecordsStoreHasData(store) {
  if (!store?.records || typeof store.records !== "object") return false
  return Object.values(store.records).some((list) => Array.isArray(list) && list.length > 0)
}

/**
 * @param {TradeRecordsStore} store
 * @returns {number}
 */
export function tradeRecordsRevisionFromStore(store) {
  let max = 0
  const buckets = store?.records && typeof store.records === "object" ? store.records : {}
  for (const list of Object.values(buckets)) {
    if (!Array.isArray(list)) continue
    for (const r of list) {
      const t = Date.parse(String(r?.updatedAt || r?.createdAt || ""))
      if (Number.isFinite(t) && t > max) max = t
    }
  }
  return Math.max(max, Date.now())
}

/** @returns {number} */
export function readTradeRecordsSyncRevision() {
  try {
    const raw = localStorage.getItem(TRADE_RECORDS_SYNC_META_KEY)
    if (!raw) return knownRevision
    const parsed = JSON.parse(raw)
    const rev = Number(parsed?.revision)
    if (Number.isFinite(rev)) {
      knownRevision = rev
      return rev
    }
  } catch {
    /* ignore */
  }
  return knownRevision
}

/** @param {number} revision */
export function writeTradeRecordsSyncRevision(revision) {
  const rev = Number.isFinite(Number(revision)) ? Number(revision) : 0
  knownRevision = rev
  try {
    localStorage.setItem(
      TRADE_RECORDS_SYNC_META_KEY,
      JSON.stringify({ revision: rev, updatedAtMs: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

/**
 * @param {TradeRecordsAuthSession} session
 */
export function setTradeRecordsCloudAuth(session) {
  authSession = session
  if (!session) {
    skipCloudPush = true
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
    }
  }
}

export function beginTradeRecordsCloudReconcile() {
  skipCloudPush = true
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
}

export function endTradeRecordsCloudReconcile() {
  skipCloudPush = false
}

/**
 * @param {TradeRecordsStore} localStore
 * @param {CloudTradeRecordsSnapshot | null | undefined} cloud
 * @returns {TradeRecordsReconcileResult}
 */
export function reconcileTradeRecords(localStore, cloud) {
  const local = localStore?.version === 1 && localStore.records ? localStore : { version: 1, records: {} }
  const localHas = tradeRecordsStoreHasData(local)
  const cloudStore = cloud?.records
  const cloudHas = tradeRecordsStoreHasData(cloudStore)
  const cloudRev = Number.isFinite(Number(cloud?.revision)) ? Number(cloud.revision) : 0

  if (!cloudHas && !localHas) {
    return {
      store: local,
      revision: cloudRev,
      source: "local",
      mode: "empty",
      shouldUpload: false,
    }
  }

  // Empty server must never wipe local — upload instead.
  if (!cloudHas && localHas) {
    return {
      store: local,
      revision: cloudRev,
      source: "local",
      mode: "local-upload",
      shouldUpload: true,
    }
  }

  // Empty local must never wipe server — download instead.
  if (cloudHas && !localHas) {
    return {
      store: /** @type {TradeRecordsStore} */ (cloudStore),
      revision: cloudRev,
      source: "cloud",
      mode: "cloud-download",
      shouldUpload: false,
    }
  }

  // Both have data → server is source of truth (cross-device).
  return {
    store: /** @type {TradeRecordsStore} */ (cloudStore),
    revision: cloudRev,
    source: "cloud",
    mode: "cloud-authoritative",
    shouldUpload: false,
  }
}

/**
 * @param {string} idToken
 * @returns {Promise<CloudTradeRecordsSnapshot | null>}
 */
export async function fetchCloudTradeRecords(idToken) {
  const res = await fetch(TRADE_RECORDS_API_PATH, {
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
  // API returns { records: { version, records }, revision, updatedAt, syncMode }
  const nested = json?.records
  const store =
    nested && typeof nested === "object" && nested.records && typeof nested.records === "object"
      ? { version: 1, records: nested.records }
      : { version: 1, records: {} }
  return {
    records: store,
    revision: Number(json?.revision) || 0,
    updatedAt: json?.updatedAt == null ? null : String(json.updatedAt),
    syncMode: String(json?.syncMode || ""),
  }
}

/**
 * @param {string} idToken
 * @param {TradeRecordsStore} store
 * @param {number} [baseRevision]
 * @returns {Promise<{ ok: boolean, conflict?: boolean, revision?: number, store?: TradeRecordsStore }>}
 */
export async function pushCloudTradeRecords(idToken, store, baseRevision) {
  const revision = tradeRecordsRevisionFromStore(store)
  const body = {
    records: store,
    revision,
  }
  if (baseRevision != null && Number.isFinite(Number(baseRevision))) {
    body.baseRevision = Number(baseRevision)
  }

  const res = await fetch(TRADE_RECORDS_API_PATH, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (res.status === 503) {
    console.warn("[trade-records-sync] Supabase not configured — device-local only")
    return { ok: false }
  }

  if (res.status === 409) {
    const err = await res.json().catch(() => ({}))
    const serverRev = Number(err?.revision)
    try {
      const fresh = await fetchCloudTradeRecords(idToken)
      if (fresh && tradeRecordsStoreHasData(fresh.records)) {
        writeTradeRecordsStore(fresh.records)
        writeTradeRecordsSyncRevision(fresh.revision)
        return { ok: false, conflict: true, revision: fresh.revision, store: fresh.records }
      }
      if (Number.isFinite(serverRev)) writeTradeRecordsSyncRevision(serverRev)
    } catch (e) {
      console.warn("[trade-records-sync] conflict refetch failed — keeping local", e)
    }
    return { ok: false, conflict: true, revision: Number.isFinite(serverRev) ? serverRev : knownRevision }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `save_failed_${res.status}`)
  }

  const json = await res.json()
  const nextRev = Number(json?.revision)
  if (Number.isFinite(nextRev)) writeTradeRecordsSyncRevision(nextRev)
  else writeTradeRecordsSyncRevision(revision)
  return { ok: true, revision: readTradeRecordsSyncRevision() }
}

/**
 * @param {string} idToken
 * @returns {Promise<TradeRecordsReconcileResult>}
 */
export async function reconcileTradeRecordsWithCloud(idToken) {
  const localStore = readTradeRecordsStore()
  let cloud = null
  try {
    cloud = await fetchCloudTradeRecords(idToken)
  } catch (e) {
    console.warn("[trade-records-sync] cloud fetch failed — using local", e)
    return {
      store: localStore,
      revision: readTradeRecordsSyncRevision(),
      source: "local",
      mode: "cloud-fetch-error",
      shouldUpload: false,
    }
  }

  const result = reconcileTradeRecords(localStore, cloud)

  if (result.source === "cloud") {
    // Apply server cache; never apply empty over local (guarded by reconcile).
    writeTradeRecordsStore(result.store)
  }
  writeTradeRecordsSyncRevision(result.revision)

  if (result.shouldUpload) {
    try {
      const pushed = await pushCloudTradeRecords(idToken, result.store, result.revision)
      if (pushed.ok && pushed.revision != null) {
        result.revision = pushed.revision
      }
    } catch (e) {
      console.warn("[trade-records-sync] initial upload failed — local kept", e)
    }
  }

  console.info("[trade-records-sync] reconcile", {
    mode: result.mode,
    source: result.source,
    localHas: tradeRecordsStoreHasData(localStore),
    cloudHas: tradeRecordsStoreHasData(cloud?.records),
    revision: result.revision,
  })

  return result
}

/**
 * Debounced PUT after local mutations (logged-in only).
 */
export function scheduleTradeRecordsCloudPush() {
  if (!authSession || skipCloudPush) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void flushTradeRecordsCloudPush()
  }, 900)
}

export async function flushTradeRecordsCloudPush() {
  if (!authSession || skipCloudPush) return
  try {
    const token = await authSession.getIdToken()
    const store = readTradeRecordsStore()
    const baseRevision = readTradeRecordsSyncRevision()
    await pushCloudTradeRecords(token, store, baseRevision)
  } catch (e) {
    console.warn("[trade-records-sync] push failed — local kept", e)
  }
}
