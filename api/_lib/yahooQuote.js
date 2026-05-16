/** Yahoo Finance chart API — VIX, Put/Call, MOVE 등 */

function toFiniteNumber(value) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function pickPreviousClose(meta = {}, closes = []) {
  const reversed = Array.isArray(closes) ? [...closes].reverse() : []
  const validClose = reversed.find((v) => Number.isFinite(v))
  return (
    toFiniteNumber(meta.previousClose) ??
    toFiniteNumber(meta.chartPreviousClose) ??
    toFiniteNumber(meta.regularMarketPreviousClose) ??
    toFiniteNumber(meta.previousClosePrice) ??
    toFiniteNumber(validClose)
  )
}

/**
 * @param {string} symbol e.g. ^VIX
 * @returns {Promise<{ value: number | null, delta: number | null, error?: string }>}
 */
export async function fetchYahooQuoteSeries(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`
    const res = await fetch(url, { method: "GET", cache: "no-store" })
    if (!res.ok) return { value: null, delta: null, error: `yahoo_http_${res.status}` }
    const raw = await res.json()
    const result = raw?.chart?.result?.[0]
    const meta = result?.meta ?? {}
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((v) => Number.isFinite(v))
    const price = toFiniteNumber(meta.regularMarketPrice) ?? toFiniteNumber(meta.previousClose)
    const prevClose = pickPreviousClose(meta, closes)
    if (!Number.isFinite(price)) return { value: null, delta: null, error: "yahoo_parse" }
    const delta =
      Number.isFinite(prevClose) && prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : null
    return { value: price, delta }
  } catch (e) {
    return { value: null, delta: null, error: e instanceof Error ? e.message : "yahoo_fetch" }
  }
}
