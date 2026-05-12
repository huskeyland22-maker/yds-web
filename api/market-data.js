const SYMBOLS = [
  { key: "kospi", symbol: "^KS11" },
  { key: "kosdaq", symbol: "^KQ11" },
  { key: "nasdaq", symbol: "^IXIC" },
  { key: "sp500", symbol: "^GSPC" },
  { key: "usdkrw", symbol: "KRW=X" },
  { key: "us10y", symbol: "^TNX" },
  { key: "vix", symbol: "^VIX" },
  { key: "dxy", symbol: "DX-Y.NYB" },
  { key: "soxx", symbol: "SOXX" },
  { key: "putCall", symbol: "^PCC" },
  { key: "move", symbol: "^MOVE" },
]

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
    toFiniteNumber(meta.previousClosePrice) ??
    toFiniteNumber(validClose)
  )
}

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const res = await fetch(url, { method: "GET", cache: "no-store" })
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} (${symbol})`)
  const raw = await res.json()
  const result = raw?.chart?.result?.[0]
  const meta = result?.meta ?? {}
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const price = toFiniteNumber(meta.regularMarketPrice) ?? toFiniteNumber(meta.previousClose)
  const prevClose = pickPreviousClose(meta, closes)
  if (!Number.isFinite(price) || !Number.isFinite(prevClose) || prevClose === 0) {
    throw new Error(`Yahoo parse failed (${symbol})`)
  }
  const changePct = ((price - prevClose) / prevClose) * 100
  return { price, changePct }
}

export default async function handler(_req, res) {
  const parsedData = {
    kospi: null,
    kosdaq: null,
    nasdaq: null,
    sp500: null,
    usdkrw: null,
    us10y: null,
    vix: null,
    dxy: null,
    soxx: null,
    putCall: null,
    move: null,
  }
  const changeData = { ...parsedData }

  const settled = await Promise.allSettled(
    SYMBOLS.map(async ({ key, symbol }) => ({ key, quote: await fetchYahooQuote(symbol) })),
  )

  settled.forEach((entry) => {
    if (entry.status !== "fulfilled") return
    const { key, quote } = entry.value
    parsedData[key] = quote.price
    changeData[key] = quote.changePct
  })

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
  res.status(200).json({
    parsedData,
    changeData,
    updatedAt: new Date().toISOString(),
    source: "vercel-yahoo",
  })
}
