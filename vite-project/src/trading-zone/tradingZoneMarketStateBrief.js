/**
 * 실전 매매존 — 현재 시장 상태 브리프 (점수 근거 · 행동 이유)
 */
import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { pickMetricValue } from "../utils/panicMarketActionEngine.js"

/** @typedef {{ label: string; text: string }} MarketStateBriefLine */

/** @typedef {{
 *   scoreBasis: MarketStateBriefLine[]
 *   actionReasons: MarketStateBriefLine[]
 * }} TradingZoneMarketStateBrief */

const CORE_METRIC_KEYS = /** @type {const} */ (["vix", "fearGreed", "bofa"])

/** @type {Record<(typeof CORE_METRIC_KEYS)[number], string>} */
const CORE_LABEL = {
  vix: "VIX",
  fearGreed: "CNN",
  bofa: "BofA",
}

/** @param {number} pts */
function formatPts(pts) {
  if (!Number.isFinite(pts) || pts === 0) return "0"
  return pts > 0 ? `+${pts}` : String(pts)
}

/**
 * @param {import("../utils/buildScoreExplainLayer.js").ScoreExplainLayer} layer
 * @param {string} key
 */
function pickDriverPoints(layer, key) {
  if (!layer.ready) return null
  for (const horizon of ["short", "mid", "long"]) {
    const block = layer.horizons.find((h) => h.horizon === horizon)
    const driver = block?.drivers.find((d) => d.key === key && !d.auxiliary)
    if (driver) return driver.points
  }
  return null
}

/**
 * @param {(typeof CORE_METRIC_KEYS)[number]} key
 * @param {object | null | undefined} panicData
 */
function resolveActionReason(key, panicData) {
  const n = Number(pickMetricValue(panicData, key))
  if (!Number.isFinite(n)) return `${CORE_LABEL[key]} —`

  if (key === "vix") {
    if (n <= 18) return "VIX 안정"
    if (n >= 26) return "VIX 확대"
    return "VIX 보통"
  }
  if (key === "fearGreed") {
    if (n >= 75) return "CNN 탐욕 과열"
    if (n >= 60) return "CNN 탐욕권"
    if (n <= 25) return "CNN 공포권"
    if (n <= 40) return "CNN 공포 경계"
    return "CNN 중립"
  }
  if (n >= 8) return "BofA 낙관 과열"
  if (n >= 6.5) return "BofA 낙관 우세"
  if (n <= 2) return "BofA 신용 위축"
  if (n <= 4) return "BofA 보수"
  return "BofA 중립"
}

/**
 * @param {{
 *   panicData?: object | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 *   cycleScore?: number | null
 * }} input
 * @returns {TradingZoneMarketStateBrief}
 */
export function buildTradingZoneMarketStateBrief({
  panicData = null,
  snapshot = null,
  historyRows = [],
  cycleScore = null,
}) {
  const layer = buildScoreExplainLayer({ panicData, snapshot, historyRows, cycleScore })

  const scoreBasis = CORE_METRIC_KEYS.map((key) => {
    const pts = pickDriverPoints(layer, key)
    return {
      label: CORE_LABEL[key],
      text: pts == null ? "—" : formatPts(pts),
    }
  })

  const actionReasons = CORE_METRIC_KEYS.map((key) => ({
    label: CORE_LABEL[key],
    text: resolveActionReason(key, panicData),
  }))

  return { scoreBasis, actionReasons }
}
