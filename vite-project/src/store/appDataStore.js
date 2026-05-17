/**
 * 사이클 차트·밸류체인 heat · 패닉 히스토리 단일 진입점.
 * 차트·데스크 수치: panic_index_history only (허브 모드)
 */

import { create } from "zustand"
import {
  fetchCycleMetricsHistory,
  fetchPanicIndexHistory,
  isPanicHubEnabled,
} from "../config/api.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import {
  mergeCycleRows,
  normalizeCycleHistoryRows,
  readCycleMetricHistoryFromLS,
  writeCycleMetricHistoryToLS,
} from "../utils/cycleHistoryUtils.js"
import { purgeStaleCycleLocalStorage } from "../utils/cycleHistoryHygiene.js"
import {
  buildChartDataFromHistory,
  historyRowsToCycleRows,
  logHistoryChartDebug,
} from "../utils/panicHistoryDesk.js"
import { replacePanicIndexHistory } from "../utils/panicIndexHistory.js"
import {
  logFetchFail,
  logFetchStart,
  logFetchSuccess,
  logStoreWrite,
} from "../utils/dataFlowTrace.js"

/** @typedef {'none' | 'supabase-index-history' | 'static-json' | 'localStorage'} CycleHistorySource */

export const useAppDataStore = create((set, get) => ({
  sectorHeatMap: null,
  sectorHeatFetchedAt: null,
  sectorHeatError: null,
  sectorHeatLoading: false,

  cycleMetricHistory: [],
  /** @type {CycleHistorySource} */
  cycleHistorySource: "none",
  cycleHistoryUpdatedAt: null,
  cycleHistoryRealtime: false,

  cycleStaticFetchedAt: null,
  panicIndexFetchedAt: null,
  lastCycleBundleError: null,

  realtimeLastEventAt: null,
  realtimeEventCount: 0,

  markRealtimeEvent: () => {
    const t = Date.now()
    set({ realtimeLastEventAt: t, realtimeEventCount: get().realtimeEventCount + 1 })
  },

  invalidateCycleHistoryCache: () => {
    try {
      writeCycleMetricHistoryToLS([])
    } catch {
      // ignore
    }
    set({
      cycleMetricHistory: [],
      cycleHistorySource: "none",
      cycleHistoryUpdatedAt: null,
      cycleStaticFetchedAt: null,
      panicIndexFetchedAt: null,
    })
    logStoreWrite("appDataStore.cycleHistory", { action: "invalidate-cache" })
  },

  purgeLegacyCycleStorage: () => {
    const { purgedCycle, purgedIndex } = purgeStaleCycleLocalStorage()
    if (purgedCycle || purgedIndex) {
      const fromLs = readCycleMetricHistoryFromLS()
      set({
        cycleMetricHistory: fromLs,
        cycleHistorySource: fromLs.length ? "localStorage" : "none",
        cycleHistoryUpdatedAt: fromLs.length ? Date.now() : null,
      })
      logStoreWrite("appDataStore.cycleHistory", { action: "purge-legacy", purgedCycle, purgedIndex, rows: fromLs.length })
    }
    return { purgedCycle, purgedIndex }
  },

  _commitCycleHistory: (rows, meta) => {
    const fresh = Array.isArray(rows) ? rows : []
    writeCycleMetricHistoryToLS(fresh)
    set({
      cycleMetricHistory: fresh,
      cycleHistorySource: meta.source ?? get().cycleHistorySource,
      cycleHistoryUpdatedAt: meta.updatedAt ?? Date.now(),
      cycleHistoryRealtime: Boolean(meta.realtime),
    })
    if (fresh.length > 0) {
      const chartData = buildChartDataFromHistory(fresh, "vix")
      logHistoryChartDebug(fresh, chartData)
    }
    logStoreWrite("appDataStore.cycleHistory", {
      source: meta.source,
      rows: fresh.length,
      realtime: Boolean(meta.realtime),
    })
  },

  /**
   * panic_index_history → cycleMetricHistory (허브: 단일 소스, 혼합·LS fallback 없음)
   */
  loadCycleHistoryBundle: async (opts = {}) => {
    const limit = opts.limit ?? 120
    const force = Boolean(opts.force)
    if (force) get().invalidateCycleHistoryCache()
    logFetchStart("cycle-history-bundle", { limit, force })
    get().purgeLegacyCycleStorage()

    const hubOn = isPanicHubEnabled()

    if (hubOn) {
      try {
        const hubRows = await fetchPanicIndexHistory({ limit })
        const fromHub = historyRowsToCycleRows(hubRows)
        replacePanicIndexHistory(hubRows)

        if (fromHub.length < 1) {
          set({
            lastCycleBundleError: "panic_index_history_empty",
            panicIndexFetchedAt: Date.now(),
          })
          get()._commitCycleHistory([], { source: "none", realtime: true })
          logFetchSuccess("cycle-history-bundle", { hubRows: 0, merged: 0, source: "none" })
          return { hubRows: [], fetchedAt: null, merged: [] }
        }

        const t = Date.now()
        set({
          cycleStaticFetchedAt: t,
          panicIndexFetchedAt: t,
          lastCycleBundleError: null,
        })
        get()._commitCycleHistory(fromHub, { source: "supabase-index-history", realtime: true })
        logFetchSuccess("cycle-history-bundle", {
          hubRows: fromHub.length,
          merged: fromHub.length,
          source: "supabase-index-history",
        })
        return { hubRows, fetchedAt: t, merged: fromHub }
      } catch (e) {
        logFetchFail("cycle-history-bundle", e)
        set({
          lastCycleBundleError: String(e instanceof Error ? e.message : e),
          cycleMetricHistory: [],
          cycleHistorySource: "none",
        })
        return { hubRows: [], fetchedAt: null, error: e, merged: [] }
      }
    }

    try {
      const staticRows = await fetchCycleMetricsHistory({ debugLog: false })
      const normalized = normalizeCycleHistoryRows(staticRows)
      const prev = force ? [] : readCycleMetricHistoryFromLS()
      const merged = mergeCycleRows(mergeCycleRows(prev, normalized), [])
      const source = normalized.length > 0 ? "static-json" : prev.length ? "localStorage" : "none"
      const t = Date.now()
      set({ cycleStaticFetchedAt: t, lastCycleBundleError: null })
      get()._commitCycleHistory(merged, { source, realtime: false })
      logFetchSuccess("cycle-history-bundle", { staticRows: normalized.length, merged: merged.length, source })
      return { staticRows: normalized, hubRows: [], fetchedAt: t, merged }
    } catch (e) {
      logFetchFail("cycle-history-bundle", e)
      const fromLs = readCycleMetricHistoryFromLS()
      set({
        lastCycleBundleError: String(e instanceof Error ? e.message : e),
        cycleMetricHistory: fromLs,
        cycleHistorySource: fromLs.length ? "localStorage" : "none",
      })
      return { staticRows: [], hubRows: [], fetchedAt: null, error: e, merged: fromLs }
    }
  },

  fetchSectorHeat: async () => {
    const layer = "value-chain-heat"
    logFetchStart(layer, { url: "/value-chain-heat.json" })
    set({ sectorHeatLoading: true, sectorHeatError: null })
    try {
      const url = withNoStoreQuery("/value-chain-heat.json")
      const res = await fetch(url, LIVE_JSON_GET_INIT)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const map = data?.sectorHeat
      if (!map || typeof map !== "object") throw new Error("invalid_sectorHeat_shape")
      const t = Date.now()
      set({
        sectorHeatMap: map,
        sectorHeatFetchedAt: t,
        sectorHeatLoading: false,
        sectorHeatError: null,
      })
      logFetchSuccess(layer, { keys: Object.keys(map).length, fetchedAt: t })
      logStoreWrite("appDataStore.sectorHeat", { rows: Object.keys(map).length })
      return map
    } catch (e) {
      logFetchFail(layer, e, { url: "/value-chain-heat.json" })
      set({ sectorHeatLoading: false, sectorHeatError: String(e instanceof Error ? e.message : e) })
      return null
    }
  },
}))
