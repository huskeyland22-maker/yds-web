/**
 * Static v41 equity BUY research summary.
 * Display copy only. Not a live signal, forecast, or strategy selector.
 */
export const EQUITY_RESEARCH_SUMMARY = {
  version: "v41",
  period: "2016-01-04 ~ 2026-10-05",
  episodes: 1380,
  buy: {
    T20: { mean: 4.71, median: 3.65, winRate: 64.43 },
    T60: { mean: 12.45, median: 10.17, winRate: 71.64 },
    T120: { mean: 23.14, median: 17.92, winRate: 76.25 },
  },
  random: {
    T20: 3.61,
    T60: 9.62,
    T120: 20.41,
  },
  difference: {
    T20: 1.1,
    T60: 2.83,
    T120: 2.73,
  },
  "T60 statistical": {
    ciLow: 1.26,
    ciHigh: 4.39,
    pValue: 0.003,
  },
  buyEvidence: "B",
  buyLimitation: {
    postBuyLowMean: -9.54,
    postBuyLowMedian: -6.66,
    noNewLowRate: 14.18,
    lowMeanDay: 21.1,
    lowMedianDay: 14,
    hit10: 70.16,
    hit20: 42.24,
  },
  deepDrawdown: {
    lessThan20MedianT120: -7.56,
    lessThan20WinT120: 40.55,
  },
  deepDrawdownEvidence: "A",
  deepDrawdownRecoveryEvidence: "D",
  sell: {
    evidence: "D",
    adopted: false,
  },
  weeklySell: {
    evidence: "D",
    adopted: false,
  },
  riskState: {
    available: false,
    evidence: "C",
    note: "주봉 HOLD / CAUTION / RISK는 현재 화면에 연결하지 않습니다.",
  },
  add: {
    automated: false,
    evidence: "C",
  },
  baseline: {
    name: "Buy & Hold",
    evidence: "A",
  },
  selectedStrategy: null,
}
