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

const FRED_SERIES = [
  { key: "dgs2", series: "DGS2" },
  { key: "dgs30", series: "DGS30" },
  { key: "dfii10", series: "DFII10" },
  { key: "t10yie", series: "T10YIE" },
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

async function fetchFredSeries(series) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`
  const res = await fetch(url, { method: "GET", cache: "no-store" })
  if (!res.ok) throw new Error(`FRED HTTP ${res.status} (${series})`)
  const text = await res.text()
  const lines = String(text || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)

  /** @type {number[]} */
  const values = []
  for (const line of lines) {
    const idx = line.lastIndexOf(",")
    if (idx < 0) continue
    const raw = line.slice(idx + 1).trim()
    if (raw === "." || raw === "") continue
    const n = Number(raw)
    if (Number.isFinite(n)) values.push(n)
  }
  if (values.length < 1) throw new Error(`FRED parse failed (${series})`)
  const current = values[values.length - 1]
  const prev = values.length >= 2 ? values[values.length - 2] : null
  const changePct = Number.isFinite(prev) && prev !== 0 ? ((current - prev) / prev) * 100 : null
  return { price: current, changePct }
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
    dgs2: null,
    dgs30: null,
    dfii10: null,
    t10yie: null,
    // Macro layer alias keys (기존 클라이언트 재사용)
    us2y: null,
    us30y: null,
    realYield: null,
    bei: null,
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

  const fredSettled = await Promise.allSettled(
    FRED_SERIES.map(async ({ key, series }) => ({ key, series, quote: await fetchFredSeries(series) })),
  )

  fredSettled.forEach((entry) => {
    if (entry.status !== "fulfilled") return
    const { key, quote } = entry.value
    parsedData[key] = quote.price
    changeData[key] = quote.changePct
  })

  // Alias mapping for macro-risk clientHistory fallback keys.
  parsedData.us2y = parsedData.us2y ?? parsedData.dgs2
  parsedData.us30y = parsedData.us30y ?? parsedData.dgs30
  parsedData.realYield = parsedData.realYield ?? parsedData.dfii10
  parsedData.bei = parsedData.bei ?? parsedData.t10yie
  changeData.us2y = changeData.us2y ?? changeData.dgs2
  changeData.us30y = changeData.us30y ?? changeData.dgs30
  changeData.realYield = changeData.realYield ?? changeData.dfii10
  changeData.bei = changeData.bei ?? changeData.t10yie

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
