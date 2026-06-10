import { useEffect, useMemo, useRef, useState } from "react"
import {
  assignRanks,
  buildStockPickViews,
  filterRecommendableStockPicks,
} from "../content/ydsStockPickModel.js"
import { computeStockPickLoadStats } from "../content/ydsStockPickLoadStats.js"
import {
  computeStockPickPipelineDebug,
  logStockPickPipelineDebug,
} from "../content/ydsStockPickPipelineDebug.js"
import { fetchStockPickLiveSnapshots } from "../content/ydsStockPickLiveFetcher.js"

/**
 * @param {import("../content/ydsMarketAdapter.js").YdsMarketAdapterContext | null} marketContext
 */
export function useStockPickLiveData(marketContext) {
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState(/** @type {{ ticker: string; error: string }[]} */ ([]))
  const [lastSyncAt, setLastSyncAt] = useState(/** @type {string | null} */ (null))
  const [snapshotMap, setSnapshotMap] = useState(
    /** @type {Map<string, import("../content/ydsStockPickLiveFetcher.js").LivePickSnapshotEntry>} */ (
      new Map()
    ),
  )
  const requestIdRef = useRef(0)

  useEffect(() => {
    const ac = new AbortController()
    const requestId = ++requestIdRef.current

    ;(async () => {
      setLoading(true)
      const result = await fetchStockPickLiveSnapshots(marketContext, ac.signal)
      if (requestId !== requestIdRef.current) return

      setSnapshotMap(result.snapshots)
      setErrors(result.errors)
      setLastSyncAt(result.fetchedAt)
      setLoading(false)
    })().catch(() => {
      if (requestId === requestIdRef.current) setLoading(false)
    })

    return () => ac.abort()
  }, [marketContext])

  const allStocks = useMemo(
    () => buildStockPickViews(marketContext, snapshotMap),
    [marketContext, snapshotMap],
  )

  const stocks = useMemo(
    () => assignRanks(filterRecommendableStockPicks(allStocks)),
    [allStocks],
  )

  const loadStats = useMemo(() => computeStockPickLoadStats(allStocks), [allStocks])

  const pipelineDebug = useMemo(
    () => computeStockPickPipelineDebug(snapshotMap, allStocks, stocks, errors),
    [snapshotMap, allStocks, stocks, errors],
  )

  useEffect(() => {
    if (loading) return
    logStockPickPipelineDebug(pipelineDebug)
  }, [loading, pipelineDebug])

  return {
    stocks,
    allStocks,
    loadStats,
    pipelineDebug,
    loading,
    errors,
    lastSyncAt,
    liveReady: loadStats.totalLive > 0,
  }
}

/**
 * @param {string} ticker
 * @param {import("../content/ydsMarketAdapter.js").YdsMarketAdapterContext | null} marketContext
 */
export function useStockPickDetailLive(ticker, marketContext) {
  const { stocks, loading, errors, lastSyncAt, liveReady } = useStockPickLiveData(marketContext)
  const key = String(ticker ?? "").toUpperCase()

  const stock = useMemo(() => {
    if (!key) return null
    return stocks.find((s) => s.ticker.toUpperCase() === key) ?? null
  }, [stocks, key])

  return { stock, loading, errors, lastSyncAt, liveReady }
}
