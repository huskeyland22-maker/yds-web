/**
 * 전략 연구실 LAB — 시나리오별 데모 스냅샷 (히스토리 없을 때 재생용)
 * 실제 규칙 엔진(buildHomeV5StrategyEvaluation)에 그대로 투입한다.
 */

/** @type {Record<string, Record<string, { fearGreed: number; vix: number; bofa: number; highYield: number }>>} */
const LAB_MOCK_BY_SCENARIO = {
  "2018-q4": {
    "2018-10-03": { fearGreed: 78, vix: 11, bofa: 7.3, highYield: 3.2 },
    "2018-11-20": { fearGreed: 48, vix: 19, bofa: 5.4, highYield: 3.6 },
    "2018-12-24": { fearGreed: 22, vix: 28, bofa: 4.1, highYield: 4.4 },
  },
  "2020-covid": {
    "2020-02-19": { fearGreed: 55, vix: 15, bofa: 5.8, highYield: 3.9 },
    "2020-03-16": { fearGreed: 28, vix: 22, bofa: 4.5, highYield: 5.2 },
    "2020-03-23": { fearGreed: 8, vix: 82, bofa: 3.2, highYield: 8.1 },
    "2020-04-09": { fearGreed: 42, vix: 38, bofa: 4.8, highYield: 5.8 },
  },
  "2022-rates": {
    "2022-06-13": { fearGreed: 52, vix: 27, bofa: 5.2, highYield: 4.1 },
    "2022-10-13": { fearGreed: 28, vix: 31, bofa: 4.4, highYield: 5.0 },
    "2022-12-30": { fearGreed: 22, vix: 28, bofa: 4.6, highYield: 4.8 },
  },
  "2023-svb": {
    "2023-03-08": { fearGreed: 58, vix: 19, bofa: 5.5, highYield: 3.8 },
    "2023-03-13": { fearGreed: 18, vix: 26, bofa: 4.2, highYield: 5.4 },
    "2023-03-17": { fearGreed: 12, vix: 30, bofa: 3.9, highYield: 5.9 },
    "2023-03-24": { fearGreed: 44, vix: 21, bofa: 5.1, highYield: 4.0 },
  },
  "2025-ai": {
    "2025-02-03": { fearGreed: 62, vix: 16, bofa: 5.6, highYield: 3.4 },
    "2025-06-02": { fearGreed: 74, vix: 13, bofa: 7.4, highYield: 3.1 },
    "2025-10-01": { fearGreed: 58, vix: 17, bofa: 5.8, highYield: 3.5 },
    "2025-11-03": { fearGreed: 55, vix: 18, bofa: 5.4, highYield: 3.6 },
  },
}

/** @param {string} scenarioId @param {string} date */
export function getLabMockPanicData(scenarioId, date) {
  const snap = LAB_MOCK_BY_SCENARIO[scenarioId]?.[date]
  if (!snap) return null
  return {
    date: String(date).slice(0, 10),
    fearGreed: snap.fearGreed,
    vix: snap.vix,
    bofa: snap.bofa,
    highYield: snap.highYield,
  }
}

/** @param {object | null | undefined} panicData */
export function isUsablePanicSnapshot(panicData) {
  if (!panicData) return false
  const fg = Number(panicData.fearGreed)
  const vix = Number(panicData.vix)
  const bofa = Number(panicData.bofa)
  return Number.isFinite(fg) || Number.isFinite(vix) || Number.isFinite(bofa)
}

/** @param {string} scenarioId */
export function hasLabMockScenario(scenarioId) {
  return Boolean(LAB_MOCK_BY_SCENARIO[scenarioId])
}
