/**
 * YDS 역사 검증관 — 이벤트별 완성 데이터 오버레이
 * 코로나 → 리먼 → SVB 순으로 확장. 미완성 이벤트는 스켈레톤(null) 유지.
 *
 * 지표 출처(코로나): VIX 종가(CBOE), CNN Fear & Greed 일별 지수(공개 역사값 근사)
 * 시장 성과: S&P500(SPX) 종가 — 전고(2020-02-19) 대비 저점(2020-03-23) MDD,
 *            저점 기준 6·12개월 후 수익률
 */

/** @typedef {"skeleton" | "complete"} YdsEventCompletionStatus */

/**
 * @type {Record<string, {
 *   completionStatus: YdsEventCompletionStatus
 *   performanceNotes?: string
 *   marketPerformance: {
 *     maxDrawdownPct: number | null
 *     after6mSp500Pct: number | null
 *     after12mSp500Pct: number | null
 *     performanceAnchorDate?: string | null
 *   }
 *   milestones?: Partial<Record<"start"|"rise"|"fearExpansion"|"climax"|"recovery", { historyData?: Partial<{ vix: number | null, cnn: number | null }> }>>
 * }>}
 */
export const YDS_EVENT_COMPLETIONS = {
  "panic-2020-covid": {
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 전고(2020-02-19) 대비 저점(2020-03-23). 6·12개월 수익률: 저점 종가 기준.",
    marketPerformance: {
      maxDrawdownPct: -33.9,
      after6mSp500Pct: 48.2,
      after12mSp500Pct: 75.0,
      performanceAnchorDate: "2020-03-23",
    },
    milestones: {
      start: { historyData: { vix: 14.4, cnn: 76 } },
      rise: { historyData: { vix: 61.6, cnn: 29 } },
      fearExpansion: { historyData: { vix: 75.5, cnn: 17 } },
      climax: { historyData: { vix: 82.7, cnn: 12 } },
      recovery: { historyData: { vix: 25.1, cnn: 53 } },
    },
  },
}

/** @param {Record<string, unknown>} event */
export function applyEventCompletion(event) {
  const completion = YDS_EVENT_COMPLETIONS[event.id]
  if (!completion) {
    return { ...event, completionStatus: "skeleton" }
  }

  const mergedMilestones = { ...event.milestones }
  if (completion.milestones) {
    for (const [key, patch] of Object.entries(completion.milestones)) {
      const base = mergedMilestones[key]
      if (!base) continue
      mergedMilestones[key] = {
        ...base,
        historyData: {
          ...base.historyData,
          ...(patch.historyData ?? {}),
        },
      }
    }
  }

  return {
    ...event,
    completionStatus: completion.completionStatus,
    performanceNotes: completion.performanceNotes ?? null,
    marketPerformance: {
      ...event.marketPerformance,
      ...completion.marketPerformance,
    },
    milestones: mergedMilestones,
  }
}

export function isEventComplete(event) {
  return event?.completionStatus === "complete"
}
