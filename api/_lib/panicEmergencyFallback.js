import { panicObjectFromLatestRow } from "./latestPanicMetrics.js"

/** 긴급 복구 — DB/API 실패 시 최소 스냅샷 */
export const PANIC_EMERGENCY_ROWS = [
  {
    date: "2026-05-21",
    vix: 16.76,
    vxn: 16.76,
    fear_greed: 50,
    put_call: 1,
    move: 100,
    bofa: 5,
    skew: 140,
    hy_oas: 3.5,
    gs_sentiment: 5,
    updated_at: "2026-05-21T12:00:00.000Z",
  },
]

export function panicEmergencyHubData() {
  const row = PANIC_EMERGENCY_ROWS[0]
  const data = panicObjectFromLatestRow(row)
  if (data) {
    data.__emergency = true
    data.__fetchSource = "EMERGENCY"
  }
  return data
}
