/**
 * Display helpers for DBB signal-strength v8 (3-of-4 vs 4-of-4).
 */

export const CHART_QUALITY_V8_PATH = "/data/dbb-chart-quality-v8.json"

export const CHART_QUALITY_V8_BASIS = {
  title: "DBB 신호 강도 검증 v8 — 3개 충족 vs 4개 충족",
  researchOnly: "연구 전용입니다. v1~v7·DBB 매수 조건·매매 기록·자동매매는 바꾸지 않습니다.",
  compare: "같은 유니버스·같은 진입(다음 시가)·같은 기간에서 조건 3개 충족과 4개 충족을 비교합니다.",
  success: "성공은 기간 수익률이 0%를 넘는 경우만입니다. 0%는 별도 집계하고, 미완성은 분모에서 제외합니다.",
  caution: "검증 결과를 보고 임계값을 바꾸지 않습니다. 효용 미입증이면 규칙을 채택하지 않습니다.",
}
