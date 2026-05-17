/**
 * Recharts Y축·라인 시각 프로필 (지표별 padding / tick / 강조)
 * @typedef {{
 *   padding: number
 *   tickCount?: number
 *   tickDecimals?: number
 *   strokeWidth?: number
 *   activeDotR?: number
 *   narrowRange?: boolean
 *   showArea?: boolean
 * }} ChartMetricProfile
 */

/** @type {Record<string, ChartMetricProfile>} */
export const chartProfiles = {
  putCall: {
    padding: 0.03,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 2,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  highYield: {
    padding: 0.08,
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
    padding: 0.4,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 2,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  vix: {
    padding: 0.3,
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
    padding: 5,
    tickCount: 5,
    tickDecimals: 0,
    strokeWidth: 3,
    activeDotR: 5,
  },
  move: {
    padding: 5,
    tickCount: 5,
    tickDecimals: 0,
    strokeWidth: 3,
    activeDotR: 5,
  },
  skew: {
    padding: 4,
    narrowRange: true,
    tickCount: 6,
    tickDecimals: 0,
    strokeWidth: 3.5,
    activeDotR: 6,
    showArea: true,
  },
  gsBullBear: {
    padding: 5,
    tickCount: 5,
    tickDecimals: 0,
    strokeWidth: 3,
    activeDotR: 5,
  },
}

const DEFAULT_PROFILE = {
  padding: 0.3,
  tickCount: 5,
  tickDecimals: 2,
  strokeWidth: 3,
  activeDotR: 5,
  narrowRange: false,
  showArea: false,
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

/**
 * @param {number[]} values
 * @param {ChartMetricProfile} profile
 * @returns {[number, number] | null}
 */
export function computeProfileYDomain(values, profile) {
  if (!values?.length) return null
  const { padding, tickDecimals = 2 } = profile
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lo = min - padding
  const hi = max + padding
  if (tickDecimals <= 0) {
    return [Math.floor(lo), Math.ceil(hi)]
  }
  return [Number(lo.toFixed(tickDecimals)), Number(hi.toFixed(tickDecimals))]
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
