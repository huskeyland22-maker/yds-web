import { applyEventCompletion } from "./ydsHistoricalEventCompletions.js"

/**
 * YDS 역사 검증용 대표 이벤트 데이터셋 (2차)
 * - 실제 역사적 사건 기반 이벤트만 유지
 * - 카테고리: panic / dca / interest / overheated
 * - 각 이벤트 대표 날짜 5개: 시작 / 상승 / 공포확대 / 극점 / 회복
 */

/** @typedef {"panic" | "dca" | "interest" | "overheated"} YdsEventCategory */

/** @type {Array<{ id: string; category: YdsEventCategory; name: string; startDate: string; endDate: string; keyDates: { start: string; rally: string; fearExpansion: string; extreme: string; recovery: string } }>} */
const RAW_EVENTS = [
  {
    id: "panic-2008-lehman",
    category: "panic",
    name: "리먼쇼크",
    startDate: "2008-09-01",
    endDate: "2009-03-31",
    keyDates: { start: "2008-09-01", rally: "2008-10-13", fearExpansion: "2008-10-10", extreme: "2008-11-20", recovery: "2009-03-23" },
  },
  {
    id: "panic-2011-us-downgrade",
    category: "panic",
    name: "미국 신용등급 강등",
    startDate: "2011-07-15",
    endDate: "2011-10-31",
    keyDates: { start: "2011-07-15", rally: "2011-08-09", fearExpansion: "2011-08-08", extreme: "2011-08-09", recovery: "2011-10-27" },
  },
  {
    id: "panic-2020-covid",
    category: "panic",
    name: "코로나 팬데믹 급락",
    startDate: "2020-02-20",
    endDate: "2020-06-30",
    keyDates: { start: "2020-02-20", rally: "2020-03-24", fearExpansion: "2020-03-12", extreme: "2020-03-16", recovery: "2020-06-08" },
  },
  {
    id: "panic-2022-tightening",
    category: "panic",
    name: "긴축 쇼크 베어마켓",
    startDate: "2022-01-03",
    endDate: "2022-11-15",
    keyDates: { start: "2022-01-03", rally: "2022-03-16", fearExpansion: "2022-06-13", extreme: "2022-10-13", recovery: "2022-11-10" },
  },
  {
    id: "panic-2023-svb",
    category: "panic",
    name: "미국 지역은행 스트레스 (SVB)",
    startDate: "2023-02-10",
    endDate: "2023-05-19",
    keyDates: { start: "2023-02-10", rally: "2023-03-14", fearExpansion: "2023-03-10", extreme: "2023-03-13", recovery: "2023-05-19" },
  },
  {
    id: "panic-2024-yen-carry",
    category: "panic",
    name: "엔캐리 청산 쇼크",
    startDate: "2024-07-01",
    endDate: "2024-08-31",
    keyDates: { start: "2024-07-01", rally: "2024-07-17", fearExpansion: "2024-08-02", extreme: "2024-08-05", recovery: "2024-08-30" },
  },

  {
    id: "dca-2020-reopening",
    category: "dca",
    name: "코로나 이후 리오프닝",
    startDate: "2020-04-01",
    endDate: "2020-09-30",
    keyDates: { start: "2020-04-01", rally: "2020-04-06", fearExpansion: "2020-04-21", extreme: "2020-05-14", recovery: "2020-08-18" },
  },
  {
    id: "dca-2022-h2",
    category: "dca",
    name: "2022 하반기 바닥 다지기",
    startDate: "2022-07-01",
    endDate: "2022-10-31",
    keyDates: { start: "2022-07-01", rally: "2022-07-15", fearExpansion: "2022-09-23", extreme: "2022-10-13", recovery: "2022-11-10" },
  },
  {
    id: "dca-2023-post-svb",
    category: "dca",
    name: "SVB 이후 회복 국면",
    startDate: "2023-03-15",
    endDate: "2023-08-31",
    keyDates: { start: "2023-03-15", rally: "2023-03-28", fearExpansion: "2023-05-04", extreme: "2023-05-04", recovery: "2023-08-31" },
  },
  {
    id: "dca-2024-summer-pullback",
    category: "dca",
    name: "2024 여름 조정",
    startDate: "2024-04-15",
    endDate: "2024-08-30",
    keyDates: { start: "2024-04-15", rally: "2024-05-15", fearExpansion: "2024-08-02", extreme: "2024-08-05", recovery: "2024-08-30" },
  },

  {
    id: "interest-2016-brexit",
    category: "interest",
    name: "브렉시트",
    startDate: "2016-05-01",
    endDate: "2016-09-30",
    keyDates: { start: "2016-05-01", rally: "2016-06-28", fearExpansion: "2016-06-24", extreme: "2016-06-24", recovery: "2016-08-15" },
  },
  {
    id: "interest-2018-trade-war",
    category: "interest",
    name: "미중 무역분쟁",
    startDate: "2018-03-01",
    endDate: "2018-09-30",
    keyDates: { start: "2018-03-01", rally: "2018-04-09", fearExpansion: "2018-06-19", extreme: "2018-06-28", recovery: "2018-08-27" },
  },
  {
    id: "interest-2024-q1",
    category: "interest",
    name: "2024 1분기 관망 구간",
    startDate: "2024-01-02",
    endDate: "2024-03-31",
    keyDates: { start: "2024-01-02", rally: "2024-02-22", fearExpansion: "2024-03-13", extreme: "2024-03-13", recovery: "2024-03-28" },
  },

  {
    id: "overheated-2000-dotcom",
    category: "overheated",
    name: "닷컴버블 정점",
    startDate: "1999-11-01",
    endDate: "2000-04-30",
    keyDates: { start: "1999-11-01", rally: "2000-01-03", fearExpansion: "2000-03-27", extreme: "2000-03-24", recovery: "2000-04-14" },
  },
  {
    id: "overheated-2020-liquidity",
    category: "overheated",
    name: "코로나 유동성 버블",
    startDate: "2020-08-01",
    endDate: "2020-12-31",
    keyDates: { start: "2020-08-01", rally: "2020-09-02", fearExpansion: "2020-09-03", extreme: "2020-09-03", recovery: "2020-11-09" },
  },
  {
    id: "overheated-2023-ai-rally",
    category: "overheated",
    name: "AI 랠리 과열",
    startDate: "2023-05-01",
    endDate: "2023-08-31",
    keyDates: { start: "2023-05-01", rally: "2023-05-26", fearExpansion: "2023-08-02", extreme: "2023-08-18", recovery: "2023-09-14" },
  },
  {
    id: "overheated-2024-ai-rally2",
    category: "overheated",
    name: "AI 2차 랠리",
    startDate: "2024-10-01",
    endDate: "2025-01-31",
    keyDates: { start: "2024-10-01", rally: "2024-11-06", fearExpansion: "2024-12-18", extreme: "2024-12-18", recovery: "2025-01-24" },
  },
]

function calcDurationDays(startDate, endDate) {
  const s = new Date(`${startDate}T12:00:00`).getTime()
  const e = new Date(`${endDate}T12:00:00`).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null
  return Math.round((e - s) / 86_400_000) + 1
}

function buildHistoryData(date) {
  return {
    date,
    yds: null,
    vix: null,
    cnn: null,
    bofa: null,
    hy: null,
    putCall: null,
    sp500: null,
  }
}

export const YDS_MILESTONE_ORDER = ["start", "rise", "fearExpansion", "climax", "recovery"]

export const YDS_VALIDATION_EVENT_DATASET = RAW_EVENTS.map((event) => ({
  ...event,
  phase: event.category,
  event: event.name,
  milestones: {
    start: { date: event.keyDates.start, historyData: buildHistoryData(event.keyDates.start) },
    rise: { date: event.keyDates.rally, historyData: buildHistoryData(event.keyDates.rally) },
    fearExpansion: { date: event.keyDates.fearExpansion, historyData: buildHistoryData(event.keyDates.fearExpansion) },
    climax: { date: event.keyDates.extreme, historyData: buildHistoryData(event.keyDates.extreme) },
    recovery: { date: event.keyDates.recovery, historyData: buildHistoryData(event.keyDates.recovery) },
  },
  marketPerformance: {
    maxDrawdownPct: null,
    after6mSp500Pct: null,
    after12mSp500Pct: null,
    performanceAnchorDate: null,
  },
  durationDays: calcDurationDays(event.startDate, event.endDate),
})).map(applyEventCompletion)

export const YDS_VALIDATION_EVENT_CATEGORY_LABEL = {
  panic: "패닉 이벤트",
  dca: "분할매수 이벤트",
  interest: "관심 이벤트",
  overheated: "과열 이벤트",
}

