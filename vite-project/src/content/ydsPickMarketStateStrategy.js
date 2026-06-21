/**
 * 시장상태별 최적 투자전략 검증 — 7일 잠금
 */

import { picksWithLockedOutcome } from "./ydsPickOutcomeEngine.js"
import { pickExtremesByReturn, summarizeLockedReturns } from "./ydsPickReturnStats.js"
import { normalizeMarketStateBucket } from "./ydsPickSuccessPatternEngine.js"
import { getRecommendSnapshot } from "./ydsValidationRecommendSnapshot.js"

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

export const MARKET_STATE_HORIZON = "d7"

/** @type {{ id: string; label: string; matchIds: string[] }[]} */
export const MARKET_STRATEGY_GROUPS = [
  {
    id: "opportunity",
    label: "기회대기",
    matchIds: ["interest", "boundaryEntry", "adjustmentEntry", "earlyRise"],
  },
  { id: "defensive", label: "방어", matchIds: ["defensive"] },
  { id: "fear", label: "공포", matchIds: ["panic"] },
  { id: "greed", label: "탐욕", matchIds: ["optimism", "overheat", "adjustmentRecovery"] },
]

/**
 * @param {ValidationPickRecord} pick
 */
export function resolveMarketStateBucket(pick) {
  const snap = getRecommendSnapshot(pick)
  const raw = snap?.marketStateLabel ?? pick.strategyLabel ?? pick.regimeLabel ?? ""
  return normalizeMarketStateBucket(raw)
}

/**
 * @typedef {{
 *   name: string
 *   ticker: string
 *   returnPct: number
 * } | null} PickExtreme
 */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   stateLabel: string
 *   count: number
 *   winRate: number | null
 *   avgReturn: number | null
 *   best: PickExtreme
 *   worst: PickExtreme
 * }} MarketStrategyStat
 */

/**
 * @typedef {{
 *   horizonKey: 'd7'
 *   horizonLabel: string
 *   total: number
 *   strategies: MarketStrategyStat[]
 *   detailStates: MarketStrategyStat[]
 * }} MarketStateStrategyReport
 */

/**
 * @param {ValidationPickRecord[]} subset
 * @param {string} id
 * @param {string} label
 */
function buildStrategyStatFromSubset(subset, id, label) {
  const returns = subset
    .map((p) => p.horizons?.d7)
    .filter((r) => r != null && Number.isFinite(r))
    .map(Number)
  const stats = summarizeLockedReturns(returns)
  const { best, worst } = pickExtremesByReturn(subset, MARKET_STATE_HORIZON)

  return {
    id,
    label,
    stateLabel: label,
    count: stats.count,
    winRate: stats.winRate,
    avgReturn: stats.avgReturn,
    best,
    worst,
  }
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {string} id
 * @param {string} label
 * @param {string[]} matchIds
 */
function buildStrategyStat(picks, id, label, matchIds) {
  const subset = picks.filter((p) => matchIds.includes(resolveMarketStateBucket(p).id))
  return buildStrategyStatFromSubset(subset, id, label)
}

/**
 * @param {ValidationPickRecord[]} allPicks
 * @returns {MarketStateStrategyReport}
 */
export function buildMarketStateStrategyReport(allPicks) {
  const picks = picksWithLockedOutcome(allPicks ?? [], MARKET_STATE_HORIZON)

  const strategies = MARKET_STRATEGY_GROUPS.map((g) =>
    buildStrategyStat(picks, g.id, g.label, g.matchIds),
  ).sort((a, b) => (b.avgReturn ?? -999) - (a.avgReturn ?? -999))

  /** @type {Map<string, ValidationPickRecord[]>} */
  const byState = new Map()
  for (const pick of picks) {
    const bucket = resolveMarketStateBucket(pick)
    if (!byState.has(bucket.id)) byState.set(bucket.id, [])
    byState.get(bucket.id).push(pick)
  }

  const detailStates = [...byState.entries()]
    .map(([stateId, subset]) => {
      const label = resolveMarketStateBucket(subset[0]).label
      return buildStrategyStatFromSubset(subset, stateId, label)
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => (b.avgReturn ?? -999) - (a.avgReturn ?? -999))

  return {
    horizonKey: "d7",
    horizonLabel: "7일",
    total: picks.length,
    strategies,
    detailStates,
  }
}
