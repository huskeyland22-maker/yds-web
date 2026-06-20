/**
 * 패닉 히스토리 수동 seed — 8지표 (2026-05-13 ~ 05-19)
 */

/** @typedef {import("./panicHistoryLocalPersist.js").PanicHistoryRow} PanicHistoryRow */

/** @type {PanicHistoryRow[]} */
export const PANIC_HISTORY_SEED = [
  {
    date: "2026-05-13",
    vix: 17.6,
    vxn: 24.8,
    fearGreed: 62,
    bofa: 6.4,
    putCall: 0.5,
    highYield: 2.8,
    move: 70.0,
    skew: 141,
    panicIndex: 25,
  },
  {
    date: "2026-05-14",
    vix: 17.3,
    vxn: 24.6,
    fearGreed: 64,
    bofa: 6.5,
    putCall: 0.49,
    highYield: 2.81,
    move: 70.2,
    skew: 141,
    panicIndex: 25,
  },
  {
    date: "2026-05-15",
    vix: 18.43,
    vxn: 25.4,
    fearGreed: 63,
    bofa: 6.6,
    putCall: 0.52,
    highYield: 2.82,
    move: 70.4,
    skew: 141,
    panicIndex: 27,
  },
  {
    date: "2026-05-16",
    vix: 17.7,
    vxn: 25.1,
    fearGreed: 64,
    bofa: 6.6,
    putCall: 0.51,
    highYield: 2.82,
    move: 70.5,
    skew: 141,
    panicIndex: 26,
  },
  {
    date: "2026-05-19",
    vix: 17.82,
    vxn: 25.21,
    fearGreed: 66,
    bofa: 6.6,
    putCall: 0.5,
    highYield: 2.82,
    move: 71.68,
    skew: 141.51,
    panicIndex: 26,
  },
]

export const PANIC_HISTORY_SEED_MIN_DAYS = 5

/** seed·LS 행에 값이 있는 지표 키 (차트 탭) */
export const PANIC_HISTORY_METRIC_KEYS = [
  "vix",
  "vxn",
  "fearGreed",
  "bofa",
  "putCall",
  "highYield",
  "move",
  "skew",
]
