import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "./tradingScores.js"
import { panicDataFromCycleRow } from "./cycleHistoryUtils.js"

const STAGE_META = [
  { id: "overheated", emoji: "🔵", label: "과열" },
  { id: "neutral", emoji: "🟢", label: "중립" },
  { id: "interest", emoji: "🟡", label: "관심" },
  { id: "dca", emoji: "🟠", label: "분할매수" },
  { id: "panicBuy", emoji: "🔴", label: "패닉매수" },
]

function toDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

function calcMedian(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function calcStdDev(values, avg) {
  if (!values.length || !Number.isFinite(avg)) return null
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * @param {object[]} rows
 */
function analyzeWindow(rows = []) {
  const scores = []
  const stageCounts = Object.fromEntries(STAGE_META.map((m) => [m.id, 0]))

  for (const row of rows ?? []) {
    const panic = panicDataFromCycleRow(row)
    if (!panic) continue
    const score = getFinalScore(panic)
    if (!Number.isFinite(score)) continue
    const stage = resolveMacroV1Status(score)
    if (!stage) continue
    scores.push(score)
    if (stage.id in stageCounts) stageCounts[stage.id] += 1
  }

  const total = scores.length
  const avgScore = total ? scores.reduce((sum, v) => sum + v, 0) / total : null
  const maxScore = total ? Math.max(...scores) : null
  const minScore = total ? Math.min(...scores) : null
  const medianScore = total ? calcMedian(scores) : null
  const stdDev = total ? calcStdDev(scores, avgScore) : null
  const stageStats = STAGE_META.map((meta) => {
    const count = stageCounts[meta.id] ?? 0
    const pct = total ? (count / total) * 100 : 0
    const warning =
      pct >= 70
        ? `${meta.label} 비중 ${pct.toFixed(1)}% (과다)`
        : pct > 0 && pct < 5
          ? `${meta.label} 비중 ${pct.toFixed(1)}% (과소)`
          : null
    return { ...meta, count, pct, warning }
  })
  const imbalanceWarnings = stageStats
    .map((s) => s.warning)
    .filter(Boolean)

  return {
    total,
    avgScore,
    maxScore,
    minScore,
    medianScore,
    stdDev,
    stageStats,
    imbalanceWarnings,
  }
}

/**
 * @param {object[]} historyRows
 */
export function analyzeYdsScoreDistribution(historyRows = []) {
  return analyzeWindow(historyRows)
}

/**
 * @param {object[]} historyRows
 */
export function analyzeYdsScoreDistributionWindows(historyRows = []) {
  const rows = [...(historyRows ?? [])]
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(toDateKey(row)))
    .sort((a, b) => toDateKey(a).localeCompare(toDateKey(b)))
  const latestKey = toDateKey(rows[rows.length - 1] ?? null)
  if (!latestKey) {
    return {
      recent1y: analyzeWindow([]),
      recent3y: analyzeWindow([]),
      all: analyzeWindow([]),
    }
  }
  const latestTs = new Date(`${latestKey}T12:00:00`).getTime()
  const year1Cut = latestTs - 365 * 86_400_000
  const year3Cut = latestTs - 365 * 3 * 86_400_000
  const recent1yRows = rows.filter((row) => new Date(`${toDateKey(row)}T12:00:00`).getTime() >= year1Cut)
  const recent3yRows = rows.filter((row) => new Date(`${toDateKey(row)}T12:00:00`).getTime() >= year3Cut)
  return {
    recent1y: analyzeWindow(recent1yRows),
    recent3y: analyzeWindow(recent3yRows),
    all: analyzeWindow(rows),
  }
}
