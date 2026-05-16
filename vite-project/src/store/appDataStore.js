/**
 * 사이클 차트·밸류체인 heat 등 패닉 스토어 외 보조 데이터 단일 진입점.
 * (패닉 지표 숫자는 panicStore 유지)
 */

import { create } from "zustand"
import {
  fetchCycleMetricsHistory,
  fetchPanicIndexHistory,
  isPanicHubEnabled,
} from "../config/api.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import {
  logFetchFail,
  logFetchStart,
  logFetchSuccess,
  logStoreWrite,
} from "../utils/dataFlowTrace.js"

export const useAppDataStore = create((set, get) => ({
  /** { [sectorId]: heat string } | null */
  sectorHeatMap: null,
  sectorHeatFetchedAt: null,
  sectorHeatError: null,
  sectorHeatLoading: false,

  cycleStaticFetchedAt: null,
  panicIndexFetchedAt: null,
  lastCycleBundleError: null,

  realtimeLastEventAt: null,
  realtimeEventCount: 0,

  markRealtimeEvent: () => {
    const t = Date.now()
    set({ realtimeLastEventAt: t, realtimeEventCount: get().realtimeEventCount + 1 })
  },

  /**
   * /value-chain-heat.json — ValueChainPage 전용이던 fetch 중앙화
   */
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

  /**
   * App 마운트 시 1회: 정적 cycle JSON + (허브 시) panic_index_history
   */
  loadCycleHistoryBundle: async (opts = {}) => {
    const limit = opts.limit ?? 120
    logFetchStart("cycle-history-bundle", { limit })
    try {
      const [staticRows, hubRows] = await Promise.all([
        fetchCycleMetricsHistory({ debugLog: false }),
        isPanicHubEnabled() ? fetchPanicIndexHistory({ limit }) : Promise.resolve([]),
      ])
      const t = Date.now()
      set({
        cycleStaticFetchedAt: t,
        panicIndexFetchedAt: isPanicHubEnabled() ? t : null,
        lastCycleBundleError: null,
      })
      logFetchSuccess("cycle-history-bundle", {
        staticRows: Array.isArray(staticRows) ? staticRows.length : 0,
        hubRows: Array.isArray(hubRows) ? hubRows.length : 0,
      })
      return { staticRows, hubRows, fetchedAt: t }
    } catch (e) {
      logFetchFail("cycle-history-bundle", e)
      set({ lastCycleBundleError: String(e instanceof Error ? e.message : e) })
      return { staticRows: [], hubRows: [], fetchedAt: null, error: e }
    }
  },
}))
