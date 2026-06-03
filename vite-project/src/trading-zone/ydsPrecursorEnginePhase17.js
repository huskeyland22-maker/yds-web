import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { recordTodayValidationSnapshot } from "./ydsPrecursorEnginePhase13.js"
import { buildPrecursorEnginePhase15Report } from "./ydsPrecursorEnginePhase15.js"
import { buildPrecursorEnginePhase16Report } from "./ydsPrecursorEnginePhase16.js"
import { REGIME_BY_ID } from "./ydsPrecursorRegimeDisplay.js"
import {
  formatRiskPatternDisplayLine,
  getPrecursorMetricDisplay,
} from "./ydsPrecursorMetricDisplay.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { offsetPrecursorDay, parsePrecursorDay } from "./ydsPrecursorInterpolation.js"
import {
  loadPrecursorMarketJournal,
  upsertPrecursorMarketJournalEntry,
} from "./ydsPrecursorMarketJournalStorage.js"

export const PRECURSOR_ENGINE_PHASE17_LABEL =
  "YDS Precursor Engine — Phase 17 (Market Validation Journal)"

const FIRST_MOVER_THRESHOLDS = {
  ydsScore: 4,
  priA: 3,
  priB: 3,
  dominantSimilarity: 5,
  confidenceScore: 4,
}

const FIRST_MOVER_KEYS = ["ydsScore", "priA", "priB", "dominantSimilarity", "confidenceScore"]

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildDailyMarketJournalSnapshot(events, options = {}) {
  const dashboard = buildPrecursorDashboardBetaReport(events, options)
  const phase6 = buildPrecursorEnginePhase6Report(events, options)
  const phase15 = buildPrecursorEnginePhase15Report(events, options)
  const phase16 = buildPrecursorEnginePhase16Report(events, options)

  const date =
    String(dashboard.asOf ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10)

  const patternLine = formatRiskPatternDisplayLine(
    dashboard.cards.pattern.patternId,
    dashboard.cards.pattern.label,
  )

  const journalText = [
    `[${date}] ${dashboard.cards.regime.emoji} ${dashboard.cards.regime.label}`,
    `시장 위치 ${formatMetric(dashboard.cards.yds.value, 0)} · ${patternLine} ${formatMetric(dashboard.cards.pattern.similarity, 0)}%`,
    `조기경보 ${formatMetric(dashboard.cards.priA.value, 0)} · 충격감지 ${formatMetric(dashboard.cards.priB.value, 0)}`,
    `행동: ${phase15.currentAction.emoji} ${phase15.currentAction.label} · 신뢰도 ${phase16.confidence.score}% (${phase16.confidence.label.label})`,
    phase16.narrative.paragraphs[0] ?? "",
  ].join("\n")

  return {
    date,
    savedAt: new Date().toISOString(),
    ydsScore: dashboard.cards.yds.value,
    priA: dashboard.cards.priA.value,
    priB: dashboard.cards.priB.value,
    regimeId: dashboard.cards.regime.regimeId ?? "unknown",
    regimeLabel: dashboard.cards.regime.label ?? "—",
    regimeEmoji: dashboard.cards.regime.emoji ?? "⚪",
    dominantPatternId: dashboard.cards.pattern.patternId,
    dominantPatternLabel: dashboard.cards.pattern.label ?? "—",
    dominantSimilarity: dashboard.cards.pattern.similarity,
    patternRanks: (phase6.top3 ?? []).map((p) => ({
      rank: p.rank,
      patternId: p.patternId,
      patternLabel: p.patternLabel,
      similarity: p.similarity,
    })),
    actionId: phase15.currentAction.id,
    actionLabel: phase15.currentAction.label,
    actionEmoji: phase15.currentAction.emoji,
    confidenceScore: phase16.confidence.score,
    confidenceLabelId: phase16.confidence.label.id,
    confidenceLabel: phase16.confidence.label.label,
    journalText,
    interpretation: phase16.narrative.text,
    radarAlertId: dashboard.cards.interpretation.radarAlert?.id ?? null,
  }
}

/**
 * @param {number | null} past
 * @param {number | null} current
 */
function formatDelta(past, current) {
  if (past == null || current == null || !Number.isFinite(past) || !Number.isFinite(current)) {
    return { delta: null, label: "—" }
  }
  const d = Math.round((current - past) * 10) / 10
  const sign = d > 0 ? "+" : ""
  return { delta: d, label: `${sign}${d}` }
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 * @param {string} endDate
 * @param {number} offsetDays
 */
function findSnapshotAtOffset(log, endDate, offsetDays) {
  const targetDate = offsetPrecursorDay(endDate, -offsetDays)
  const targetTs = parsePrecursorDay(targetDate)
  let best = null
  for (const row of log) {
    if (parsePrecursorDay(row.date) <= targetTs) best = row
  }
  return best
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 */
function buildRegimeChangeLog(log) {
  const entries = []
  for (let i = 1; i < log.length; i += 1) {
    const prev = log[i - 1]
    const cur = log[i]
    if (prev.regimeId === cur.regimeId) continue
    entries.push({
      date: cur.date,
      fromId: prev.regimeId,
      toId: cur.regimeId,
      from: { emoji: prev.regimeEmoji, label: prev.regimeLabel },
      to: { emoji: cur.regimeEmoji, label: cur.regimeLabel },
    })
  }
  return entries.reverse()
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 */
function buildPatternRotationLog(log) {
  const entries = []
  for (let i = 1; i < log.length; i += 1) {
    const prev = log[i - 1]
    const cur = log[i]
    const prevTop = prev.patternRanks?.[0]
    const curTop = cur.patternRanks?.[0]
    const rankShifts = []
    for (const c of cur.patternRanks ?? []) {
      const p = (prev.patternRanks ?? []).find((x) => x.patternId === c.patternId)
      if (p && p.rank !== c.rank) {
        rankShifts.push({
          patternId: c.patternId,
          patternLabel: c.patternLabel,
          fromRank: p.rank,
          toRank: c.rank,
        })
      }
    }
    const topChanged = prevTop?.patternId !== curTop?.patternId
    if (!topChanged && rankShifts.length === 0) continue
    entries.push({
      date: cur.date,
      topChanged,
      fromTop: prevTop?.patternLabel ?? "—",
      toTop: curTop?.patternLabel ?? "—",
      fromTopSim: prevTop?.similarity ?? null,
      toTopSim: curTop?.similarity ?? null,
      rankShifts,
    })
  }
  return entries.reverse()
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} past
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} current
 */
function buildThirtyDayComparison(past, current) {
  const m = getPrecursorMetricDisplay
  if (!past || !current) {
    return { hasPast: false, pastDate: null, currentDate: current?.date ?? null, rows: [] }
  }
  return {
    hasPast: true,
    pastDate: past.date,
    currentDate: current.date,
    rows: [
      { key: "ydsScore", label: m("yds").label, ...formatDelta(past.ydsScore, current.ydsScore) },
      { key: "priA", label: m("priA").label, ...formatDelta(past.priA, current.priA) },
      { key: "priB", label: m("priB").label, ...formatDelta(past.priB, current.priB) },
      {
        key: "confidenceScore",
        label: "신뢰도",
        ...formatDelta(past.confidenceScore, current.confidenceScore),
      },
      {
        key: "dominantSimilarity",
        label: "우세 패턴 유사도",
        ...formatDelta(past.dominantSimilarity, current.dominantSimilarity),
      },
      {
        key: "regime",
        label: m("regime").label,
        delta: null,
        deltaLabel: `${past.regimeEmoji} ${past.regimeLabel} → ${current.regimeEmoji} ${current.regimeLabel}`,
        changed: past.regimeId !== current.regimeId,
      },
      {
        key: "pattern",
        label: m("pattern").label,
        delta: null,
        deltaLabel: `${past.dominantPatternLabel} → ${current.dominantPatternLabel}`,
        changed: past.dominantPatternId !== current.dominantPatternId,
      },
      {
        key: "action",
        label: "행동 가이드",
        delta: null,
        deltaLabel: `${past.actionLabel} → ${current.actionLabel}`,
        changed: past.actionId !== current.actionId,
      },
    ],
  }
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 * @param {number} [windowDays]
 */
function detectLeadingIndicator(log, windowDays = 30) {
  const labelMap = {
    ydsScore: getPrecursorMetricDisplay("yds").label,
    priA: getPrecursorMetricDisplay("priA").label,
    priB: getPrecursorMetricDisplay("priB").label,
    dominantSimilarity: "우세 패턴 유사도",
    confidenceScore: "신뢰도",
    regime: getPrecursorMetricDisplay("regime").label,
    action: "행동 가이드",
  }

  if (log.length < 2) {
    return { found: false, label: "—", reason: "저널 2일 이상 필요" }
  }

  const endDate = log[log.length - 1].date
  const startTs = parsePrecursorDay(endDate) - windowDays * 86_400_000
  const windowLog = log.filter((r) => parsePrecursorDay(r.date) >= startTs)

  const events = []
  for (let i = 1; i < windowLog.length; i += 1) {
    const prev = windowLog[i - 1]
    const cur = windowLog[i]
    for (const key of FIRST_MOVER_KEYS) {
      const p = prev[key]
      const c = cur[key]
      if (p == null || c == null || !Number.isFinite(p) || !Number.isFinite(c)) continue
      if (Math.abs(c - p) >= FIRST_MOVER_THRESHOLDS[key]) {
        events.push({
          date: cur.date,
          key,
          label: labelMap[key],
          delta: Math.round((c - p) * 10) / 10,
        })
      }
    }
    if (prev.regimeId !== cur.regimeId) {
      events.push({
        date: cur.date,
        key: "regime",
        label: labelMap.regime,
        delta:
          (REGIME_BY_ID[cur.regimeId]?.order ?? 0) - (REGIME_BY_ID[prev.regimeId]?.order ?? 0),
      })
    }
    if (prev.actionId !== cur.actionId) {
      events.push({ date: cur.date, key: "action", label: labelMap.action, delta: 1 })
    }
  }

  if (!events.length) {
    return { found: false, label: "—", reason: `${windowDays}일 구간 임계 변화 없음` }
  }

  const earliest = [...events].sort((a, b) => a.date.localeCompare(b.date))[0]
  const recent = events.slice(-8).reverse()

  return {
    found: true,
    label: earliest.label,
    date: earliest.date,
    delta: earliest.delta > 0 ? `+${earliest.delta}` : String(earliest.delta),
    reason: `${earliest.date} 최초 유의미 변화`,
    recentMoves: recent,
  }
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 * @param {number} [limit]
 */
function buildValidationJournalEntries(log, limit = 20) {
  return [...log]
    .reverse()
    .slice(0, limit)
    .map((row) => ({
      date: row.date,
      savedAt: row.savedAt,
      regimeLabel: `${row.regimeEmoji} ${row.regimeLabel}`,
      patternLine: formatRiskPatternDisplayLine(row.dominantPatternId, row.dominantPatternLabel),
      yds: row.ydsScore,
      priA: row.priA,
      priB: row.priB,
      action: `${row.actionEmoji} ${row.actionLabel}`,
      confidence: `${row.confidenceScore}% · ${row.confidenceLabel}`,
      journalText: row.journalText,
      interpretation: row.interpretation,
    }))
}

/**
 * @param {string} dateStr
 */
function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 */
function buildWeeklySummaries(log) {
  /** @type {Map<string, ReturnType<typeof loadPrecursorMarketJournal>>} */
  const buckets = new Map()
  for (const row of log) {
    const key = isoWeekKey(row.date)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(row)
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([weekKey, rows]) => {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
      const regimeChanges = buildRegimeChangeLog(sorted).length
      const patternChanges = buildPatternRotationLog(sorted).filter((e) => e.topChanged).length
      const avgConf =
        rows.reduce((s, r) => s + r.confidenceScore, 0) / Math.max(1, rows.length)
      const topPattern = modePattern(rows)
      return {
        period: weekKey,
        kind: "week",
        startDate: sorted[0].date,
        endDate: sorted[sorted.length - 1].date,
        entryCount: rows.length,
        regimeChanges,
        patternChanges,
        avgConfidence: Math.round(avgConf),
        dominantPattern: topPattern,
        headline: `${sorted[0].date}~${sorted[sorted.length - 1].date} · ${rows.length}일 · 국면 ${regimeChanges}회 · ${topPattern}`,
      }
    })
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} log
 */
function buildMonthlySummaries(log) {
  /** @type {Map<string, ReturnType<typeof loadPrecursorMarketJournal>>} */
  const buckets = new Map()
  for (const row of log) {
    const key = row.date.slice(0, 7)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(row)
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([monthKey, rows]) => {
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
      const regimeChanges = buildRegimeChangeLog(sorted).length
      const patternChanges = buildPatternRotationLog(sorted).filter((e) => e.topChanged).length
      const avgConf =
        rows.reduce((s, r) => s + r.confidenceScore, 0) / Math.max(1, rows.length)
      const topPattern = modePattern(rows)
      const last = sorted[sorted.length - 1]
      return {
        period: monthKey,
        kind: "month",
        startDate: sorted[0].date,
        endDate: sorted[sorted.length - 1].date,
        entryCount: rows.length,
        regimeChanges,
        patternChanges,
        avgConfidence: Math.round(avgConf),
        dominantPattern: topPattern,
        lastAction: `${last.actionEmoji} ${last.actionLabel}`,
        headline: `${monthKey} · ${rows.length}일 기록 · 평균 신뢰도 ${Math.round(avgConf)}%`,
      }
    })
}

/**
 * @param {ReturnType<typeof loadPrecursorMarketJournal>} rows
 */
function modePattern(rows) {
  const counts = new Map()
  for (const r of rows) {
    const id = r.dominantPatternId ?? r.dominantPatternLabel
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  let best = "—"
  let max = 0
  for (const [id, n] of counts) {
    if (n > max) {
      max = n
      const row = rows.find((r) => (r.dominantPatternId ?? r.dominantPatternLabel) === id)
      best = formatRiskPatternDisplayLine(row?.dominantPatternId, row?.dominantPatternLabel)
    }
  }
  return best
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; log?: ReturnType<typeof loadPrecursorMarketJournal> }} [options]
 */
export function buildPrecursorEnginePhase17Report(events, options = {}) {
  const log = options.log ?? loadPrecursorMarketJournal()
  const live = buildDailyMarketJournalSnapshot(events, options)
  const savedToday = log.find((r) => r.date === live.date) ?? null
  const compareBase = savedToday ?? live
  const past30 = findSnapshotAtOffset(log, live.date, 30)
  const comparison30 = buildThirtyDayComparison(past30, compareBase)

  const endTs = parsePrecursorDay(live.date)
  const log90 = log.filter((r) => parsePrecursorDay(r.date) >= endTs - 90 * 86_400_000)

  return {
    label: PRECURSOR_ENGINE_PHASE17_LABEL,
    live,
    savedToday,
    dailySnapshot: compareBase,
    storage: {
      totalEntries: log.length,
      firstDate: log[0]?.date ?? null,
      lastDate: log[log.length - 1]?.date ?? null,
      hasToday: Boolean(savedToday),
    },
    comparison30,
    regimeChangeLog: buildRegimeChangeLog(log).slice(0, 25),
    patternRotationLog: buildPatternRotationLog(log).slice(0, 25),
    stats90d: {
      regimeChangeCount: buildRegimeChangeLog(log90).length,
      patternChangeCount: buildPatternRotationLog(log90).filter((e) => e.topChanged).length,
    },
    leadingIndicator: detectLeadingIndicator(log, 30),
    journal: buildValidationJournalEntries(log, 15),
    dailyLog: [...log].reverse().slice(0, 30),
    weeklySummaries: buildWeeklySummaries(log),
    monthlySummaries: buildMonthlySummaries(log),
    notes: [
      "검증 페이지 전용 · Market Journal localStorage",
      "Phase 0~16 읽기 전용 · 일별 스냅샷에 행동·신뢰도·자동 기록 포함",
      "저장 시 Phase 13 기본 로그도 동기화",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function recordTodayMarketJournalSnapshot(events, options = {}) {
  const entry = buildDailyMarketJournalSnapshot(events, options)
  const journalResult = upsertPrecursorMarketJournalEntry(entry)
  recordTodayValidationSnapshot(events, options)
  return journalResult
}
