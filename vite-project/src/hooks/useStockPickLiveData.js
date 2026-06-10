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
import {
  emitStockPickPerfReport,
  mark,
  measure,
  resetStockPickPerfSession,
  syncPostApiMark,
} from "../content/ydsStockPickPerf.js"
import {
  markPostApiComplete,
  recordRenderPhase,
  resetStockPickRenderPerf,
} from "../content/ydsStockPickRenderPerf.js"
import { readInitialStockPickSnapshots, saveStockPickSnapshotCache } from "../content/ydsStockPickSnapshotCache.js"
import { fetchStockPickLiveSnapshots } from "../content/ydsStockPickLiveFetcher.js"

const bootCache = readInitialStockPickSnapshots()

/**
 * @param {import("../content/ydsMarketAdapter.js").YdsMarketAdapterContext | null} marketContext
 */
export function useStockPickLiveData(marketContext) {
  const [snapshotMap, setSnapshotMap] = useState(() => bootCache.snapshots)
  const [errors, setErrors] = useState(() => bootCache.errors)
  const [lastSyncAt, setLastSyncAt] = useState(() => bootCache.fetchedAt)
  const [loading, setLoading] = useState(() => !bootCache.fromCache)
  const [refreshing, setRefreshing] = useState(false)
  const [fromCache, setFromCache] = useState(() => bootCache.fromCache)
  const requestIdRef = useRef(0)
  const perfInitRef = useRef(false)

  useEffect(() => {
    if (perfInitRef.current) return
    perfInitRef.current = true
    resetStockPickPerfSession({ fromCache: bootCache.fromCache })
    resetStockPickRenderPerf()
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    const requestId = ++requestIdRef.current
    const hasDisplayData = snapshotMap.size > 0

    if (hasDisplayData) {
      setRefreshing(true)
      setLoading(false)
    } else {
      setLoading(true)
    }

    mark("api fetch start")

    ;(async () => {
      const result = await fetchStockPickLiveSnapshots(marketContext, ac.signal)
      if (requestId !== requestIdRef.current) return

      measure("api fetch", "api fetch start")
      markPostApiComplete()
      syncPostApiMark()

      setSnapshotMap(result.snapshots)
      setErrors(result.errors)
      setLastSyncAt(result.fetchedAt)
      setFromCache(false)

      const persistCache = () => {
        const t0 = typeof performance !== "undefined" ? performance.now() : 0
        saveStockPickSnapshotCache(result.snapshots, result.fetchedAt, result.errors)
        if (typeof performance !== "undefined") {
          recordRenderPhase("cache save", performance.now() - t0)
        }
      }
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(persistCache, { timeout: 2000 })
      } else {
        setTimeout(persistCache, 0)
      }

      setLoading(false)
      setRefreshing(false)
    })().catch(() => {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    })

    return () => ac.abort()
  }, [marketContext])

  const allStocks = useMemo(
    () => buildStockPickViews(marketContext, snapshotMap),
    [marketContext, snapshotMap],
  )

  const stocks = useMemo(() => {
    const canPerf = typeof performance !== "undefined"
    if (canPerf) mark("score calc start")

    const filterT0 = canPerf ? performance.now() : 0
    const filtered = filterRecommendableStockPicks(allStocks)
    if (canPerf) recordRenderPhase("filter live", performance.now() - filterT0)

    const sortT0 = canPerf ? performance.now() : 0
    const result = assignRanks(filtered)
    if (canPerf) {
      recordRenderPhase("sort", performance.now() - sortT0)
      if (result.length) measure("score calc", "score calc start")
    }
    return result
  }, [allStocks])

  const loadStats = useMemo(() => computeStockPickLoadStats(allStocks), [allStocks])

  const pipelineDebug = useMemo(
    () => computeStockPickPipelineDebug(snapshotMap, allStocks, stocks, errors),
    [snapshotMap, allStocks, stocks, errors],
  )

  useEffect(() => {
    if (loading && !stocks.length) return
    logStockPickPipelineDebug(pipelineDebug)
  }, [loading, stocks.length, pipelineDebug])

  useEffect(() => {
    if (loading || refreshing) return
    emitStockPickPerfReport({ fromCache, refreshing: false })
  }, [loading, refreshing, fromCache])

  return {
    stocks,
    allStocks,
    loadStats,
    pipelineDebug,
    loading: loading && stocks.length === 0,
    refreshing,
    fromCache,
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
  const { stocks, loading, errors, lastSyncAt, liveReady, refreshing } =
    useStockPickLiveData(marketContext)
  const key = String(ticker ?? "").toUpperCase()

  const stock = useMemo(() => {
    if (!key) return null
    return stocks.find((s) => s.ticker.toUpperCase() === key) ?? null
  }, [stocks, key])

  return { stock, loading, errors, lastSyncAt, liveReady, refreshing }
}
