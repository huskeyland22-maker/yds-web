import { buildMetricRow } from "./displayMetrics.js"
import { sourceToDataBadge } from "./deltaSemantics.js"
import { metricDisplayLabel, metricDisplayTooltip } from "./metricLabels.js"

/**
 * @typedef {import('./displayMetrics.js').MetricDisplayRow} MetricDisplayRow
 * @typedef {import('./rawLayer.js').MetricSeries} MetricSeries
 */

/**
 * @param {Record<string, MetricSeries>} raw
 * @param {object | null} panicContext
 * @param {Record<string, string>} sources
 * @returns {MetricDisplayRow}
 */
function buildVxnTierRow(raw, panicContext, sources) {
  const hist = raw.VXN
  const spot = Number(panicContext?.vxn)

  if (hist?.current != null && Number.isFinite(hist.current)) {
    const noHorizon = hist.change5D == null && hist.change20D == null
    const series = noHorizon ? { ...hist, slope: "flat", status: "—" } : hist
    return buildMetricRow(series, metricDisplayLabel("VXN"), {
      format: "index",
      tier: 2,
      hide1D: true,
      tooltip: metricDisplayTooltip("VXN"),
      dataBadge: sourceToDataBadge(sources.VXN ?? "staticSeed"),
      deltaHorizonNA: noHorizon,
    })
  }

  if (!Number.isFinite(spot)) {
    return buildMetricRow(
      { key: "VXN", current: null, change1D: null, change5D: null, change20D: null, slope: "flat", status: "—" },
      metricDisplayLabel("VXN"),
      {
        format: "index",
        tier: 2,
        hide1D: true,
        tooltip: metricDisplayTooltip("VXN"),
        dataBadge: "MOCK",
        deltaHorizonNA: true,
      },
    )
  }

  return buildMetricRow(
    {
      key: "VXN",
      current: spot,
      change1D: null,
      change5D: null,
      change20D: null,
      slope: "flat",
      status: "—",
    },
    metricDisplayLabel("VXN"),
    {
      format: "index",
      tier: 2,
      hide1D: true,
      tooltip: metricDisplayTooltip("VXN"),
      dataBadge: sourceToDataBadge(sources.VXN ?? "cycle-manual"),
      deltaHorizonNA: true,
    },
  )
}

/**
 * @param {Record<string, MetricSeries>} raw
 * @param {object | null} panicContext
 * @param {Record<string, string>} [sources]
 * @returns {{ tier1: MetricDisplayRow[]; tier2: MetricDisplayRow[] }}
 */
export function buildTieredMetrics(raw, panicContext = null, sources = {}) {
  const badge = (key) => sourceToDataBadge(sources[key] ?? "staticSeed")

  const tier1 = [
    buildMetricRow(raw.US10Y, metricDisplayLabel("US10Y"), {
      format: "rate",
      tier: 1,
      tooltip: metricDisplayTooltip("US10Y"),
      dataBadge: badge("US10Y"),
    }),
    buildMetricRow(raw.REAL_YIELD, metricDisplayLabel("REAL_YIELD"), {
      format: "rate",
      tier: 1,
      tooltip: metricDisplayTooltip("REAL_YIELD"),
      dataBadge: badge("REAL_YIELD"),
    }),
    buildMetricRow(raw.DXY, metricDisplayLabel("DXY"), {
      format: "level",
      tier: 1,
      tooltip: metricDisplayTooltip("DXY"),
      dataBadge: badge("DXY"),
    }),
    buildMetricRow(raw.MOVE, metricDisplayLabel("MOVE"), {
      format: "index",
      tier: 1,
      tooltip: metricDisplayTooltip("MOVE"),
      dataBadge: badge("MOVE"),
    }),
  ]

  const tier2 = [
    buildMetricRow(raw.US30Y, metricDisplayLabel("US30Y"), {
      format: "rate",
      tier: 2,
      category: "장기금리",
      hide1D: true,
      tooltip: metricDisplayTooltip("US30Y"),
      dataBadge: badge("US30Y"),
    }),
    buildMetricRow(raw.BEI, metricDisplayLabel("BEI"), {
      format: "rate",
      tier: 2,
      tooltip: metricDisplayTooltip("BEI"),
      dataBadge: badge("BEI"),
    }),
    buildVxnTierRow(raw, panicContext, sources),
    buildMetricRow(raw.US2Y, metricDisplayLabel("US2Y"), {
      format: "rate",
      tier: 2,
      tooltip: metricDisplayTooltip("US2Y"),
      dataBadge: badge("US2Y"),
    }),
  ]

  return { tier1, tier2 }
}
