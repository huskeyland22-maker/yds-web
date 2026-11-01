/**
 * Display helpers for DBB chart quality C/E risk validation v4.
 */

export const CHART_QUALITY_V4_PATH = "/data/dbb-chart-quality-v4.json"

export const CHART_QUALITY_V4_BASIS = {
  title: "DBB 차트 품질 분석 v4 — 상대강도·반등 위험 검증",
  researchOnly: "연구 전용입니다. v1~v3 파일·점수 가중치, DBB 매수 조건, 매매 기록은 바꾸지 않습니다.",
  focus: "C 상대강도와 E 반등 확인만 평가합니다. 새 최적 가중치나 매수 규칙은 만들지 않습니다.",
  risk: "수익률과 최대 불리 움직임을 따로 보고, 하나로 합산하지 않습니다.",
  caution: "같은 날 신호는 독립이 아니며, 여러 구간을 동시에 보면 우연한 관계가 날 수 있습니다.",
}
