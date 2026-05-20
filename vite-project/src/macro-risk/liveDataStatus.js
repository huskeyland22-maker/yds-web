import { sourceToDataBadge } from "./deltaSemantics.js"
import { describeSourceFallback, TIER_STATUS_METRICS } from "./metricSourceCatalog.js"

/**
 * @typedef {Object} LiveStatusRow
 * @property {string} key
 * @property {string} short
 * @property {string} label
 * @property {number} tier
 * @property {import('./deltaSemantics.js').DataSourceBadge} badge
 * @property {string} rawSource
 * @property {string|null} fallbackNote
 */

/**
 * @typedef {Object} LiveDataStatusPayload
 * @property {boolean} liveFetchOk
 * @property {string|null} lastUpdate
 * @property {string|null} lastUpdateDisplay
 * @property {LiveStatusRow[]} tier1
 * @property {LiveStatusRow[]} tier2
 */

/**
 * @param {string|null|undefined} iso
 */
export function formatLastUpdateDisplay(iso) {
  if (!iso || typeof iso !== "string") return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {Record<string, string>} sources
 * @param {{ liveFetchOk?: boolean; updatedAt?: string|null }} meta
 * @returns {LiveDataStatusPayload}
 */
export function buildLiveDataStatus(sources = {}, meta = {}) {
  const liveFetchOk = Boolean(meta.liveFetchOk)
  const lastUpdate = meta.updatedAt ?? null

  const mapRow = (entry) => {
    const rawSource = sources[entry.key] ?? "staticSeed"
    const badge = sourceToDataBadge(rawSource)
    const fallbackNote = describeSourceFallback(rawSource, badge, liveFetchOk, entry.liveTarget)
    return {
      key: entry.key,
      short: entry.short,
      label: entry.label,
      tier: entry.tier,
      badge,
      rawSource,
      fallbackNote,
    }
  }

  const tier1 = TIER_STATUS_METRICS.filter((m) => m.tier === 1).map(mapRow)
  const tier2 = TIER_STATUS_METRICS.filter((m) => m.tier === 2).map(mapRow)

  return {
    liveFetchOk,
    lastUpdate,
    lastUpdateDisplay: formatLastUpdateDisplay(lastUpdate),
    tier1,
    tier2,
  }
}
