import {
  createEventCompletion,
  buildMarketMetrics,
} from "./ydsHistoricalEventTypes.js"

/**
 * YDS 역사 검증관 — 이벤트별 완성 데이터 오버레이
 * 코로나 → 리먼 → SVB 순 확장
 */

/** @type {Record<string, import("./ydsHistoricalEventTypes.js").EventCompletionPayload>} */
export const YDS_EVENT_COMPLETIONS = {
  "panic-2020-covid": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 전고(2020-02-19) 대비 저점(2020-03-23). 6·12개월 수익률: 저점 종가 기준.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -33.9,
      after6mSp500Pct: 48.2,
      after12mSp500Pct: 75.0,
      performanceAnchorDate: "2020-03-23",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 14.4, cnn: 76, bofa: null, highYield: null, putCall: null } },
      rise: { historyData: { yds: null, vix: 31.0, cnn: 41, bofa: null, highYield: null, putCall: null } },
      fearExpansion: { historyData: { yds: null, vix: 75.5, cnn: 17, bofa: null, highYield: null, putCall: null } },
      climax: { historyData: { yds: null, vix: 61.6, cnn: 29, bofa: null, highYield: null, putCall: null } },
      recovery: { historyData: { yds: null, vix: 25.1, cnn: 53, bofa: null, highYield: null, putCall: null } },
    },
  }),

  "panic-2008-lehman": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2008-09-01~2009-03-09 구간. 6·12개월 수익률: 저점(2009-03-09) 종가 기준. CNN F&G는 2012년 이전 미제공 → null.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -44.9,
      after6mSp500Pct: 60.8,
      after12mSp500Pct: 69.4,
      performanceAnchorDate: "2009-03-09",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 25.0, cnn: null, bofa: null, highYield: null, putCall: null } },
      rise: { historyData: { yds: null, vix: 34.7, cnn: null, bofa: null, highYield: null, putCall: null } },
      fearExpansion: { historyData: { yds: null, vix: 76.9, cnn: null, bofa: null, highYield: null, putCall: null } },
      climax: { historyData: { yds: null, vix: 49.7, cnn: null, bofa: null, highYield: null, putCall: null } },
      recovery: { historyData: { yds: null, vix: 41.2, cnn: null, bofa: null, highYield: null, putCall: null } },
    },
  }),

  "panic-2023-svb": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2023-02-10~2023-03-13 구간. 6·12개월 수익률: 극점(2023-03-13) 종가 기준.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -5.7,
      after6mSp500Pct: 15.8,
      after12mSp500Pct: 33.9,
      performanceAnchorDate: "2023-03-13",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 20.5, cnn: 55, bofa: null, highYield: 4.4, putCall: 0.84 } },
      rise: { historyData: { yds: null, vix: 22.9, cnn: 44, bofa: null, highYield: 4.8, putCall: 0.92 } },
      fearExpansion: { historyData: { yds: null, vix: 24.8, cnn: 18, bofa: null, highYield: 5.6, putCall: 1.05 } },
      climax: { historyData: { yds: null, vix: 26.5, cnn: 20, bofa: null, highYield: 5.9, putCall: 1.08 } },
      recovery: { historyData: { yds: null, vix: 17.0, cnn: 66, bofa: null, highYield: 4.4, putCall: 0.82 } },
    },
  }),
}

/** @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event */
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
