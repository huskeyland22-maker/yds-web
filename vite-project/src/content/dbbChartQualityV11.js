/**
 * Display helpers for DBB v10 matching/bootstrap audit (v11).
 */

export const CHART_QUALITY_V11_PATH = "/data/dbb-chart-quality-v11.json"

export const CHART_QUALITY_V11_BASIS = {
  title: "DBB 실전 효용 검증 v11 — v10 매칭·부트스트랩 감사",
  researchOnly: "연구 전용 감사입니다. v1~v10·DBB 매수 조건·매매 기록·자동매매는 바꾸지 않습니다.",
  scope: "매칭 편향, 대조 독립성, 미래 구간 중첩, 날짜 클러스터·시간 블록 부트스트랩을 검증합니다.",
  caution: "점추정치가 양수이거나 하위집단이 좋아 보여도 실전 효용을 인정하지 않습니다. 새 매수 규칙을 채택하지 않습니다.",
}
