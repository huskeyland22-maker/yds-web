import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

const API_PATH = "/api/dbb-prospective-ohlcv"

/**
 * Read-only OHLCV for prospective outcome refresh.
 * @param {string} symbol
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchProspectiveOhlcv(symbol, { signal } = {}) {
  const url = withNoStoreQuery(`${API_PATH}?symbol=${encodeURIComponent(symbol)}`)
  const res = await fetch(url, { ...LIVE_JSON_GET_INIT, signal })
  if (!res.ok) return { ok: false, symbol, bars: null, error: `HTTP ${res.status}` }
  const json = await res.json()
  if (!json?.ok || !Array.isArray(json.bars)) {
    return { ok: false, symbol, bars: null, error: json?.error || "empty" }
  }
  return { ok: true, symbol: json.symbol || symbol, bars: json.bars, updatedAt: json.updatedAt || null }
}
