/**
 * 종목추천 유니버스 실시간 스냅샷 일괄 조회
 */

import universe from "../data/stockPickUniverse.json" with { type: "json" }
import { fetchStockIndicators } from "../utils/stockIndicatorsApi.js"
import {
  apiBodyToEngineSnapshot,
  auditStockPickSnapshot,
  extractSnapshotExtras,
} from "./ydsStockPickLiveSnapshot.js"
import { buildStockPickViews, assignRanks } from "./ydsStockPickModel.js"

const CONCURRENCY = 4

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
 *   fetchedAt: string
 * }} LivePickSnapshotEntry
 */

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {AbortSignal} [signal]
 */
export async function fetchStockPickLiveSnapshots(marketContext = null, signal) {
  /** @type {Map<string, LivePickSnapshotEntry>} */
  const map = new Map()
  /** @type {{ ticker: string; error: string }[]} */
  const errors = []

  await mapPool(universe.stocks, CONCURRENCY, async (row) => {
    if (signal?.aborted) return
    try {
      const apiBody = await fetchStockIndicators({
        code: row.ticker,
        name: row.name,
        signal,
        panicIndex: marketContext?.panicIndex ?? undefined,
      })
      const engineSnapshot = apiBodyToEngineSnapshot(apiBody)
      const extras = extractSnapshotExtras(apiBody)
      const ok = auditStockPickSnapshot(row.ticker, engineSnapshot, {
        dataSource: apiBody.dataSource,
      })

      if (!engineSnapshot || !ok) {
        errors.push({
          ticker: row.ticker,
          error: "snapshot incomplete",
        })
        return
      }

      map.set(row.ticker, {
        engineSnapshot,
        extras,
        apiBody,
        fetchedAt: apiBody.updatedAt ?? new Date().toISOString(),
      })
    } catch (e) {
      const message = e?.message ?? String(e)
      errors.push({ ticker: row.ticker, error: message })
      console.warn("[stock-pick-live] fetch failed", {
        ticker: row.ticker,
        error: message,
      })
    }
  })

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
