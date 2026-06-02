/**
 * YDS 역사 검증용 대표 이벤트 데이터셋 (초안)
 * - 카테고리: panic / dca / interest / overheated
 * - 기간: 최소 60일 이상 권장
 */

/** @typedef {"panic" | "dca" | "interest" | "overheated"} YdsEventCategory */

/** @type {Array<{ id: string; category: YdsEventCategory; name: string; startDate: string; endDate: string }>} */
const RAW_EVENTS = [
  { id: "panic-2020-covid", category: "panic", name: "코로나 팬데믹 급락", startDate: "2020-02-20", endDate: "2020-06-30" },
  { id: "panic-2022-bear", category: "panic", name: "인플레이션·긴축 베어마켓", startDate: "2022-01-03", endDate: "2022-06-17" },
  { id: "panic-2022-oct-bottom", category: "panic", name: "2022 가을 저점 형성", startDate: "2022-08-16", endDate: "2022-11-30" },
  { id: "panic-2023-banking", category: "panic", name: "미국 지역은행 스트레스", startDate: "2023-02-10", endDate: "2023-05-19" },
  { id: "panic-2025-shock", category: "panic", name: "2025 봄 변동성 충격", startDate: "2025-03-01", endDate: "2025-06-30" },
  { id: "panic-2018-q4-aftershock", category: "panic", name: "2018 Q4 후폭풍 잔여 구간", startDate: "2019-01-01", endDate: "2019-03-31" },

  { id: "dca-2019-recovery", category: "dca", name: "2019 상반기 회복 분할매수", startDate: "2019-01-04", endDate: "2019-05-31" },
  { id: "dca-2020-reopening", category: "dca", name: "코로나 이후 리오프닝 매수", startDate: "2020-04-01", endDate: "2020-09-30" },
  { id: "dca-2021-chop", category: "dca", name: "2021 하반기 박스권 분할", startDate: "2021-08-01", endDate: "2021-12-31" },
  { id: "dca-2022-h2", category: "dca", name: "2022 하반기 저점 탐색", startDate: "2022-07-01", endDate: "2022-10-31" },
  { id: "dca-2023-h2", category: "dca", name: "2023 하반기 눌림 대응", startDate: "2023-08-01", endDate: "2023-11-30" },
  { id: "dca-2024-mid", category: "dca", name: "2024 중반 조정 매수", startDate: "2024-04-15", endDate: "2024-08-30" },

  { id: "interest-2019-late", category: "interest", name: "2019 하반기 관심 확대", startDate: "2019-07-01", endDate: "2019-10-31" },
  { id: "interest-2020-precrash", category: "interest", name: "2020 초 변동성 확대 전환", startDate: "2019-12-15", endDate: "2020-02-19" },
  { id: "interest-2021-midcycle", category: "interest", name: "2021 중간 순환매 관심", startDate: "2021-04-01", endDate: "2021-07-31" },
  { id: "interest-2022-rebound", category: "interest", name: "2022 연말 반등 관심", startDate: "2022-10-01", endDate: "2023-01-31" },
  { id: "interest-2024-q1", category: "interest", name: "2024 1분기 관망·관심", startDate: "2024-01-02", endDate: "2024-03-31" },
  { id: "interest-2025-late", category: "interest", name: "2025 하반기 관망 구간", startDate: "2025-08-01", endDate: "2025-11-15" },

  { id: "overheat-2019-yearend", category: "overheated", name: "2019 연말 과열", startDate: "2019-10-01", endDate: "2019-12-31" },
  { id: "overheat-2020-growth", category: "overheated", name: "2020 성장주 과열", startDate: "2020-08-01", endDate: "2020-12-31" },
  { id: "overheat-2021-speculative", category: "overheated", name: "2021 투기성 과열", startDate: "2021-01-01", endDate: "2021-04-30" },
  { id: "overheat-2023-ai-rally", category: "overheated", name: "2023 AI 랠리 과열", startDate: "2023-05-01", endDate: "2023-08-31" },
  { id: "overheat-2024-q4", category: "overheated", name: "2024 연말 과열", startDate: "2024-09-15", endDate: "2024-12-31" },
  { id: "overheat-2026-early", category: "overheated", name: "2026 초 위험선호 과열", startDate: "2026-01-01", endDate: "2026-03-31" },
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

