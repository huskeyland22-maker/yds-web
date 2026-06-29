/**
 * 시장 상태 변화 이력 — 사이클 시각화 · 색상 · 투자 행동
 */

import { resolveUnifiedMarketStateGuide } from "./ydsUnifiedMarketState.js"

/** @typedef {'panic' | 'rebound' | 'adjustment' | 'boundary' | 'overheat'} MarketCycleFamilyId */

export const MARKET_CYCLE_STRIP = [
  { id: "panic", label: "패닉", color: "#ef4444" },
  { id: "rebound", label: "반등", color: "#f97316" },
  { id: "adjustment", label: "조정", color: "#eab308" },
  { id: "boundary", label: "경계", color: "#22c55e" },
  { id: "overheat", label: "과열", color: "#a855f7" },
]

/** @type {Record<MarketCycleFamilyId, string>} */
export const MARKET_CYCLE_COLORS = Object.fromEntries(
  MARKET_CYCLE_STRIP.map((s) => [s.id, s.color]),
)

/** @param {string} label */
export function resolveCycleFamilyFromLabel(label) {
  const t = String(label ?? "").trim()
  if (/패닉|충격/.test(t)) return /** @type {MarketCycleFamilyId} */ ("panic")
  if (/반등|위축|회복|상승초기/.test(t)) return /** @type {MarketCycleFamilyId} */ ("rebound")
  if (/조정/.test(t)) return /** @type {MarketCycleFamilyId} */ ("adjustment")
  if (/경계/.test(t)) return /** @type {MarketCycleFamilyId} */ ("boundary")
  if (/과열|상승확산/.test(t)) return /** @type {MarketCycleFamilyId} */ ("overheat")
  return /** @type {MarketCycleFamilyId} */ ("adjustment")
}

/** @type {Record<string, string>} */
const INVESTMENT_ACTION_OVERRIDES = {
  패닉진입: "극단적 공포 구간입니다.\n소량 분할매수만 검토하고 현금 비중을 유지하세요.",
  패닉안정: "패닉이 진정되는 구간입니다.\n우량주 관심 리스트를 정비하며 분할 접근을 준비하세요.",
  반등진입: "반등 초기 신호가 나타나는 구간입니다.\n선별적 분할매수를 검토하되 추격은 자제하세요.",
  반등안정: "반등 흐름이 유지되는 구간입니다.\n분할매수를 이어가되 비중은 점진적으로 늘리세요.",
  위축진입: "반등 초기 신호가 나타나는 구간입니다.\n선별적 분할매수를 검토하되 추격은 자제하세요.",
  위축안정: "반등 흐름이 유지되는 구간입니다.\n분할매수를 이어가되 비중은 점진적으로 늘리세요.",
  조정진입: "조정이 시작되는 구간입니다.\n현금과 관심 리스트 균형을 유지하세요.",
  조정안정:
    "상승 추세는 유지되고 있지만\n추격매수보다 눌림목 분할매수가 유리한 구간입니다.",
  경계진입: "과열 전환 신호를 주시하는 구간입니다.\n신규 추격보다 보유 비중 점검에 집중하세요.",
  경계안정: "상승 추세는 유지되지만\n추격매수보다 눌림목 분할매수가 유리한 구간입니다.",
  과열진입: "과열 초기 구간입니다.\n익절·비중 축소를 검토하고 추격매수는 피하세요.",
  과열안정: "과열이 지속되는 구간입니다.\n현금 비중을 늘리고 핵심 종목만 관찰하세요.",
}

/** @param {string} label */
export function buildMarketStateInvestmentAction(label) {
  const key = String(label ?? "").trim()
  if (INVESTMENT_ACTION_OVERRIDES[key]) {
    return INVESTMENT_ACTION_OVERRIDES[key]
  }

  const guide = resolveUnifiedMarketStateGuide(key)
  if (guide.strategyNarrative.length >= 2) {
    return guide.strategyNarrative.slice(0, 2).join("\n")
  }
  if (guide.strategyNarrative.length === 1) {
    return guide.strategyNarrative[0]
  }
  return guide.actions.slice(0, 2).join(" · ")
}

/**
 * @param {string} [currentLabel]
 * @returns {{ stages: typeof MARKET_CYCLE_STRIP; currentId: MarketCycleFamilyId }}
 */
export function buildMarketCycleStrip(currentLabel) {
  const currentId = resolveCycleFamilyFromLabel(currentLabel ?? "")
  return {
    stages: MARKET_CYCLE_STRIP,
    currentId,
  }
}

/**
 * @param {{
 *   marketScore: number | null
 *   panicScore: number | null
 *   nasdaq: number | null
 *   sp500: number | null
 *   vix: number | null
 * }} snapshot
 */
export function buildMarketStateScoreRows(snapshot) {
  /** @type {{ key: string; label: string; value: string }[]} */
  const rows = []
  if (snapshot.marketScore != null) {
    rows.push({ key: "market", label: "시장점수", value: String(snapshot.marketScore) })
  }
  if (snapshot.panicScore != null) {
    rows.push({ key: "panic", label: "패닉점수", value: String(snapshot.panicScore) })
  }
  if (snapshot.nasdaq != null) {
    rows.push({
      key: "nasdaq",
      label: "NASDAQ",
      value: snapshot.nasdaq.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    })
  }
  if (snapshot.sp500 != null) {
    rows.push({
      key: "sp500",
      label: "S&P500",
      value: snapshot.sp500.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    })
  }
  if (snapshot.vix != null) {
    rows.push({ key: "vix", label: "VIX", value: String(Math.round(snapshot.vix * 10) / 10) })
  }
  return rows
}

/** @param {MarketCycleFamilyId} familyId */
export function cycleFamilyColor(familyId) {
  return MARKET_CYCLE_COLORS[familyId] ?? "#94a3b8"
}
