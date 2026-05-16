import { fetchYahooQuoteSeries } from "./yahooQuote.js"

const CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
const FRED_HY_SERIES = "BAMLH0A0HYM2"

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function collectScores(node, out) {
  if (!node || typeof node !== "object") return
  if (Object.prototype.hasOwnProperty.call(node, "score")) {
    const s = toNum(node.score)
    if (s != null) out.push(s)
  }
  if (Array.isArray(node)) {
    for (const x of node) collectScores(x, out)
    return
  }
  for (const v of Object.values(node)) collectScores(v, out)
}

/** @returns {Promise<{ value: number | null, delta: number | null, error?: string }>} */
export async function fetchCnnFearGreed() {
  try {
    const res = await fetch(CNN_FG_URL, { cache: "no-store" })
    if (!res.ok) return { value: null, delta: null, error: `cnn_http_${res.status}` }
    const payload = await res.json()
    const current = toNum(payload?.fear_and_greed?.score)
    const scores = []
    collectScores(payload, scores)
    const uniq = [...new Set(scores)]
    let previous = null
    if (current != null) {
      for (const s of uniq) {
        if (s !== current) {
          previous = s
          break
        }
      }
    }
    const delta = current != null && previous != null ? current - previous : null
    return { value: current, delta }
  } catch (e) {
    return { value: null, delta: null, error: e instanceof Error ? e.message : "cnn_fetch" }
  }
}

/** @returns {Promise<{ value: number | null, delta: number | null, error?: string }>} */
export async function fetchAlternativeMeFearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=2", { cache: "no-store" })
    if (!res.ok) return { value: null, delta: null, error: `fng_http_${res.status}` }
    const json = await res.json()
    const items = Array.isArray(json?.data) ? json.data : []
    const current = toNum(items[0]?.value)
    const prev = toNum(items[1]?.value)
    const delta = current != null && prev != null ? current - prev : null
    return { value: current, delta }
  } catch (e) {
    return { value: null, delta: null, error: e instanceof Error ? e.message : "fng_fetch" }
  }
}

/** @returns {Promise<{ value: number | null, delta: number | null, error?: string }>} */
export async function fetchFredHighYieldOas() {
  const key = String(process.env.FRED_API_KEY || "").trim()
  if (!key) return { value: null, delta: null, error: "fred_key_missing" }
  try {
    const url = new URL("https://api.stlouisfed.org/fred/series/observations")
    url.searchParams.set("series_id", FRED_HY_SERIES)
    url.searchParams.set("api_key", key)
    url.searchParams.set("file_type", "json")
    url.searchParams.set("sort_order", "desc")
    url.searchParams.set("limit", "3")
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) return { value: null, delta: null, error: `fred_http_${res.status}` }
    const json = await res.json()
    const obs = (Array.isArray(json?.observations) ? json.observations : [])
      .map((o) => toNum(o?.value))
      .filter((n) => n != null)
    if (!obs.length) return { value: null, delta: null, error: "fred_empty" }
    const value = obs[0]
    const delta = obs.length >= 2 ? value - obs[1] : null
    return { value, delta }
  } catch (e) {
    return { value: null, delta: null, error: e instanceof Error ? e.message : "fred_fetch" }
  }
}

/**
 * Live 수집 — 실패한 필드는 null, changes 에 delta 반영.
 * @param {{ preserve?: Record<string, number | null> }} [opts]
 */
export async function collectPanicMetricsLive(opts = {}) {
  const preserve = opts.preserve && typeof opts.preserve === "object" ? opts.preserve : {}
  const changes = {}
  const errors = {}

  const tasks = [
    ["vix", () => fetchYahooQuoteSeries("^VIX")],
    ["vxn", () => fetchYahooQuoteSeries("^VXN")],
    ["skew", () => fetchYahooQuoteSeries("^SKEW")],
    ["putCall", () => fetchYahooQuoteSeries("^PCC")],
    ["move", () => fetchYahooQuoteSeries("^MOVE")],
    ["fearGreed", async () => {
      const cnn = await fetchCnnFearGreed()
      if (cnn.value != null) return cnn
      return fetchAlternativeMeFearGreed()
    }],
    ["highYield", () => fetchFredHighYieldOas()],
  ]

  const settled = await Promise.all(
    tasks.map(async ([key, fn]) => {
      const r = await fn()
      return { key, ...r }
    }),
  )

  const payload = {
    updatedAt: new Date().toISOString(),
  }

  for (const { key, value, delta, error } of settled) {
    if (error) errors[key] = error
    if (value != null) {
      payload[key] = value
      if (delta != null) changes[key] = delta
    } else if (preserve[key] != null) {
      payload[key] = preserve[key]
    }
  }

  const bofaEnv = toNum(process.env.BOFA_BULL_BEAR ?? process.env.BOFA_MANUAL)
  payload.bofa = preserve.bofa ?? bofaEnv ?? null
  if (payload.bofa == null) errors.bofa = errors.bofa || "manual_or_db_required"

  const gsEnv = toNum(process.env.GS_BULL_BEAR ?? process.env.GS_SENTIMENT_MANUAL)
  payload.gsBullBear = preserve.gsBullBear ?? gsEnv ?? null

  if (Object.keys(changes).length) payload.changes = changes

  const fetchedCount = ["vix", "fearGreed", "putCall", "move", "highYield"].filter(
    (k) => payload[k] != null,
  ).length

  return {
    payload,
    errors,
    fetchedCount,
    partial: fetchedCount < 5,
  }
}
