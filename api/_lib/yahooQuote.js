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
/**
 * @param {string} symbol
 * @param {number} [maDays]
 * @returns {Promise<{ value: number | null; delta: number | null; error?: string }>}
 */
export async function fetchYahooMaDistancePercent(symbol, maDays = 20) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`
    const res = await fetch(url, { method: "GET", cache: "no-store" })
    if (!res.ok) return { value: null, delta: null, error: `yahoo_http_${res.status}` }
    const raw = await res.json()
    const result = raw?.chart?.result?.[0]
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((v) => Number.isFinite(v))
    if (closes.length < maDays) return { value: null, delta: null, error: "yahoo_ma_short" }
    const slice = closes.slice(-maDays)
    const ma = slice.reduce((a, b) => a + b, 0) / slice.length
    const price = closes[closes.length - 1]
    if (!Number.isFinite(price) || !Number.isFinite(ma) || ma === 0) {
      return { value: null, delta: null, error: "yahoo_ma_parse" }
    }
    const dist = ((price - ma) / ma) * 100
    const prevSlice = closes.length > maDays + 1 ? closes.slice(-(maDays + 1), -1) : null
    let delta = null
    if (prevSlice && prevSlice.length >= maDays) {
      const prevMa = prevSlice.slice(-maDays).reduce((a, b) => a + b, 0) / maDays
      const prevPrice = closes[closes.length - 2]
      if (Number.isFinite(prevMa) && prevMa !== 0 && Number.isFinite(prevPrice)) {
        const prevDist = ((prevPrice - prevMa) / prevMa) * 100
        delta = dist - prevDist
      }
    }
    return { value: dist, delta }
  } catch (e) {
    return { value: null, delta: null, error: e instanceof Error ? e.message : "yahoo_ma_fetch" }
  }
}

/** VIX term — (front/back - 1) * 100. 양수 = 백워데이션 */
export async function fetchVixTermStructurePercent() {
  const front = await fetchYahooQuoteSeries("^VIX")
  const back = await fetchYahooQuoteSeries("^VIX3M")
  if (front.value == null || back.value == null || back.value === 0) {
    return { value: null, delta: null, error: "vix_term_missing" }
  }
  const value = ((front.value / back.value) - 1) * 100
  return { value, delta: front.delta }
}

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
