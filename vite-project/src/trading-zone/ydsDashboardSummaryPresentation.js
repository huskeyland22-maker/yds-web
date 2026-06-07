export const DASHBOARD_SUMMARY_LABEL = "Dashboard Summary — Phase 32"

/** @type {Record<string, string>} */
const RECOMMENDED_ACTION_BY_STAGE = {
  overheated: "현금 확보 · 추격 자제",
  neutral: "종목 탐색 우선",
  interest: "관심 종목 관찰 · 현금 유지",
  dca: "분할매수 시작",
  panicBuy: "인생 타점 적극 실행",
}

/**
 * 기존 시장 분석 리포트 슬라이스만 읽는 5초 요약 뷰모델 (엔진 미수정)
 *
 * @param {{
 *   actionStageHero: {
 *     id?: string
 *     emoji?: string
 *     shortLabel?: string
 *     color?: string
 *   }
 *   actionGuide?: { oneLiner?: string; current?: { label?: string } }
 *   marketEnvironment?: { marketCondition?: { emoji?: string; label?: string } }
 *   sectorRadar: { available?: boolean; topSectors?: { id: string; label: string; score: number; rank: number }[] }
 *   entryRadar: {
 *     available?: boolean
 *     tradeCandidates?: {
 *       id: string
 *       name: string
 *       entryScore: number
 *       grade: { id: string }
 *     }[]
 *   }
 *   portfolio: {
 *     available?: boolean
 *     allocation?: {
 *       stockPct?: number
 *       cashPct?: number
 *       stockLabel?: string
 *       cashLabel?: string
 *     } | null
 *   }
 * }} report
 */
export function buildDashboardSummaryViewModel(report) {
  const stageId = report.actionStageHero?.id ?? null
  const allocation = report.portfolio?.allocation

  const topSectors = (report.sectorRadar?.topSectors ?? []).slice(0, 3).map((s) => ({
    id: s.id,
    rank: s.rank,
    label: s.label,
    score: s.score,
  }))

  const topEntryCandidates = [...(report.entryRadar?.tradeCandidates ?? [])]
    .sort((a, b) => (b.entryScore ?? 0) - (a.entryScore ?? 0))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      name: c.name,
      entryScore: c.entryScore,
      grade: c.grade?.id ?? "—",
    }))

  return {
    label: DASHBOARD_SUMMARY_LABEL,
    available: Boolean(stageId),
    currentStatus: {
      stageId,
      emoji: report.actionStageHero?.emoji ?? "⚪",
      label: report.actionStageHero?.shortLabel ?? "—",
      color: report.actionStageHero?.color ?? "#64748b",
      environmentEmoji: report.marketEnvironment?.marketCondition?.emoji ?? "",
      environmentLabel: report.marketEnvironment?.marketCondition?.label ?? "",
    },
    recommendedAction:
      (stageId && RECOMMENDED_ACTION_BY_STAGE[stageId]) ||
      report.actionGuide?.oneLiner ||
      report.actionGuide?.current?.label ||
      "—",
    topSectors,
    topEntryCandidates,
    allocation: {
      stockPct: allocation?.stockPct ?? 0,
      cashPct: allocation?.cashPct ?? 100,
      stockLabel: allocation?.stockLabel ?? `주식 ${allocation?.stockPct ?? 0}%`,
      cashLabel: allocation?.cashLabel ?? `현금 ${allocation?.cashPct ?? 100}%`,
    },
    hasSectors: topSectors.length > 0,
    hasCandidates: topEntryCandidates.length > 0,
  }
}
