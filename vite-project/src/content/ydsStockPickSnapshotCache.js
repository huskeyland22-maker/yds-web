/**
 * 종목추천 실데이터 스냅샷 캐시 — 메모리 + localStorage (TTL 5분)
 */

export const STOCK_PICK_SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000
const STORAGE_KEY = "yds-stock-pick-snapshots-v1"

/** @type {{ snapshots: Map<string, object>; fetchedAt: string; errors: { ticker: string; error: string }[]; cachedAtMs: number } | null} */
let memoryCache = null

/**
 * @param {import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry} entry
 */
function serializeEntry(entry) {
  return {
    engineSnapshot: entry.engineSnapshot,
    extras: entry.extras,
    apiBody: entry.apiBody,
    quote: entry.quote,
    fetchedAt: entry.fetchedAt,
  }
}

/**
 * @param {object} raw
 * @returns {import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry}
 */
function deserializeEntry(raw) {
  return {
    engineSnapshot: raw.engineSnapshot,
    extras: raw.extras ?? {},
    apiBody: raw.apiBody ?? {},
    quote: raw.quote ?? null,
    fetchedAt: raw.fetchedAt ?? new Date().toISOString(),
  }
}

/**
 * @param {Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} snapshots
 * @param {string} fetchedAt
 * @param {{ ticker: string; error: string }[]} errors
 */
export function setStockPickSnapshotMemoryCache(snapshots, fetchedAt, errors = []) {
  memoryCache = {
    snapshots: new Map(snapshots),
    fetchedAt,
    errors: [...errors],
    cachedAtMs: Date.now(),
  }
  return memoryCache
}

/** @param {number} [now] */
export function getStockPickSnapshotMemoryCache(now = Date.now()) {
  if (!memoryCache) return null
  if (now - memoryCache.cachedAtMs > STOCK_PICK_SNAPSHOT_CACHE_TTL_MS) return null
  return memoryCache
}

/**
 * @param {Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} snapshots
 * @param {string} fetchedAt
 * @param {{ ticker: string; error: string }[]} errors
 */
export function saveStockPickSnapshotCache(snapshots, fetchedAt, errors = []) {
  const cachedAtMs = Date.now()
  setStockPickSnapshotMemoryCache(snapshots, fetchedAt, errors)

  try {
    const entries = [...snapshots.entries()].map(([ticker, entry]) => [
      ticker,
      serializeEntry(entry),
    ])
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cachedAtMs,
        fetchedAt,
        errors,
        entries,
      }),
    )
  } catch (e) {
    console.warn("[stock-pick-cache] localStorage save failed", e?.message ?? e)
  }
}

/**
 * @param {number} [now]
 * @returns {{ snapshots: Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>; fetchedAt: string; errors: { ticker: string; error: string }[]; cachedAtMs: number; source: 'memory' | 'localStorage' } | null}
 */
export function loadStockPickSnapshotCache(now = Date.now()) {
  const mem = getStockPickSnapshotMemoryCache(now)
  if (mem) {
    return { ...mem, source: "memory" }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return null
    if (now - Number(parsed.cachedAtMs) > STOCK_PICK_SNAPSHOT_CACHE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    /** @type {Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} */
    const snapshots = new Map()
    for (const [ticker, entry] of parsed.entries) {
      if (!ticker || !entry) continue
      snapshots.set(String(ticker), deserializeEntry(entry))
    }

    const payload = {
      snapshots,
      fetchedAt: String(parsed.fetchedAt ?? new Date().toISOString()),
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      cachedAtMs: Number(parsed.cachedAtMs) || now,
    }
    setStockPickSnapshotMemoryCache(payload.snapshots, payload.fetchedAt, payload.errors)
    return { ...payload, source: "localStorage" }
  } catch {
    return null
  }
}

/**
 * @returns {{ snapshots: Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>; fetchedAt: string | null; errors: { ticker: string; error: string }[]; fromCache: boolean }}
 */
export function readInitialStockPickSnapshots() {
  const cached = loadStockPickSnapshotCache()
  if (cached?.snapshots?.size) {
    return {
      snapshots: cached.snapshots,
      fetchedAt: cached.fetchedAt,
      errors: cached.errors,
      fromCache: true,
    }
  }
  return {
    snapshots: new Map(),
    fetchedAt: null,
    errors: [],
    fromCache: false,
  }
}
