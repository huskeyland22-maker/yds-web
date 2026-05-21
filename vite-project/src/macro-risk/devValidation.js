import { auditDelta, inferDeltaMethod, sourceToDataBadge } from "./deltaSemantics.js"
import { formatLastUpdateDisplay } from "./liveDataStatus.js"
import { classifyMetric } from "./normalizeLayer.js"
import { describeSourceFallback, getMetricCatalog, TIER_STATUS_METRICS } from "./metricSourceCatalog.js"

/**
 * DEV ONLY — 데이터 패널용 (SHOW_DEBUG + isDevMode).
 * @typedef {Object} DevValidationPayload
 * @property {DevRow[]} rows
 * @property {{ live: number; manual: number; seed: number; total: number; error: number }} dataHealth
 * @property {RealBeiAudit|null} realBei
 * @property {YieldSpreadDev|null} yieldSpread
 */

/**
 * @typedef {Object} DevRow
 * @property {string} key
 * @property {string} label
 * @property {'MANUAL'|'LIVE'|'MOCK'|'STATIC'} dataBadge
 * @property {'MANUAL'|'LIVE'|'MOCK'|'STATIC'} source
 * @property {string} rawWire
 * @property {string} provider
 * @property {string} series
 * @property {string|null} lastUpdate
 * @property {string|null} fallbackNote
 * @property {string} originDetail
 * @property {string} [typeNote]
 * @property {number|null} current
 * @property {number|null} raw
 * @property {number|null} previous1D
 * @property {number|null} previous5D
 * @property {number|null} previous20D
 * @property {string|null} delta20DLine
 * @property {string} normalizeType
 * @property {string} normalizeMethod
 * @property {string} method20D
 * @property {string} deltaSummary
 * @property {string|null} warning
 * @property {boolean} seed
 * @property {boolean} fallback
 * @property {'SEED'|'STATIC'|'LIVE FAIL'|null} fallbackTag
 * @property {number|null} usedValue
 */

/**
 * @typedef {Object} RealBeiAudit
 * @property {number|null} correlation
 * @property {boolean} sameSource
 * @property {boolean} mockReuse
 */

/**
 * @typedef {Object} YieldSpreadDev
 * @property {string} currentLabel
 * @property {string} rawParts
 * @property {number|null} spread
 * @property {number|null} delta5D
 * @property {number|null} delta20D
 * @property {string} method5D
 * @property {string} method20D
 */

/** @type {Record<string, string>} */
const DEV_LABEL = {
  US10Y: "10년물 국채금리 (US10Y)",
  US2Y: "2년물 국채금리 (US2Y)",
  US30Y: "30년물 국채금리 (US30Y)",
  REAL_YIELD: "실질금리 (REAL)",
  BEI: "기대인플레이션 (BEI)",
  MOVE: "채권 변동성 (MOVE)",
  DXY: "달러지수 (DXY)",
  VXN: "나스닥 변동성 (VXN)",
  CPI: "CPI",
  CORE_CPI: "CORE CPI",
  PCE: "PCE",
  QT: "QT",
  M2: "M2",
  FED_BALANCE: "연준 잔고",
}

/**
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {Record<string, string>} [sources]
 * @param {Record<string, number[]>} [apiHistory]
 * @param {import('./yieldCurve.js').ReturnType<import('./yieldCurve.js').buildYieldCurve>} [yieldCurve]
 * @param {object|null} [panicContext]
 * @param {{ liveFetchOk?: boolean; updatedAt?: string|null }} [meta]
 * @returns {DevValidationPayload}
 */
export function buildDevValidation(
  raw,
  sources = {},
  apiHistory = {},
  yieldCurve = null,
  panicContext = null,
  meta = {},
) {
  const liveFetchOk = Boolean(meta.liveFetchOk)
  const lastUpdate = formatLastUpdateDisplay(meta.updatedAt)

  /** @type {DevRow[]} */
  const rows = TIER_STATUS_METRICS.map((cat) => buildTierDevRow(cat.key, raw, sources, panicContext, liveFetchOk, lastUpdate)).filter(
    Boolean,
  )
  const realBei = auditRealVsBei(raw, sources, apiHistory)
  const dataHealth = buildDataHealth(rows, realBei)

  return {
    rows,
    dataHealth,
    realBei,
    yieldSpread: buildYieldSpreadDevBlock(yieldCurve, raw),
  }
}

/**
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {Record<string, string>} sources
 * @param {Record<string, number[]>} apiHistory
 * @returns {RealBeiAudit|null}
 */
function auditRealVsBei(raw, sources, apiHistory) {
  const rr = raw.REAL_YIELD?.current
  const br = raw.BEI?.current
  if (!Number.isFinite(Number(rr)) || !Number.isFinite(Number(br))) return null

  const ra = apiHistory.REAL_YIELD ?? []
  const be = apiHistory.BEI ?? []
  const correlation = pearsonLastAligned(ra, be)

  const sr = sources.REAL_YIELD ?? ""
  const sb = sources.BEI ?? ""
  const sameSource = sr.length > 0 && sr === sb

  const equalSpot = Math.abs(Number(rr) - Number(br)) < 1e-5
  const mockReuse =
    equalSpot &&
    (sr === "staticSeed" ||
      sb === "staticSeed" ||
      sr === "macro-risk-seed.json" ||
      sb === "macro-risk-seed.json")

  return {
    correlation,
    sameSource,
    mockReuse,
  }
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number|null}
 */
function pearsonLastAligned(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null
  const n = Math.min(a.length, b.length)
  if (n < 5) return null
  const win = Math.min(22, n)
  const xs = a.slice(-win).map(Number)
  const ys = b.slice(-win).map(Number)
  if (xs.length !== ys.length || xs.length < 5) return null
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i += 1) {
    const vx = xs[i] - mx
    const vy = ys[i] - my
    num += vx * vy
    dx += vx * vx
    dy += vy * vy
  }
  const den = Math.sqrt(dx * dy)
  if (den < 1e-12) return null
  const r = num / den
  return Number.isFinite(r) ? Number(r.toFixed(4)) : null
}

/** @param {number[]} arr */
function mean(arr) {
  let s = 0
  let c = 0
  for (const v of arr) {
    if (Number.isFinite(v)) {
      s += v
      c += 1
    }
  }
  return c ? s / c : 0
}

/**
 * @param {import('./yieldCurve.js').ReturnType<import('./yieldCurve.js').buildYieldCurve>} curve
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @returns {YieldSpreadDev|null}
 */
function buildYieldSpreadDevBlock(curve, raw) {
  if (!curve || !raw.US10Y || !raw.US2Y) return null
  const y10 = raw.US10Y.current
  const y2 = raw.US2Y.current
  if (!Number.isFinite(Number(y10)) || !Number.isFinite(Number(y2))) return null

  const method5 = inferDeltaMethod("YIELD_SPREAD", curve.spread, curve.change5D, "5D")
  const method20 = inferDeltaMethod("YIELD_SPREAD", curve.spread, curve.change20D, "20D")

  return {
    currentLabel: "10Y − 2Y",
    rawParts: `${Number(y10).toFixed(2)} − ${Number(y2).toFixed(2)}`,
    spread: curve.spread,
    delta5D: curve.change5D,
    delta20D: curve.change20D,
    method5D:
      curve.change5D == null ? "—" : method5 === "percent_suspect" ? `${method5} ⚠` : method5,
    method20D:
      curve.change20D == null ? "—" : method20 === "percent_suspect" ? `${method20} ⚠` : method20,
  }
}

/**
 * @param {string} source
 */
/**
 * @param {string} key
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 * @param {Record<string, string>} sources
 * @param {object|null} panicContext
 * @param {boolean} liveFetchOk
 * @param {string|null} lastUpdate
 * @returns {DevRow|null}
 */
function buildTierDevRow(key, raw, sources, panicContext, liveFetchOk, lastUpdate) {
  const cat = getMetricCatalog(key)
  if (!cat) return null

  let series = raw[key]
  if (!series && key === "VXN" && Number.isFinite(Number(panicContext?.vxn))) {
    const v = Number(panicContext.vxn)
    series = {
      key: "VXN",
      current: v,
      previous1D: null,
      previous5D: null,
      previous20D: null,
      change1D: null,
      change5D: null,
      change20D: null,
      slope: "flat",
      status: "—",
    }
  }
  if (!series) return null

  const rawSource = sources[key] ?? "missing"
  const dataBadge = sourceToDataBadge(rawSource)
  const fallbackNote = describeSourceFallback(rawSource, dataBadge, liveFetchOk, cat.liveTarget)
  const fallbackTag =
    !liveFetchOk && cat.liveTarget && dataBadge !== "LIVE"
      ? "LIVE FAIL"
      : rawSource === "macro-risk-seed.json"
        ? "SEED"
        : rawSource === "staticSeed"
          ? "STATIC"
          : null
  const cls = classifyMetric(key)
  const method20 = inferDeltaMethod(key, series.current, series.change20D, "20D")
  const audit20 = auditDelta(key, series.current, series.change20D, "20D")
  const deltaStr = formatDeltaLine(key, series, method20)
  const delta20Str = formatDelta20Only(key, series, method20)
  const typeNote = key === "DXY" ? "type=index (percent 제거)" : cat.cycleReuse ? "cycle reuse" : null

  return {
    key,
    label: cat.label,
    provider: cat.provider,
    series: cat.series,
    lastUpdate,
    dataBadge,
    source: dataBadge,
    rawWire: rawSource,
    fallbackNote,
    originDetail: mapOriginDetail(rawSource),
    typeNote,
    current: series.current,
    raw: series.current,
    previous1D: series.previous1D ?? null,
    previous5D: series.previous5D ?? null,
    previous20D: series.previous20D ?? null,
    delta20DLine: delta20Str,
    normalizeType: cls.type,
    normalizeMethod: cls.method,
    method20D: audit20?.ok === false ? `${method20} ⚠` : method20,
    deltaSummary: deltaStr,
    warning:
      audit20?.ok === false
        ? audit20.warning
        : key === "VXN" && series.change5D == null
          ? "히스토리 없음 — 상승 표시 생략"
          : null,
    seed: rawSource === "macro-risk-seed.json" || rawSource === "staticSeed",
    fallback: Boolean(fallbackTag || fallbackNote),
    fallbackTag,
    usedValue: Number.isFinite(Number(series.current)) ? Number(series.current) : null,
  }
}

/**
 * @param {DevRow[]} rows
 * @param {RealBeiAudit|null} realBei
 */
function buildDataHealth(rows, realBei) {
  let live = 0
  let manual = 0
  let seed = 0
  let error = 0
  for (const r of rows) {
    if (r.dataBadge === "LIVE") live += 1
    else if (r.dataBadge === "MANUAL") manual += 1
    else if (r.dataBadge === "MOCK" || r.dataBadge === "STATIC") seed += 1
    if (r.warning) error += 1
    if (r.key === "DXY" && String(r.normalizeMethod) !== "index") error += 1
    if (r.fallbackTag === "LIVE FAIL") error += 1
  }
  if (realBei?.mockReuse) error += 1
  return {
    live,
    manual,
    seed,
    total: rows.length,
    error,
  }
}

function mapOriginDetail(source) {
  if (source === "cycle-manual") return "cycle manual (source of truth)"
  if (source === "fred-h15") return "FRED H.15"
  if (source === "market-data") return "/api/market-data (DXY)"
  if (source === "macro-risk-seed.json") return "macro-risk-seed.json"
  if (source === "market-data+panic") return "market-data"
  if (source === "missing") return "—"
  return "staticSeed"
}

/**
 * @param {string} key
 * @param {import('./rawLayer.js').MetricSeries} series
 * @param {string} method20
 */
function formatDelta20Only(key, series, method20) {
  if (series.change20D == null || !Number.isFinite(Number(series.change20D))) return null
  return `delta20D=${fmtSigned(series.change20D, method20, key)}`
}

function formatDeltaLine(key, series, method20) {
  const parts = []
  if (series.change1D != null) {
    const m = inferDeltaMethod(key, series.current, series.change1D, "1D")
    parts.push(`1D ${fmtSigned(series.change1D, m, key)}`)
  }
  if (series.change5D != null) {
    const m = inferDeltaMethod(key, series.current, series.change5D, "5D")
    parts.push(`5D ${fmtSigned(series.change5D, m, key)}`)
  }
  if (series.change20D != null) {
    parts.push(`20D ${fmtSigned(series.change20D, method20, key)}`)
  }
  return parts.join(" · ") || "—"
}

function fmtSigned(v, method, key) {
  const n = Number(v)
  const sign = n > 0 ? "+" : ""
  if (method === "percent_suspect") return `${sign}${n.toFixed(2)} (percent?)`
  if (key === "DXY" || key === "MOVE" || key === "VXN") return `${sign}${n.toFixed(2)}`
  return `${sign}${n.toFixed(2)}`
}
