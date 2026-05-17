/**
 * 지표 해석 카드 — 전일 대비·타점·매매 우선순위 브리프
 */
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { computeMarketTiming } from "./panicMarketTimingEngine.js"
import {
  historyMetricValues,
  interpretPanicMetric,
} from "./panicMetricInterpretation.js"

/** @typedef {import("./panicMetricInterpretation.js").MetricInterpretation} MetricInterpretation */

/**
 * @typedef {MetricInterpretation & {
 *   statusDisplay: string
 *   changePct: number | null
 *   changeLabel: string | null
 *   changeContext: string | null
 *   shortLine: string
 *   midLine: string
 *   longLine: string
 *   riskLine: string
 *   tradePriority: string
 * }} MetricInsightBrief
 */

const HIGHER_IS_BAD = {
  vix: true,
  vxn: true,
  putCall: true,
  fearGreed: false,
  highYield: true,
  hyOas: true,
  move: true,
  skew: true,
  bofa: false,
  gsBullBear: false,
}

/** @param {string} label */
function withGujeon(label) {
  if (!label) return "—"
  if (label.includes("구간")) return label
  return `${label} 구간`
}

/** @param {object[]} rows @param {string} metricKey */
function previousMetricValue(rows, metricKey) {
  if (!Array.isArray(rows) || rows.length < 2) return null
  const key = metricKey === "hyOas" ? "highYield" : metricKey
  const prevRow = rows[rows.length - 2]
  if (!prevRow) return null
  if (key === "highYield") return Number(prevRow.highYield ?? prevRow.hyOas)
  if (key === "gsBullBear") return Number(prevRow.gsBullBear ?? prevRow.gsSentiment)
  const n = Number(prevRow[key])
  return Number.isFinite(n) ? n : null
}

/**
 * @param {number} current
 * @param {number | null} previous
 * @param {boolean} higherIsBad
 */
function computeDayChange(current, previous, higherIsBad) {
  if (previous == null || !Number.isFinite(previous) || previous === 0) {
    return { pct: null, label: null, context: null }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct >= 0 ? "+" : ""
  const label = `(${sign}${pct.toFixed(1)}%)`
  let context = "보합 유지"
  if (Math.abs(pct) >= 2) {
    if (higherIsBad) {
      context = pct > 0 ? "변동성 확대" : "안정화 진행"
    } else {
      context = pct > 0 ? "심리 개선" : "심리 둔화"
    }
  }
  return { pct, label, context }
}

/** @param {import("./panicMarketTimingEngine.js").TimingSignal | null | undefined} signal */
function formatShortLine(signal) {
  if (!signal?.metricsUsed?.length) return "—"
  const a = signal.actionShort || signal.action
  if (signal.score >= 68 || /익절|공포 매수/.test(a)) return `${a} 우위`
  if (signal.score >= 50) return `${a} 검토`
  return `${a} · 관망`
}

/** @param {import("./panicMarketTimingEngine.js").TimingSignal | null | undefined} signal */
function formatMidLine(signal) {
  if (!signal?.metricsUsed?.length) return "—"
  const a = signal.actionShort || signal.action
  if (signal.score >= 68) return `${a} 가능`
  if (signal.score >= 40) return `${a} 유지`
  return `${a} · 축소 검토`
}

/** @param {import("./panicMarketTimingEngine.js").TimingSignal | null | undefined} signal */
function formatLongLine(signal) {
  if (!signal?.metricsUsed?.length) return "—"
  const a = signal.actionShort || signal.action
  if (signal.score >= 60) return `${a} 유지`
  if (signal.score >= 40) return `${a} · 중립`
  return `${a} · 방어`
}

/**
 * @param {object | null} panicData
 * @param {import("./panicMarketTimingEngine.js").MarketTimingGuide | null} timing
 * @param {import("./panicMarketActionEngine.js").MarketActionGuide | null} action
 */
function buildTradePriority(panicData, timing, action) {
  if (!panicData || !action) return "—"

  const short = timing?.short
  const cashFirst = ["현금", "ETF", "대형주", "방어", "채권"]

  if (action.actionMode === "Risk-off") {
    const chain = ["현금", "채권", "방어", "대형주", "배당"]
    return chain.join(" > ")
  }

  if (action.actionMode === "Risk-on") {
    const growth = short?.sectors?.length
      ? short.sectors.filter((s) => !cashFirst.includes(s))
      : action.sectors.filter((s) => !cashFirst.includes(s))
    const parts = ["현금", "ETF", ...growth.slice(0, 2)]
    return [...new Set(parts)].join(" > ")
  }

  if (short && short.score < 48) return "현금 유지"
  if (short && short.score >= 55) return "현금 > ETF > 대형주"
  return "현금 > ETF > 핵심섹터"
}

/** @param {string} metricKey @param {object | null} panicData @param {import("./panicMarketTimingEngine.js").MarketTimingGuide | null} timing */
function metricRiskLine(metricKey, panicData, timing) {
  const shortRisk = timing?.short?.risk
  const longRisk = timing?.long?.risk
  if (metricKey === "vix" || metricKey === "vxn") {
    if (shortRisk?.includes("변동성")) return shortRisk
    return longRisk?.includes("리스크") ? longRisk : "변동성 재확대 감시"
  }
  if (shortRisk) return shortRisk
  return timing?.long?.risk ?? "이벤트 리스크 점검"
}

/**
 * @param {string} metricKey
 * @param {unknown} rawValue
 * @param {{ historyRows?: object[]; panicData?: object | null }} [opts]
 * @returns {MetricInsightBrief | null}
 */
export function buildMetricInsightBrief(metricKey, rawValue, opts = {}) {
  const base = interpretPanicMetric(metricKey, rawValue, { historyRows: opts.historyRows })
  if (!base) return null

  const key = metricKey === "hyOas" ? "highYield" : metricKey
  const higherIsBad = HIGHER_IS_BAD[key] ?? true
  const prev = previousMetricValue(opts.historyRows ?? [], key)
  const change = computeDayChange(base.value, prev, higherIsBad)

  const panicData = opts.panicData ?? null
  const timing = panicData ? computeMarketTiming(panicData) : null
  const action = panicData ? computeMarketAction(panicData) : null

  return {
    ...base,
    statusDisplay: withGujeon(base.statusLabel),
    changePct: change.pct,
    changeLabel: change.label,
    changeContext: change.context,
    shortLine: formatShortLine(timing?.short),
    midLine: formatMidLine(timing?.mid),
    longLine: formatLongLine(timing?.long),
    riskLine: metricRiskLine(key, panicData, timing),
    tradePriority: buildTradePriority(panicData, timing, action),
  }
}
