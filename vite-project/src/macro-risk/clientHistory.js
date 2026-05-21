import { fetchMarketData } from "../config/api.js"
import { BOND_FRED_SERIES_MAP } from "./bondFredPolicy.js"
import { resolveBondFredFromMarket } from "./bondFredSnapshotStore.js"

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
export function buildMacroRiskHistoryFromMarket(market, _panicContext = null) {
  const pd = market?.parsedData ?? {}
  const cd = market?.changeData ?? {}
  const history = {}
  /** @type {Record<string, string>} */
  const sources = {}

  const applySeries = (key, seriesValues, source) => {
    if (!Array.isArray(seriesValues) || seriesValues.length < 2) return
    const prevPri = SOURCE_PRIORITY[sources[key]] ?? 0
    const nextPri = SOURCE_PRIORITY[source] ?? 0
    if (nextPri < prevPri) return
    history[key] = seriesValues.slice(-HISTORY_LEN)
    sources[key] = source
  }

  const applySpotFallback = (key, current, change, source) => {
    if (!Number.isFinite(Number(current))) return
    const prevPri = SOURCE_PRIORITY[sources[key]] ?? 0
    const nextPri = SOURCE_PRIORITY[source] ?? 0
    if (nextPri < prevPri) return
    history[key] = synthesizeHistoryFromSpot(current, change)
    sources[key] = source
  }

  const fredResolved = resolveBondFredFromMarket(market)

  for (const row of BOND_FRED_SERIES_MAP) {
    const hist = fredResolved.history[row.macroKey]
    if (hist?.length >= 2) {
      applySeries(row.macroKey, hist, "fred-h15")
      continue
    }
    const current = row.apiKeys.map((k) => pd[k]).find((v) => Number.isFinite(Number(v)))
    const changeKey = row.apiKeys.find((k) => cd[k] != null) ?? row.apiKeys[0]
    if (Number.isFinite(Number(current))) {
      applySpotFallback(row.macroKey, Number(current), cd[changeKey], "fred-h15")
    }
  }

  applySpotFallback("DXY", pd.dxy, cd.dxy, "market-data")

  return { history, sources, bondAsOfNy: fredResolved.asOfNy }
}

/**
 * Bond: FRED H.15 · DXY: market-data(Yahoo). 패닉 MOVE/VXN은 Cycle 전용.
 * @param {object | null} panicContext
 */
export async function loadMacroRiskHistory(panicContext = null) {
  let history = {}
  /** @type {Record<string, string>} */
  let sources = {}
  let updatedAt = new Date().toISOString()
  let liveFetchOk = false
  let bondAsOfNy = null

  try {
    const market = await fetchMarketData()
    liveFetchOk = true
    const built = buildMacroRiskHistoryFromMarket(market, panicContext)
    history = built.history
    sources = { ...sources, ...built.sources }
    bondAsOfNy = built.bondAsOfNy
    if (market.bondFred?.asOfNy) {
      updatedAt = `${market.bondFred.asOfNy}T21:00:00.000Z`
    } else if (market.updatedAt) {
      updatedAt = market.updatedAt
    }
  } catch {
    /* LIVE 실패 — 빈 히스토리 */
  }

  const cycleUpdatedAt = String(panicContext?.updatedAt ?? "").trim()
  if (cycleUpdatedAt) {
    const t = new Date(cycleUpdatedAt).getTime()
    if (Number.isFinite(t)) updatedAt = new Date(t).toISOString()
  }

  return { history, updatedAt, sources, liveFetchOk, bondAsOfNy }
}
