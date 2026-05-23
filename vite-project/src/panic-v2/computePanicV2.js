import { getFinalScore } from "../utils/tradingScores.js"
import { normalizePanicV2Metric } from "./normalizeMetrics.js"
import { resolvePanicV2Status } from "./panicV2Status.js"
import { PANIC_V2_METRICS } from "./weights.js"

/** @param {unknown} x */
function toNum(x) {
  if (x == null || x === "") return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {object | null | undefined} data
 * @param {string} key
 */
export function pickPanicV2Raw(data, key) {
  if (!data || typeof data !== "object") return null
  switch (key) {
    case "vixTerm":
      return toNum(data.vixTerm ?? data.vix_term)
    case "ndxDistance":
      return toNum(data.ndxDistance ?? data.ndx_distance)
    case "soxxDistance":
      return toNum(data.soxxDistance ?? data.soxx_distance)
    case "vvix":
      return toNum(data.vvix)
    case "dxy":
      return toNum(data.dxy)
    default:
      return toNum(data[key])
  }
}

function logPracticalDebug(data, score) {
  if (typeof console === "undefined") return
  console.log("[패닉V2 실전]", {
    score,
    vix: pickPanicV2Raw(data, "vix"),
    vvix: pickPanicV2Raw(data, "vvix"),
    term: pickPanicV2Raw(data, "vixTerm"),
    pc: pickPanicV2Raw(data, "putCall"),
    ndxDist: pickPanicV2Raw(data, "ndxDistance"),
    soxxDist: pickPanicV2Raw(data, "soxxDistance"),
    dxy: pickPanicV2Raw(data, "dxy"),
    move: pickPanicV2Raw(data, "move"),
  })
}

/**
 * @typedef {{
 *   key: string
 *   label: string
 *   shortLabel: string
 *   group: string
 *   weight: number
 *   raw: number | null
 *   normalized: number | null
 *   contribution: number
 *   contributionLabel: string
 *   missing: boolean
 * }} PanicV2MetricBreakdown
 */

/**
 * @typedef {{
 *   version: 2
 *   score: number | null
 *   coreContribution: number
 *   expertContribution: number
 *   weightUsed: number
 *   weightTotal: number
 *   completenessPct: number
 *   status: ReturnType<typeof resolvePanicV2Status>
 *   metrics: PanicV2MetricBreakdown[]
 *   legacyScore: number | null
 *   incomplete: boolean
 * }} PanicV2Result
 */

/**
 * @param {object | null | undefined} data
 * @param {{ includeLegacy?: boolean }} [opts]
 * @returns {PanicV2Result}
 */
export function computePanicV2(data, opts = {}) {
  const includeLegacy = opts.includeLegacy !== false

  /** @type {PanicV2MetricBreakdown[]} */
  const metrics = []
  let scoreSum = 0
  let weightUsed = 0
  let volContribution = 0
  let otherContribution = 0

  for (const def of PANIC_V2_METRICS) {
    const raw = pickPanicV2Raw(data, def.key)
    let normalized = normalizePanicV2Metric(def.key, raw)
    const missing = normalized == null

    if (!missing && def.key === "putCall") {
      const vix = pickPanicV2Raw(data, "vix")
      if (vix != null && vix >= 22) {
        normalized = Math.min(100, normalized * 1.08)
      }
    }

    const contribution = missing ? 0 : (normalized * def.weight) / 100
    const roundedContribution = Math.round(contribution * 10) / 10

    if (!missing) {
      scoreSum += contribution
      weightUsed += def.weight
      if (def.group === "volatility") volContribution += contribution
      else otherContribution += contribution
    }

    metrics.push({
      key: def.key,
      label: def.label,
      shortLabel: def.shortLabel,
      group: def.group,
      weight: def.weight,
      raw,
      normalized: missing ? null : Math.round(normalized * 10) / 10,
      contribution: roundedContribution,
      contributionLabel: missing ? "—" : `+${Math.round(roundedContribution)}`,
      missing,
    })
  }

  const weightTotal = PANIC_V2_METRICS.reduce((s, m) => s + m.weight, 0)
  const completenessPct = Math.round((weightUsed / weightTotal) * 100)
  const incomplete = weightUsed < weightTotal * 0.5

  let score = null
  if (weightUsed > 0) {
    score = Math.round(scoreSum)
    score = Math.max(0, Math.min(100, score))
  }

  logPracticalDebug(data, score)

  const legacyScore =
    includeLegacy && data && typeof data === "object" ? getFinalScore(data) : null

  return {
    version: 2,
    score,
    coreContribution: Math.round((volContribution + (metrics.find((m) => m.key === "putCall")?.contribution ?? 0)) * 10) / 10,
    expertContribution: Math.round(otherContribution * 10) / 10,
    weightUsed,
    weightTotal,
    completenessPct,
    status: resolvePanicV2Status(score),
    metrics,
    legacyScore: legacyScore != null ? Math.round(legacyScore) : null,
    incomplete,
  }
}

/** @param {PanicV2Result | null | undefined} result @param {string} group */
export function panicV2MetricsByGroup(result, group) {
  if (!result?.metrics) return []
  return result.metrics.filter((m) => m.group === group && !m.missing)
}
