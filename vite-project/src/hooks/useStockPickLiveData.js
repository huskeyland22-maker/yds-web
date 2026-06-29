import { useEffect, useMemo, useRef, useState } from "react"
import {
  assignRanks,
  buildStockPickViews,
  filterRecommendableStockPicks,
} from "../content/ydsStockPickModel.js"
import { applyStockPickBatchMeta } from "../content/ydsStockPickBatchEnrich.js"
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
import { markTimeline } from "../content/ydsFirstEntryTimeline.js"
import {
  logStockPickApiDuplicateAudit,
  resetStockPickApiCounter,
} from "../content/ydsStockPickApiCounter.js"
import { traceStockPickMount } from "../content/ydsStockPickMountTrace.js"
import {
  isStockPickFetchSessionDone,
  isStockPickFetchSessionInFlight,
} from "../content/ydsStockPickFetchSession.js"
import {
  markPostApiComplete,
  recordRenderPhase,
  resetStockPickRenderPerf,
} from "../content/ydsStockPickRenderPerf.js"
import {
  loadStockPickSnapshotCache,
  readInitialStockPickSnapshots,
  saveStockPickSnapshotCache,
} from "../content/ydsStockPickSnapshotCache.js"
import { fetchStockPickLiveSnapshots } from "../content/ydsStockPickLiveFetcher.js"
import { logStockPickPriceSourceCheck } from "../content/ydsStockPickPriceSourceCheck.js"

const bootCache = readInitialStockPickSnapshots()

/** 컴포넌트 remount 시 HTTP 중복 시작 차단 — hydrate/join은 항상 허용 */
let hookMountFetchCommitted = false

/**
 * @param {Map<string, object>} map
 * @param {import("../content/ydsMarketAdapter.js").YdsMarketAdapterContext | null} marketContext
 */
function countRecommendableFromMap(map, marketContext) {
  if (!map?.size) return 0
  return filterRecommendableStockPicks(buildStockPickViews(marketContext, map)).length
}

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
  const fetchGuardRef = useRef(false)
  const marketContextRef = useRef(marketContext)
  marketContextRef.current = marketContext

  useEffect(() => {
    traceStockPickMount("useStockPickLiveData", "mount", {
      hookMountFetchCommitted,
      sessionDone: isStockPickFetchSessionDone(),
    })
    return () => {
      traceStockPickMount("useStockPickLiveData", "unmount", {
        hookMountFetchCommitted,
        sessionDone: isStockPickFetchSessionDone(),
      })
    }
  }, [])

  useEffect(() => {
    if (perfInitRef.current) return
    perfInitRef.current = true
    resetStockPickPerfSession({ fromCache: bootCache.fromCache })
    resetStockPickRenderPerf()
    resetStockPickApiCounter()
  }, [])

  useEffect(() => {
    if (fetchGuardRef.current) {
      setLoading(false)
      setRefreshing(false)
      return undefined
    }
    fetchGuardRef.current = true

    const ac = new AbortController()
    const requestId = ++requestIdRef.current
    const isSessionReuse = hookMountFetchCommitted

    if (!isSessionReuse) {
      hookMountFetchCommitted = true
    }

    const cachedPayload = loadStockPickSnapshotCache()
    let displayMap = snapshotMap
    let displayCount = snapshotMap.size

    if (!displayCount && cachedPayload?.snapshots?.size) {
      displayMap = cachedPayload.snapshots
      displayCount = cachedPayload.snapshots.size
      setSnapshotMap(cachedPayload.snapshots)
      setErrors(cachedPayload.errors ?? [])
      setLastSyncAt(cachedPayload.fetchedAt)
      setFromCache(true)
    }

    if (isSessionReuse) {
      console.log("[stock-pick] skip duplicate hook fetch", {
        hookMountFetchCommitted: true,
        loading,
        snapshotMapSize: displayCount,
        stocksLength: countRecommendableFromMap(displayMap, marketContextRef.current),
        sessionDone: isStockPickFetchSessionDone(),
        sessionInFlight: isStockPickFetchSessionInFlight(),
        hydratedFromCache: Boolean(cachedPayload?.snapshots?.size && !snapshotMap.size),
      })
    }

    const sessionInFlight = isStockPickFetchSessionInFlight()
    const needsNetwork = displayCount === 0

    if (displayCount > 0) {
      setLoading(false)
      if (!isSessionReuse || sessionInFlight) {
        setRefreshing(true)
      }
    } else {
      setLoading(true)
    }

    if (!isSessionReuse && needsNetwork) {
      mark("api fetch start")
      markTimeline("API_START", { segment: "stockApi" })
    } else if (needsNetwork) {
      markTimeline("API_START", { segment: "stockApi", reuse: true })
    }

    const finishLoading = () => {
      if (requestId !== requestIdRef.current) return
      setLoading(false)
      setRefreshing(false)
    }

    const persistSnapshotCache = (snapshots, fetchedAt, fetchErrors) => {
      const persistCache = () => {
        const t0 = typeof performance !== "undefined" ? performance.now() : 0
        saveStockPickSnapshotCache(snapshots, fetchedAt, fetchErrors)
        if (typeof performance !== "undefined") {
          recordRenderPhase("cache save", performance.now() - t0)
        }
      }
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(persistCache, { timeout: 2000 })
      } else {
        setTimeout(persistCache, 0)
      }
    }

    ;(async () => {
      if (!needsNetwork && !sessionInFlight && isStockPickFetchSessionDone()) {
        finishLoading()
        return
      }

      try {
        const result = await fetchStockPickLiveSnapshots(marketContextRef.current, ac.signal, {
          callsite: isSessionReuse
            ? "useStockPickLiveData.useEffect.sessionReuse"
            : "useStockPickLiveData.useEffect.mount",
        })

        if (requestId !== requestIdRef.current) {
          finishLoading()
          return
        }
        if (ac.signal.aborted) {
          finishLoading()
          return
        }

        if (!isSessionReuse && !result.fromSessionCache) {
          measure("api fetch", "api fetch start")
          markTimeline("API_END", { segment: "stockApi" })
          markPostApiComplete()
          syncPostApiMark()
        } else if (needsNetwork) {
          markTimeline("API_END", { segment: "stockApi", reuse: true })
        }

        setSnapshotMap(result.snapshots)
        setErrors(result.errors ?? [])
        setLastSyncAt(result.fetchedAt)
        setFromCache(Boolean(result.fromSessionCache))

        if (!result.fromSessionCache && result.snapshots?.size) {
          persistSnapshotCache(result.snapshots, result.fetchedAt, result.errors ?? [])
        }

        finishLoading()
        if (!isSessionReuse && !result.fromSessionCache) {
          logStockPickApiDuplicateAudit()
        }
      } catch {
        finishLoading()
      }
    })()

    return () => {
      ac.abort()
    }
  }, [])

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
    const ranked = assignRanks(filtered)
    const result = applyStockPickBatchMeta(ranked, allStocks)
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
    logStockPickPriceSourceCheck(stocks)
  }, [loading, stocks.length, pipelineDebug, stocks])

  useEffect(() => {
    if (loading || refreshing) return
    emitStockPickPerfReport({ fromCache, refreshing: false })
  }, [loading, refreshing, fromCache])

  return {
    stocks,
    /** @deprecated alias — prefer `stocks` */
    liveStocks: stocks,
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
