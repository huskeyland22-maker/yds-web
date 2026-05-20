import { fetchMarketData } from "../config/api.js"

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
  const history = {}
  /** @type {Record<string, string>} */
  const sources = {}

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

  return { history, sources }
}

/**
 * /api/market-data (Bond CORE). 패닉 MOVE/VXN은 Cycle 전용 — Bond 레이어 미주입.
 * @param {object | null} panicContext
 */
export async function loadMacroRiskHistory(panicContext = null) {
  let history = {}
  /** @type {Record<string, string>} */
  let sources = {}
  let updatedAt = new Date().toISOString()
  let liveFetchOk = false

  try {
    const market = await fetchMarketData()
    liveFetchOk = true
    const built = buildMacroRiskHistoryFromMarket(market, panicContext)
    history = built.history
    sources = { ...sources, ...built.sources }
    if (market.updatedAt) updatedAt = market.updatedAt
  } catch {
    /* LIVE 실패 — 빈 히스토리(정적 시드 비혼입); UI는 DEV/배지로만 감사 */
  }

  // 데이터 기준시점 동기화: Cycle(updatedAt) 우선 사용.
  // 정책: 미국장 종가 확정 이후(KST 오전 8시 기준) 동일 시점으로 Cycle/Macro 해석.
  const cycleUpdatedAt = String(panicContext?.updatedAt ?? "").trim()
  if (cycleUpdatedAt) {
    const t = new Date(cycleUpdatedAt).getTime()
    if (Number.isFinite(t)) updatedAt = new Date(t).toISOString()
  }

  return { history, updatedAt, sources, liveFetchOk }
}
