/**
 * 패닉 히스토리 차트 — 탭 → row 필드 매핑 (단일 지표만)
 */

import { buildPanicV1HistoryChartData } from "../panic-v2/panicV1History.js"
import { buildPanicV2DynamicChartData } from "../panic-v2/panicV2Dynamic.js"
import { getFinalScore } from "./tradingScores.js"
import { formatChartAxisMd } from "./chartDateFormat.js"
import { panicDataFromCycleRow } from "./cycleHistoryUtils.js"
import { sortHistoryRowsAsc } from "./panicHistoryDesk.js"

/** UI 탭 id → cycle row 필드 */
export const HISTORY_CHART_FIELD_MAP = {
  panicV2: "panicV2",
  panicV1: "panicV1",
  vix: "vix",
  vvix: "vvix",
  vixTerm: "vixTerm",
  ndxDistance: "ndxDistance",
  soxxDistance: "soxxDistance",
  dxy: "dxy",
  vxn: "vxn",
  fearGreed: "fearGreed",
  bofa: "bofa",
  putCall: "putCall",
  highYield: "highYield",
  move: "move",
  skew: "skew",
  gs: "gsBullBear",
  gsBullBear: "gsBullBear",
  ydsComposite: "ydsComposite",
}

/** @param {object} row @param {string} field */
export function historyRowFieldValue(row, field) {
  if (!row || !field) return null
  if (field === "highYield") {
    const n = Number(row.highYield ?? row.hyOas)
    return Number.isFinite(n) ? n : null
  }
  if (field === "gsBullBear") {
    const n = Number(row.gsBullBear ?? row.gsSentiment)
    return Number.isFinite(n) ? n : null
  }
  if (field === "vixTerm") return Number(row.vixTerm ?? row.vix_term)
  if (field === "ndxDistance") return Number(row.ndxDistance ?? row.ndx_distance)
  if (field === "soxxDistance") return Number(row.soxxDistance ?? row.soxx_distance)
  const n = Number(row[field])
  return Number.isFinite(n) ? n : null
}

/** @param {string} activeHistoryTab */
export function resolveHistoryChartField(activeHistoryTab) {
  return HISTORY_CHART_FIELD_MAP[activeHistoryTab] ?? activeHistoryTab
}

/**
 * 단일 지표 — Recharts dataKey="value"
 * @param {object[]} history
 * @param {string} selectedField
 */
export function buildSingleMetricChartData(history, selectedField) {
  if (!selectedField) return []
  return sortHistoryRowsAsc(history)
    .map((row) => {
      const date = String(row.date ?? row.ts ?? "").slice(0, 10)
      const value = historyRowFieldValue(row, selectedField)
      if (!Number.isFinite(value)) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value,
        [selectedField]: value,
      }
    })
    .filter(Boolean)
}

/** VIX·CNN·BofA 등으로 계산한 YDS 종합점수(0~100) 시계열 */
export function buildYdsCompositeChartData(history) {
  return sortHistoryRowsAsc(history)
    .map((row) => {
      const date = String(row.date ?? row.ts ?? "").slice(0, 10)
      const panic = panicDataFromCycleRow(row)
      if (!panic) return null
      const score = getFinalScore(panic)
      if (!Number.isFinite(score)) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value: score,
        ydsComposite: score,
      }
    })
    .filter(Boolean)
}

/** DB·병합된 panic_v2 점수로 차트 (1건 이상이면 즉시 표시) */
export function buildPanicV2StoredChartData(history) {
  return sortHistoryRowsAsc(history)
    .map((row) => {
      const date = String(row.date ?? row.ts ?? "").slice(0, 10)
      const raw =
        row.panic_v2 ??
        row.panic_index_v2 ??
        (row.panicScore != null && Number(row.panicScore) !== 0 ? row.panicScore : null) ??
        null
      if (raw == null || raw === "") return null
      const score = Number(raw)
      if (!Number.isFinite(score)) return null
      return {
        date,
        axisLabel: formatChartAxisMd(date),
        value: score,
        panicV2: score,
      }
    })
    .filter(Boolean)
}

/**
 * @param {object[]} history
 * @param {string} activeHistoryTab
 */
export function buildHistoryChartPayload(history, activeHistoryTab) {
  if (activeHistoryTab === "ydsComposite") {
    const chartData = buildYdsCompositeChartData(history)
    return {
      selectedField: "ydsComposite",
      dataKey: "value",
      chartData,
    }
  }
  if (activeHistoryTab === "panicV2") {
    const stored = buildPanicV2StoredChartData(history)
    const chartData = stored.length >= 1 ? stored : buildPanicV2DynamicChartData(history)
    return {
      selectedField: "panicV2",
      dataKey: "value",
      chartData,
    }
  }
  if (activeHistoryTab === "panicV1") {
    const chartData = buildPanicV1HistoryChartData(history)
    return {
      selectedField: "panicV1",
      dataKey: "value",
      chartData,
    }
  }
  const selectedField = resolveHistoryChartField(activeHistoryTab)
  const chartData = buildSingleMetricChartData(history, selectedField)
  return {
    selectedField,
    dataKey: "value",
    chartData,
  }
}
