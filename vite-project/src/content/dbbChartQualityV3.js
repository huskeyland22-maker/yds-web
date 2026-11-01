/**
 * Display helpers for DBB chart quality component validity v3.
 * Does not retune v1 weights or overwrite v1/v2 results.
 */

export const CHART_QUALITY_V3_PATH = "/data/dbb-chart-quality-v3.json"

export const CHART_QUALITY_V3_BASIS = {
  title: "DBB 차트 품질 분석 v3 — 항목별 유효성",
  researchOnly: "연구 전용입니다. v1·v2 파일과 점수 가중치, DBB 매수 조건, 매매 기록은 바꾸지 않습니다.",
  method: "항목 산식은 v1과 같고, 동일 신호일 비교·학습·검증 경계는 v2·v1과 같습니다. 가중치 최적화는 하지 않습니다.",
  raw: "v1 JSON에는 항목 점수만 있어 신호일까지의 OHLCV로 세부값을 다시 계산하고 v1 점수와 일치하는지 확인합니다.",
  caution: "상관과 그룹 차이는 기술 통계입니다. 여러 항목·기간을 동시에 보면 우연한 관계가 날 수 있습니다.",
}
