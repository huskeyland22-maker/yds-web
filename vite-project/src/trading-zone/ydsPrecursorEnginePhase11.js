import { buildPatternHistoryStore } from "./ydsPrecursorEnginePhase9.js"
import {
  REGIME_CHANGE_LOOKBACK_DAYS,
  resolveRegimeFromThirtyDayChange,
} from "./ydsPrecursorEnginePhase10.js"
import { REGIME_BY_ID, regimeDisplayForId } from "./ydsPrecursorRegimeDisplay.js"
import { offsetPrecursorDay, parsePrecursorDay } from "./ydsPrecursorInterpolation.js"

export const PRECURSOR_ENGINE_PHASE11_LABEL =
  "YDS Precursor Engine — Phase 11 (Regime History)"

export const REGIME_HISTORY_WINDOWS = [
  { id: 30, label: "30일" },
  { id: 90, label: "90일" },
  { id: 180, label: "180일" },
]

const METRIC_KEYS = [
  "ydsScore",
  "priA",
  "priB",
  "bullSimilarity",
  "lehmanSimilarity",
  "covidSimilarity",
  "tariffSimilarity",
  "svbSimilarity",
]

const MAX_CHANGE_LOG = 12

/**
 * @param {Record<string, number | null>} point
 */
function dominantPatternId(point) {
  const ranked = [
    ["bull", point.bullSimilarity],
    ["lehman", point.lehmanSimilarity],
    ["covid", point.covidSimilarity],
    ["tariff", point.tariffSimilarity],
    ["svb", point.svbSimilarity],
  ].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  return ranked[0]?.[0] ?? null
}

/**
 * @param {Record<string, number | null>} current
 * @param {Record<string, number | null>} past
 */
function buildThirtyDayDeltas(current, past) {
  /** @type {Record<string, number | null | boolean>} */
  const deltas = {}
  for (const key of METRIC_KEYS) {
    const c = current[key]
    const p = past[key]
    if (c == null || p == null || !Number.isFinite(c) || !Number.isFinite(p)) deltas[key] = null
    else deltas[key] = Math.round((c - p) * 10) / 10
  }
  const panicKeys = ["lehmanSimilarity", "covidSimilarity", "tariffSimilarity"]
  const panicDeltas = panicKeys.map((k) => deltas[k]).filter((v) => v != null)
  deltas.panicSimilarityAvg =
    panicDeltas.length > 0
      ? Math.round((panicDeltas.reduce((a, b) => a + b, 0) / panicDeltas.length) * 10) / 10
      : null
  deltas.dominantShift = dominantPatternId(current) !== dominantPatternId(past)
  return deltas
}

/**
 * @param {ReturnType<typeof buildPatternHistoryStore>["history"]} history
 * @param {number} index
 * @param {number} lookbackDays
 */
function getPastPointAt(history, index, lookbackDays = REGIME_CHANGE_LOOKBACK_DAYS) {
  const current = history[index]
  if (!current) return null
  const targetDate = offsetPrecursorDay(current.date, -lookbackDays)
  const targetTs = parsePrecursorDay(targetDate)
  let best = history[0]
  for (let i = 0; i <= index; i += 1) {
    const row = history[i]
    const ts = parsePrecursorDay(row.date)
    if (ts <= targetTs) best = row
  }
  return best
}

/**
 * @param {string} dateA
 * @param {string} dateB
 */
function daySpanBetween(dateA, dateB) {
  const span = Math.abs(parsePrecursorDay(dateB) - parsePrecursorDay(dateA))
  return Math.max(1, Math.round(span / 86_400_000))
}

/**
 * @param {ReturnType<typeof buildPatternHistoryStore>["history"]} history
 */
export function buildRegimeHistorySeries(history) {
  return history.map((point, index) => {
    const past = getPastPointAt(history, index)
    const deltas30 = past ? buildThirtyDayDeltas(point, past) : null
    const regime = deltas30
      ? resolveRegimeFromThirtyDayChange(point, deltas30)
      : regimeDisplayForId("stable", { reason: "30일 기준 부족" })
    return {
      date: point.date,
      label: point.date?.slice(5, 10) ?? "",
      regimeId: regime.id,
      regime,
    }
  })
}

/**
 * @param {ReturnType<typeof buildRegimeHistorySeries>} series
 */
function buildRegimeChangeLog(series) {
  /** @type {{ date: string; fromId: string; toId: string; from: object; to: object }[]} */
  const log = []
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1]
    const cur = series[i]
    if (prev.regimeId === cur.regimeId) continue
    log.push({
      date: cur.date,
      fromId: prev.regimeId,
      toId: cur.regimeId,
      from: prev.regime,
      to: cur.regime,
    })
  }
  return log.reverse()
}

/**
 * @param {ReturnType<typeof buildRegimeHistorySeries>} series
 */
function computeCurrentRegimeDuration(series) {
  if (!series.length) return { days: 0, sinceDate: null }
  const lastId = series[series.length - 1].regimeId
  let days = 1
  let sinceDate = series[series.length - 1].date
  for (let i = series.length - 2; i >= 0; i -= 1) {
    if (series[i].regimeId !== lastId) break
    days += daySpanBetween(series[i].date, series[i + 1].date)
    sinceDate = series[i].date
  }
  return { days, sinceDate }
}

/**
 * @param {ReturnType<typeof buildRegimeHistorySeries>} fullSeries
 * @param {number} windowDays
 */
function sliceSeriesWindow(fullSeries, windowDays) {
  if (!fullSeries.length) return []
  const endTs = parsePrecursorDay(fullSeries[fullSeries.length - 1].date)
  const startTs = endTs - windowDays * 86_400_000
  return fullSeries.filter((s) => parsePrecursorDay(s.date) >= startTs)
}

/**
 * @param {ReturnType<typeof buildRegimeHistorySeries>} series
 */
function countRegimeChanges(series) {
  let changes = 0
  for (let i = 1; i < series.length; i += 1) {
    if (series[i].regimeId !== series[i - 1].regimeId) changes += 1
  }
  return changes
}

/**
 * @param {string | undefined} fromId
 * @param {string | undefined} toId
 */
function resolveChangeDirection(fromId, toId) {
  const fromOrder = REGIME_BY_ID[fromId]?.order ?? -1
  const toOrder = REGIME_BY_ID[toId]?.order ?? -1
  if (toOrder > fromOrder) return { id: "up", label: "상승 (위험 심화)" }
  if (toOrder < fromOrder) return { id: "down", label: "완화 (안정 회복)" }
  return { id: "flat", label: "유지" }
}

/**
 * @param {ReturnType<typeof buildRegimeHistorySeries>} series
 */
function buildTimelineSegments(series) {
  if (!series.length) return []
  /** @type {{ startDate: string; endDate: string; regimeId: string; regime: object; daySpan: number }[]} */
  const segments = []
  let segStart = 0
  for (let i = 1; i <= series.length; i += 1) {
    const ended = i === series.length || series[i].regimeId !== series[segStart].regimeId
    if (!ended) continue
    const endIdx = i === series.length ? i - 1 : i - 1
    const start = series[segStart]
    const end = series[endIdx]
    segments.push({
      startDate: start.date,
      endDate: end.date,
      regimeId: start.regimeId,
      regime: start.regime,
      daySpan: daySpanBetween(start.date, end.date),
    })
    segStart = i
  }
  return segments
}

/**
 * @param {ReturnType<typeof buildRegimeChangeLog>} changeLog
 * @param {ReturnType<typeof buildRegimeHistorySeries>} series
 */
function buildSummary(changeLog, series) {
  const last = series[series.length - 1]
  const duration = computeCurrentRegimeDuration(series)
  const lastChange = changeLog[0] ?? null
  const previousRegime = lastChange?.from ?? series[series.length - 2]?.regime ?? null
  const direction = lastChange
    ? resolveChangeDirection(lastChange.fromId, lastChange.toId)
    : { id: "flat", label: "변화 없음" }

  return {
    currentRegime: last?.regime ?? regimeDisplayForId("stable"),
    previousRegime,
    durationDays: duration.days,
    durationLabel: last
      ? `${last.regime.label} ${duration.days}일째`
      : "—",
    sinceDate: duration.sinceDate,
    changeDirection: direction,
    lastChangeDate: lastChange?.date ?? null,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null }} [options]
 */
export function buildPrecursorEnginePhase11Report(events, options = {}) {
  const store = buildPatternHistoryStore(events, options)
  const fullSeries = buildRegimeHistorySeries(store.history)
  const changeLog = buildRegimeChangeLog(fullSeries)
  const summary = buildSummary(changeLog, fullSeries)

  const windows = Object.fromEntries(
    REGIME_HISTORY_WINDOWS.map((w) => {
      const series = sliceSeriesWindow(fullSeries, w.id)
      return [
        w.id,
        {
          days: w.id,
          label: w.label,
          series,
          segments: buildTimelineSegments(series),
          changeCount: countRegimeChanges(series),
          points: series.length,
        },
      ]
    }),
  )

  return {
    label: PRECURSOR_ENGINE_PHASE11_LABEL,
    current: {
      regime: summary.currentRegime,
      headline: `${summary.currentRegime.emoji} ${summary.currentRegime.label}`,
      durationDays: summary.durationDays,
      durationLabel: summary.durationLabel,
    },
    summary,
    changeLog: changeLog.slice(0, MAX_CHANGE_LOG),
    changeLogTotal: changeLog.length,
    windows,
    fullSeriesLength: fullSeries.length,
    notes: [
      "검증 전용 · Phase 9 시계열 + Phase 10(30일Δ) 체제 판정 재사용",
      "국면 지속일수 = 동일 id 연속 구간 일수 추정(월별 앵커 보간)",
      "변경 로그 = 인접 시점 regimeId 변경",
      "Phase 0~10·getFinalScore 미변경",
    ],
  }
}
