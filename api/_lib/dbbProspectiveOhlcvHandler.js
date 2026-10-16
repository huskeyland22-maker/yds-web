/**
 * Read-only OHLCV fetch for DBB prospective tracking v12.
 * Does not change DBB thresholds, evaluateBars, or trade records.
 */
import { barsFromYahooChartResult } from "./dailyBottomBuyHandler.js"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function queryParam(req, name) {
  const raw = req?.query?.[name]
  if (Array.isArray(raw)) return String(raw[0] || "")
  return raw == null ? "" : String(raw)
}

async function fetchYahooOhlcv(symbol) {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 500 * 86400
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, { headers: YAHOO_HEADERS, cache: "no-store" })
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo ${symbol} empty_chart`)
  return barsFromYahooChartResult(result, period2)
}

/**
 * GET ?symbol=QQQ (and optional second call for QQQ regime/excess).
 */
export async function handleDbbProspectiveOhlcv(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  res.setHeader("Access-Control-Allow-Origin", "*")
  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed", system: "dbb_prospective_ohlcv_v12" })
    return
  }
  const symbol = queryParam(req, "symbol").trim().toUpperCase()
  if (!symbol || !/^[A-Z.]{1,12}$/.test(symbol)) {
    res.status(400).json({ ok: false, error: "invalid_symbol", system: "dbb_prospective_ohlcv_v12" })
    return
  }
  try {
    const bars = await fetchYahooOhlcv(symbol)
    res.status(200).json({
      ok: true,
      system: "dbb_prospective_ohlcv_v12",
      researchOnly: true,
      symbol,
      bars,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: err?.message || "ohlcv_fetch_failed",
      system: "dbb_prospective_ohlcv_v12",
      symbol,
    })
  }
}
