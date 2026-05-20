import { slopeArrow } from "./seriesMath.js"

/**
 * @typedef {import('./rawLayer.js').MetricSeries} MetricSeries
 * @typedef {'rate'|'index'|'pct'|'level'} MetricFormat
 * @typedef {Object} MetricDisplayRow
 * @property {string} key
 * @property {string} label
 * @property {number|null} current
 * @property {number|null} change1D
 * @property {number|null} change5D
 * @property {number|null} change20D
 * @property {'up'|'down'|'flat'} slope
 * @property {MetricFormat} format
 * @property {number} [tier]
 * @property {string} [category]
 * @property {boolean} [hide1D]
 * @property {string} [tooltip]
 * @property {'LIVE'|'MOCK'|'STATIC'} [dataBadge]
 * @property {boolean} [deltaHorizonNA] — 5D·20D 미산출 시 N/A 및 추세 화살표 생략(VXN 등)
 */

/**
 * @param {MetricSeries | undefined} series
 * @param {string} label
 * @param {{ format?: MetricFormat; tier?: number; category?: string; hide1D?: boolean; tooltip?: string; dataBadge?: 'LIVE'|'MOCK'|'STATIC'; deltaHorizonNA?: boolean }} [opts]
 * @returns {MetricDisplayRow}
 */
export function buildMetricRow(series, label, opts = {}) {
  return {
    key: series?.key ?? label,
    label,
    tooltip: opts.tooltip,
    current: series?.current ?? null,
    change1D: series?.change1D ?? null,
    change5D: series?.change5D ?? null,
    change20D: series?.change20D ?? null,
    slope: series?.slope ?? "flat",
    format: opts.format ?? "rate",
    tier: opts.tier,
    category: opts.category,
    hide1D: opts.hide1D ?? false,
    dataBadge: opts.dataBadge,
    deltaHorizonNA: opts.deltaHorizonNA ?? false,
  }
}

/**
 * @param {number|null} v
 * @param {MetricFormat} format
 * @param {number|null} [base] current for pct
 */
export function formatDelta(v, format, base = null) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  const sign = n > 0 ? "+" : ""
  if (format === "pct") {
    const pct = base != null && base !== 0 ? (n / base) * 100 : n
    return `${sign}${pct.toFixed(1)}%`
  }
  if (format === "level" || format === "index") return `${sign}${n.toFixed(2)}`
  return `${sign}${n.toFixed(2)}`
}

/**
 * @param {number|null} v
 * @param {MetricFormat} format
 */
export function formatCurrent(v, format) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  if (format === "pct") return `${n.toFixed(1)}%`
  if (format === "level" || format === "index") return n.toFixed(1)
  return n.toFixed(2)
}

/**
 * @param {MetricDisplayRow} row
 */
export function formatMetricSummaryLines(row) {
  const cur = formatCurrent(row.current, row.format)
  const lines = [`${row.label} ${cur}`]
  if (row.change5D != null) lines.push(`5D ${formatDelta(row.change5D, row.format, row.current)}`)
  if (row.change20D != null) lines.push(`20D ${formatDelta(row.change20D, row.format, row.current)}`)
  return lines
}

/**
 * @param {'up'|'down'|'flat'} slope
 */
export function slopeLabelKo(slope) {
  if (slope === "up") return "상승"
  if (slope === "down") return "하락"
  return "보합"
}

/**
 * @param {MetricDisplayRow} row
 */
export function formatSlopeLine(row) {
  return `기울기 ${slopeArrow(row.slope)} ${slopeLabelKo(row.slope)}`
}
