import { buildMetricRow } from "./displayMetrics.js"
import { sourceToDataBadge } from "./deltaSemantics.js"
import { metricDisplayLabel, metricDisplayTooltip } from "./metricLabels.js"

/**
 * @typedef {import('./displayMetrics.js').MetricDisplayRow} MetricDisplayRow
 * @typedef {import('./rawLayer.js').MetricSeries} MetricSeries
 */

/**
 * CORE + Expert 티어 (VXN·MOVE 제외 — 패닉/Cycle 전용)
 * @param {Record<string, MetricSeries>} raw
 * @param {object | null} _panicContext
 * @param {Record<string, string>} [sources]
 * @returns {{ tier1: MetricDisplayRow[]; tier2: MetricDisplayRow[] }}
 */
export function buildTieredMetrics(raw, _panicContext = null, sources = {}) {
  const badge = (key) => sourceToDataBadge(sources[key] ?? "missing")

  const tier1 = [
    buildMetricRow(raw.US10Y, metricDisplayLabel("US10Y"), {
      format: "rate",
      tier: 1,
      category: "성장주·코스피·AI·반도체",
      tooltip: metricDisplayTooltip("US10Y"),
      dataBadge: badge("US10Y"),
    }),
    buildMetricRow(raw.US30Y, metricDisplayLabel("US30Y"), {
      format: "rate",
      tier: 1,
      category: "장기인플·재정·채권심리",
      hide1D: true,
      tooltip: metricDisplayTooltip("US30Y"),
      dataBadge: badge("US30Y"),
    }),
    buildMetricRow(raw.DXY, metricDisplayLabel("DXY"), {
      format: "level",
      tier: 1,
      category: "유동성·외인·위험자산",
      tooltip: metricDisplayTooltip("DXY"),
      dataBadge: badge("DXY"),
    }),
  ]

  const tier2 = [
    buildMetricRow(raw.REAL_YIELD, metricDisplayLabel("REAL_YIELD"), {
      format: "rate",
      tier: 2,
      category: "Expert",
      tooltip: metricDisplayTooltip("REAL_YIELD"),
      dataBadge: badge("REAL_YIELD"),
    }),
    buildMetricRow(raw.US2Y, metricDisplayLabel("US2Y"), {
      format: "rate",
      tier: 2,
      category: "Expert",
      tooltip: metricDisplayTooltip("US2Y"),
      dataBadge: badge("US2Y"),
    }),
    buildMetricRow(raw.BEI, metricDisplayLabel("BEI"), {
      format: "rate",
      tier: 2,
      category: "Expert",
      tooltip: metricDisplayTooltip("BEI"),
      dataBadge: badge("BEI"),
    }),
  ]

  return { tier1, tier2 }
}
