import { buildPrecursorEnginePhase6Report } from "./ydsPrecursorEnginePhase6.js"
import { buildPrecursorDashboardBetaReport } from "./ydsPrecursorEnginePhase12.js"
import { REGIME_BY_ID } from "./ydsPrecursorRegimeDisplay.js"
import { formatMetric } from "./ydsHistoricalEventTypes.js"
import { offsetPrecursorDay, parsePrecursorDay } from "./ydsPrecursorInterpolation.js"
import {
  loadPrecursorValidationLog,
  upsertPrecursorValidationSnapshot,
} from "./ydsPrecursorValidationLogStorage.js"

export const PRECURSOR_ENGINE_PHASE13_LABEL =
  "YDS Precursor Engine — Phase 13 (Real Market Validation Log)"

const FIRST_MOVER_THRESHOLDS = {
  ydsScore: 4,
  priA: 3,
  priB: 3,
  dominantSimilarity: 5,
}

const FIRST_MOVER_LABELS = {
  ydsScore: "YDS",
  priA: "PRI-A",
  priB: "PRI-B",
  dominantSimilarity: "우세 패턴 유사도",
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function buildDailyValidationSnapshot(events, options = {}) {
  const dashboard = buildPrecursorDashboardBetaReport(events, options)
  const phase6 = buildPrecursorEnginePhase6Report(events, options)
  const date =
    String(dashboard.asOf ?? "").slice(0, 10) ||
    new Date().toISOString().slice(0, 10)

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
    interpretation: dashboard.cards.interpretation.text ?? "",
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
 * @param {ReturnType<typeof loadPrecursorValidationLog>} log
 * @param {string} endDate
 * @param {number} offsetDays
 */
function findSnapshotAtOffset(log, endDate, offsetDays) {
  const targetDate = offsetPrecursorDay(endDate, -offsetDays)
  const targetTs = parsePrecursorDay(targetDate)
  let best = null
  let bestDist = Infinity
  for (const row of log) {
    const ts = parsePrecursorDay(row.date)
    const dist = Math.abs(ts - targetTs)
    if (dist < bestDist) {
      bestDist = dist
      best = row
    }
    if (ts <= targetTs) best = row
  }
  return best
}

/**
 * @param {ReturnType<typeof buildDailyValidationSnapshot>} past
 * @param {ReturnType<typeof buildDailyValidationSnapshot>} current
 */
function buildThirtyDayComparison(past, current) {
  if (!past || !current) {
    return {
      hasPast: false,
      pastDate: null,
      currentDate: current?.date ?? null,
      rows: [],
    }
  }
  return {
    hasPast: true,
    pastDate: past.date,
    currentDate: current.date,
    rows: [
      { key: "ydsScore", label: "YDS", ...formatDelta(past.ydsScore, current.ydsScore) },
      { key: "priA", label: "PRI-A", ...formatDelta(past.priA, current.priA) },
      { key: "priB", label: "PRI-B", ...formatDelta(past.priB, current.priB) },
      {
        key: "dominantSimilarity",
        label: "우세 패턴 유사도",
        ...formatDelta(past.dominantSimilarity, current.dominantSimilarity),
      },
      {
        key: "regime",
        label: "국면",
        delta: null,
        deltaLabel: `${past.regimeEmoji} ${past.regimeLabel} → ${current.regimeEmoji} ${current.regimeLabel}`,
        changed: past.regimeId !== current.regimeId,
      },
      {
        key: "pattern",
        label: "우세 패턴",
        delta: null,
        deltaLabel: `${past.dominantPatternLabel} → ${current.dominantPatternLabel}`,
        changed: past.dominantPatternId !== current.dominantPatternId,
      },
    ],
  }
}

/**
 * @param {ReturnType<typeof loadPrecursorValidationLog>} log
 */
function buildRegimeChangeLogFromSnapshots(log) {
  /** @type {{ date: string; from: object; to: object }[]} */
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
 * @param {ReturnType<typeof loadPrecursorValidationLog>} log
 */
function buildPatternRankChangeLog(log) {
  /** @type {object[]} */
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
 * @param {ReturnType<typeof loadPrecursorValidationLog>} log
 * @param {number} [windowDays]
 */
function detectFirstMover(log, windowDays = 30) {
  if (log.length < 2) {
    return {
      found: false,
      label: "—",
      reason: "스냅샷 2일 이상 필요",
    }
  }
  const endDate = log[log.length - 1].date
  const startTs = parsePrecursorDay(endDate) - windowDays * 86_400_000
  const windowLog = log.filter((r) => parsePrecursorDay(r.date) >= startTs)

  /** @type {{ date: string; key: string; label: string; delta: number }[]} */
  const events = []
  for (let i = 1; i < windowLog.length; i += 1) {
    const prev = windowLog[i - 1]
    const cur = windowLog[i]
    for (const key of Object.keys(FIRST_MOVER_THRESHOLDS)) {
      const p = prev[key]
      const c = cur[key]
      if (p == null || c == null || !Number.isFinite(p) || !Number.isFinite(c)) continue
      const delta = Math.abs(c - p)
      if (delta >= FIRST_MOVER_THRESHOLDS[key]) {
        events.push({
          date: cur.date,
          key,
          label: FIRST_MOVER_LABELS[key],
          delta: Math.round((c - p) * 10) / 10,
        })
      }
    }
    if (prev.regimeId !== cur.regimeId) {
      events.push({
        date: cur.date,
        key: "regime",
        label: "국면",
        delta: (REGIME_BY_ID[cur.regimeId]?.order ?? 0) - (REGIME_BY_ID[prev.regimeId]?.order ?? 0),
      })
    }
  }

  if (!events.length) {
    const first = windowLog[0]
    const last = windowLog[windowLog.length - 1]
    const scores = Object.keys(FIRST_MOVER_LABELS).map((key) => {
      const p = first[key]
      const l = last[key]
      if (p == null || l == null) return null
      return { key, label: FIRST_MOVER_LABELS[key], absDelta: Math.abs(l - p) }
    }).filter(Boolean)
    const top = scores.sort((a, b) => (b?.absDelta ?? 0) - (a?.absDelta ?? 0))[0]
    if (!top) {
      return { found: false, label: "—", reason: "30일 구간 변화 미미" }
    }
    return {
      found: true,
      label: top.label,
      date: last.date,
      delta: formatDelta(first[top.key], last[top.key]).label,
      reason: `30일 누적 최대 변화 (${top.label})`,
      mode: "cumulative",
    }
  }

  const earliest = [...events].sort((a, b) => a.date.localeCompare(b.date))[0]
  return {
    found: true,
    label: earliest.label,
    date: earliest.date,
    delta: earliest.delta > 0 ? `+${earliest.delta}` : String(earliest.delta),
    reason: `${earliest.date} 최초 임계 돌파`,
    mode: "chronological",
  }
}

/**
 * @param {ReturnType<typeof loadPrecursorValidationLog>} log
 * @param {number} [limit]
 */
function buildValidationJournal(log, limit = 15) {
  return [...log]
    .reverse()
    .slice(0, limit)
    .map((row) => ({
      date: row.date,
      savedAt: row.savedAt,
      regimeLabel: `${row.regimeEmoji} ${row.regimeLabel}`,
      patternLine: `${row.dominantPatternLabel} ${formatMetric(row.dominantSimilarity, 0)}%`,
      yds: row.ydsScore,
      priA: row.priA,
      priB: row.priB,
      interpretation: row.interpretation,
    }))
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[]; log?: ReturnType<typeof loadPrecursorValidationLog> }} [options]
 */
export function buildPrecursorEnginePhase13Report(events, options = {}) {
  const log = options.log ?? loadPrecursorValidationLog()
  const live = buildDailyValidationSnapshot(events, options)
  const savedToday = log.find((r) => r.date === live.date) ?? null
  const past30 = findSnapshotAtOffset(log, live.date, 30)
  const comparison30 = buildThirtyDayComparison(past30, savedToday ?? live)

  const endTs = parsePrecursorDay(live.date)
  const log90 = log.filter((r) => parsePrecursorDay(r.date) >= endTs - 90 * 86_400_000)
  const regimeChanges90 = buildRegimeChangeLogFromSnapshots(log90)
  const patternChanges90 = buildPatternRankChangeLog(log90)

  return {
    label: PRECURSOR_ENGINE_PHASE13_LABEL,
    live,
    savedToday,
    storage: {
      totalEntries: log.length,
      firstDate: log[0]?.date ?? null,
      lastDate: log[log.length - 1]?.date ?? null,
      hasToday: Boolean(savedToday),
    },
    comparison30,
    regimeChangeLog: buildRegimeChangeLogFromSnapshots(log).slice(0, 20),
    patternRankChangeLog: buildPatternRankChangeLog(log).slice(0, 20),
    stats90d: {
      regimeChangeCount: regimeChanges90.length,
      patternChangeCount: patternChanges90.length,
    },
    firstMover: detectFirstMover(log, 30),
    journal: buildValidationJournal(log, 12),
    notes: [
      "검증 전용 · localStorage 일별 스냅샷",
      "Phase 12 실측 집약 · Phase 0~11 엔진 미변경",
      "가장 먼저 움직인 지표 = 30일 로그 내 최초 임계 돌파",
    ],
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 * @param {{ latestSnapshot?: Record<string, unknown> | null; extraRows?: object[] }} [options]
 */
export function recordTodayValidationSnapshot(events, options = {}) {
  const snapshot = buildDailyValidationSnapshot(events, options)
  return upsertPrecursorValidationSnapshot(snapshot)
}
