/**
 * Display helpers for DBB signal vs matched non-signal control v10.
 */

export const CHART_QUALITY_V10_PATH = "/data/dbb-chart-quality-v10.json"

export const CHART_QUALITY_V10_BASIS = {
  title: "DBB 실전 효용 검증 v10 — 신호일 vs 비신호일 대조",
  researchOnly: "연구 전용입니다. v1~v9·DBB 매수 조건·매매 기록·자동매매는 바꾸지 않습니다.",
  question: "DBB 신호 다음 시가 매수가, 같은 종목의 유사 시장 환경 비신호일 매수보다 유리한지 봅니다.",
  matching:
    "동일 종목, QQQ 국면 일치, 사전 하락·변동성·QQQ 20일 수익률 캘리퍼로 1:1 매칭합니다. 미래 수익·MAE는 매칭에 쓰지 않습니다.",
  caution: "절대 수익률이 양수라는 이유만으로 효용을 단정하지 않습니다. 효용 미입증이면 규칙을 채택하지 않습니다.",
}
