/**
 * 패닉 히스토리 수동 seed — panic_index_history 복구용 (2026-05-13 ~ 05-19)
 * localStorage panic_history 가 5일 미만일 때 자동 병합
 */

/** @type {import("./panicHistoryLocalPersist.js").PanicHistoryRow[]} */
export const PANIC_HISTORY_SEED = [
  {
    date: "2026-05-13",
    vix: 17.45,
    fearGreed: 58,
    putCall: 0.49,
    move: 68.2,
    bofa: 52,
    skew: 138.4,
    hyOas: 2.95,
    gsSentiment: 68,
    panicIndex: 42,
  },
  {
    date: "2026-05-14",
    vix: 17.62,
    fearGreed: 59,
    putCall: 0.5,
    move: 69.1,
    bofa: 53,
    skew: 139.2,
    hyOas: 2.91,
    gsSentiment: 69,
    panicIndex: 41,
  },
  {
    date: "2026-05-15",
    vix: 17.38,
    fearGreed: 60,
    putCall: 0.48,
    move: 69.8,
    bofa: 54,
    skew: 140.1,
    hyOas: 2.88,
    gsSentiment: 69,
    panicIndex: 40,
  },
  {
    date: "2026-05-16",
    vix: 17.71,
    fearGreed: 61,
    putCall: 0.5,
    move: 70.0,
    bofa: 55,
    skew: 140.8,
    hyOas: 2.85,
    gsSentiment: 70,
    panicIndex: 39,
  },
  {
    date: "2026-05-19",
    vix: 17.82,
    fearGreed: 63,
    putCall: 0.51,
    move: 70.24,
    bofa: 56,
    skew: 141.51,
    hyOas: 2.82,
    gsSentiment: 70,
    panicIndex: 38,
  },
]

export const PANIC_HISTORY_SEED_MIN_DAYS = 5
