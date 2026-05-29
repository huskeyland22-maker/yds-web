/**
 * 실전 매매존 — 현재 시장 상태 브리프 (기간별 점수 근거 · 행동 연결)
 */
import { buildHomeV5CoreSynthesis } from "../home-v5/homeV5CoreSynthesis.js"
import { buildMarketPolicy } from "./marketPolicyEngine.js"
import { buildScoreExplainLayer } from "../utils/buildScoreExplainLayer.js"
import { pickMetricValue } from "../utils/panicMarketActionEngine.js"

/** @typedef {"vix" | "fearGreed" | "bofa"} CoreMetricKey */

/** @typedef {{
 *   key: CoreMetricKey
 *   icon: string
 *   status: string
 *   points: number
 *   pointsText: string
 *   tone: "positive" | "neutral" | "negative"
 * }} ScoreDriverLine */

/** @typedef {{
 *   horizonId: string
 *   period: string
 *   score: number | null
 *   drivers: ScoreDriverLine[]
 * }} HorizonScoreBreakdown */

/** @typedef {{
 *   text: string
 *   tone: "positive" | "neutral" | "negative"
 * }} ActionReasonLine */

/** @typedef {{
 *   horizonBreakdowns: HorizonScoreBreakdown[]
 *   actionReasons: ActionReasonLine[]
 *   actionConclusion: string
 * }} TradingZoneMarketStateBrief */

const CORE_METRIC_KEYS = /** @type {const} */ (["vix", "fearGreed", "bofa"])

/** @type {Record<CoreMetricKey, string>} */
const CORE_LABEL = {
  vix: "VIX",
  fearGreed: "CNN",
  bofa: "BofA",
}

/** @type {Record<string, string>} */
const PERIOD_BY_HORIZON = {
  short: "단기",
  mid: "중기",
  long: "장기",
  tactical: "실전",
}

/** @type {Record<string, "short" | "mid" | "long">} */
const DRIVER_SOURCE_HORIZON = {
  short: "short",
  mid: "mid",
  long: "long",
  tactical: "mid",
}

/** @param {number} pts */
function formatPts(pts) {
  if (!Number.isFinite(pts) || pts === 0) return "0"
  return pts > 0 ? `+${pts}` : String(pts)
}

/** @param {number} pts */
function toneFromPoints(pts) {
  if (pts >= 6) return "positive"
  if (pts <= -4) return "negative"
  return "neutral"
}

/** @param {number} pts @param {"positive"|"neutral"|"negative"} tone */
function iconFromTone(pts, tone) {
  if (tone === "positive") return "🟢"
  if (tone === "negative") return "🔴"
  return "🟡"
}

/**
 * @param {import("../utils/buildScoreExplainLayer.js").ScoreExplainLayer} layer
 * @param {"short" | "mid" | "long"} horizon
 * @param {CoreMetricKey} key
 */
function pickDriver(layer, horizon, key) {
  if (!layer.ready) return null
  const block = layer.horizons.find((h) => h.horizon === horizon)
  const direct = block?.drivers.find((d) => d.key === key && !d.auxiliary)
  if (direct) return direct
  for (const fallback of ["short", "mid", "long"]) {
    if (fallback === horizon) continue
    const fb = layer.horizons.find((h) => h.horizon === fallback)
    const d = fb?.drivers.find((x) => x.key === key && !x.auxiliary)
    if (d) return d
  }
  return null
}

/**
 * @param {(typeof CORE_METRIC_KEYS)[number]} key
 * @param {object | null | undefined} panicData
 */
function fallbackStatus(key, panicData) {
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
 * @param {CoreMetricKey} key
 * @param {import("../utils/buildScoreExplainLayer.js").ScoreExplainLayer} layer
 * @param {string} horizonId
 * @param {object | null | undefined} panicData
 */
function buildCoreDriverLine(key, layer, horizonId, panicData) {
  const sourceHorizon = DRIVER_SOURCE_HORIZON[horizonId] ?? "mid"
  const driver = pickDriver(layer, sourceHorizon, key)
  const pts = driver?.points ?? 0
  const tone = toneFromPoints(pts)
  const status = driver
    ? `${driver.metricLabel} ${driver.statusShort}`
    : fallbackStatus(key, panicData)

  return {
    key,
    icon: iconFromTone(pts, tone),
    status,
    points: pts,
    pointsText: formatPts(pts),
    tone,
  }
}

/**
 * @param {import("../utils/buildScoreExplainLayer.js").ScoreExplainLayer} layer
 * @param {string} horizonId
 * @param {object | null | undefined} panicData
 */
function buildHorizonDrivers(layer, horizonId, panicData) {
  if (horizonId === "tactical") {
    return CORE_METRIC_KEYS.map((key) => buildCoreDriverLine(key, layer, "tactical", panicData))
  }
  const sourceHorizon = DRIVER_SOURCE_HORIZON[horizonId]
  if (!sourceHorizon || sourceHorizon === "tactical") {
    return CORE_METRIC_KEYS.map((key) => buildCoreDriverLine(key, layer, horizonId, panicData))
  }
  const block = layer.horizons.find((h) => h.horizon === sourceHorizon)
  const fromExplain = (block?.drivers ?? [])
    .filter((d) => !d.auxiliary)
    .slice(0, 3)
    .map((d) => {
      const tone = toneFromPoints(d.points)
      return {
        key: d.key,
        icon: iconFromTone(d.points, tone),
        status: `${d.metricLabel} ${d.statusShort}`,
        points: d.points,
        pointsText: formatPts(d.points),
        tone,
      }
    })
  if (fromExplain.length >= 2) return fromExplain
  return CORE_METRIC_KEYS.map((key) => buildCoreDriverLine(key, layer, horizonId, panicData))
}

/**
 * @param {{
 *   panicData?: object | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 *   cycleScore?: number | null
 *   cards?: { id: string; period: string; score: number | null }[]
 * }} input
 * @returns {TradingZoneMarketStateBrief}
 */
export function buildTradingZoneMarketStateBrief({
  panicData = null,
  snapshot = null,
  historyRows = [],
  cycleScore = null,
  cards = [],
}) {
  const layer = buildScoreExplainLayer({ panicData, snapshot, historyRows, cycleScore })
  const marketPolicy = buildMarketPolicy({ panicData })
  const synthesis = buildHomeV5CoreSynthesis(panicData, marketPolicy)

  const horizonIds = ["short", "mid", "long", "tactical"]
  const horizonBreakdowns = horizonIds
    .map((horizonId) => {
      const card = cards.find((c) => c.id === horizonId)
      const score = card?.score ?? layer.horizons.find((h) => h.horizon === horizonId)?.score ?? null
      if (!Number.isFinite(Number(score))) return null
      return {
        horizonId,
        period: card?.period ?? PERIOD_BY_HORIZON[horizonId] ?? horizonId,
        score: Number.isFinite(Number(score)) ? Math.round(Number(score)) : null,
        drivers: buildHorizonDrivers(layer, horizonId, panicData),
      }
    })
    .filter(Boolean)

  const actionReasons = CORE_METRIC_KEYS.map((key) => {
    const text = fallbackStatus(key, panicData)
    const tone =
      /안정|우호|우세|완화/.test(text) ? "positive" : /확대|공포|위축|과열/.test(text) ? "negative" : "neutral"
    return { text, tone }
  })

  const actionConclusion = synthesis?.headline ? `→ ${synthesis.headline}` : "→ 관망 우위"

  return {
    horizonBreakdowns,
    actionReasons,
    actionConclusion,
  }
}
