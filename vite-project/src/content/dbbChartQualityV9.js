/**
 * Display helpers for DBB signal-strength robustness v9.
 */

export const CHART_QUALITY_V9_PATH = "/data/dbb-chart-quality-v9.json"

export const CHART_QUALITY_V9_BASIS = {
  title: "DBB 신호 강도 검증 v9 — 종목 편중·국면·시장 초과수익",
  researchOnly: "연구 전용입니다. v1~v8·DBB 매수 조건·매매 기록·자동매매는 바꾸지 않습니다.",
  studies: "연구 A 종목 편중, 연구 B 시장 국면, 연구 C QQQ 초과수익, 연구 D 날짜 단위 불확실성을 함께 봅니다.",
  regime: "국면은 ETF 신호 국면 v3와 동일하게 QQQ 종가·MA50·MA200·기울기로 정의하며 신호일까지만 사용합니다.",
  caution: "유리한 국면·종목만 골라내지 않습니다. 효용 미입증이면 규칙을 채택하지 않습니다.",
}
