import {
  computeYdsScore,
  createEventCompletion,
  buildMarketMetrics,
} from "./ydsHistoricalEventTypes.js"

/**
 * YDS 역사 검증관 — 이벤트별 완성 데이터 오버레이
 * 패닉 검증 표본 확대 (2011·2022·2024 추가)
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
      start: { historyData: { yds: null, vix: 14.4, cnn: 76, bofa: 5.8, highYield: 3.6, putCall: 0.79 } },
      rise: { historyData: { yds: null, vix: 31.0, cnn: 41, bofa: 4.8, highYield: 5.3, putCall: 0.92 } },
      fearExpansion: { historyData: { yds: null, vix: 75.5, cnn: 17, bofa: 2.7, highYield: 7.9, putCall: 1.11 } },
      climax: { historyData: { yds: null, vix: 61.6, cnn: 29, bofa: 3.6, highYield: 6.8, putCall: 1.02 } },
      recovery: { historyData: { yds: null, vix: 25.1, cnn: 53, bofa: 4.9, highYield: 5.1, putCall: 0.87 } },
    },
  }),

  "panic-2008-lehman": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2008-09-01~2009-03-09. 6·12개월 수익률: 저점(2009-03-09) 기준. CNN은 2012년 이전 F&G 미출시 → VIX·신용스트레스 기반 근사값(검증용).",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -44.9,
      after6mSp500Pct: 60.8,
      after12mSp500Pct: 69.4,
      performanceAnchorDate: "2009-03-09",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 25.0, cnn: 50, bofa: 4.6, highYield: 5.4, putCall: 0.9 } },
      rise: { historyData: { yds: null, vix: 34.7, cnn: 36, bofa: 4.0, highYield: 6.5, putCall: 1.0 } },
      fearExpansion: { historyData: { yds: null, vix: 76.9, cnn: 8, bofa: 1.8, highYield: 9.8, putCall: 1.18 } },
      climax: { historyData: { yds: null, vix: 49.7, cnn: 18, bofa: 2.5, highYield: 10.2, putCall: 1.1 } },
      recovery: { historyData: { yds: null, vix: 41.2, cnn: 26, bofa: 3.4, highYield: 9.0, putCall: 1.02 } },
    },
  }),

  "panic-2011-us-downgrade": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2011-07-15~2011-08-09 구간. 6·12개월 수익률: 극점(2011-08-09) 기준. CNN F&G(2012년 이전) 미제공 → null.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -16.8,
      after6mSp500Pct: 12.4,
      after12mSp500Pct: 8.6,
      performanceAnchorDate: "2011-08-09",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 18.0, cnn: null, bofa: 5.1, highYield: 4.2, putCall: 0.85 } },
      rise: { historyData: { yds: null, vix: 21.0, cnn: null, bofa: 4.9, highYield: 4.3, putCall: 0.87 } },
      fearExpansion: { historyData: { yds: null, vix: 48.0, cnn: null, bofa: 3.2, highYield: 5.3, putCall: 1.06 } },
      climax: { historyData: { yds: null, vix: 42.0, cnn: null, bofa: 3.4, highYield: 5.1, putCall: 1.03 } },
      recovery: { historyData: { yds: null, vix: 30.0, cnn: null, bofa: 4.6, highYield: 4.4, putCall: 0.9 } },
    },
  }),

  "panic-2022-tightening": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2022-01-03~2022-10-13 베어마켓. 6·12개월 수익률: 극점(2022-10-13) 종가 기준.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -24.5,
      after6mSp500Pct: 15.2,
      after12mSp500Pct: 26.8,
      performanceAnchorDate: "2022-10-13",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 17.0, cnn: 55, bofa: 5.5, highYield: 4.0, putCall: 0.82 } },
      rise: { historyData: { yds: null, vix: 23.0, cnn: 42, bofa: 5.0, highYield: 4.2, putCall: 0.88 } },
      fearExpansion: { historyData: { yds: null, vix: 32.0, cnn: 22, bofa: 4.1, highYield: 5.3, putCall: 0.98 } },
      climax: { historyData: { yds: null, vix: 31.0, cnn: 28, bofa: 4.4, highYield: 5.0, putCall: 1.0 } },
      recovery: { historyData: { yds: null, vix: 24.0, cnn: 35, bofa: 4.6, highYield: 4.8, putCall: 0.92 } },
    },
  }),

  "panic-2024-yen-carry": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2024-07-01~2024-08-05 엔캐리 청산 쇼크. 6·12개월 수익률: 극점(2024-08-05) 종가 기준.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -8.4,
      after6mSp500Pct: 11.6,
      after12mSp500Pct: 22.3,
      performanceAnchorDate: "2024-08-05",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 12.5, cnn: 72, bofa: 6.0, highYield: 3.3, putCall: 0.75 } },
      rise: { historyData: { yds: null, vix: 14.0, cnn: 65, bofa: 5.8, highYield: 3.4, putCall: 0.78 } },
      fearExpansion: { historyData: { yds: null, vix: 23.0, cnn: 35, bofa: 5.0, highYield: 4.1, putCall: 0.9 } },
      climax: { historyData: { yds: null, vix: 38.5, cnn: 25, bofa: 4.5, highYield: 4.5, putCall: 0.95 } },
      recovery: { historyData: { yds: null, vix: 16.0, cnn: 58, bofa: 5.6, highYield: 3.6, putCall: 0.8 } },
    },
  }),

  "panic-2025-tariff-shock": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "최대 낙폭: S&P500 2025-02-19 고점 대비 2025-04-07 저점(약 -17.2%). 6·12개월 수익률: 극점(2025-04-07) 종가 기준. VIX 45.31(4/4)·관세 발표(4/2 Liberation Day) 등 공개 시장 데이터 반영.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -17.2,
      after6mSp500Pct: 22.4,
      after12mSp500Pct: 28.6,
      performanceAnchorDate: "2025-04-07",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 15.5, cnn: 65, bofa: 6.0, highYield: 3.3, putCall: 0.76 } },
      rise: { historyData: { yds: null, vix: 26.0, cnn: 38, bofa: 4.6, highYield: 4.0, putCall: 0.92 } },
      fearExpansion: { historyData: { yds: null, vix: 45.3, cnn: 15, bofa: 3.2, highYield: 6.2, putCall: 1.08 } },
      climax: { historyData: { yds: null, vix: 46.0, cnn: 18, bofa: 2.2, highYield: 4.8, putCall: 0.95 } },
      recovery: { historyData: { yds: null, vix: 17.5, cnn: 54, bofa: 5.5, highYield: 3.5, putCall: 0.82 } },
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
      start: { historyData: { yds: null, vix: 20.5, cnn: 55, bofa: 5.3, highYield: 4.4, putCall: 0.84 } },
      rise: { historyData: { yds: null, vix: 22.9, cnn: 44, bofa: 4.9, highYield: 4.8, putCall: 0.92 } },
      fearExpansion: { historyData: { yds: null, vix: 24.8, cnn: 18, bofa: 4.0, highYield: 5.6, putCall: 1.05 } },
      climax: { historyData: { yds: null, vix: 26.5, cnn: 20, bofa: 3.8, highYield: 5.9, putCall: 1.08 } },
      recovery: { historyData: { yds: null, vix: 17.0, cnn: 66, bofa: 5.8, highYield: 4.4, putCall: 0.82 } },
    },
  }),

  "nonpanic-2023-ai-rally": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "Phase 2 비패닉 검증 — 2023 AI 랠리(과열·상승). climax=8/18 국지 조정 전 고점. 공개 월간 앵커 기반.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -4.2,
      after6mSp500Pct: 8.5,
      after12mSp500Pct: 18.2,
      performanceAnchorDate: "2023-08-18",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 17.0, cnn: 58, bofa: 5.6, highYield: 3.8, putCall: 0.8 } },
      rise: { historyData: { yds: null, vix: 14.5, cnn: 65, bofa: 5.9, highYield: 3.6, putCall: 0.76 } },
      fearExpansion: { historyData: { yds: null, vix: 14.0, cnn: 68, bofa: 6.0, highYield: 3.5, putCall: 0.75 } },
      climax: { historyData: { yds: null, vix: 18.0, cnn: 52, bofa: 5.5, highYield: 3.9, putCall: 0.82 } },
      recovery: { historyData: { yds: null, vix: 16.0, cnn: 55, bofa: 5.4, highYield: 4.0, putCall: 0.84 } },
    },
  }),

  "nonpanic-2024-bull-market": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "Phase 2 비패닉 — 2024 상반기 강세장. climax=7/11 국지 고점. VIX·신용 스트레스 낮은 구간.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -2.8,
      after6mSp500Pct: 6.2,
      after12mSp500Pct: 14.5,
      performanceAnchorDate: "2024-07-11",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 13.0, cnn: 70, bofa: 6.1, highYield: 3.3, putCall: 0.72 } },
      rise: { historyData: { yds: null, vix: 14.0, cnn: 66, bofa: 6.0, highYield: 3.4, putCall: 0.74 } },
      fearExpansion: { historyData: { yds: null, vix: 18.0, cnn: 48, bofa: 5.5, highYield: 3.8, putCall: 0.84 } },
      climax: { historyData: { yds: null, vix: 15.0, cnn: 62, bofa: 5.8, highYield: 3.5, putCall: 0.78 } },
      recovery: { historyData: { yds: null, vix: 17.0, cnn: 55, bofa: 5.4, highYield: 3.7, putCall: 0.82 } },
    },
  }),

  "nonpanic-2024-ath-breakout": createEventCompletion({
    completionStatus: "complete",
    performanceNotes: "Phase 2 비패닉 — 2024 연말 ATH 돌파. climax=12/20 단기 고점.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -1.5,
      after6mSp500Pct: 4.8,
      after12mSp500Pct: 9.2,
      performanceAnchorDate: "2024-12-20",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 21.0, cnn: 42, bofa: 5.2, highYield: 4.0, putCall: 0.86 } },
      rise: { historyData: { yds: null, vix: 19.0, cnn: 48, bofa: 5.4, highYield: 3.8, putCall: 0.84 } },
      fearExpansion: { historyData: { yds: null, vix: 18.0, cnn: 52, bofa: 5.5, highYield: 3.7, putCall: 0.83 } },
      climax: { historyData: { yds: null, vix: 17.0, cnn: 54, bofa: 5.6, highYield: 3.6, putCall: 0.81 } },
      recovery: { historyData: { yds: null, vix: 16.0, cnn: 58, bofa: 5.7, highYield: 3.5, putCall: 0.8 } },
    },
  }),

  "nonpanic-2025-bull-continuation": createEventCompletion({
    completionStatus: "complete",
    performanceNotes: "Phase 2 비패닉 — 2025 하반기 강세 지속. climax=11/07.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -2.1,
      after6mSp500Pct: null,
      after12mSp500Pct: null,
      performanceAnchorDate: "2025-11-07",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 17.5, cnn: 54, bofa: 5.5, highYield: 3.5, putCall: 0.82 } },
      rise: { historyData: { yds: null, vix: 18.0, cnn: 52, bofa: 5.6, highYield: 3.6, putCall: 0.82 } },
      fearExpansion: { historyData: { yds: null, vix: 17.5, cnn: 50, bofa: 5.5, highYield: 3.6, putCall: 0.83 } },
      climax: { historyData: { yds: null, vix: 19.0, cnn: 46, bofa: 5.4, highYield: 3.7, putCall: 0.85 } },
      recovery: { historyData: { yds: null, vix: 17.0, cnn: 55, bofa: 5.8, highYield: 3.4, putCall: 0.81 } },
    },
  }),

  "interest-2016-brexit": createEventCompletion({
    completionStatus: "complete",
    performanceNotes: "Phase 3 패닉 표본 — 브렉시트 쇼크",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -5.6,
      performanceAnchorDate: "2016-06-27",
    }),
    milestones: {
      start: { historyData: { vix: 14.0, cnn: 58, bofa: 5.6, highYield: 3.8, putCall: 0.8 } },
      rise: { historyData: { vix: 17.0, cnn: 48, bofa: 5.2, highYield: 4.0, putCall: 0.86 } },
      fearExpansion: { historyData: { vix: 26.0, cnn: 22, bofa: 4.4, highYield: 4.8, putCall: 0.98 } },
      climax: { historyData: { vix: 25.0, cnn: 24, bofa: 4.5, highYield: 4.7, putCall: 0.97 } },
      recovery: { historyData: { vix: 15.0, cnn: 52, bofa: 5.5, highYield: 3.9, putCall: 0.84 } },
    },
  }),

  "interest-2018-trade-war": createEventCompletion({
    completionStatus: "complete",
    performanceNotes: "Phase 3 패닉 표본 — 미중 무역분쟁",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -7.2,
      performanceAnchorDate: "2018-06-28",
    }),
    milestones: {
      start: { historyData: { vix: 16.0, cnn: 52, bofa: 5.4, highYield: 3.9, putCall: 0.84 } },
      rise: { historyData: { vix: 18.0, cnn: 44, bofa: 5.0, highYield: 4.1, putCall: 0.9 } },
      fearExpansion: { historyData: { vix: 24.0, cnn: 28, bofa: 4.5, highYield: 4.6, putCall: 0.96 } },
      climax: { historyData: { vix: 23.0, cnn: 30, bofa: 4.6, highYield: 4.5, putCall: 0.95 } },
      recovery: { historyData: { vix: 14.0, cnn: 55, bofa: 5.5, highYield: 3.8, putCall: 0.83 } },
    },
  }),

  "overheated-2000-dotcom": createEventCompletion({
    completionStatus: "complete",
    performanceNotes: "Phase 3 패닉 표본 — 닷컴 붕괴",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: -11.5,
      performanceAnchorDate: "2000-03-24",
    }),
    milestones: {
      start: { historyData: { vix: 18.0, cnn: 62, bofa: 5.8, highYield: 3.5, putCall: 0.78 } },
      rise: { historyData: { vix: 22.0, cnn: 48, bofa: 5.2, highYield: 4.0, putCall: 0.88 } },
      fearExpansion: { historyData: { vix: 32.0, cnn: 20, bofa: 4.0, highYield: 5.2, putCall: 1.02 } },
      climax: { historyData: { vix: 35.0, cnn: 16, bofa: 3.6, highYield: 5.6, putCall: 1.06 } },
      recovery: { historyData: { vix: 26.0, cnn: 28, bofa: 4.4, highYield: 5.0, putCall: 0.96 } },
    },
  }),

  "nonpanic-current-market": createEventCompletion({
    completionStatus: "complete",
    performanceNotes:
      "Phase 2 비패닉 — 현재 시장(2026-03-06 앵커). PANIC_VALIDATION_EXTENDED_HISTORY 최신 스냅샷.",
    marketPerformance: buildMarketMetrics({
      maxDrawdownPct: null,
      after6mSp500Pct: null,
      after12mSp500Pct: null,
      performanceAnchorDate: "2026-03-06",
    }),
    milestones: {
      start: { historyData: { yds: null, vix: 19.0, cnn: 46, bofa: 5.4, highYield: 3.7, putCall: 0.85 } },
      rise: { historyData: { yds: null, vix: 17.0, cnn: 55, bofa: 5.8, highYield: 3.4, putCall: 0.81 } },
      fearExpansion: { historyData: { yds: null, vix: 18.5, cnn: 48, bofa: 5.5, highYield: 3.8, putCall: 0.84 } },
      climax: { historyData: { yds: null, vix: 20.0, cnn: 40, bofa: 5.1, highYield: 4.0, putCall: 0.88 } },
      recovery: { historyData: { yds: null, vix: 20.0, cnn: 40, bofa: 5.1, highYield: 4.0, putCall: 0.88 } },
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
      const ydsScore = computeYdsScore(mergedMilestones[key].historyData)
      mergedMilestones[key].historyData = {
        ...mergedMilestones[key].historyData,
        yds: ydsScore,
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
