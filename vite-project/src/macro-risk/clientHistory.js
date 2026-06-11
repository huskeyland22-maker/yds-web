import { fetchMarketDataWithRetry } from "./fetchMarketDataWithRetry.js"
import {
  applyBondLiquiditySpotCacheToHistory,
  persistBondLiquiditySpotCacheFromSnapshot,
} from "./bondLiquiditySpotCache.js"
import { buildMacroRiskSnapshot } from "./engine.js"
import { BOND_FRED_SERIES_MAP } from "./bondFredPolicy.js"
import { clearBondFredSnapshot, resolveBondFredFromMarket } from "./bondFredSnapshotStore.js"
import { recordBondSyncMeta } from "./bondSyncMeta.js"
import { applyBondStaleFallback } from "./bondCollectionMeta.js"
import {
  filterValidTreasuryYields,
  isValidUsTreasuryYield,
  normalizeUsTreasuryYield,
} from "./bondYieldValidity.js"

const HISTORY_LEN = 22
const SOURCE_PRIORITY = {
  staticSeed: 1,
  "macro-risk-seed.json": 2,
  "market-data": 3,
  "fred-h15": 5,
  "cycle-manual": 6,
}

/**
 * 1일 변화율(%)로 단순 역산 시계열 (FRED 히스토리 없을 때만 fallback).
 * @param {number|null} current
 * @param {number|null} changePct1D
 * @param {number} [points]
 */
export function synthesizeHistoryFromSpot(current, changePct1D, points = HISTORY_LEN) {
  const cur = Number(current)
  if (!Number.isFinite(cur)) return []
  const pct = Number(changePct1D)
  const dailyFactor = Number.isFinite(pct) ? 1 + pct / 100 : 1
  const out = []
  for (let i = points - 1; i >= 0; i -= 1) {
    out.push(cur / dailyFactor ** i)
  }
  return out.map((v) => Number(v.toFixed(4)))
}

/**
 * @param {{ parsedData?: Record<string, number|null>; changeData?: Record<string, number|null>; bondFred?: object }} market
 * @param {object | null} _panicContext
 * @returns {{ history: Record<string, number[]>; sources: Record<string, string>; bondAsOfNy: string|null }}
 */
export function buildMacroRiskHistoryFromMarket(market, _panicContext = null, opts = {}) {
  const pd = market?.parsedData ?? {}
  const cd = market?.changeData ?? {}
  const history = {}
  /** @type {Record<string, string>} */
  const sources = {}

  const applySeries = (key, seriesValues, source) => {
    const isBondKey = key === "US10Y" || key === "US30Y" || key === "US2Y"
    const cleaned = isBondKey ? filterValidTreasuryYields(seriesValues) : seriesValues
    if (!Array.isArray(cleaned) || cleaned.length < 2) return
    const prevPri = SOURCE_PRIORITY[sources[key]] ?? 0
    const nextPri = SOURCE_PRIORITY[source] ?? 0
    if (nextPri < prevPri) return
    history[key] = cleaned.slice(-HISTORY_LEN)
    sources[key] = source
  }

  const applySpotFallback = (key, current, change, source) => {
    const isBondKey = key === "US10Y" || key === "US30Y" || key === "US2Y"
    const spot = isBondKey ? normalizeUsTreasuryYield(current) : Number(current)
    if (!Number.isFinite(spot)) return
    const prevPri = SOURCE_PRIORITY[sources[key]] ?? 0
    const nextPri = SOURCE_PRIORITY[source] ?? 0
    if (nextPri < prevPri) return
    history[key] = synthesizeHistoryFromSpot(spot, change)
    sources[key] = source
  }

  const fredResolved = resolveBondFredFromMarket(market, { forceRefresh: Boolean(opts.forceBondSync) })

  for (const row of BOND_FRED_SERIES_MAP) {
    const hist = fredResolved.history[row.macroKey]
    if (hist?.length >= 2) {
      applySeries(row.macroKey, hist, "fred-h15")
      continue
    }
    const current = row.apiKeys
      .map((k) => normalizeUsTreasuryYield(pd[k]))
      .find((v) => v != null)
    const changeKey = row.apiKeys.find((k) => cd[k] != null) ?? row.apiKeys[0]
    if (current != null) {
      applySpotFallback(row.macroKey, current, cd[changeKey], "fred-h15")
    }
  }

  applySpotFallback("DXY", pd.dxy, cd.dxy, "market-data")

  applyBondStaleFallback(history, sources)

  const bondFetchErrors = market?.bondFred?.fetch?.errors ?? {}
  const bondLiveCount = market?.bondFred?.fetch?.liveCount ?? 0

  return {
    history,
    sources,
    bondAsOfNy: fredResolved.asOfNy,
    bondFetchErrors,
    bondLiveCount,
  }
}

/**
 * Bond: FRED H.15 · DXY: market-data(Yahoo). 패닉 MOVE/VXN은 Cycle 전용.
 * @param {object | null} panicContext
 */
/**
 * @param {object | null} panicContext
 * @param {{ forceBondSync?: boolean }} [opts]
 */
export async function loadMacroRiskHistory(panicContext = null, opts = {}) {
  let history = {}
  /** @type {Record<string, string>} */
  let sources = {}
  let updatedAt = new Date().toISOString()
  let liveFetchOk = false
  let bondAsOfNy = null
  /** @type {Record<string, string>} */
  let bondFetchErrors = {}
  let bondLiveCount = 0

  try {
    if (opts.forceBondSync) clearBondFredSnapshot()
    const market = await fetchMarketDataWithRetry({ cacheBust: true })
    liveFetchOk = true
    const built = buildMacroRiskHistoryFromMarket(market, panicContext, opts)
    history = built.history
    sources = { ...sources, ...built.sources }
    bondAsOfNy = built.bondAsOfNy
    bondFetchErrors = built.bondFetchErrors ?? {}
    bondLiveCount = built.bondLiveCount ?? 0
    const liveSnapshot = buildMacroRiskSnapshot(history, panicContext, {
      sources,
      liveFetchOk: true,
      updatedAt: market.updatedAt ?? new Date().toISOString(),
      bondAsOfNy,
      bondFetchErrors,
      bondLiveCount,
    })
    persistBondLiquiditySpotCacheFromSnapshot(liveSnapshot, panicContext?.move)
    if (market.bondFred?.asOfNy) {
      updatedAt = `${market.bondFred.asOfNy}T21:00:00.000Z`
    } else if (market.updatedAt) {
      updatedAt = market.updatedAt
    }
    if (opts.forceBondSync) {
      recordBondSyncMeta({ asOfNy: bondAsOfNy })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    bondFetchErrors = {
      _client: /timeout/i.test(msg) ? "market-data_timeout" : "market-data_fetch_failed",
    }
  }

  const cycleUpdatedAt = String(panicContext?.updatedAt ?? "").trim()
  if (cycleUpdatedAt) {
    const t = new Date(cycleUpdatedAt).getTime()
    if (Number.isFinite(t)) updatedAt = new Date(t).toISOString()
  }

  if (!liveFetchOk) {
    const built = buildMacroRiskHistoryFromMarket({ parsedData: {}, changeData: {} }, panicContext, opts)
    history = built.history
    sources = { ...sources, ...built.sources }
    bondAsOfNy = built.bondAsOfNy ?? bondAsOfNy
    applyBondLiquiditySpotCacheToHistory(history, sources, synthesizeHistoryFromSpot)
    if (!bondFetchErrors._client) {
      bondFetchErrors = { ...bondFetchErrors, _client: "market-data_fetch_failed" }
    }
  }

  return { history, updatedAt, sources, liveFetchOk, bondAsOfNy, bondFetchErrors, bondLiveCount }
}
