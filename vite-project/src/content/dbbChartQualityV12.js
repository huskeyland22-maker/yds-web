/**
 * Display helpers for DBB prospective tracking v12.
 */

export const CHART_QUALITY_V12_PATH = null // live localStorage study — no static JSON path

export const CHART_QUALITY_V12_BASIS = {
  title: "DBB 전향적 검증",
  researchOnly: "관찰·기록 전용입니다. 새 매수 규칙·자동 매수·자동 매도를 구현하지 않습니다.",
  storage:
    "브라우저 localStorage에만 저장됩니다. 기기·브라우저 간 공유되지 않으며, 데이터 삭제·프라이빗 모드 시 소실될 수 있습니다. 실거래 기록과 분리됩니다.",
  baseline: "최초 관측 시 현재 신호는 기준선만 잡고 전향적 표본에 넣지 않습니다. 이후 rising-edge만 기록합니다.",
  caution: "표본이 충분히 쌓이기 전에는 실전 효용을 확정하지 않습니다. 미완성 수익률을 0으로 대체하지 않습니다.",
}
