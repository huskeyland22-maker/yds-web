/**
 * v41 final synthesis. Research only.
 * Reads the stored v35–v40 results and restates them. It does not rerun a
 * backtest, retune a threshold, or adopt a buy, sell, or add rule.
 * selectedStrategy stays null. ETF results are not pooled with these equities.
 */

export const STUDY_SELECTED_STRATEGY = null
export const EQUITY_WINDOW = { from: "2016-01-04", to: "2026-10-05" }
export const ETF_WINDOW = { from: "2016-02-02", to: "2026-06-25" }
export const EXPECTED_EPISODES = 1380
export const EXPECTED_FINGERPRINT = "aef6413691cb91f89853558d4230e4bede0be76d939a9f1b9c748aa89256239e"

export const GRADES = {
  BUY: "B",
  SELL: "D",
  WEEKLY_SELL: "D",
  RISK_STATE: "C",
  ADD: "C",
  DEEP_DRAWDOWN: "A",
  IMMEDIATE_LOW: "D",
  AVERAGE_COST_MATH: "A",
  DEEP_RECOVERY: "D",
  BUY_AND_HOLD: "A",
}

export const MATRIX = [
  ["BUY", "약한~중간 수준의 역사적 우위", "B", "기존 BUY 유지"],
  ["SELL", "일관된 초과성과 없음", "D", "채택 안 함"],
  ["Weekly SELL", "B&H 초과 실패", "D", "채택 안 함"],
  ["HOLD/CAUTION/RISK", "일부 위험 차이", "C", "참고용 가능"],
  ["ADD5", "얕은 하락에서 유리", "C", "자동규칙 금지"],
  ["ADD10", "얕은 하락에서 유리", "C", "자동규칙 금지"],
  ["Deep Drawdown", "회복 신뢰도 급격히 저하", "A", "위험 경고"],
  ["B&H", "강력한 baseline", "A", "기본 benchmark"],
]

function near(actual, expected, digits = 4) {
  const scale = 10 ** digits
  return Math.round(actual * scale) === Math.round(expected * scale)
}

function must(condition, message) {
  if (!condition) {
    const error = new Error(message)
    error.lines = [message]
    throw error
  }
}

export function assertStoredFacts(sources) {
  const { technical, weekly, state, buy, addon, recovery } = sources
  must(technical.selectedStrategy === null && weekly.selectedStrategy === null, "sell strategy is not null")
  must(state.selectedStrategy === null && buy.selectedStrategy === null, "state or buy strategy is not null")
  must(addon.selectedStrategy === null && recovery.selectedStrategy === null, "add strategy is not null")
  must(buy.integrity.episodes === EXPECTED_EPISODES, `episodes ${buy.integrity.episodes}`)
  must(buy.integrity.overlap === 0 && buy.lookAhead.violations === 0, "buy overlap or lookahead")
  must(buy.integrity.fingerprint === EXPECTED_FINGERPRINT, "buy fingerprint")
  must(addon.integrity.fingerprint === EXPECTED_FINGERPRINT && recovery.integrity.fingerprint === EXPECTED_FINGERPRINT, "later fingerprint")
  must(buy.integrity.from === EQUITY_WINDOW.from && buy.integrity.to === EQUITY_WINDOW.to, "equity window")
  must(state.integrity.episodes === EXPECTED_EPISODES && state.lookAhead.violations === 0, "state identity")
  const perf = buy.buy.performance
  must(near(perf[60].mean, 0.1245, 4) && near(perf[120].mean, 0.2314, 4), "buy returns")
  must(buy.comparison[60].mean > 0 && buy.ci[120].meanLow < 0 && buy.ci[120].meanHigh > 0, "random edge")
  must(buy.permutation[60].p === 0.003 && buy.permutation[120].p === 0.055, "permutation")
  must(buy.breadth.better === 19 && buy.breadth.qualified === 30, "breadth")
  must(near(buy.buy.trough.extraMean, -0.0954, 4) && near(buy.buy.reach[0.1].rate, 0.7016, 4), "trough and reach")
  const vote = technical.strategies.find((row) => row.id === "s2-vote4-downtrend")
  must(vote && vote.meanCagr < vote.meanBhCagr && vote.oos.every((row) => row.meanExcessCagr < 0), "technical sell")
  must(weekly.strategies.every((row) => row.meanCagr < row.meanBhCagr), "weekly sell")
  must(weekly.judgment.adopted === false && weekly.judgment.winner === null, "weekly adoption")
  must(state.judgment.label.startsWith("2."), "state label")
  must(buy.judgment.label.startsWith("B."), "buy label")
  must(addon.judgment.label.startsWith("B."), "addon label")
  must(recovery.judgment.label.startsWith("C."), "recovery label")
  must(recovery.strategies.ADD5.deep["0.2"].t120.median < 0, "deep median")
  must(recovery.strategies.ADD5.contrast["120"].meanHigh < 0, "deep gap")
  return {
    episodes: EXPECTED_EPISODES,
    fingerprint: EXPECTED_FINGERPRINT,
    grades: GRADES,
    matrix: MATRIX,
    selectedStrategy: null,
    productionChanged: false,
    buyChanged: false,
    sellChanged: false,
    addChanged: false,
    uiChanged: false,
    apiChanged: false,
    dbChanged: false,
    researchOnly: true,
  }
}
