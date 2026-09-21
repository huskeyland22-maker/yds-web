/**
 * GET /api/daily-bottom-buy
 * Live snapshots for YDS Daily Bottom Buy V1 (10 ETFs).
 * Does not touch Panic Index.
 */
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_THRESHOLDS,
  SPLIT_BUY_GUIDE,
  evaluateBars,
  buildEtfCard,
  sortCardsByOpportunity,
} from "./_lib/dailyBottomBuyEngine.js"

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
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
  const ts = result?.timestamp ?? []
  const q = result?.indicators?.quote?.[0] ?? {}
  const { open, high, low, close, volume } = q
  const bars = []
  for (let i = 0; i < ts.length; i++) {
    const c = close?.[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    const o = Number.isFinite(open?.[i]) ? open[i] : c
    const h = Number.isFinite(high?.[i]) ? high[i] : Math.max(o, c)
    const l = Number.isFinite(low?.[i]) ? low[i] : Math.min(o, c)
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: o,
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: Number.isFinite(volume?.[i]) ? volume[i] : 0,
    })
  }
  return bars
}

export default async function handler(req, res) {
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
      all: cards,
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || "daily_bottom_buy_failed",
    })
  }
}
