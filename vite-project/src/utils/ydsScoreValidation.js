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

const SCORE_BINS = [
  { id: "bin0", label: "0~20", min: 0, max: 20 },
  { id: "bin1", label: "20~40", min: 20, max: 40 },
  { id: "bin2", label: "40~60", min: 40, max: 60 },
  { id: "bin3", label: "60~80", min: 60, max: 80 },
  { id: "bin4", label: "80~100", min: 80, max: 101 },
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
  const scoreBinCounts = Object.fromEntries(SCORE_BINS.map((b) => [b.id, 0]))

  for (const row of rows ?? []) {
    const panic = panicDataFromCycleRow(row)
    if (!panic) continue
    const score = getFinalScore(panic)
    if (!Number.isFinite(score)) continue
    const stage = resolveMacroV1Status(score)
    if (!stage) continue
    scores.push(score)
    if (stage.id in stageCounts) stageCounts[stage.id] += 1
    const bin = SCORE_BINS.find((b) => score >= b.min && score < b.max)
    if (bin) scoreBinCounts[bin.id] += 1
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
  const scoreBins = SCORE_BINS.map((bin) => {
    const count = scoreBinCounts[bin.id] ?? 0
    const pct = total ? (count / total) * 100 : 0
    const warning =
      pct > 60
        ? `${bin.label} 구간 비중 ${pct.toFixed(1)}% (과도 집중)`
        : pct > 0 && pct < 3
          ? `${bin.label} 구간 비중 ${pct.toFixed(1)}% (희소)`
          : null
    return { ...bin, count, pct, warning }
  })
  const imbalanceWarnings = stageStats
    .map((s) => s.warning)
    .filter(Boolean)
    .concat(scoreBins.map((b) => b.warning).filter(Boolean))

  const severe = imbalanceWarnings.filter((w) => /(과다|과도|희소|과소)/.test(w)).length
  let fitnessGrade = "A"
  if (severe >= 4) fitnessGrade = "D"
  else if (severe >= 3) fitnessGrade = "C"
  else if (severe >= 1) fitnessGrade = "B"

  const recommendation =
    fitnessGrade === "A"
      ? "현재 체계 적합도 : A · 구간 분포 균형이 우수하여 실전 활용성이 높습니다."
      : fitnessGrade === "B"
        ? "현재 체계 적합도 : B · 일부 구간 쏠림이 있으나 실전 활용 가능한 수준입니다."
        : fitnessGrade === "C"
          ? "현재 체계 적합도 : C · 중간 이상 왜곡이 있어 구간 경계 재점검이 필요합니다."
          : "현재 체계 적합도 : D · 특정 구간 집중이 커 점수 경계 재설계 검토가 필요합니다."

  return {
    total,
    avgScore,
    maxScore,
    minScore,
    medianScore,
    stdDev,
    stageStats,
    scoreBins,
    imbalanceWarnings,
    fitnessGrade,
    recommendation,
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
