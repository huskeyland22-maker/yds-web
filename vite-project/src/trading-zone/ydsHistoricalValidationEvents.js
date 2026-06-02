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
    id: "panic-2020-covid-crash",
    category: "panic",
    name: "코로나 팬데믹 급락",
    startDate: "2020-02-20",
    endDate: "2020-06-30",
    keyDates: {
      start: "2020-02-20",
      rally: "2020-03-24",
      fearExpansion: "2020-03-12",
      extreme: "2020-03-16",
      recovery: "2020-06-08",
    },
  },
  {
    id: "panic-2022-tightening-bear",
    category: "panic",
    name: "긴축 쇼크 베어마켓",
    startDate: "2022-01-03",
    endDate: "2022-06-17",
    keyDates: {
      start: "2022-01-03",
      rally: "2022-03-16",
      fearExpansion: "2022-05-05",
      extreme: "2022-06-16",
      recovery: "2022-08-16",
    },
  },
  {
    id: "panic-2022-q3-to-q4",
    category: "panic",
    name: "2022 가을 저점 재시험",
    startDate: "2022-08-16",
    endDate: "2022-11-30",
    keyDates: {
      start: "2022-08-16",
      rally: "2022-10-04",
      fearExpansion: "2022-09-23",
      extreme: "2022-10-13",
      recovery: "2022-11-30",
    },
  },
  {
    id: "panic-2023-banking-stress",
    category: "panic",
    name: "미국 지역은행 스트레스",
    startDate: "2023-02-10",
    endDate: "2023-05-19",
    keyDates: {
      start: "2023-02-10",
      rally: "2023-03-14",
      fearExpansion: "2023-03-10",
      extreme: "2023-03-13",
      recovery: "2023-05-19",
    },
  },

  {
    id: "dca-2019-recovery-leg",
    category: "dca",
    name: "2019 상반기 회복 분할매수",
    startDate: "2019-01-04",
    endDate: "2019-05-31",
    keyDates: {
      start: "2019-01-04",
      rally: "2019-02-15",
      fearExpansion: "2019-01-03",
      extreme: "2018-12-24",
      recovery: "2019-04-26",
    },
  },
  {
    id: "dca-2020-reopening-trend",
    category: "dca",
    name: "팬데믹 이후 리오프닝 추세",
    startDate: "2020-04-01",
    endDate: "2020-09-30",
    keyDates: {
      start: "2020-04-01",
      rally: "2020-04-06",
      fearExpansion: "2020-03-23",
      extreme: "2020-03-23",
      recovery: "2020-08-18",
    },
  },
  {
    id: "dca-2022-h2-bottoming",
    category: "dca",
    name: "2022 하반기 바닥 다지기",
    startDate: "2022-07-01",
    endDate: "2022-10-31",
    keyDates: {
      start: "2022-07-01",
      rally: "2022-07-15",
      fearExpansion: "2022-09-23",
      extreme: "2022-10-13",
      recovery: "2022-11-10",
    },
  },
  {
    id: "dca-2024-spring-summer",
    category: "dca",
    name: "2024 봄·여름 조정 매수",
    startDate: "2024-04-15",
    endDate: "2024-08-30",
    keyDates: {
      start: "2024-04-15",
      rally: "2024-05-15",
      fearExpansion: "2024-08-05",
      extreme: "2024-08-05",
      recovery: "2024-08-30",
    },
  },

  {
    id: "interest-2019-late-cycle",
    category: "interest",
    name: "2019 하반기 관심 확대",
    startDate: "2019-07-01",
    endDate: "2019-10-31",
    keyDates: {
      start: "2019-07-01",
      rally: "2019-09-04",
      fearExpansion: "2019-08-05",
      extreme: "2019-08-05",
      recovery: "2019-10-11",
    },
  },
  {
    id: "interest-2020-pre-crash",
    category: "interest",
    name: "2020 초 과열 전환 감지",
    startDate: "2019-12-15",
    endDate: "2020-02-19",
    keyDates: {
      start: "2019-12-15",
      rally: "2020-01-17",
      fearExpansion: "2020-02-24",
      extreme: "2020-03-16",
      recovery: "2020-04-14",
    },
  },
  {
    id: "interest-2021-mid-cycle",
    category: "interest",
    name: "2021 중간 순환매 관심",
    startDate: "2021-04-01",
    endDate: "2021-07-31",
    keyDates: {
      start: "2021-04-01",
      rally: "2021-05-21",
      fearExpansion: "2021-05-12",
      extreme: "2021-05-12",
      recovery: "2021-07-26",
    },
  },
  {
    id: "interest-2024-q1-range",
    category: "interest",
    name: "2024 1분기 관망 구간",
    startDate: "2024-01-02",
    endDate: "2024-03-31",
    keyDates: {
      start: "2024-01-02",
      rally: "2024-02-22",
      fearExpansion: "2024-03-13",
      extreme: "2024-03-13",
      recovery: "2024-03-28",
    },
  },

  {
    id: "overheat-2020-growth-euphoria",
    category: "overheated",
    name: "2020 성장주 과열",
    startDate: "2020-08-01",
    endDate: "2020-12-31",
    keyDates: {
      start: "2020-08-01",
      rally: "2020-09-02",
      fearExpansion: "2020-09-03",
      extreme: "2020-09-03",
      recovery: "2020-11-09",
    },
  },
  {
    id: "overheat-2021-speculative-run",
    category: "overheated",
    name: "2021 투기성 과열",
    startDate: "2021-01-01",
    endDate: "2021-04-30",
    keyDates: {
      start: "2021-01-01",
      rally: "2021-01-26",
      fearExpansion: "2021-02-25",
      extreme: "2021-02-25",
      recovery: "2021-04-16",
    },
  },
  {
    id: "overheat-2023-ai-euphoria",
    category: "overheated",
    name: "2023 AI 랠리 과열",
    startDate: "2023-05-01",
    endDate: "2023-08-31",
    keyDates: {
      start: "2023-05-01",
      rally: "2023-05-26",
      fearExpansion: "2023-08-02",
      extreme: "2023-08-18",
      recovery: "2023-09-14",
    },
  },
]

function calcDurationDays(startDate, endDate) {
  const s = new Date(`${startDate}T12:00:00`).getTime()
  const e = new Date(`${endDate}T12:00:00`).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null
  return Math.round((e - s) / 86_400_000) + 1
}

export const YDS_VALIDATION_EVENT_DATASET = RAW_EVENTS.map((event) => ({
  ...event,
  durationDays: calcDurationDays(event.startDate, event.endDate),
}))

export const YDS_VALIDATION_EVENT_CATEGORY_LABEL = {
  panic: "패닉 이벤트",
  dca: "분할매수 이벤트",
  interest: "관심 이벤트",
  overheated: "과열 이벤트",
}

