/**
 * 사이클 차트·밸류체인 heat · 패닉 히스토리 단일 진입점.
 * (라이브 패닉 숫자는 panicStore)
 */

import { create } from "zustand"
import {
  fetchCycleMetricsHistory,
  fetchPanicIndexHistory,
  isPanicHubEnabled,
} from "../config/api.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import {
  buildCycleRowFromPanic,
  mergeCycleRows,
  normalizeCycleHistoryRows,
  readCycleMetricHistoryFromLS,
  writeCycleMetricHistoryToLS,
} from "../utils/cycleHistoryUtils.js"
import { purgeStaleCycleLocalStorage } from "../utils/cycleHistoryHygiene.js"
import { panicIndexRowToCycleChart, replacePanicIndexHistory } from "../utils/panicIndexHistory.js"
import { validatePanicData } from "../utils/validatePanicData.js"
import {
  logFetchFail,
  logFetchStart,
  logFetchSuccess,
  logStoreWrite,
} from "../utils/dataFlowTrace.js"

/** @typedef {'none' | 'supabase-hub' | 'supabase-index-history' | 'static-json' | 'localStorage' | 'live-panic'} CycleHistorySource */

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

  /** 부팅 시 2024 mock LS 정리 */
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
    logStoreWrite("appDataStore.cycleHistory", {
      source: meta.source,
      rows: fresh.length,
      realtime: Boolean(meta.realtime),
    })
  },

  /** panicStore 갱신 시 당일 행 병합 */
  syncCycleHistoryFromPanic: (panicData) => {
    if (!validatePanicData(panicData)) return get().cycleMetricHistory
    const row = buildCycleRowFromPanic(panicData)
    if (!row) return get().cycleMetricHistory
    const merged = mergeCycleRows(get().cycleMetricHistory, [row])
    get()._commitCycleHistory(merged, { source: "live-panic", realtime: false })
    return merged
  },

  /**
   * App 마운트: Supabase index history + (빈) static JSON 병합
   */
  loadCycleHistoryBundle: async (opts = {}) => {
    const limit = opts.limit ?? 120
    logFetchStart("cycle-history-bundle", { limit })
    get().purgeLegacyCycleStorage()
    try {
      const [staticRows, hubRows] = await Promise.all([
        fetchCycleMetricsHistory({ debugLog: false }),
        isPanicHubEnabled() ? fetchPanicIndexHistory({ limit }) : Promise.resolve([]),
      ])
      const normalized = normalizeCycleHistoryRows(staticRows)
      const fromHub = hubRows.map(panicIndexRowToCycleChart).filter(Boolean)
      replacePanicIndexHistory(hubRows)

      const prev = readCycleMetricHistoryFromLS()
      const merged = mergeCycleRows(mergeCycleRows(prev, normalized), fromHub)

      const source =
        fromHub.length > 0
          ? "supabase-index-history"
          : normalized.length > 0
            ? "static-json"
            : prev.length
              ? "localStorage"
              : "none"

      const t = Date.now()
      set({
        cycleStaticFetchedAt: t,
        panicIndexFetchedAt: isPanicHubEnabled() ? t : null,
        lastCycleBundleError: null,
      })
      get()._commitCycleHistory(merged, { source, realtime: isPanicHubEnabled() })
      logFetchSuccess("cycle-history-bundle", {
        staticRows: normalized.length,
        hubRows: fromHub.length,
        merged: merged.length,
        source,
      })
      return { staticRows: normalized, hubRows, fetchedAt: t, merged }
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
