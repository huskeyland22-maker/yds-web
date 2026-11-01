/**
 * Display helpers for DBB practical utility v7.
 */

export const CHART_QUALITY_V7_PATH = "/data/dbb-chart-quality-v7.json"

export const CHART_QUALITY_V7_BASIS = {
  title: "DBB 실전 효용 검증 v7 — 종목 선택 + 매수 후 위험관리",
  researchOnly: "연구 전용입니다. v1~v6·DBB 매수 조건·매매 기록·자동매매는 바꾸지 않습니다.",
  studyA: "연구 A: 같은 날·같은 데이터에서 전체 신호 대비 A~D 상위 약 1/3 선택의 효용을 봅니다. E는 희소하면 참고만 합니다.",
  studyB: "연구 B: 다음 거래일 시가 진입 후 고정손절·추세청산·결합을 무위험관리 보유와 비교합니다.",
  caution: "검증 결과를 보고 한도·비율을 다시 고르지 않습니다. 효용 미입증이면 규칙을 채택하지 않습니다.",
}
