import { sourceToDataBadge } from "./deltaSemantics.js"
import { describeSourceFallback, getMetricCatalog, TIER_STATUS_METRICS } from "./metricSourceCatalog.js"

/**
 * @typedef {Object} LiveStatusRow
 * @property {string} key
 * @property {string} short
 * @property {string} label
 * @property {number} tier
 * @property {import('./deltaSemantics.js').DataSourceBadge} badge
 * @property {string} rawSource
 * @property {string|null} fallbackNote
 * @property {'SEED'|'STATIC'|'LIVE FAIL'|null} fallbackTag
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
    const rawSource = sources[entry.key] ?? "missing"
    const badge = sourceToDataBadge(rawSource)
    const fallbackNote = describeSourceFallback(rawSource, badge, liveFetchOk, entry.liveTarget)
    const fallbackTag =
      !liveFetchOk && entry.liveTarget && badge !== "LIVE"
        ? "LIVE FAIL"
        : rawSource === "macro-risk-seed.json"
          ? "SEED"
          : rawSource === "staticSeed"
            ? "STATIC"
            : null
    return {
      key: entry.key,
      short: entry.short,
      label: entry.label,
      tier: entry.tier,
      badge,
      rawSource,
      fallbackNote,
      fallbackTag,
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

/**
 * Macro Risk 페이지 상단 파이프라인 문구 (/api/market-data + LIVE 상태).
 * @param {LiveDataStatusPayload|null|undefined} payload
 */
export function formatMacroRiskPipelineSubtitle(payload) {
  if (!payload) return "클라이언트 계산 · /api/market-data · —"
  const rows = [...payload.tier1, ...payload.tier2]
  /** @type {Record<string, LiveStatusRow>} */
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))

  let apiClean = true
  for (const m of TIER_STATUS_METRICS) {
    if (!m.liveTarget) continue
    const r = byKey[m.key]
    if (!r || r.badge !== "LIVE" || r.fallbackTag) {
      apiClean = false
      break
    }
  }

  const hasCycleManual = rows.some((r) => {
    const c = getMetricCatalog(r.key)
    return Boolean(c?.cycleReuse && r.badge === "MANUAL")
  })

  let tail = "—"
  if (!payload.liveFetchOk || !apiClean) {
    tail = "LIVE FAIL"
  } else {
    tail = hasCycleManual ? "LIVE + MANUAL" : "LIVE SNAPSHOT"
  }

  return `클라이언트 계산 · /api/market-data · ${tail}`
}
