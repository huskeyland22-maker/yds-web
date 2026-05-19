import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import { normalizeStockCodeParam } from "./stockIndicatorsApi.js"

/**
 * @param {string[]} codes
 * @param {{ sectorScore?: number | null; panicIndex?: number | null }} [ctx]
 */
export async function fetchStockSignalsBatch(codes, ctx = {}) {
  const uniq = [...new Set(codes.map((c) => normalizeStockCodeParam(c)).filter(Boolean))]
  if (!uniq.length) return { results: {}, errors: {} }

  const qs = new URLSearchParams()
  qs.set("batch", "1")
  qs.set("codes", uniq.join(","))
  if (ctx.sectorScore != null && Number.isFinite(Number(ctx.sectorScore))) {
    qs.set("sectorScore", String(ctx.sectorScore))
  }
  if (ctx.panicIndex != null && Number.isFinite(Number(ctx.panicIndex))) {
    qs.set("panicIndex", String(ctx.panicIndex))
  }

  const res = await fetch(withNoStoreQuery(`/api/stock?${qs.toString()}`), LIVE_JSON_GET_INIT)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `batch HTTP ${res.status}`)
  }
  return {
    results: body.results ?? {},
    errors: body.errors ?? {},
    panicIndex: body.panicIndex ?? null,
  }
}

/**
 * @param {string} code
 * @param {{ days?: number }} [opts]
 */
export async function fetchStockSignalHistory(code, opts = {}) {
  const ticker = normalizeStockCodeParam(code)
  if (!ticker) return []
  const qs = new URLSearchParams()
  qs.set("code", ticker)
  qs.set("signalHistory", "1")
  if (opts.days) qs.set("days", String(opts.days))
  const res = await fetch(withNoStoreQuery(`/api/stock?${qs.toString()}`), LIVE_JSON_GET_INIT)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return []
  return Array.isArray(body.rows) ? body.rows : []
}
