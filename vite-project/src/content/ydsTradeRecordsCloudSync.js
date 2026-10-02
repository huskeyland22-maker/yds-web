/**
 * Trade records cloud sync — Supabase user_trade_records via /api/trade-records-sync.
 * Firebase ID token auth. localStorage `yds.tradeRecords.v1` shape unchanged (cache when logged in).
 */

import {
  normalizeDeletedRecordIds,
  readTradeRecordsStore,
  stripDeletedTradeRecords,
  unionDeletedRecordIds,
  writeTradeRecordsStore,
} from "./ydsTradeRecords.js"

export const TRADE_RECORDS_SYNC_META_KEY = "yds.tradeRecords.syncMeta.v1"
export const TRADE_RECORDS_API_PATH = "/api/trade-records-sync"

/**
 * @typedef {{ version: 1, records: Record<string, object[]>, deletedRecordIds?: string[] }} TradeRecordsStore
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
/** Save happened while reconcile was blocking pushes. Flushed when reconcile ends. */
let deferredPush = false
/** @type {number} */
let knownRevision = 0

/**
 * @param {object | null | undefined} record
 * @returns {number}
 */
/**
 * @param {TradeRecordsStore | null | undefined} store
 * @param {string} id
 */
function recordStillLive(store, id) {
  const buckets = store?.records && typeof store.records === "object" ? store.records : {}
  for (const list of Object.values(buckets)) {
    if (!Array.isArray(list)) continue
    if (list.some((row) => row && row.id === id)) return true
  }
  return false
}

function recordStamp(record) {
  const t = Date.parse(String(record?.updatedAt || record?.createdAt || ""))
  return Number.isFinite(t) ? t : 0
}

/**
 * Cloud rows first, then local rows. Same id keeps the newer stamp.
 * A tie keeps the local row so an in-flight save is not dropped.
 * @param {object[] | null | undefined} cloudList
 * @param {object[] | null | undefined} localList
 * @returns {object[]}
 */
function mergeRecordLists(cloudList, localList) {
  /** @type {Map<string, object>} */
  const map = new Map()
  for (const row of Array.isArray(cloudList) ? cloudList : []) {
    if (row && typeof row.id === "string" && row.id) map.set(row.id, row)
  }
  for (const row of Array.isArray(localList) ? localList : []) {
    if (!row || typeof row.id !== "string" || !row.id) continue
    const prev = map.get(row.id)
    if (!prev || recordStamp(row) >= recordStamp(prev)) map.set(row.id, row)
  }
  return [...map.values()]
}

/**
 * Union of buckets. Local-only keys such as `dbb:MSFT` stay.
 * @param {TradeRecordsStore | null | undefined} base
 * @param {TradeRecordsStore | null | undefined} extra
 * @returns {TradeRecordsStore}
 */
function mergeTradeRecordStores(base, extra) {
  const baseRecords = base?.records && typeof base.records === "object" ? base.records : {}
  const extraRecords = extra?.records && typeof extra.records === "object" ? extra.records : {}
  /** @type {Record<string, object[]>} */
  const records = {}
  for (const key of new Set([...Object.keys(baseRecords), ...Object.keys(extraRecords)])) {
    const merged = mergeRecordLists(baseRecords[key], extraRecords[key])
    if (merged.length) records[key] = merged
  }
  return { version: 1, records }
}

/**
 * Union live rows, then drop every id in either tombstone list.
 * A deleted id never survives a newer or older copy of the same row.
 * @param {TradeRecordsStore | null | undefined} base
 * @param {TradeRecordsStore | null | undefined} extra
 * @returns {TradeRecordsStore}
 */
export function mergeTradeRecordsWithDeletions(base, extra) {
  const deletedRecordIds = unionDeletedRecordIds(base?.deletedRecordIds, extra?.deletedRecordIds)
  const merged = mergeTradeRecordStores(base, extra)
  return {
    version: 1,
    records: stripDeletedTradeRecords(merged.records, deletedRecordIds),
    deletedRecordIds,
  }
}

/**
 * Cloud is missing a tombstone, or it still contains a row that was deleted.
 * @param {TradeRecordsStore | null | undefined} cloudStore
 * @param {TradeRecordsStore | null | undefined} next
 */
function deletionsNeedUpload(cloudStore, next) {
  const cloudIds = new Set(normalizeDeletedRecordIds(cloudStore?.deletedRecordIds))
  for (const id of normalizeDeletedRecordIds(next?.deletedRecordIds)) {
    if (!cloudIds.has(id)) return true
  }
  const deleted = new Set(normalizeDeletedRecordIds(next?.deletedRecordIds))
  if (!deleted.size) return false
  const buckets = cloudStore?.records && typeof cloudStore.records === "object" ? cloudStore.records : {}
  for (const list of Object.values(buckets)) {
    if (!Array.isArray(list)) continue
    for (const row of list) {
      if (row && typeof row.id === "string" && deleted.has(row.id)) return true
    }
  }
  return false
}

/**
 * @param {TradeRecordsStore | null | undefined} store
 * @returns {TradeRecordsStore}
 */
function normalizeSyncStore(store) {
  const records = store?.records && typeof store.records === "object" ? store.records : {}
  const deletedRecordIds = normalizeDeletedRecordIds(store?.deletedRecordIds)
  return {
    version: 1,
    records: stripDeletedTradeRecords(records, deletedRecordIds),
    deletedRecordIds,
  }
}

/**
 * True when `next` has a bucket row the `base` snapshot does not,
 * or a newer stamp for an id that both have.
 * @param {TradeRecordsStore | null | undefined} base
 * @param {TradeRecordsStore | null | undefined} next
 */
function storeHasNewerLocalData(base, next) {
  const baseRecords = base?.records && typeof base.records === "object" ? base.records : {}
  const nextRecords = next?.records && typeof next.records === "object" ? next.records : {}
  for (const [key, list] of Object.entries(nextRecords)) {
    if (!Array.isArray(list)) continue
    const baseList = Array.isArray(baseRecords[key]) ? baseRecords[key] : []
    /** @type {Map<string, object>} */
    const baseById = new Map()
    for (const row of baseList) {
      if (row && typeof row.id === "string" && row.id) baseById.set(row.id, row)
    }
    for (const row of list) {
      if (!row || typeof row.id !== "string" || !row.id) continue
      const prev = baseById.get(row.id)
      if (!prev || recordStamp(row) > recordStamp(prev)) return true
    }
  }
  return false
}

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
    deferredPush = false
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
  if (!deferredPush) return
  deferredPush = false
  scheduleTradeRecordsCloudPush()
}

/**
 * @param {TradeRecordsStore} localStore
 * @param {CloudTradeRecordsSnapshot | null | undefined} cloud
 * @returns {TradeRecordsReconcileResult}
 */
export function reconcileTradeRecords(localStore, cloud) {
  const local = normalizeSyncStore(
    localStore?.version === 1 && localStore.records ? localStore : { version: 1, records: {} },
  )
  const cloudRaw =
    cloud?.records && typeof cloud.records === "object"
      ? cloud.records
      : { version: 1, records: {}, deletedRecordIds: [] }
  const cloudStore = normalizeSyncStore(cloudRaw)
  const localHas = tradeRecordsStoreHasData(local)
  const cloudHas = tradeRecordsStoreHasData(cloudStore)
  const localTomb = local.deletedRecordIds.length > 0
  const cloudTomb = cloudStore.deletedRecordIds.length > 0
  const cloudRev = Number.isFinite(Number(cloud?.revision)) ? Number(cloud.revision) : 0
  const store = mergeTradeRecordsWithDeletions(cloudStore, local)
  const uploadNewer = storeHasNewerLocalData(cloudStore, store)
  const uploadDelete = deletionsNeedUpload(cloudRaw, store)

  if (!cloudHas && !cloudTomb && !localHas && !localTomb) {
    return {
      store,
      revision: cloudRev,
      source: "local",
      mode: "empty",
      shouldUpload: false,
    }
  }

  // Empty server must never wipe local — upload instead. Local tombstones go with it.
  if (!cloudHas && !cloudTomb && (localHas || localTomb)) {
    return {
      store,
      revision: cloudRev,
      source: "local",
      mode: "local-upload",
      shouldUpload: true,
    }
  }

  // Empty local must never wipe server — download instead, including tombstones.
  if ((cloudHas || cloudTomb) && !localHas && !localTomb) {
    return {
      store,
      revision: cloudRev,
      source: "cloud",
      mode: "cloud-download",
      shouldUpload: uploadDelete,
    }
  }

  // Both sides have rows or tombstones. Deleted ids win over any live copy.
  const shouldUpload = uploadNewer || uploadDelete
  return {
    store,
    revision: cloudRev,
    source: "cloud",
    mode: shouldUpload ? "merged-upload" : "cloud-authoritative",
    shouldUpload,
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
      ? {
          version: 1,
          records: nested.records,
          deletedRecordIds: normalizeDeletedRecordIds(nested.deletedRecordIds),
        }
      : { version: 1, records: {}, deletedRecordIds: [] }
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
      if (fresh) {
        const reconciled = reconcileTradeRecords(readTradeRecordsStore(), fresh)
        writeTradeRecordsStore(reconciled.store)
        writeTradeRecordsSyncRevision(fresh.revision)
        if (reconciled.shouldUpload) scheduleTradeRecordsCloudPush()
        return { ok: false, conflict: true, revision: fresh.revision, store: reconciled.store }
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
  // A save during the cloud fetch is not in `localStore`. Fold it in before write/upload.
  // Tombstones from that save still beat a live row captured before the delete.
  const localNow = readTradeRecordsStore()
  const merged = mergeTradeRecordsWithDeletions(result.store, localNow)
  result.store = merged
  if (storeHasNewerLocalData(cloud?.records, merged) || deletionsNeedUpload(cloud?.records, merged)) {
    result.shouldUpload = true
    if (result.mode === "cloud-authoritative" || result.mode === "cloud-download" || result.mode === "empty") {
      result.mode = "merged-upload"
    }
  }

  const localDeleted = new Set(normalizeDeletedRecordIds(localNow.deletedRecordIds))
  const gainedTombstone = normalizeDeletedRecordIds(merged.deletedRecordIds).some((id) => !localDeleted.has(id))
  const droppedLiveRow = Object.values(localNow.records || {}).some(
    (list) =>
      Array.isArray(list) &&
      list.some((row) => row && typeof row.id === "string" && !recordStillLive(merged, row.id)),
  )
  if (result.source === "cloud" || storeHasNewerLocalData(localNow, merged) || gainedTombstone || droppedLiveRow) {
    // Apply merged cache. Local-only dbb:* buckets stay in `merged`.
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
  if (!authSession) return
  if (skipCloudPush) {
    deferredPush = true
    return
  }
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
