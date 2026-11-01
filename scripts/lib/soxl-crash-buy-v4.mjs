/**
 * SOXL crash-buy v4 (research only).
 *
 * Records what a daily-bar study can and cannot reproduce.
 * Does not select a strategy and does not invent broker fills.
 */

import { SELECTED_STRATEGY } from "./soxl-crash-buy-v1.mjs"

export { SELECTED_STRATEGY }

export const FROZEN_DRAWDOWN_MAX = -0.17066193989162826
export const FROZEN_RETURN5_MAX = -0.05070732428222979

export const BLOTTER_FIELDS = Object.freeze([
  "orderDate",
  "priorClose",
  "limitPrice",
  "quantity",
  "createdAt",
  "canceledAt",
  "limitChanges",
  "fillQuantity",
  "averageFillPrice",
  "rationale",
])

export const USER_DESCRIBED_PRINCIPLES = Object.freeze({
  evidenceClass: "user-described-principle",
  verifiedByOrderRecords: false,
  points: Object.freeze([
    "SOXL 또는 반도체 업종의 추세가 급격히 나빠질 것으로 예상할 때 지정가 매수를 고려한다.",
    "기준 가격은 직전 거래일 종가다.",
    "기본 지정가는 직전 종가 대비 -10%다.",
    "하락 위험이 더 커졌다고 판단하면 기존 -10% 주문을 -15%로 낮춘다.",
    "매일 무조건 주문하는 방식은 아니다.",
    "-10%와 -15% 주문을 동시에 내는 방식으로 가정하지 않는다.",
  ]),
})

export const SIMULATION_ASSUMPTIONS = Object.freeze({
  evidenceClass: "simulation-assumption",
  points: Object.freeze([
    "판단은 T일 종가까지의 데이터로 수행한다.",
    "주문은 T+1부터 유효하다.",
    "기본 모델은 시가가 지정가 이하이면 시가 체결, 그렇지 않고 일중 저가가 지정가 이하이면 지정가 체결로 계산한다.",
    "보수 모델은 갭 체결만 인정하고 지정가보다 10bp 불리한 가격을 적용한다.",
    "일봉 저가만으로 실제 주문 체결을 확정할 수 없다.",
  ]),
})

/** Known repo locations. None of these is a SOXL broker blotter. */
export const SEARCH_TARGETS = Object.freeze([
  Object.freeze({
    path: "scripts/.cache/soxl-crash-buy-v1-daily-ohlcv.json",
    role: "price-cache",
    reason: "Yahoo 일봉 OHLC 캐시다. 주문 시각, 지정가, 수량, 체결 원장이 없다.",
  }),
  Object.freeze({
    path: "scripts/.cache/dbb-smh-daily-ohlcv.json",
    role: "price-cache",
    reason: "SMH 일봉 캐시다. SOXL 주문 기록이 아니다.",
  }),
  Object.freeze({
    path: "scripts/.cache/soxl-crash-buy-v1-result.json",
    role: "research-result",
    reason: "기계적 A/B 시뮬레이션 결과다.",
  }),
  Object.freeze({
    path: "scripts/.cache/soxl-crash-buy-v2-result.json",
    role: "research-result",
    reason: "C/D 연구 모델 결과다. 실제 주문 내역이 아니다.",
  }),
  Object.freeze({
    path: "scripts/.cache/soxl-crash-buy-v3-result.json",
    role: "research-result",
    reason: "체결 가정 민감도 결과다. 실제 체결 확률이 아니다.",
  }),
  Object.freeze({
    path: "scripts/.cache/yds-daily-bottom-buy-3of4-order-result.json",
    role: "etf-research-orders",
    reason: "ETF 3/4 연구 주문 집계다. SOXL 문자열이 없고 사용자 체결 원장이 아니다.",
  }),
  Object.freeze({
    path: "vite-project/src/content/ydsTradeRecords.js",
    role: "browser-schema",
    reason: "브라우저 localStorage yds.tradeRecords.v1의 수동 매수 기록 스키마다. 저장소에 SOXL 주문 행이 없다.",
  }),
  Object.freeze({
    path: "vite-project/src/content/ydsPortfolioTradesStorage.js",
    role: "browser-schema",
    reason: "브라우저 localStorage yds-portfolio-trades-v1 스키마다. 저장소에 SOXL 원장이 없다.",
  }),
  Object.freeze({
    path: "supabase/migrations/20250926120000_user_trade_records.sql",
    role: "cloud-schema",
    reason: "클라우드 매수 기록 테이블 정의다. 내보낸 SOXL 주문 행이 없다.",
  }),
])

/**
 * A complete broker or user blotter row. Missing any field is not an actual log.
 * @param {object | null | undefined} row
 */
export function isActualOrderLog(row) {
  if (!row || row.sourceType !== "broker-or-user-blotter") return false
  return BLOTTER_FIELDS.every((field) => row[field] != null && row[field] !== "")
}

/**
 * Simulation output cannot be relabeled as an actual fill.
 * @param {object | null | undefined} row
 */
export function asReportedFill(row) {
  const actual = isActualOrderLog(row)
  return {
    actualFill: actual,
    evidenceClass: actual ? "actual-order-log" : "simulation-or-incomplete",
  }
}

function horizonBrief(row) {
  return {
    n: row.n,
    mean: row.mean,
    median: row.median,
    comparisonDeferred: row.comparisonDeferred,
  }
}

/**
 * Copy C/D sensitivity rows from the v3 result. Does not recompute them.
 * @param {object} v3
 */
export function cdSensitivityFromV3(v3) {
  const strategies = {}
  for (const strategy of ["C", "D"]) {
    strategies[strategy] = {}
    for (const scenario of ["base", "close-through", "gap-only-open", "conservative"]) {
      strategies[strategy][scenario] = {}
      for (const period of ["eval", "y2022_2024", "y2025_2026"]) {
        const row = v3.sensitivity[strategy][scenario][period]
        const reported = asReportedFill(row)
        strategies[strategy][scenario][period] = {
          orders: row.orders,
          filled: row.filled,
          fillRate: row.fillRate,
          gapsFilled: row.gapsFilled,
          touchesFilled: row.touchesFilled,
          horizons: {
            5: horizonBrief(row.horizons["5"]),
            20: horizonBrief(row.horizons["20"]),
            60: horizonBrief(row.horizons["60"]),
          },
          anyComparisonDeferred: row.anyComparisonDeferred,
          actualFill: reported.actualFill,
          evidenceClass: reported.evidenceClass,
          source: "v3-simulation-sensitivity",
        }
      }
    }
  }
  return strategies
}

/**
 * @param {ReturnType<typeof cdSensitivityFromV3>} sensitivity
 */
export function touchDependence(sensitivity) {
  const base = sensitivity.D.base.eval
  const gapOnly = sensitivity.D["gap-only-open"].eval
  const conservative = sensitivity.D.conservative.eval
  return {
    baseFills: base.filled,
    baseTouchFills: base.touchesFilled,
    baseGapFills: base.gapsFilled,
    gapOnlyFills: gapOnly.filled,
    conservativeFills: conservative.filled,
    t20BaseN: base.horizons["20"].n,
    t20BaseMean: base.horizons["20"].mean,
    t20GapOnlyN: gapOnly.horizons["20"].n,
    t20GapOnlyDeferred: gapOnly.horizons["20"].comparisonDeferred,
    t20ConservativeN: conservative.horizons["20"].n,
    t20ConservativeDeferred: conservative.horizons["20"].comparisonDeferred,
    actualFillProbability: null,
  }
}

/**
 * @param {{ path: string, role: string, reason: string, exists: boolean }[]} inspected
 */
export function surveyResult(inspected) {
  return {
    actualOrderLogFound: false,
    inspected,
    notRead: Object.freeze([
      "브라우저 localStorage의 실제 행",
      "Supabase user_trade_records의 계정 데이터",
      "증권사 주문·체결 내역서",
    ]),
  }
}
