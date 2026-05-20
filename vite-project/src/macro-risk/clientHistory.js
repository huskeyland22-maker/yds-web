import { withNoStoreQuery, LIVE_JSON_GET_INIT } from "../config/liveDataFetch.js"
import { fetchMarketData } from "../config/api.js"
import { MACRO_RISK_SEED_HISTORY } from "./staticSeed.js"

const HISTORY_LEN = 22

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

  const us10 = pd.us10y
  if (Number.isFinite(Number(us10))) {
    history.US10Y = synthesizeHistoryFromSpot(us10, cd.us10y)
    sources.US10Y = "market-data"
  }

  const dxy = pd.dxy
  if (Number.isFinite(Number(dxy))) {
    history.DXY = synthesizeHistoryFromSpot(dxy, cd.dxy)
    sources.DXY = "market-data"
  }

  const moveLive = pd.move ?? panicContext?.move
  const moveChg = cd.move
  if (Number.isFinite(Number(moveLive))) {
    history.MOVE = synthesizeHistoryFromSpot(moveLive, moveChg)
    sources.MOVE = pd.move != null ? "market-data" : "market-data+panic"
  }

  const vxnSpot = Number(panicContext?.vxn)
  if (Number.isFinite(vxnSpot)) {
    const chg = cd.vxn
    if (Number.isFinite(Number(chg))) {
      history.VXN = synthesizeHistoryFromSpot(vxnSpot, chg)
      sources.VXN = "panicContext+synth"
    } else {
      history.VXN = [vxnSpot]
      sources.VXN = "panicContext"
    }
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
