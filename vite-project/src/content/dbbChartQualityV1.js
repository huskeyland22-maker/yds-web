/**
 * Display helpers for DBB chart quality research v1.
 * The scored rows come from the generated JSON. This file does not retune weights.
 */

export const CHART_QUALITY_PATH = "/data/dbb-chart-quality-v1.json"

export const CHART_QUALITY_BASIS = {
  title: "DBB 차트 품질 분석 v1",
  researchOnly: "연구 전용입니다. 기존 DBB 매수 조건, 매매 기록, ETF 신호 연구 v1~v5는 바꾸지 않습니다.",
  universe: "개별 종목 연구 대상 31개. LRCX, AMAT, MU, TSM, VRT가 목록과 데이터에 있으면 포함합니다.",
  signal:
    "기존 동결 임계값으로 count가 3 미만에서 3 이상으로 올라간 첫날을 신호일로 둡니다. 연속 구간은 한 에피소드입니다.",
  entry: "진입가는 신호일 다음 거래일 시가입니다. 없으면 미확정이며 성과는 미완료입니다.",
  score:
    "점수는 신호일 종가까지의 정보만 사용합니다. 이후 가격은 점수에 넣지 않습니다. 최초 규칙은 연구용 가설이며 성과를 보고 바꾸지 않습니다.",
  missing: "결측은 0점이나 0% 수익으로 채우지 않습니다. 계산 불가는 별도로 표시합니다.",
  independence: "같은 날의 여러 종목 신호와 같은 종목의 반복 신호는 독립 표본으로 보지 않습니다.",
}
