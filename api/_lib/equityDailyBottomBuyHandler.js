/**
 * Read-only equity Daily Bottom Buy HTTP handler.
 * Hosted by market-data via ydsMode so the serverless entry count stays put.
 * Does not read or write trade records or the ETF snapshot.
 * Membership only affects response redaction — engine evaluation stays full.
 */
import fs from "node:fs"
import path from "node:path"
import { barsFromYahooChartResult } from "./dailyBottomBuyHandler.js"
import {
  redactEquityDailyBottomBuyPayload,
} from "./equityDailyBottomBuyRedact.js"
import { requireProMembership } from "./requireProMembership.js"

function loadEquityEngine() {
  return import("../../scripts/lib/equity-daily-bottom-buy.mjs")
}

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

const CACHE_DIR =
  [
    path.resolve(process.cwd(), "scripts/.cache/eq-ohlcv"),
    path.resolve(process.cwd(), "../scripts/.cache/eq-ohlcv"),
  ].find((dir) => fs.existsSync(dir)) || path.resolve(process.cwd(), "scripts/.cache/eq-ohlcv")

function readQuery(req) {
  if (req?.query && typeof req.query === "object") {
    const symbol = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol
    if (symbol != null || req.query.symbol === "") return { symbol: symbol == null ? "" : String(symbol) }
  }
  try {
    const url = new URL(req?.url || "/", "http://localhost")
    return { symbol: url.searchParams.get("symbol") || "" }
  } catch {
    return { symbol: "" }
  }
}

async function fetchYahooBars(yahoo) {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 400 * 86400
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, { headers: YAHOO_HEADERS, cache: "no-store" })
  if (!res.ok) throw new Error(`Yahoo ${yahoo} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo ${yahoo} empty_chart`)
  return barsFromYahooChartResult(result, period2)
}

function readCachedBars(yahoo) {
  const file = path.join(CACHE_DIR, `${String(yahoo).replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"))
    return Array.isArray(raw.bars) ? raw.bars : null
  } catch {
    return null
  }
}

/**
 * @param {string} symbol
 * @param {{ fetchBars?: (yahoo: string) => Promise<any[]>, readCache?: (yahoo: string) => any[] | null }} [deps]
 */
export async function loadEquityDailyBottomBuy(symbol, deps = {}) {
  const {
    DATA_MISSING,
    EQUITY_DAILY_BOTTOM_BUY_ID,
    buildEquityDailyBottomBuyView,
    equityUniverse,
    findEquityCandidate,
    findEquityResearchMember,
  } = await loadEquityEngine()
  const universe = equityUniverse()
  const meta = findEquityCandidate(symbol) || findEquityResearchMember(symbol)
  if (!meta) {
    return {
      status: 200,
      body: {
        ok: true,
        system: EQUITY_DAILY_BOTTOM_BUY_ID,
        universe,
        view: buildEquityDailyBottomBuyView(null, null),
      },
    }
  }
  const fetchBars = deps.fetchBars || fetchYahooBars
  const readCache = deps.readCache || readCachedBars
  let bars = null
  let source = null
  try {
    bars = await fetchBars(meta.yahoo)
    source = "yahoo"
  } catch {
    bars = readCache(meta.yahoo)
    source = bars ? "cache" : null
  }
  const view = buildEquityDailyBottomBuyView(meta, bars, { source })
  if (!view.ok && !bars) view.message = DATA_MISSING
  return {
    status: 200,
    body: {
      ok: true,
      system: EQUITY_DAILY_BOTTOM_BUY_ID,
      universe,
      view,
    },
  }
}

/**
 * @param {import('http').IncomingMessage & { method?: string, query?: Record<string, string | string[]>, headers?: Record<string, string> }} req
 * @param {import('http').ServerResponse & { setHeader: Function, status: Function, json: Function, end: Function }} res
 * @param {{
 *   requireProMembership?: typeof requireProMembership
 *   load?: typeof loadEquityDailyBottomBuy
 * }} [deps]
 */
export async function handleEquityDailyBottomBuy(req, res, deps = {}) {
  const { DATA_MISSING, EQUITY_DAILY_BOTTOM_BUY_ID } = await loadEquityEngine()
  res.setHeader("Cache-Control", "no-store, max-age=0")
  res.setHeader("Access-Control-Allow-Origin", "*")
  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed", system: EQUITY_DAILY_BOTTOM_BUY_ID })
    return
  }

  const requirePro = deps.requireProMembership ?? requireProMembership
  const load = deps.load ?? loadEquityDailyBottomBuy

  try {
    const { symbol } = readQuery(req)
    // Always evaluate full view first; membership only affects response redaction.
    const result = await load(symbol)
    const fullPayload = result.body

    const gate = await requirePro(req)
    if (gate.ok) {
      res.status(result.status).json({
        ...fullPayload,
        access: "full",
        audience: gate.audience === "operator" ? "operator" : "pro",
      })
      return
    }

    // FREE / logged-out / membership errors → summary only (never leak details).
    res.status(result.status).json(redactEquityDailyBottomBuyPayload(fullPayload))
  } catch {
    res.status(200).json(
      redactEquityDailyBottomBuyPayload({
        ok: false,
        system: EQUITY_DAILY_BOTTOM_BUY_ID,
        message: DATA_MISSING,
        view: null,
      }),
    )
  }
}
