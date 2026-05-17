/**
 * Recharts Y축·라인 시각 프로필 (지표별 padding / tick / 강조)
 * @typedef {{
 *   padding?: number
 *   paddingRatio?: number
 *   paddingMin?: number
 *   tickCount?: number
 *   tickDecimals?: number
 *   strokeWidth?: number
 *   activeDotR?: number
 *   narrowRange?: boolean
 *   showArea?: boolean
 * }} ChartMetricProfile

/**
 * @typedef {{
 *   mode: "auto" | "fixed"
 *   paddingRatio?: number
 *   paddingMin?: number
 *   fixed?: [number, number]
 * }} YDomainConfig
 */

/** @type {Record<string, ChartMetricProfile>} */
export const chartProfiles = {
  putCall: {
    paddingRatio: 0.08,
    paddingMin: 0.02,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 2,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  highYield: {
    paddingRatio: 0.08,
    paddingMin: 0.08,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 2,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  hyOas: {
    padding: 0.08,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 2,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  bofa: {
    paddingRatio: 0.08,
    paddingMin: 0.25,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 2,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  vix: {
    paddingRatio: 0.08,
    paddingMin: 0.25,
    tickCount: 5,
    tickDecimals: 1,
    strokeWidth: 3,
    activeDotR: 5,
  },
  vxn: {
    padding: 0.3,
    tickCount: 5,
    tickDecimals: 1,
    strokeWidth: 3,
    activeDotR: 5,
  },
  fearGreed: {
    paddingRatio: 0.05,
    paddingMin: 2,
    tickCount: 5,
    tickDecimals: 0,
    strokeWidth: 3,
    activeDotR: 5,
  },
  move: {
    paddingRatio: 0.08,
    paddingMin: 3,
    tickCount: 5,
    tickDecimals: 0,
    strokeWidth: 3,
    activeDotR: 5,
  },
  skew: {
    paddingRatio: 0.08,
    paddingMin: 2,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 0,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  gsBullBear: {
    paddingRatio: 0.05,
    paddingMin: 2,
    tickCount: 5,
    tickDecimals: 0,
    strokeWidth: 3,
    activeDotR: 5,
  },
}

const DEFAULT_PROFILE = {
  paddingRatio: 0.08,
  paddingMin: 0.1,
  tickCount: 5,
  tickDecimals: 2,
  strokeWidth: 3,
  activeDotR: 5,
  narrowRange: false,
  showArea: false,
}

/** @type {Record<string, YDomainConfig>} */
export const yDomainConfigs = {
  vix: { mode: "auto", paddingRatio: 0.08, paddingMin: 0.2 },
  vxn: { mode: "auto", paddingRatio: 0.08, paddingMin: 0.2 },
  putCall: { mode: "auto", paddingRatio: 0.08, paddingMin: 0.02, fixed: [0.4, 0.8] },
  bofa: { mode: "auto", paddingRatio: 0.08, paddingMin: 0.25, fixed: [0, 10] },
  fearGreed: { mode: "fixed", fixed: [0, 100] },
  highYield: { mode: "auto", paddingRatio: 0.08, paddingMin: 0.08, fixed: [1, 5] },
  hyOas: { mode: "auto", paddingRatio: 0.08, paddingMin: 0.08, fixed: [1, 5] },
  move: { mode: "auto", paddingRatio: 0.08, paddingMin: 3, fixed: [50, 200] },
  skew: { mode: "auto", paddingRatio: 0.08, paddingMin: 2, fixed: [100, 180] },
  gsBullBear: { mode: "fixed", fixed: [0, 100] },
}

/** @param {string} metricKey */
export function resolveChartProfile(metricKey) {
  const key = metricKey === "hyOas" ? "highYield" : metricKey
  return { ...DEFAULT_PROFILE, ...(chartProfiles[key] ?? {}) }
}

/** @param {object[]} chartData @param {string} dataKey */
export function extractChartValues(chartData, dataKey) {
  return chartData
    .map((d) => d[dataKey])
    .filter((v) => v != null && Number.isFinite(Number(v)))
    .map(Number)
}

function normalizeMetricKey(metricKey) {
  return metricKey === "hyOas" ? "highYield" : metricKey
}

/**
 * @param {number[]} values
 * @param {{ paddingRatio?: number; paddingMin?: number; tickDecimals?: number }} opts
 * @returns {{ lo: number; hi: number }}
 */
function autoDomainFromValues(values, opts = {}) {
  const { paddingRatio = 0.08, paddingMin = 0.1, tickDecimals = 2 } = opts
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, Number.EPSILON)
  const pad = Math.max(span * paddingRatio, paddingMin)
  let lo = min - pad
  let hi = max + pad
  if (span < pad * 0.5) {
    const mid = (min + max) / 2
    lo = mid - pad
    hi = mid + pad
  }
  if (tickDecimals <= 0) {
    return { lo: Math.floor(lo), hi: Math.ceil(hi) }
  }
  const factor = 10 ** tickDecimals
  return {
    lo: Math.floor(lo * factor) / factor,
    hi: Math.ceil(hi * factor) / factor,
  }
}

/**
 * 데이터가 fixed 안에 있으면 auto 유지, 밖이면 fixed로 확장
 * @param {number} lo
 * @param {number} hi
 * @param {[number, number]} fixed
 * @param {number[]} values
 */
function mergeWithFixedBounds(lo, hi, fixed, values) {
  const [fMin, fMax] = fixed
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const inside = dataMin >= fMin && dataMax <= fMax
  if (inside) return [lo, hi]
  return [Math.min(lo, fMin), Math.max(hi, fMax)]
}

/**
 * @param {number[]} values
 * @param {string} metricKey
 * @param {{ showZoneBands?: boolean }} [options]
 * @returns {[number, number] | null}
 */
export function computeHistoryYDomain(values, metricKey, options = {}) {
  if (!values?.length) return null
  const key = normalizeMetricKey(metricKey)
  const profile = resolveChartProfile(key)
  const cfg = yDomainConfigs[key] ?? { mode: "auto", paddingRatio: 0.08, paddingMin: 0.1 }
  const tickDecimals = profile.tickDecimals ?? 2

  if (options.showZoneBands && key === "fearGreed") {
    return [0, 100]
  }

  if (cfg.mode === "fixed" && cfg.fixed) {
    return cfg.fixed
  }

  const { lo, hi } = autoDomainFromValues(values, {
    paddingRatio: cfg.paddingRatio ?? profile.paddingRatio ?? 0.08,
    paddingMin: cfg.paddingMin ?? profile.paddingMin ?? 0.1,
    tickDecimals,
  })

  if (cfg.fixed) {
    return mergeWithFixedBounds(lo, hi, cfg.fixed, values)
  }

  return [lo, hi]
}

/**
 * @param {number[]} values
 * @param {ChartMetricProfile} profile
 * @returns {[number, number] | null}
 */
export function computeProfileYDomain(values, profile) {
  if (!values?.length) return null
  const tickDecimals = profile.tickDecimals ?? 2
  const paddingRatio = profile.paddingRatio ?? (profile.padding != null && profile.padding < 1 ? profile.padding : 0.08)
  const paddingMin =
    profile.paddingMin ?? (profile.padding != null && profile.padding >= 1 ? profile.padding : 0.1)
  const { lo, hi } = autoDomainFromValues(values, { paddingRatio, paddingMin, tickDecimals })
  return [lo, hi]
}

/** @param {ChartMetricProfile} profile */
export function yAxisTickFormatter(profile) {
  const decimals = profile.tickDecimals ?? 2
  return (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return "—"
    if (decimals <= 0) return String(Math.round(n))
    return n.toFixed(decimals)
  }
}
