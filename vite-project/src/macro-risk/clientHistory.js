import { withNoStoreQuery, LIVE_JSON_GET_INIT } from "../config/liveDataFetch.js"
import { fetchMarketData } from "../config/api.js"
import { MACRO_RISK_SEED_HISTORY } from "./staticSeed.js"

const HISTORY_LEN = 22
const SOURCE_PRIORITY = {
  staticSeed: 1,
  "macro-risk-seed.json": 2,
  "market-data": 3,
  "cycle-manual": 4,
}

/**
 * 1일 변화율(%)로 단순 역산 시계열 (절대 20D/5D 근사 — 클라이언트 전용).
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
 * @param {{ parsedData?: Record<string, number|null>; changeData?: Record<string, number|null> }} market
 * @param {object | null} panicContext
 * @returns {Record<string, number[]>}
 */
/**
 * @param {{ parsedData?: Record<string, number|null>; changeData?: Record<string, number|null> }} market
 * @param {object | null} panicContext
 * @returns {{ history: Record<string, number[]>; sources: Record<string, string> }}
 */
export function buildMacroRiskHistoryFromMarket(market, panicContext = null) {
  const pd = market?.parsedData ?? {}
  const cd = market?.changeData ?? {}
  const history = { ...MACRO_RISK_SEED_HISTORY }
  /** @type {Record<string, string>} */
  const sources = {}
  for (const k of Object.keys(MACRO_RISK_SEED_HISTORY)) sources[k] = "staticSeed"

  /**
   * Source of Truth 우선순위: MANUAL > LIVE API > MOCK
   * @param {string} key
   * @param {number|null} current
   * @param {number|null} change
   * @param {string} source
   */
  const applySeries = (key, current, change, source) => {
    if (!Number.isFinite(Number(current))) return
    const prevPri = SOURCE_PRIORITY[sources[key]] ?? 0
    const nextPri = SOURCE_PRIORITY[source] ?? 0
    if (nextPri < prevPri) return
    history[key] = synthesizeHistoryFromSpot(current, change)
    sources[key] = source
  }

  // Tier LIVE 대상: 기존 market-data 재사용 (신규 API 없음)
  applySeries("US10Y", pd.us10y, cd.us10y, "market-data")
  applySeries("US2Y", pd.us2y ?? pd.dgs2, cd.us2y ?? cd.dgs2, "market-data")
  applySeries("US30Y", pd.us30y ?? pd.dgs30, cd.us30y ?? cd.dgs30, "market-data")
  applySeries("REAL_YIELD", pd.realYield ?? pd.dfii10, cd.realYield ?? cd.dfii10, "market-data")
  applySeries("BEI", pd.bei ?? pd.t10yie, cd.bei ?? cd.t10yie, "market-data")
  applySeries("DXY", pd.dxy, cd.dxy, "market-data")

  // 중복 지표(MOVE/VXN): Cycle 수동입력 Source of Truth 우선
  const manualMove = Number(panicContext?.move)
  if (Number.isFinite(manualMove)) {
    applySeries("MOVE", manualMove, cd.move, "cycle-manual")
  } else {
    applySeries("MOVE", pd.move, cd.move, "market-data")
  }

  const manualVxn = Number(panicContext?.vxn)
  if (Number.isFinite(manualVxn)) {
    applySeries("VXN", manualVxn, cd.vxn, "cycle-manual")
  }

  return { history, sources }
}

/**
 * 선택: public/macro-risk-seed.json (정적 자산, serverless 아님)
 * @returns {Promise<Record<string, number[]>|null>}
 */
async function fetchStaticMacroSeedJson() {
  try {
    const res = await fetch(withNoStoreQuery("/macro-risk-seed.json"), LIVE_JSON_GET_INIT)
    if (!res.ok) return null
    const data = await res.json()
    return data?.history && typeof data.history === "object" ? data.history : null
  } catch {
    return null
  }
}

/**
 * 기존 /api/market-data + 정적 시드. 신규 Vercel function 호출 없음.
 * @param {object | null} panicContext
 */
export async function loadMacroRiskHistory(panicContext = null) {
  let history = { ...MACRO_RISK_SEED_HISTORY }
  /** @type {Record<string, string>} */
  let sources = {}
  for (const k of Object.keys(MACRO_RISK_SEED_HISTORY)) sources[k] = "staticSeed"
  let updatedAt = new Date().toISOString()

  const staticJson = await fetchStaticMacroSeedJson()
  if (staticJson) {
    history = { ...history, ...staticJson }
    for (const k of Object.keys(staticJson)) sources[k] = "macro-risk-seed.json"
  }

  try {
    const market = await fetchMarketData()
    const built = buildMacroRiskHistoryFromMarket(market, panicContext)
    history = built.history
    sources = { ...sources, ...built.sources }
    if (market.updatedAt) updatedAt = market.updatedAt
  } catch {
    /* 시드만 사용 */
  }

  return { history, updatedAt, sources }
}
