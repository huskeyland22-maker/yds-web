/**
 * 종목추천 유니버스 실시간 스냅샷 일괄 조회
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import {
  fetchKrStockIndicatorsBatch,
  fetchStockIndicators,
  fetchUsStockIndicatorsBatch,
} from "../utils/stockIndicatorsApi.js"
import {
  apiBodyToEngineSnapshot,
  auditStockPickSnapshot,
  extractSnapshotExtras,
} from "./ydsStockPickLiveSnapshot.js"
import {
  apiBodyToPickQuote,
  fetchStockPickQuotesBatch,
  mergePickQuote,
} from "./ydsStockPickQuoteService.js"
import { buildStockPickViews, assignRanks } from "./ydsStockPickModel.js"
import { runStockPickFetchOnce } from "./ydsStockPickFetchSession.js"
import { recordStockPickFetchSegments } from "./ydsStockPickPerf.js"

/**
 * @typedef {{
 *   engineSnapshot: import("./ydsStockScoreEngine.js").StockPriceSnapshot
 *   extras: ReturnType<typeof extractSnapshotExtras>
 *   apiBody: object
 *   quote: import("./ydsStockPickQuoteService.js").StockPickQuoteView | null
 *   fetchedAt: string
 * }} LivePickSnapshotEntry
 */

/**
 * @param {Map<string, LivePickSnapshotEntry>} map
 * @param {{ ticker: string; name: string; country: 'US' | 'KR' }} row
 * @param {object} apiBody
 * @param {{ ticker: string; error: string }[]} errors
 */
function ingestLiveSnapshot(map, row, apiBody, errors) {
  const engineSnapshot = apiBodyToEngineSnapshot(apiBody)
  const extras = extractSnapshotExtras(apiBody)
  const ok = auditStockPickSnapshot(row.ticker, engineSnapshot, {
    dataSource: apiBody.dataSource,
  })

  if (!engineSnapshot) {
    errors.push({ ticker: row.ticker, error: "snapshot incomplete" })
    return
  }

  if (!ok) {
    console.warn("[stock-pick-live] partial snapshot", { ticker: row.ticker })
  }

  map.set(row.ticker, {
    engineSnapshot,
    extras,
    apiBody,
    quote: mergePickQuote(null, apiBody, row.country),
    fetchedAt: apiBody.updatedAt ?? new Date().toISOString(),
  })
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {AbortSignal} [signal]
 * @param {{ callsite?: string; force?: boolean }} [opts]
 */
export async function fetchStockPickLiveSnapshots(marketContext = null, signal, opts = {}) {
  const callsite = opts.callsite ?? "fetchStockPickLiveSnapshots"
  console.log("[stock-pick-fetch]", callsite, { force: Boolean(opts.force) })

  return runStockPickFetchOnce(
    () => runStockPickLiveSnapshots(marketContext, signal, callsite),
    { callsite, force: opts.force },
  )
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {AbortSignal} [signal]
 * @param {string} callsite
 */
async function runStockPickLiveSnapshots(marketContext = null, signal, callsite = "unknown") {
  /** @type {Map<string, LivePickSnapshotEntry>} */
  const map = new Map()
  /** @type {{ ticker: string; error: string }[]} */
  const errors = []

  const krRows = universe.stocks.filter((s) => s.country === "KR")
  const usRows = universe.stocks.filter((s) => s.country === "US")
  const panicIndex = marketContext?.panicIndex ?? undefined

  const perf = {
    usFetchCount: usRows.length,
    usHttpCallCount: usRows.length ? 1 : 0,
    usParallelCount: 0,
    usBatchDurationMs: 0,
    krFetchCount: krRows.length,
    krHttpCallCount: krRows.length ? 1 : 0,
    krParallelCount: 0,
    krBatchDurationMs: 0,
    portfolioDurationMs: 0,
  }

  const krPromise = (async () => {
    if (!krRows.length || signal?.aborted) return { batch: null, error: null }
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
    try {
      const batch = await fetchKrStockIndicatorsBatch({
        codes: krRows.map((r) => r.ticker),
        panicIndex,
        signal,
      })
      perf.krBatchDurationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
      )
      perf.krParallelCount = batch.batchMeta?.parallelConcurrency ?? 1
      return { batch, error: null }
    } catch (e) {
      perf.krBatchDurationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
      )
      return { batch: null, error: e }
    }
  })()

  const usPromise = (async () => {
    if (!usRows.length || signal?.aborted) return { batch: null, error: null }
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
    try {
      const batch = await fetchUsStockIndicatorsBatch({
        codes: usRows.map((r) => r.ticker),
        panicIndex,
        signal,
      })
      perf.usBatchDurationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
      )
      perf.usParallelCount = batch.batchMeta?.parallelConcurrency ?? 1
      return { batch, error: null }
    } catch (e) {
      perf.usBatchDurationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
      )
      return { batch: null, error: e }
    }
  })()

  const [krResult, usResult] = await Promise.all([krPromise, usPromise])

  if (krResult.batch) {
    for (const row of krRows) {
      const apiBody = krResult.batch.results[row.ticker]
      if (apiBody) {
        ingestLiveSnapshot(map, row, apiBody, errors)
      } else {
        const errMsg = krResult.batch.errors[row.ticker] ?? "batch missing"
        errors.push({ ticker: row.ticker, error: String(errMsg) })
      }
    }
    if (krResult.batch.tokenStats) {
      console.info("[stock-pick-live] KR batch token stats", krResult.batch.tokenStats)
    }
  } else if (krResult.error) {
    const message = krResult.error?.message ?? String(krResult.error)
    console.warn("[stock-pick-live] KR batch failed", message)
    for (const row of krRows) {
      errors.push({ ticker: row.ticker, error: message })
    }
  }

  if (usResult.batch) {
    for (const row of usRows) {
      const apiBody = usResult.batch.results[row.ticker]
      if (apiBody) {
        ingestLiveSnapshot(map, row, apiBody, errors)
      } else {
        const errMsg = usResult.batch.errors[row.ticker] ?? "batch missing"
        errors.push({ ticker: row.ticker, error: String(errMsg) })
      }
    }
  } else if (usResult.error) {
    const message = usResult.error?.message ?? String(usResult.error)
    console.warn("[stock-pick-live] US batch failed", message)
    for (const row of usRows) {
      errors.push({ ticker: row.ticker, error: message })
    }
  }

  for (const [ticker, entry] of map) {
    const row = universe.stocks.find((s) => s.ticker === ticker)
    const country = row?.country ?? "US"
    entry.quote = entry.quote ?? apiBodyToPickQuote(entry.apiBody, country)
  }

  const enrichPortfolioQuotes = async () => {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
    try {
      const { quotes: portfolioQuotes } = await fetchStockPickQuotesBatch()
      perf.portfolioDurationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
      )
      for (const [ticker, entry] of map) {
        const pq = portfolioQuotes.get(ticker)
        const snapClose = entry.engineSnapshot?.close
        const pqPrice = pq?.price
        if (pq && snapClose != null && pqPrice != null && snapClose > 0) {
          const diff = Math.abs(pqPrice - snapClose) / snapClose
          if (diff >= 0.2) {
            console.warn("[stock-pick-live] skip portfolio quote — snapshot mismatch", {
              ticker,
              portfolioPrice: pqPrice,
              snapshotClose: snapClose,
              diffPct: Math.round(diff * 1000) / 10,
            })
            continue
          }
        }
        if (pq) entry.quote = pq
      }
    } catch (e) {
      perf.portfolioDurationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
      )
      console.warn("[stock-pick-live] portfolio quote batch failed", e?.message ?? e)
    }
  }

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => enrichPortfolioQuotes(), { timeout: 4000 })
  } else {
    setTimeout(() => enrichPortfolioQuotes(), 0)
  }

  recordStockPickFetchSegments(perf)
  console.log("[stock-pick-fetch] complete", { callsite, snapshotCount: map.size })

  return { snapshots: map, errors, fetchedAt: new Date().toISOString() }
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {AbortSignal} [signal]
 */
export async function fetchStockPickUniverseLive(marketContext = null, signal) {
  const { snapshots, errors, fetchedAt } = await fetchStockPickLiveSnapshots(
    marketContext,
    signal,
    { callsite: "fetchStockPickUniverseLive" },
  )
  const stocks = assignRanks(buildStockPickViews(marketContext, snapshots))
  return { stocks, errors, fetchedAt, snapshotCount: snapshots.size }
}

/**
 * @param {string} ticker
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {AbortSignal} [signal]
 */
export async function fetchStockPickByTickerLive(ticker, marketContext = null, signal, opts = {}) {
  const key = String(ticker ?? "").toUpperCase()
  const row = universe.stocks.find((s) => s.ticker.toUpperCase() === key)
  if (!row) return { stock: null, error: "not found" }

  try {
    const apiBody = await fetchStockIndicators({
      code: row.ticker,
      name: row.name,
      signal,
      panicIndex: marketContext?.panicIndex ?? undefined,
    })
    const engineSnapshot = apiBodyToEngineSnapshot(apiBody)
    const extras = extractSnapshotExtras(apiBody)
    auditStockPickSnapshot(row.ticker, engineSnapshot, { dataSource: apiBody.dataSource })

    /** @type {Map<string, import("./ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} */
    const map = new Map()
    if (engineSnapshot) {
      map.set(row.ticker, {
        engineSnapshot,
        extras,
        apiBody,
        quote: mergePickQuote(null, apiBody, row.country),
        fetchedAt: apiBody.updatedAt ?? new Date().toISOString(),
      })
    }

    const views = buildStockPickViews(marketContext, map)
    const stock =
      assignRanks(views.filter((s) => s.country === row.country)).find(
        (s) => s.ticker.toUpperCase() === key,
      ) ?? views.find((s) => s.ticker.toUpperCase() === key) ?? null

    return { stock, error: stock ? null : "snapshot failed" }
  } catch (e) {
    return { stock: null, error: e?.message ?? String(e) }
  }
}
