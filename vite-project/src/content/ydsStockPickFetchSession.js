/**
 * 종목추천 유니버스 fetch — 브라우저 세션당 1회 (remount·panicIndex 변경 재호출 방지)
 */

import { getStockPickSnapshotMemoryCache } from "./ydsStockPickSnapshotCache.js"

const GKEY = "__ydsStockPickFetchSession__"

/** @returns {{ done: boolean; promise: Promise<object> | null; lastCallsite: string | null }} */
function session() {
  const g = globalThis
  if (!g[GKEY]) {
    g[GKEY] = { done: false, promise: null, lastCallsite: null }
  }
  return g[GKEY]
}

export function isStockPickFetchSessionDone() {
  return session().done
}

export function getStockPickFetchSessionCallsite() {
  return session().lastCallsite
}

/**
 * @template T
 * @param {() => Promise<T>} runner
 * @param {{ callsite?: string; force?: boolean }} [opts]
 * @returns {Promise<T>}
 */
export async function runStockPickFetchOnce(runner, opts = {}) {
  const s = session()
  const callsite = opts.callsite ?? "unknown"
  s.lastCallsite = callsite

  if (s.done && !opts.force) {
    const mem = getStockPickSnapshotMemoryCache()
    if (mem?.snapshots?.size) {
      console.log("[stock-pick-fetch] session cache hit — skip HTTP", { callsite })
      return {
        snapshots: mem.snapshots,
        errors: mem.errors ?? [],
        fetchedAt: mem.fetchedAt,
        fromSessionCache: true,
      }
    }
  }

  if (s.promise && !opts.force) {
    console.log("[stock-pick-fetch] join in-flight session promise", { callsite })
    return s.promise
  }

  const p = runner()
  s.promise = p

  try {
    const result = await p
    s.done = true
    return result
  } finally {
    if (s.promise === p) {
      s.promise = null
    }
  }
}

/** 테스트·강제 재조회용 */
export function resetStockPickFetchSession() {
  const g = globalThis
  g[GKEY] = { done: false, promise: null, lastCallsite: null }
}
