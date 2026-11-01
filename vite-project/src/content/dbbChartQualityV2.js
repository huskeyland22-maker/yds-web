/**
 * Display helpers for DBB chart quality same-day comparison v2.
 * Scores and returns come from frozen v1 rows. This file does not retune them.
 */

export const CHART_QUALITY_V2_PATH = "/data/dbb-chart-quality-v2.json"

export const CHART_QUALITY_V2_BASIS = {
  title: "DBB 차트 품질 분석 v2 — 동일 신호일 비교",
  researchOnly: "연구 전용입니다. v1 점수 규칙·JSON, DBB 매수 조건, 매매 기록, ETF v1~v5는 바꾸지 않습니다.",
  group: "신호일이 같은 종목만 한 그룹입니다. 날짜가 다른 신호를 합치지 않습니다.",
  score: "총점이 있는 종목만 순위에 넣고, 계산 불가는 0점으로 두지 않습니다. 동점은 모두 상위로 둡니다.",
  outcome: "진입가·수익률·불리 움직임 정의는 v1과 같습니다. 미완료 값은 차이 계산에서 빼고 0으로 채우지 않습니다.",
  bias: "같은 신호일로 날짜 효과는 줄어들지만 업종 편향과 종목 간 상관은 남습니다.",
}
