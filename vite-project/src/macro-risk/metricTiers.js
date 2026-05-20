import { buildMetricRow } from "./displayMetrics.js"

/**
 * @typedef {import('./displayMetrics.js').MetricDisplayRow} MetricDisplayRow
 * @typedef {import('./rawLayer.js').MetricSeries} MetricSeries
 */

/**
 * @param {object | null} panicContext
 * @returns {MetricSeries | undefined}
 */
function vxnSeriesFromPanic(panicContext) {
  const v = Number(panicContext?.vxn)
  if (!Number.isFinite(v)) return undefined
  const slope = v >= 22 ? "up" : v <= 15 ? "down" : "flat"
  return {
    key: "VXN",
    current: v,
    change1D: null,
    change5D: null,
    change20D: null,
    slope,
    status: slope === "up" ? "변동성 상승" : "보합",
  }
}

/**
 * @param {Record<string, MetricSeries>} raw
 * @param {object | null} panicContext
 * @returns {{ tier1: MetricDisplayRow[]; tier2: MetricDisplayRow[] }}
 */
export function buildTieredMetrics(raw, panicContext = null) {
  const vxn = vxnSeriesFromPanic(panicContext)

  const tier1 = [
    buildMetricRow(raw.US10Y, "US10Y", { format: "rate", tier: 1 }),
    buildMetricRow(raw.REAL_YIELD, "REAL", { format: "rate", tier: 1 }),
    buildMetricRow(raw.DXY, "DXY", { format: "pct", tier: 1 }),
    buildMetricRow(raw.MOVE, "MOVE", { format: "index", tier: 1 }),
  ]

  const tier2 = [
    buildMetricRow(raw.US30Y, "30Y", {
      format: "rate",
      tier: 2,
      category: "장기금리",
      hide1D: true,
    }),
    buildMetricRow(raw.BEI, "BEI", { format: "rate", tier: 2 }),
    buildMetricRow(vxn, "VXN", { format: "index", tier: 2, hide1D: true }),
    buildMetricRow(raw.US2Y, "2Y", { format: "rate", tier: 2 }),
  ]

  return { tier1, tier2 }
}
