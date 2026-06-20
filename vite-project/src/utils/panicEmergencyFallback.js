/** 클라이언트 긴급 복구 스냅샷 (api/_lib/panicEmergencyFallback.js 와 동일 값) */
export function panicEmergencyHubPayload() {
  return {
    tradeDate: "2026-05-21",
    updatedAt: "2026-05-21T12:00:00.000Z",
    vix: 16.76,
    vxn: 16.76,
    fearGreed: 50,
    putCall: 1,
    move: 100,
    bofa: 5,
    skew: 140,
    highYield: 3.5,
    accessTier: "pro",
    __emergency: true,
    __fetchSource: "EMERGENCY",
    __fetchedAt: Date.now(),
    __isStale: true,
  }
}
