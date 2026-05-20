const YAHOO_SERIES = [
  { key: "US10Y", symbol: "^TNX" },
  { key: "US2Y", symbol: "2YY=F" },
  { key: "DXY", symbol: "DX-Y.NYB" },
  { key: "MOVE", symbol: "^MOVE" },
]

function toFinite(value) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string} symbol
 * @param {string} [range]
 */
export async function fetchYahooDailyCloses(symbol, range = "3mo") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetch(url, { method: "GET", cache: "no-store" })
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} (${symbol})`)
  const raw = await res.json()
  const closes = raw?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
  return closes.map(toFinite).filter((v) => v != null)
}

/**
 * @returns {Promise<Record<string, number[]>>}
 */
export async function fetchMacroRiskHistory() {
  /** @type {Record<string, number[]>} */
  const history = {}

  const settled = await Promise.allSettled(
    YAHOO_SERIES.map(async ({ key, symbol }) => {
      const closes = await fetchYahooDailyCloses(symbol)
      return { key, closes }
    }),
  )

  settled.forEach((entry) => {
    if (entry.status !== "fulfilled") return
    const { key, closes } = entry.value
    if (closes.length >= 5) history[key] = closes
  })

  return history
}
