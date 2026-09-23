/**
 * Daily Bottom Buy V1 HTTP handler (hosted by market-data via ydsMode dispatch).
 * Does not touch Panic Index.
 */
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_THRESHOLDS,
  SPLIT_BUY_GUIDE,
  evaluateBars,
  buildEtfCard,
  sortCardsByOpportunity,
} from "./dailyBottomBuyEngine.js"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

const NY_TZ = "America/New_York"

/**
 * US equity session trading day (YYYY-MM-DD) in America/New_York.
 * @param {number} unixSec
 * @returns {string | null}
 */
export function tradingDayKeyAmericaNy(unixSec) {
  const n = Number(unixSec)
  if (!Number.isFinite(n) || n <= 0) return null
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: NY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(n * 1000))
  } catch {
    return null
  }
}

/**
 * Bar date label — keep prior DBB convention (UTC calendar day of bar unix).
 * US cash daily opens (13:30/14:30 UTC) still map to the NY trading calendar day.
 * @param {number} unixSec
 * @returns {string | null}
 */
export function barDateKeyFromUnix(unixSec) {
  const n = Number(unixSec)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n * 1000).toISOString().slice(0, 10)
}

/**
 * Fill Yahoo's trailing null-close daily bar only when the quote is a
 * completed regular-session print for that same US trading day.
 *
 * @param {{
 *   barUnix: number
 *   meta?: {
 *     regularMarketPrice?: number
 *     regularMarketTime?: number
 *     currentTradingPeriod?: { regular?: { start?: number, end?: number } }
 *   } | null
 *   nowUnix?: number
 * }} args
 * @returns {boolean}
 */
export function shouldBackfillNullCloseFromQuote({ barUnix, meta, nowUnix } = {}) {
  const price = Number(meta?.regularMarketPrice)
  const rmt = Number(meta?.regularMarketTime)
  const barTs = Number(barUnix)
  const now = Number.isFinite(Number(nowUnix)) ? Number(nowUnix) : Math.floor(Date.now() / 1000)

  if (!Number.isFinite(price) || price <= 0) return false
  if (!Number.isFinite(rmt) || rmt <= 0) return false
  if (!Number.isFinite(barTs) || barTs <= 0) return false

  const barDay = tradingDayKeyAmericaNy(barTs)
  const quoteDay = tradingDayKeyAmericaNy(rmt)
  if (!barDay || !quoteDay || barDay !== quoteDay) return false

  const todayNy = tradingDayKeyAmericaNy(now)
  if (!todayNy) return false

  // Quote belongs to a prior NY session that has already rolled past → completed.
  if (quoteDay < todayNy) return true

  // Same NY calendar day as "now": only backfill after regular session end.
  const regular = meta?.currentTradingPeriod?.regular
  const regularStart = Number(regular?.start)
  const regularEnd = Number(regular?.end)
  if (!Number.isFinite(regularStart) || !Number.isFinite(regularEnd)) return false

  const periodDay = tradingDayKeyAmericaNy(regularStart)
  if (!periodDay || periodDay !== barDay) return false

  return rmt >= regularEnd
}

/**
 * @param {object | null | undefined} chartResult Yahoo chart.result[0]
 * @param {number} [nowUnix]
 * @returns {{ date: string, open: number, high: number, low: number, close: number, volume: number }[]}
 */
export function barsFromYahooChartResult(chartResult, nowUnix = Math.floor(Date.now() / 1000)) {
  const ts = chartResult?.timestamp ?? []
  const q = chartResult?.indicators?.quote?.[0] ?? {}
  const meta = chartResult?.meta ?? {}
  const { open, high, low, close, volume } = q

  /** @type {{ date: string, open: number, high: number, low: number, close: number, volume: number }[]} */
  const bars = []
  let lastRawIdx = -1

  for (let i = 0; i < ts.length; i++) {
    lastRawIdx = i
    const c = close?.[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    const o = Number.isFinite(open?.[i]) ? open[i] : c
    const h = Number.isFinite(high?.[i]) ? high[i] : Math.max(o, c)
    const l = Number.isFinite(low?.[i]) ? low[i] : Math.min(o, c)
    const date = barDateKeyFromUnix(ts[i])
    if (!date) continue
    bars.push({
      date,
      open: o,
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: Number.isFinite(volume?.[i]) ? volume[i] : 0,
    })
  }

  if (lastRawIdx < 0) return bars

  const lastClose = close?.[lastRawIdx]
  const lastTs = Number(ts[lastRawIdx])
  const lastDate = barDateKeyFromUnix(lastTs)
  const alreadyHaveLast =
    lastDate != null && bars.length > 0 && bars[bars.length - 1].date === lastDate

  if (
    !alreadyHaveLast &&
    (lastClose == null || !Number.isFinite(lastClose) || lastClose <= 0) &&
    shouldBackfillNullCloseFromQuote({ barUnix: lastTs, meta, nowUnix })
  ) {
    const price = Number(meta.regularMarketPrice)
    const o = Number.isFinite(open?.[lastRawIdx]) ? open[lastRawIdx] : price
    const h = Number.isFinite(high?.[lastRawIdx]) ? high[lastRawIdx] : Math.max(o, price)
    const l = Number.isFinite(low?.[lastRawIdx]) ? low[lastRawIdx] : Math.min(o, price)
    if (!lastDate) return bars
    bars.push({
      date: lastDate,
      open: o,
      high: Math.max(h, o, price),
      low: Math.min(l, o, price),
      close: price,
      volume: Number.isFinite(volume?.[lastRawIdx]) ? volume[lastRawIdx] : 0,
    })
  }

  return bars
}

/**
 * @param {string} symbol
 */
async function fetchYahooOhlcv(symbol) {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 400 * 86400
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
 * @param {import('http').IncomingMessage & { method?: string, query?: Record<string, string | string[]> }} req
 * @param {import('http').ServerResponse & { setHeader: Function, status: Function, json: Function, end: Function }} res
 */
export async function handleDailyBottomBuy(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  res.setHeader("Access-Control-Allow-Origin", "*")
  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" })
    return
  }

  try {
    const settled = await Promise.all(
      DAILY_BOTTOM_BUY_ETFS.map(async (meta) => {
        try {
          const bars = await fetchYahooOhlcv(meta.symbol)
          const evaluation = evaluateBars(bars, DAILY_BOTTOM_THRESHOLDS)
          return buildEtfCard(meta, evaluation)
        } catch (err) {
          return buildEtfCard(meta, {
            ok: false,
            error: err?.message || "fetch_failed",
          })
        }
      }),
    )

    const cards = sortCardsByOpportunity(settled)
    const opportunities = cards.filter((c) => c.ok && c.count >= 3)
    const watch = cards.filter((c) => c.ok && c.count === 2)
    const waiting = cards.filter((c) => !c.ok || c.count <= 1)

    res.status(200).json({
      ok: true,
      system: "daily_bottom_buy_v1",
      separateFromPanic: true,
      updatedAt: new Date().toISOString(),
      thresholds: DAILY_BOTTOM_THRESHOLDS,
      splitBuy: SPLIT_BUY_GUIDE,
      disclaimer: [
        "일상적인 조정 구간에서 분할매수를 검토하기 위한 보조 신호입니다.",
        "3개 충족 = 1차 매수 후보",
        "4개 충족 = 추가 매수 후보",
        "신호 발생 후에도 추가 하락할 수 있습니다.",
        "대형 시장 패닉은 Panic Index를 참고합니다.",
      ],
      counts: {
        opportunity: opportunities.length,
        watch: watch.length,
        wait: waiting.length,
      },
      opportunities,
      watch,
      waiting,
      all: settled,
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || "daily_bottom_buy_failed",
    })
  }
}
