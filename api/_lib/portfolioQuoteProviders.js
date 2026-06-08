/**
 * Phase 6-1 — Portfolio Quote Providers (서버)
 * Mock → Yahoo → Naver 순 폴백
 */

import { fetchYahooQuoteSeries } from "./yahooQuote.js"
import { fetchKisCurrentPrice, getKisEnvStatus, normalizeDomesticStockCode } from "./kisClient.js"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

/** @typedef {'live' | 'delayed' | 'error'} QuoteStatusId */
/** @typedef {'USD' | 'KRW'} QuoteCurrency */

/**
 * @typedef {{
 *   ticker: string
 *   country: 'us' | 'kr'
 *   price: number | null
 *   change: number | null
 *   currency: QuoteCurrency
 *   updatedAt: string | null
 *   status: QuoteStatusId
 *   source: string
 *   error?: string
 * }} PortfolioQuoteResult
 */

function num(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * @param {'us' | 'kr'} country
 * @param {string} ticker
 */
export function portfolioQuoteKey(country, ticker) {
  return `${country}:${String(ticker ?? "").trim()}`
}

/** @param {string} raw */
function parseKrCode(raw) {
  return normalizeDomesticStockCode(raw)
}

/**
 * @param {string} ticker
 * @param {number} [basePrice]
 * @returns {PortfolioQuoteResult | null}
 */
function mockProviderQuote(ticker, basePrice = 100) {
  if (process.env.PORTFOLIO_QUOTE_MOCK !== "1") return null
  const price = num(basePrice) ?? 100
  return {
    ticker: String(ticker),
    country: "us",
    price,
    change: 0,
    currency: "USD",
    updatedAt: nowIso(),
    status: "delayed",
    source: "mock",
  }
}

/**
 * @param {string} symbol
 * @returns {Promise<PortfolioQuoteResult | null>}
 */
async function yahooChartQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  const res = await fetch(url, { method: "GET", headers: YAHOO_HEADERS, cache: "no-store" })
  if (!res.ok) return null

  const raw = await res.json()
  const result = raw?.chart?.result?.[0]
  const meta = result?.meta ?? {}
  const price = num(meta.regularMarketPrice) ?? num(meta.previousClose)
  if (price == null) return null

  const series = await fetchYahooQuoteSeries(symbol)
  const change = series.delta
  const marketState = String(meta.marketState ?? meta.currentTradingPeriod?.state ?? "").toUpperCase()
  const status = marketState === "REGULAR" ? "live" : "delayed"
  const updatedAt =
    meta.regularMarketTime != null
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : nowIso()

  const currency = String(meta.currency ?? "USD").toUpperCase() === "KRW" ? "KRW" : "USD"

  return {
    ticker: String(symbol),
    country: currency === "KRW" ? "kr" : "us",
    price,
    change: change ?? null,
    currency,
    updatedAt,
    status,
    source: "yahoo",
  }
}

/**
 * @param {string} ticker
 * @returns {Promise<PortfolioQuoteResult | null>}
 */
export async function yahooProviderGetQuote(ticker) {
  const sym = String(ticker ?? "").trim().toUpperCase()
  if (!sym) return null
  const q = await yahooChartQuote(sym)
  if (!q) return null
  return { ...q, ticker: sym, country: "us", currency: "USD" }
}

/**
 * @param {string} ticker
 * @returns {Promise<PortfolioQuoteResult | null>}
 */
export async function yahooKrProviderGetQuote(ticker) {
  const code = parseKrCode(ticker)
  if (!code) return null
  for (const suffix of [".KS", ".KQ"]) {
    const q = await yahooChartQuote(`${code}${suffix}`)
    if (q?.price != null) {
      return {
        ...q,
        ticker: code,
        country: "kr",
        currency: "KRW",
      }
    }
  }
  return null
}

/**
 * @param {string} ticker
 * @returns {Promise<PortfolioQuoteResult | null>}
 */
export async function naverProviderGetQuote(ticker) {
  const code = parseKrCode(ticker)
  if (!code) return null

  const url = `https://m.stock.naver.com/api/stock/${code}/basic`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...YAHOO_HEADERS,
      Referer: `https://m.stock.naver.com/domestic/stock/${code}/total`,
    },
    cache: "no-store",
  })
  if (!res.ok) return null

  const data = await res.json()
  const price = num(data?.closePrice)
  if (price == null) return null

  const change = num(data?.fluctuationsRatio)
  const marketStatus = String(data?.marketStatus ?? "").toUpperCase()
  const status = marketStatus === "OPEN" ? "live" : "delayed"
  const updatedAt = data?.localTradedAt ? String(data.localTradedAt) : nowIso()

  return {
    ticker: code,
    country: "kr",
    price,
    change,
    currency: "KRW",
    updatedAt,
    status,
    source: "naver",
  }
}

/**
 * @param {string} ticker
 * @returns {Promise<PortfolioQuoteResult | null>}
 */
async function kisProviderGetQuote(ticker) {
  const code = parseKrCode(ticker)
  if (!code) return null
  const env = getKisEnvStatus()
  if (!env.configured) return null

  try {
    const row = await fetchKisCurrentPrice(code)
    const price = num(row?.price)
    if (price == null) return null
    const change = num(row?.changePct)
    return {
      ticker: code,
      country: "kr",
      price,
      change,
      currency: "KRW",
      updatedAt: nowIso(),
      status: "live",
      source: "kis",
    }
  } catch {
    return null
  }
}

/**
 * @param {'us' | 'kr'} country
 * @param {string} ticker
 * @returns {Promise<PortfolioQuoteResult>}
 */
export async function resolvePortfolioQuote(country, ticker) {
  const normalizedCountry = country === "kr" ? "kr" : "us"
  const sym = String(ticker ?? "").trim()
  const errorBase = {
    ticker: sym,
    country: normalizedCountry,
    price: null,
    change: null,
    currency: normalizedCountry === "kr" ? "KRW" : "USD",
    updatedAt: null,
    status: /** @type {QuoteStatusId} */ ("error"),
    source: "none",
  }

  if (!sym) return { ...errorBase, error: "missing_ticker" }

  const mock = mockProviderQuote(sym)
  if (mock) {
    return {
      ...mock,
      ticker: sym,
      country: normalizedCountry,
      currency: normalizedCountry === "kr" ? "KRW" : "USD",
    }
  }

  if (normalizedCountry === "us") {
    const yahoo = await yahooProviderGetQuote(sym)
    if (yahoo?.price != null) return yahoo
    return { ...errorBase, error: "us_quote_failed" }
  }

  const yahooKr = await yahooKrProviderGetQuote(sym)
  if (yahooKr?.price != null) return yahooKr

  const kis = await kisProviderGetQuote(sym)
  if (kis?.price != null) return kis

  const naver = await naverProviderGetQuote(sym)
  if (naver?.price != null) return naver

  return { ...errorBase, error: "kr_quote_failed" }
}

/** @returns {Promise<number | null>} */
export async function fetchUsdKrwRate() {
  const q = await yahooChartQuote("KRW=X")
  return q?.price ?? null
}
