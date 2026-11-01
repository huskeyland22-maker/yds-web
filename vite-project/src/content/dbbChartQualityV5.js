/**
 * Display helpers for DBB chart quality final judgment v5.
 */

export const CHART_QUALITY_V5_PATH = "/data/dbb-chart-quality-v5.json"

export const CHART_QUALITY_V5_BASIS = {
  title: "DBB 차트 품질 분석 v5 — 항목별 최종 판정",
  researchOnly: "연구 전용입니다. v1~v4 파일·점수 가중치, DBB 매수 조건, 매매 기록은 바꾸지 않습니다.",
  purpose: "저장된 v1~v4 결과만으로 A~E 증거 수준과 실전 적용 가능성을 정리합니다. 새 매수 규칙은 만들지 않습니다.",
  levels: "판정은 추가 검증 · 판단 유보 · 현재 근거 부족만 사용합니다. 검증 완료·실전 유효는 쓰지 않습니다.",
  caution: "전체 표본의 관찰과 동일일·검증 선별력을 섞어 평균하지 않습니다. 수익과 불리 움직임도 합산하지 않습니다.",
}
