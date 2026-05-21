/**
 * 델타 단위 자동 판별·오류 검사 (표시·DEV 검증용, 데이터 파이프라인 불변).
 * @typedef {'absolute'|'percent'|'bps'|'percent_suspect'} DeltaMethod
 */

/** @type {Record<string, { max1D: number; max5D: number; max20D: number; kind: 'rate'|'index'|'level' }>} */
const METRIC_LIMITS = {
  US10Y: { max1D: 0.15, max5D: 0.35, max20D: 0.65, kind: "rate" },
  US2Y: { max1D: 0.2, max5D: 0.45, max20D: 0.85, kind: "rate" },
  US30Y: { max1D: 0.15, max5D: 0.35, max20D: 0.55, kind: "rate" },
  REAL_YIELD: { max1D: 0.12, max5D: 0.25, max20D: 0.45, kind: "rate" },
  BEI: { max1D: 0.1, max5D: 0.2, max20D: 0.35, kind: "rate" },
  MOVE: { max1D: 8, max5D: 18, max20D: 28, kind: "index" },
  DXY: { max1D: 1.2, max5D: 2.5, max20D: 4.5, kind: "level" },
  VXN: { max1D: 3, max5D: 6, max20D: 12, kind: "index" },
  /** 장단기 금리차(10Y−2Y) 변화 — 스프레드 pp 단위 */
  YIELD_SPREAD: { max1D: 0.15, max5D: 0.35, max20D: 0.65, kind: "rate" },
}

/** @typedef {'MANUAL'|'LIVE'|'MOCK'|'STATIC'} DataSourceBadge */

/**
 * @param {string} source
 * @returns {DataSourceBadge}
 */
export function sourceToDataBadge(source) {
  if (source === "cycle-manual") return "MANUAL"
  if (source === "fred-h15") return "LIVE"
  if (source === "market-data" || source === "market-data+panic") return "LIVE"
  if (source === "macro-risk-seed.json") return "MOCK"
  if (source === "staticSeed") return "STATIC"
  if (source === "missing") return "MOCK"
  return "MOCK"
}

/**
 * @param {string} key
 * @param {number|null} current
 * @param {number|null} delta
 * @param {'1D'|'5D'|'20D'} horizon
 * @returns {DeltaMethod}
 */
export function inferDeltaMethod(key, current, delta, horizon = "20D") {
  if (delta == null || !Number.isFinite(Number(delta))) return "absolute"
  const lim = METRIC_LIMITS[key]
  const abs = Math.abs(Number(delta))
  const cur = Number(current)
  if (!lim) return "absolute"

  if (lim.kind === "rate") {
    if (abs > 2.5) return "percent_suspect"
    if (abs > lim.max20D * 1.8 && horizon === "20D") return "percent_suspect"
    return "absolute"
  }

  if (lim.kind === "index" || lim.kind === "level") {
    if (Number.isFinite(cur) && abs > Math.max(lim.max20D * 2, cur * 0.15)) return "percent_suspect"
    return "absolute"
  }

  return "absolute"
}

/**
 * @param {string} key
 * @param {number|null} current
 * @param {number|null} delta
 * @param {'1D'|'5D'|'20D'} horizon
 */
export function auditDelta(key, current, delta, horizon) {
  const lim = METRIC_LIMITS[key]
  if (!lim || delta == null || !Number.isFinite(Number(delta))) return null
  const h = horizon === "1D" ? "max1D" : horizon === "5D" ? "max5D" : "max20D"
  const max = lim[h]
  const abs = Math.abs(Number(delta))
  if (abs <= max) return { ok: true, method: inferDeltaMethod(key, current, delta, horizon) }

  const method = inferDeltaMethod(key, current, delta, horizon)
  return {
    ok: false,
    method,
    warning: `${horizon} Δ ${abs.toFixed(2)} — 한도 ${max} 초과 (${method === "percent_suspect" ? "percent 혼입 의심" : "absolute 기대"})`,
  }
}

/**
 * @param {number|null} delta
 * @param {DeltaMethod} method
 * @param {import('./displayMetrics.js').MetricFormat} format
 */
export function formatDeltaByMethod(delta, method, format = "rate") {
  if (delta == null || !Number.isFinite(Number(delta))) return "—"
  const n = Number(delta)
  const sign = n > 0 ? "+" : ""
  if (method === "bps") return `${sign}${(n * 100).toFixed(0)}bp`
  if (method === "percent") return `${sign}${n.toFixed(2)}%`
  if (format === "level" || format === "index") return `${sign}${n.toFixed(2)}`
  return `${sign}${n.toFixed(2)}`
}
