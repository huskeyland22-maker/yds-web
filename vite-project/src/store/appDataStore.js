/**
 * 사이클 차트·밸류체인 heat · 패닉 히스토리 단일 진입점.
 * 차트·데스크 수치: panic_index_history only (허브 모드)
 */

import { create } from "zustand"
import {
  backfillPanicHistoryV2,
  fetchCycleMetricsHistory,
  fetchPanicHistoryV2,
  fetchPanicHubLatestOptional,
  fetchPanicIndexHistory,
  fetchPanicIndexLatest,
  isPanicHubEnabled,
} from "../config/api.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import {
  buildCycleRowFromPanic,
  mergeCycleRows,
  normalizeCycleHistoryRows,
  panicDataFromCycleRow,
  readCycleMetricHistoryFromLS,
  writeCycleMetricHistoryToLS,
} from "../utils/cycleHistoryUtils.js"
import { purgeStaleCycleLocalStorage, rowCalendarKey } from "../utils/cycleHistoryHygiene.js"
import {
  buildChartDataFromHistory,
  historyRowsToCycleRows,
  logHistoryChartDebug,
  panicDeskDataFromHistory,
} from "../utils/panicHistoryDesk.js"
import { computePanicV2 } from "../panic-v2/computePanicV2.js"
import { enrichCycleRowsWithPanicV2 } from "../panic-v2/panicHistoryV2Backfill.js"
import { logPanicV2ClientSummary } from "../utils/panicV2BackfillLog.js"
import {
  countPanicV2ScoredRows,
  mergePanicHistoryV2IntoCycleRows,
} from "../utils/panicHistoryV2Merge.js"
import { hasPanicMetricValues, resolveLatestMetrics } from "../utils/resolveLatestPanicMetrics.js"
import { deskReportKey } from "../utils/panicMarketReportEngine.js"
import { replacePanicIndexHistory } from "../utils/panicIndexHistory.js"
import {
  loadStoredPanicHistory,
  panicHistoryLocalToCycleRows,
  persistHistory,
  persistHistoryFromCycleRows,
} from "../utils/panicHistoryLocalPersist.js"
import {
  logFetchFail,
  logFetchStart,
  logFetchSuccess,
  logStoreWrite,
} from "../utils/dataFlowTrace.js"

/** @typedef {'none' | 'supabase-index-history' | 'static-json' | 'localStorage'} CycleHistorySource */

function panicScoreNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const useAppDataStore = create((set, get) => ({
  sectorHeatMap: null,
  sectorHeatFetchedAt: null,
  sectorHeatError: null,
  sectorHeatLoading: false,

  cycleMetricHistory: [],
  /** Supabase market_cycle_history (일별 사이클·점수) */
  marketCycleHistory: [],
  /** @type {CycleHistorySource} */
  cycleHistorySource: "none",
  cycleHistoryUpdatedAt: null,
  cycleHistoryRealtime: false,

  cycleStaticFetchedAt: null,
  panicIndexFetchedAt: null,
  lastCycleBundleError: null,

  realtimeLastEventAt: null,
  realtimeEventCount: 0,

  deskMarketReport: null,
  deskMarketReportKey: null,
  deskMarketReportLoading: false,

  /** latest_panic_metrics 스냅샷 (허브 API) */
  hubPanicMetrics: null,
  /** panic_index_history 최신 1건 (API raw row) */
  latestHistoryRow: null,
  /** @type {'idle' | 'loading' | 'backfilling' | 'ready' | 'preparing'} */
  panicHistoryV2SyncStatus: "idle",
  panicHistoryV2RowCount: 0,
  /** resolveLatestMetrics 결과 캐시 */
  deskResolvedPanicData: null,

  /** 저장 직후 대시보드가 따라갈 trade date (YYYY-MM-DD) */
  deskSnapshotTradeDate: null,

  setDeskMarketReport: (report, reportKey = null) => {
    set({
      deskMarketReport: report && typeof report === "object" ? report : null,
      deskMarketReportKey: reportKey,
      deskMarketReportLoading: false,
    })
    logStoreWrite("appDataStore.deskMarketReport", { hasReport: Boolean(report?.summary) })
  },

  loadDeskMarketReport: async (tradeDate) => {
    if (!isPanicHubEnabled()) {
      set({ deskMarketReport: null, deskMarketReportKey: null, deskMarketReportLoading: false })
      return null
    }
    const key = deskReportKey(tradeDate)
    const dateStr =
      typeof tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate.slice(0, 10))
        ? tradeDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    set({ deskMarketReportLoading: true })
    try {
      const dailyUrl = withNoStoreQuery(`/api/ai/reports?daily=1&date=${encodeURIComponent(dateStr)}`)
      const dailyRes = await fetch(dailyUrl, LIVE_JSON_GET_INIT)
      if (dailyRes.ok) {
        const dailyJson = await dailyRes.json()
        const dailyRow = dailyJson?.row ?? (Array.isArray(dailyJson?.rows) ? dailyJson.rows[0] : null)
        if (dailyRow?.summary) {
          set({
            deskMarketReport: dailyRow,
            deskMarketReportKey: key,
            deskMarketReportLoading: false,
          })
          get().refreshDeskResolvedPanicData()
          return dailyRow
        }
      }

      const url = withNoStoreQuery(
        `/api/ai/reports?report_key=${encodeURIComponent(key)}&limit=1`,
      )
      const res = await fetch(url, LIVE_JSON_GET_INIT)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const row = Array.isArray(json?.rows) ? json.rows[0] : null
      const content = row?.content && typeof row.content === "object" ? row.content : null
      if (content?.summary) {
        set({
          deskMarketReport: content,
          deskMarketReportKey: key,
          deskMarketReportLoading: false,
        })
        get().refreshDeskResolvedPanicData()
        return content
      }
      set({ deskMarketReport: null, deskMarketReportKey: null, deskMarketReportLoading: false })
      return null
    } catch (e) {
      logFetchFail("desk-market-report", e, { tradeDate, key })
      set({ deskMarketReport: null, deskMarketReportKey: null })
      return null
    } finally {
      set({ deskMarketReportLoading: false })
    }
  },

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
    logStoreWrite("appDataStore.cycleHistory", { action: "invalidate-cache", keepPanicHistoryLs: true })
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

  /**
   * panic_history_v2 API 동기화 → cycle rows 병합 (없으면 백필 시도)
   * @param {object[]} cycleRows
   */
  syncPanicHistoryV2: async (cycleRows) => {
    const base = Array.isArray(cycleRows) ? cycleRows : []
    if (!isPanicHubEnabled() || base.length < 1) {
      set({ panicHistoryV2SyncStatus: "preparing", panicHistoryV2RowCount: 0 })
      return { rows: base, v2Rows: [], status: "preparing" }
    }

    set({ panicHistoryV2SyncStatus: "loading" })
    try {
      let v2Rows = await fetchPanicHistoryV2({ limit: 30 })
      let v2Count = v2Rows.length

      if (v2Count < 1 && base.length >= 1) {
        set({ panicHistoryV2SyncStatus: "backfilling" })
        const backfill = await backfillPanicHistoryV2({
          limit: 35,
          days: 30,
          source: "client_mount",
        })
        if (backfill?.ok && !backfill?.skipped) {
          v2Rows = await fetchPanicHistoryV2({ limit: 30 })
          v2Count = v2Rows.length
          if (backfill.summary) console.log("[패닉V2 백필 API]", backfill.summary)
        }
      }

      let merged = mergePanicHistoryV2IntoCycleRows(base, v2Rows)
      let scored = countPanicV2ScoredRows(merged)

      if (scored < 1 && base.length >= 1) {
        merged = merged.map((row) => {
          if (panicScoreNum(row.panicV2Score) != null) return row
          const v2 = computePanicV2(row)
          if (v2.score == null) return row
          return {
            ...row,
            panicV2Score: v2.score,
            panicV2DynamicScore: v2.score,
            panicV2Status: v2.status?.label ?? null,
            panicV2StatusId: v2.status?.id ?? null,
          }
        })
        scored = countPanicV2ScoredRows(merged)
      }

      if (scored >= 1 && scored < 8 && base.length >= 8) {
        merged = enrichCycleRowsWithPanicV2(merged)
        scored = countPanicV2ScoredRows(merged)
      }

      const finalScored = countPanicV2ScoredRows(merged)
      const status = finalScored >= 1 ? "ready" : "preparing"
      if (finalScored >= 1) {
        logPanicV2ClientSummary(merged)
      }
      set({
        panicHistoryV2SyncStatus: status,
        panicHistoryV2RowCount: finalScored,
      })
      return { rows: merged, v2Rows, status }
    } catch (e) {
      logFetchFail("panic-history-v2-sync", e)
      const fallback =
        base.length >= 8 ? enrichCycleRowsWithPanicV2(base) : base
      set({
        panicHistoryV2SyncStatus: "preparing",
        panicHistoryV2RowCount: countPanicV2ScoredRows(fallback),
      })
      return { rows: fallback, v2Rows: [], status: "preparing" }
    }
  },

  _commitCycleHistory: (rows, meta) => {
    const raw = Array.isArray(rows) ? rows : []
    const fresh = raw.length >= 8 ? enrichCycleRowsWithPanicV2(raw) : raw
    writeCycleMetricHistoryToLS(fresh)
    if (fresh.length > 0) {
      persistHistoryFromCycleRows(fresh)
    }
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
   * panic_index_history 최신 1건 — history 전체 대신 latest 우선 (cycle mount·저장 직후)
   */
  loadCycleLatestSnapshot: async (opts = {}) => {
    const force = Boolean(opts.force)
    const tradeDate =
      typeof opts.tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.tradeDate.slice(0, 10))
        ? opts.tradeDate.slice(0, 10)
        : null
    if (!isPanicHubEnabled()) return null
    logFetchStart("cycle-latest-snapshot", { force, tradeDate })
    try {
      const latest = await fetchPanicIndexLatest()
      if (latest?.date) {
        set({ latestHistoryRow: latest })
      }
      const fromHub = latest?.date ? historyRowsToCycleRows([latest]) : []
      const cycleRow = fromHub[0] ?? null
      if (fromHub.length > 0) {
        const prev = force ? [] : get().cycleMetricHistory
        const merged = mergeCycleRows(prev, fromHub)
        get()._commitCycleHistory(merged, {
          source: "supabase-index-history",
          realtime: true,
        })
      }
      if (tradeDate) set({ deskSnapshotTradeDate: tradeDate })
      get().refreshDeskResolvedPanicData()
      if (latest?.date) {
        console.log("LATEST UPDATED", {
          date: cycleRow?.date ?? latest.date,
          vix: cycleRow?.vix ?? latest.vix,
          fearGreed: cycleRow?.fearGreed ?? latest.fearGreed,
          rows: get().cycleMetricHistory?.length ?? 0,
        })
      } else {
        console.warn("LATEST UPDATED — no history row")
      }
      return cycleRow
    } catch (e) {
      logFetchFail("cycle-latest-snapshot", e)
      console.error("LATEST UPDATED — failed", e)
      return null
    }
  },

  /** 저장 payload를 즉시 cycle history에 병합 (서버 refetch 전 UI 반영) */
  mergeCycleRowFromPanicPayload: (panicLike, tradeDate) => {
    const row = buildCycleRowFromPanic({
      ...(panicLike && typeof panicLike === "object" ? panicLike : {}),
      updatedAt:
        panicLike?.updatedAt ??
        (tradeDate ? `${String(tradeDate).slice(0, 10)}T12:00:00.000Z` : undefined),
    })
    if (!row) return null
    const merged = mergeCycleRows(get().cycleMetricHistory, [row])
    void get()
      .syncPanicHistoryV2(merged)
      .then((v2Sync) => {
        get()._commitCycleHistory(v2Sync?.rows ?? merged, {
          source: "supabase-index-history",
          realtime: true,
        })
      })
      .catch(() => {
        get()._commitCycleHistory(merged, { source: "supabase-index-history", realtime: true })
      })
    persistHistory(panicLike, tradeDate)
    if (tradeDate) set({ deskSnapshotTradeDate: String(tradeDate).slice(0, 10) })
    return row
  },

  refreshDeskResolvedPanicData: () => {
    const rows = get().cycleMetricHistory ?? []
    const key = get().deskSnapshotTradeDate
    let cycleRow = null
    if (key && rows.length) {
      cycleRow = rows.find((r) => rowCalendarKey(r) === key) ?? null
    }
    if (!cycleRow && rows.length) {
      cycleRow = rows[rows.length - 1]
    }
    const resolved = resolveLatestMetrics({
      panicMetrics: get().hubPanicMetrics,
      latestHistory: get().latestHistoryRow,
      reportMetrics: get().deskMarketReport,
      cycleRows: rows,
      cycleRow,
    })
    set({ deskResolvedPanicData: resolved })
    return resolved
  },

  /** latest_panic_metrics → history 최신 → cycle → daily report */
  resolveDeskPanicData: () => {
    const cached = get().deskResolvedPanicData
    if (cached && hasPanicMetricValues(cached)) return cached
    return get().refreshDeskResolvedPanicData()
  },

  /** 허브·히스토리·리포트 병렬 로드 후 데스크 지표 갱신 */
  loadDeskMetricSources: async (opts = {}) => {
    if (!isPanicHubEnabled()) return null
    const tradeDate = opts.tradeDate ?? get().deskSnapshotTradeDate ?? null
    logFetchStart("desk-metric-sources", { tradeDate })
    let hub = null
    let latest = null
    try {
      ;[hub, latest] = await Promise.all([
        fetchPanicHubLatestOptional({ debugLog: false }),
        fetchPanicIndexLatest().catch(() => null),
      ])
      set({ hubPanicMetrics: hub, latestHistoryRow: latest })
      if (!get().deskMarketReport && !get().deskMarketReportLoading) {
        await get().loadDeskMarketReport(tradeDate ?? new Date().toISOString().slice(0, 10))
      }
      const resolved = get().refreshDeskResolvedPanicData()
      logFetchSuccess("desk-metric-sources", {
        hasHub: Boolean(hub),
        hasHistory: Boolean(latest?.date),
        hasDesk: hasPanicMetricValues(resolved),
        emergency: Boolean(hub?.__emergency),
      })
      return resolved
    } catch (e) {
      logFetchFail("desk-metric-sources", e)
      return get().refreshDeskResolvedPanicData()
    } finally {
      set({ deskMarketReportLoading: false })
    }
  },

  refreshDashboardAfterSave: async (opts = {}) => {
    const tradeDate = opts.tradeDate ?? null
    if (opts.payload) {
      get().mergeCycleRowFromPanicPayload(opts.payload, tradeDate)
    }
    await get().loadCycleLatestSnapshot({ force: false, tradeDate })
    await get().loadCycleHistoryBundle({ limit: opts.limit ?? 500, force: true })
    await get().loadDeskMetricSources({ tradeDate })
    const desk = get().resolveDeskPanicData()
    console.log("DASHBOARD REFRESHED", {
      rows: get().cycleMetricHistory?.length ?? 0,
      tradeDate: get().deskSnapshotTradeDate,
      vix: desk?.vix ?? null,
    })
    return desk
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

    let localHistory = loadStoredPanicHistory()
    console.log("local history", localHistory.length, localHistory)

    if (localHistory.length === 0) {
      const desk = get().resolveDeskPanicData()
      if (desk && Number.isFinite(Number(desk.vix))) {
        persistHistory(desk, get().deskSnapshotTradeDate)
        localHistory = loadStoredPanicHistory()
        console.log("[YDS] seeded panic_history from live desk", localHistory.length)
      }
    }

    const localCycleRows = panicHistoryLocalToCycleRows(localHistory)

    const hubOn = isPanicHubEnabled()

    if (hubOn) {
      try {
        const bundle = await fetchPanicIndexHistory({
          limit,
          withCycle: true,
          debugMetric: "vix",
          debugRange: "6M",
        })
        const hubRows = bundle.rows ?? []
        console.log("[YDS] loadCycleHistoryBundle hubRows", hubRows.length, hubRows)
        const fromHub = historyRowsToCycleRows(hubRows)
        console.log("[YDS] loadCycleHistoryBundle cycleRows", fromHub.length, fromHub)
        replacePanicIndexHistory(hubRows)
        if (bundle.cycleRows?.length) {
          set({ marketCycleHistory: bundle.cycleRows })
        }

        let cycleRows = mergeCycleRows(fromHub, localCycleRows)
        if (cycleRows.length < localCycleRows.length && localCycleRows.length > 0) {
          cycleRows = localCycleRows
          console.log("[YDS] loadCycleHistoryBundle prefer local seed", cycleRows.length)
        }
        if (cycleRows.length < 1 && hubRows.length > 0) {
          cycleRows = historyRowsToCycleRows(hubRows)
        }
        if (cycleRows.length < 1 && localCycleRows.length > 0) {
          cycleRows = localCycleRows
          console.log("[YDS] loadCycleHistoryBundle local fallback", cycleRows.length)
        }
        if (cycleRows.length < 1) {
          set({
            lastCycleBundleError: "panic_index_history_empty",
            panicIndexFetchedAt: Date.now(),
          })
          get()._commitCycleHistory([], { source: "none", realtime: true })
          logFetchSuccess("cycle-history-bundle", { hubRows: 0, merged: 0, source: "none", localHistory: localHistory.length })
          return { hubRows: [], fetchedAt: null, merged: [] }
        }

        const t = Date.now()
        set({
          cycleStaticFetchedAt: t,
          panicIndexFetchedAt: t,
          lastCycleBundleError: null,
        })
        const v2Sync = await get().syncPanicHistoryV2(cycleRows)
        const mergedWithV2 = v2Sync?.rows ?? cycleRows
        get()._commitCycleHistory(mergedWithV2, { source: "supabase-index-history", realtime: true })
        const latestRow = hubRows.length ? hubRows[hubRows.length - 1] : null
        if (latestRow) set({ latestHistoryRow: latestRow })
        get().refreshDeskResolvedPanicData()
        logFetchSuccess("cycle-history-bundle", {
          hubRows: cycleRows.length,
          merged: cycleRows.length,
          source: "supabase-index-history",
        })
        return { hubRows, fetchedAt: t, merged: cycleRows }
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
