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
    case "highYield":
      return toNum(data.highYield ?? data.hyOas ?? data.hy_oas)
    case "gsBullBear":
      return toNum(data.gsBullBear ?? data.gsSentiment ?? data.gs_sentiment ?? data.gs)
    default:
      return toNum(data[key])
  }
}

/**
 * @typedef {{
 *   key: string
 *   label: string
 *   shortLabel: string
 *   group: "core" | "expert"
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
  let coreContribution = 0
  let expertContribution = 0

  for (const def of PANIC_V2_METRICS) {
    const raw = pickPanicV2Raw(data, def.key)
    const normalized = normalizePanicV2Metric(def.key, raw)
    const missing = normalized == null
    const contribution = missing ? 0 : (normalized * def.weight) / 100
    const roundedContribution = Math.round(contribution * 10) / 10

    if (!missing) {
      scoreSum += contribution
      weightUsed += def.weight
      if (def.group === "core") coreContribution += contribution
      else expertContribution += contribution
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

  const legacyScore =
    includeLegacy && data && typeof data === "object" ? getFinalScore(data) : null

  return {
    version: 2,
    score,
    coreContribution: Math.round(coreContribution * 10) / 10,
    expertContribution: Math.round(expertContribution * 10) / 10,
    weightUsed,
    weightTotal,
    completenessPct,
    status: resolvePanicV2Status(score),
    metrics,
    legacyScore: legacyScore != null ? Math.round(legacyScore) : null,
    incomplete,
  }
}

/** @param {PanicV2Result | null | undefined} result @param {"core" | "expert"} group */
export function panicV2MetricsByGroup(result, group) {
  if (!result?.metrics) return []
  return result.metrics.filter((m) => m.group === group && !m.missing)
}
