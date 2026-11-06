import {
  fetchVixTermStructurePercent,
  fetchYahooMaDistancePercent,
  fetchYahooQuoteSeries,
} from "./yahooQuote.js"

import {
  fetchFredHighYieldOas as fetchFredHighYieldOasFromCredit,
} from "./creditSpreads.js"

const CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"

/** @deprecated use creditSpreads.fetchFredHighYieldOas — kept for callers */
export async function fetchFredHighYieldOas() {
  return fetchFredHighYieldOasFromCredit()
}

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

/**
 * Live 수집 — HY/BBB는 creditSpreads 주 2회 경로로 분리 (여기 포함하지 않음).
 * @param {{ preserve?: Record<string, number | null> }} [opts]
 */
export async function collectPanicMetricsLive(opts = {}) {
  const preserve = opts.preserve && typeof opts.preserve === "object" ? opts.preserve : {}
  const changes = {}
  const errors = {}

  const tasks = [
    ["vix", () => fetchYahooQuoteSeries("^VIX")],
    ["vvix", () => fetchYahooQuoteSeries("^VVIX")],
    ["vixTerm", () => fetchVixTermStructurePercent()],
    ["ndxDistance", () => fetchYahooMaDistancePercent("^NDX")],
    ["soxxDistance", () => fetchYahooMaDistancePercent("SOXX")],
    ["dxy", () => fetchYahooQuoteSeries("DX-Y.NYB")],
    ["vxn", () => fetchYahooQuoteSeries("^VXN")],
    ["skew", () => fetchYahooQuoteSeries("^SKEW")],
    ["putCall", () => fetchYahooQuoteSeries("^PCC")],
    ["move", () => fetchYahooQuoteSeries("^MOVE")],
    ["fearGreed", async () => {
      const cnn = await fetchCnnFearGreed()
      if (cnn.value != null) return cnn
      return fetchAlternativeMeFearGreed()
    }],
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

  if (Object.keys(changes).length) payload.changes = changes

  const fetchedCount = ["vix", "fearGreed", "putCall", "move"].filter((k) => payload[k] != null).length

  return {
    payload,
    errors,
    fetchedCount,
    partial: fetchedCount < 4,
  }
}
