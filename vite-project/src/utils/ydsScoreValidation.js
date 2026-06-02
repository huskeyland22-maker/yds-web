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

/**
 * @param {object[]} historyRows
 */
export function analyzeYdsScoreDistribution(historyRows = []) {
  const scores = []
  const stageCounts = Object.fromEntries(STAGE_META.map((m) => [m.id, 0]))

  for (const row of historyRows ?? []) {
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

  const stageStats = STAGE_META.map((meta) => {
    const count = stageCounts[meta.id] ?? 0
    const pct = total ? (count / total) * 100 : 0
    return { ...meta, count, pct }
  })

  const suggestions = []
  const neutralPct = stageStats.find((s) => s.id === "neutral")?.pct ?? 0
  const interestPct = stageStats.find((s) => s.id === "interest")?.pct ?? 0
  const panicPct = stageStats.find((s) => s.id === "panicBuy")?.pct ?? 0
  const overheatPct = stageStats.find((s) => s.id === "overheated")?.pct ?? 0
  const dcaPct = stageStats.find((s) => s.id === "dca")?.pct ?? 0

  if (neutralPct >= 55) {
    suggestions.push("중립 비중이 높습니다. 중립 구간 폭을 축소하고 관심/분할매수 경계 재검토를 권장합니다.")
  }
  if (overheatPct <= 4 && panicPct <= 4) {
    suggestions.push("극단 구간(과열/패닉) 발생이 희소합니다. 양 끝단 경계값을 완화하는 민감도 점검이 필요합니다.")
  }
  if (interestPct + dcaPct <= 18) {
    suggestions.push("진입 준비 구간(관심+분할매수) 비중이 낮습니다. 중립→관심, 관심→분할 전환 임계치 점검을 권장합니다.")
  }
  if (panicPct >= 18) {
    suggestions.push("패닉 구간 비중이 높습니다. 패닉 임계값 상향 또는 VIX 가중치 민감도 점검을 권장합니다.")
  }
  if (avgScore != null && avgScore >= 62) {
    suggestions.push("평균 점수가 높은 편입니다. 상단 구간(중립/과열) 절단점 재검토를 권장합니다.")
  } else if (avgScore != null && avgScore <= 38) {
    suggestions.push("평균 점수가 낮은 편입니다. 하단 구간(관심/분할매수/패닉) 절단점 재검토를 권장합니다.")
  }

  if (!suggestions.length) {
    suggestions.push("현재 분포는 크게 치우치지 않습니다. 현행 구간 유지 후 월간 재검증을 권장합니다.")
  }

  return {
    total,
    avgScore,
    maxScore,
    minScore,
    stageStats,
    suggestions,
  }
}
