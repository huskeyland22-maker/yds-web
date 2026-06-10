/**
 * 종목추천 유니버스 실시간 스냅샷 일괄 조회
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import {
  fetchKrStockIndicatorsBatch,
  fetchStockIndicators,
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

const US_CONCURRENCY = 4

/**
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<void>} worker
 */
async function mapPool(items, limit, worker) {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++
      await worker(items[i])
    }
  })
  await Promise.all(runners)
}

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
 */
export async function fetchStockPickLiveSnapshots(marketContext = null, signal) {
  /** @type {Map<string, LivePickSnapshotEntry>} */
  const map = new Map()
  /** @type {{ ticker: string; error: string }[]} */
  const errors = []

  const krRows = universe.stocks.filter((s) => s.country === "KR")
  const usRows = universe.stocks.filter((s) => s.country === "US")
  const panicIndex = marketContext?.panicIndex ?? undefined

  if (krRows.length && !signal?.aborted) {
    try {
      const batch = await fetchKrStockIndicatorsBatch({
        codes: krRows.map((r) => r.ticker),
        panicIndex,
        signal,
      })

      for (const row of krRows) {
        const apiBody = batch.results[row.ticker]
        if (apiBody) {
          ingestLiveSnapshot(map, row, apiBody, errors)
        } else {
          const errMsg = batch.errors[row.ticker] ?? "batch missing"
          errors.push({ ticker: row.ticker, error: String(errMsg) })
        }
      }

      if (batch.tokenStats) {
        console.info("[stock-pick-live] KR batch token stats", batch.tokenStats)
      }
    } catch (e) {
      const message = e?.message ?? String(e)
      console.warn("[stock-pick-live] KR batch failed", message)
      for (const row of krRows) {
        errors.push({ ticker: row.ticker, error: message })
      }
    }
  }

  await mapPool(usRows, US_CONCURRENCY, async (row) => {
    if (signal?.aborted) return
    try {
      const apiBody = await fetchStockIndicators({
        code: row.ticker,
        name: row.name,
        signal,
        panicIndex,
      })
      ingestLiveSnapshot(map, row, apiBody, errors)
    } catch (e) {
      const message = e?.message ?? String(e)
      errors.push({ ticker: row.ticker, error: message })
      console.warn("[stock-pick-live] fetch failed", {
        ticker: row.ticker,
        error: message,
      })
    }
  })

  try {
    const { quotes: portfolioQuotes } = await fetchStockPickQuotesBatch()
    for (const [ticker, entry] of map) {
      const row = universe.stocks.find((s) => s.ticker === ticker)
      const country = row?.country ?? "US"
      entry.quote =
        portfolioQuotes.get(ticker) ??
        entry.quote ??
        apiBodyToPickQuote(entry.apiBody, country)
    }
  } catch (e) {
    console.warn("[stock-pick-live] portfolio quote batch failed", e?.message ?? e)
  }

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
  )
  const stocks = assignRanks(buildStockPickViews(marketContext, snapshots))
  return { stocks, errors, fetchedAt, snapshotCount: snapshots.size }
}

/**
 * @param {string} ticker
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {AbortSignal} [signal]
 */
export async function fetchStockPickByTickerLive(ticker, marketContext = null, signal) {
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
