import { resolveActionGuideStep } from "./ydsPrecursorEnginePhase15.js"
import { loadPrecursorValidationLog } from "./ydsPrecursorValidationLogStorage.js"
import { loadPrecursorMarketJournal } from "./ydsPrecursorMarketJournalStorage.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"
import {
  calcForwardReturnMap,
  mergeYdsSourceHistory,
  pickYdsWeeklySteps,
  YDS_FORWARD_HORIZONS,
} from "./ydsSignalHistory.js"

export const PRECURSOR_ENGINE_PHASE18_LABEL =
  "YDS Precursor Engine — Phase 18 (Action Performance Scoreboard)"

export const ACTION_PERFORMANCE_BUCKETS = [
  { id: "watch", label: "관망", emoji: "👀", actionIds: ["cash_prep", "watch"] },
  { id: "interest", label: "관심", emoji: "📋", actionIds: ["track"] },
  { id: "dca", label: "분할매수", emoji: "🟠", actionIds: ["dca_prep", "dca_active"] },
  { id: "panic", label: "패닉매수", emoji: "🔴", actionIds: ["panic_buy", "historic"] },
]

/** @type {Record<string, typeof ACTION_PERFORMANCE_BUCKETS[number]>} */
const BUCKET_BY_ACTION_ID = {}
for (const bucket of ACTION_PERFORMANCE_BUCKETS) {
  for (const id of bucket.actionIds) {
    BUCKET_BY_ACTION_ID[id] = bucket
  }
}

/**
 * @param {string} actionId
 */
export function mapActionIdToPerformanceBucket(actionId) {
  return BUCKET_BY_ACTION_ID[actionId] ?? BUCKET_BY_ACTION_ID.watch
}

/** @param {string} dateStr */
function rowDateKey(dateStr) {
  return String(dateStr ?? "").slice(0, 10)
}

/**
 * @param {object[]} steps
 * @param {string} date
 */
function findStepIndexOnOrBefore(steps, date) {
  const target = rowDateKey(date)
  if (!target) return -1
  let best = -1
  for (let i = 0; i < steps.length; i += 1) {
    const d = rowDateKey(steps[i]?.date)
    if (d && d <= target) best = i
    else if (d && d > target) break
  }
  return best
}

/**
 * @param {ReturnType<typeof loadPrecursorValidationLog>[number] | ReturnType<typeof loadPrecursorMarketJournal>[number]} row
 */
function resolveLogActionId(row) {
  if (row.actionId && BUCKET_BY_ACTION_ID[row.actionId]) return row.actionId
  return resolveActionGuideStep({
    ydsScore: row.ydsScore ?? null,
    priA: row.priA ?? null,
    priB: row.priB ?? null,
    regimeId: row.regimeId ?? "unknown",
    patternId: row.dominantPatternId ?? null,
  }).id
}

/**
 * Phase 13 + Phase 17 저널 병합 (날짜당 1건)
 */
export function mergeValidationLogForAnalysis() {
  const byDate = new Map()
  for (const row of loadPrecursorValidationLog()) {
    byDate.set(row.date, { ...row })
  }
  for (const row of loadPrecursorMarketJournal()) {
    byDate.set(row.date, { ...row })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * @param {ReturnType<typeof mergeValidationLogForAnalysis>} log
 * @param {object[]} historyRows
 */
function buildActionPerformanceSignals(log, historyRows) {
  const merged = mergeYdsSourceHistory(historyRows)
  const steps = pickYdsWeeklySteps(merged)
  if (!steps.length || !log.length) return { signals: [], steps, matched: 0 }

  /** @type {object[]} */
  const signals = []

  for (const row of log) {
    const idx = findStepIndexOnOrBefore(steps, row.date)
    if (idx < 0) continue

    const actionId = resolveLogActionId(row)
    const bucket = mapActionIdToPerformanceBucket(actionId)
    const actionLabel =
      row.actionLabel ??
      resolveActionGuideStep({
        ydsScore: row.ydsScore,
        priA: row.priA,
        priB: row.priB,
        regimeId: row.regimeId,
        patternId: row.dominantPatternId,
      }).label

    const forwardReturns = calcForwardReturnMap(steps, idx)

    signals.push({
      date: row.date,
      actionId,
      actionLabel,
      bucketId: bucket.id,
      bucketLabel: bucket.label,
      bucketEmoji: bucket.emoji,
      ydsScore: row.ydsScore,
      priA: row.priA,
      priB: row.priB,
      regimeLabel: row.regimeLabel,
      patternLabel: row.dominantPatternLabel,
      forwardReturns,
    })
  }

  return { signals, steps, matched: signals.length }
}

/**
 * @param {object[]} signals
 * @param {"m1"|"m3"|"m6"|"m12"} horizonKey
 */
function aggregateBucketHorizonStats(signals, horizonKey) {
  /** @type {Record<string, { count: number; wins: number; returns: number[] }>} */
  const acc = {}
  for (const b of ACTION_PERFORMANCE_BUCKETS) {
    acc[b.id] = { count: 0, wins: 0, returns: [] }
  }

  for (const s of signals) {
    const ret = s.forwardReturns?.[horizonKey]
    if (ret == null || !Number.isFinite(ret)) continue
    const a = acc[s.bucketId]
    if (!a) continue
    a.count += 1
    a.returns.push(ret)
    if (ret > 0) a.wins += 1
  }

  return ACTION_PERFORMANCE_BUCKETS.map((bucket) => {
    const a = acc[bucket.id]
    const n = a.returns.length
    const avgReturn = n ? a.returns.reduce((s, v) => s + v, 0) / n : null
    const winRate = n ? (a.wins / n) * 100 : null
    const maxGain = n ? Math.max(...a.returns) : null
    const maxLoss = n ? Math.min(...a.returns) : null
    return {
      bucketId: bucket.id,
      label: bucket.label,
      emoji: bucket.emoji,
      count: a.count,
      winRate: winRate != null ? Math.round(winRate * 10) / 10 : null,
      avgReturn: avgReturn != null ? Math.round(avgReturn * 10) / 10 : null,
      maxGain: maxGain != null ? Math.round(maxGain * 10) / 10 : null,
      maxLoss: maxLoss != null ? Math.round(maxLoss * 10) / 10 : null,
    }
  })
}

/**
 * @param {object[]} signals
 * @param {"m1"|"m3"|"m6"|"m12"} horizonKey
 */
function buildRankingByWinRate(signals, horizonKey) {
  const stats = aggregateBucketHorizonStats(signals, horizonKey)
  return [...stats]
    .filter((s) => s.count > 0)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .map((s, i) => ({ rank: i + 1, ...s, horizon: horizonKey }))
}

/**
 * @param {object[]} signals
 * @param {"m1"|"m3"|"m6"|"m12"} horizonKey
 */
function buildRankingByAvgReturn(signals, horizonKey) {
  const stats = aggregateBucketHorizonStats(signals, horizonKey)
  return [...stats]
    .filter((s) => s.count > 0)
    .sort((a, b) => (b.avgReturn ?? 0) - (a.avgReturn ?? 0))
    .map((s, i) => ({ rank: i + 1, ...s, horizon: horizonKey }))
}

/**
 * @param {object[]} signals
 * @param {"m1"|"m3"|"m6"|"m12"} horizonKey
 */
function findExtremeSignal(signals, horizonKey, mode) {
  let best = null
  for (const s of signals) {
    const ret = s.forwardReturns?.[horizonKey]
    if (ret == null || !Number.isFinite(ret)) continue
    if (!best || (mode === "best" ? ret > best.returnPct : ret < best.returnPct)) {
      best = {
        date: s.date,
        actionId: s.actionId,
        actionLabel: s.actionLabel,
        bucketId: s.bucketId,
        bucketLabel: s.bucketLabel,
        bucketEmoji: s.bucketEmoji,
        ydsScore: s.ydsScore,
        regimeLabel: s.regimeLabel,
        patternLabel: s.patternLabel,
        horizon: horizonKey,
        returnPct: Math.round(ret * 10) / 10,
      }
    }
  }
  return best
}

/**
 * @param {object[]} signals
 * @param {"m1"|"m3"|"m6"|"m12"} horizonKey
 */
function buildCumulativePerformanceChart(signals, horizonKey) {
  return ACTION_PERFORMANCE_BUCKETS.map((bucket) => {
    const rows = signals
      .filter(
        (s) =>
          s.bucketId === bucket.id &&
          s.forwardReturns?.[horizonKey] != null &&
          Number.isFinite(s.forwardReturns[horizonKey]),
      )
      .sort((a, b) => a.date.localeCompare(b.date))

    let equity = 100
    const points = [{ date: rows[0]?.date ?? "—", equity: 100, label: "시작" }]
    for (const s of rows) {
      const ret = s.forwardReturns[horizonKey]
      equity *= 1 + ret / 100
      points.push({
        date: s.date,
        equity: Math.round(equity * 100) / 100,
        returnPct: ret,
        actionLabel: s.actionLabel,
      })
    }

    return {
      bucketId: bucket.id,
      label: bucket.label,
      emoji: bucket.emoji,
      signalCount: rows.length,
      finalEquity: points.length > 1 ? points[points.length - 1].equity : 100,
      points,
    }
  })
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ extraRows?: object[]; log?: ReturnType<typeof mergeValidationLogForAnalysis> }} [options]
 */
export function buildPrecursorEnginePhase18Report(events, options = {}) {
  void events
  const log = options.log ?? mergeValidationLogForAnalysis()
  const historyRows = options.extraRows ?? []
  const { signals, steps, matched } = buildActionPerformanceSignals(log, historyRows)

  const defaultHorizon = "m3"
  const horizonMeta = YDS_FORWARD_HORIZONS.map((h) => ({
    key: h.key,
    label: h.key === "m1" ? "1개월" : h.key === "m3" ? "3개월" : h.key === "m6" ? "6개월" : "12개월",
    minDays: h.minDays,
  }))

  const scoreboardByHorizon = Object.fromEntries(
    YDS_FORWARD_HORIZONS.map((h) => [h.key, aggregateBucketHorizonStats(signals, h.key)]),
  )

  return {
    label: PRECURSOR_ENGINE_PHASE18_LABEL,
    meta: {
      logEntries: log.length,
      matchedSignals: matched,
      historySteps: steps.length,
      hasData: matched > 0,
      defaultHorizon,
    },
    horizons: horizonMeta,
    scoreboard: scoreboardByHorizon,
    winRateRanking: buildRankingByWinRate(signals, defaultHorizon),
    avgReturnRanking: buildRankingByAvgReturn(signals, defaultHorizon),
    bestSignal: findExtremeSignal(signals, defaultHorizon, "best"),
    worstSignal: findExtremeSignal(signals, defaultHorizon, "worst"),
    cumulativeChart: {
      horizon: defaultHorizon,
      series: buildCumulativePerformanceChart(signals, defaultHorizon),
    },
    signals: signals.slice().reverse().slice(0, 40),
    notes: [
      "Phase 0~17 읽기 전용 · Phase 13/17 Validation Log + Phase 15 행동 매핑",
      "수익률 = YDS 시장 프록시 주간 스텝 합성 (검증 페이지와 동일)",
      "행동 구간: 관망·관심·분할매수·패닉매수 · 1/3/6/12개월 전방 수익",
      "로그 부족 시 Phase 17/13에서 일별 스냅샷 저장 후 재분석",
    ],
  }
}

/** @param {number | null} v */
export function formatPerformancePct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  const sign = v > 0 ? "+" : ""
  return `${sign}${formatMetric(v, 1)}%`
}
