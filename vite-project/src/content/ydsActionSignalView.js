/**
 * YDS 행동 신호 — 표시 전용 (YDS 단일 판정)
 */

import { resolveTodayActionsFromSnapshot } from "./ydsActionGuide.js"
import { currentMarketViewFromSnapshot } from "./ydsCurrentMarketView.js"
import { resolveEffectiveMarketAllocation } from "./ydsOverheatAllocation.js"
import { resolveMarketStageSnapshot } from "./ydsMarketStageLabels.js"
import { getFinalScore } from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   emoji: string
 *   text: string
 * }} ActionSignalLine
 */

/**
 * @typedef {{
 *   strategyEmoji: string
 *   strategyLabel: string
 *   strategyColor: string
 *   signals: ActionSignalLine[]
 *   contextLine: string
 * }} ActionSignalView
 */

/** @param {string} text */
function iconForAction(text) {
  const t = String(text ?? "")
  if (/추격|금지|보류|중단|관망/.test(t)) return "🚫"
  if (/현금/.test(t)) return "💵"
  if (/관심|탐색|관찰|발굴|리스트|감시/.test(t)) return "👀"
  if (/익절/.test(t)) return "✈"
  if (/매수|정리|분할|집중/.test(t)) return "📌"
  return "✓"
}

/**
 * @param {ReturnType<typeof resolveTodayActionsFromSnapshot>} actions
 * @param {import("./ydsOverheatAllocation.js").EffectiveMarketAllocation | null} effective
 * @param {import("./ydsCurrentMarketView.js").CurrentMarketView} market
 */
function resolveStrategyMode(actions, effective, market) {
  const defensive =
    effective?.mode === "overheat" ||
    market.cycleId === "peakOverheat" ||
    market.cycleId === "lateCycle"

  if (defensive && effective?.mode === "overheat") {
    return {
      emoji: "🟠",
      label: "방어 모드",
      color: market.color,
    }
  }

  return {
    emoji: actions.band.emoji,
    label: actions.band.label,
    color: actions.band.color,
  }
}

/**
 * @param {import("./ydsOverheatAllocation.js").EffectiveMarketAllocation | null} effective
 */
function formatCashSignalLine(effective) {
  if (!effective) return "현금 비중 유지"
  const tier = effective.tier
  if (tier?.id === "entry") return "현금 50~60% 유지"
  if (tier?.id === "boundary") return "현금 60~70% 유지"
  if (tier?.id === "extreme") return "현금 70~80% 유지"
  if (effective.cashPct != null) return `현금 ${effective.cashPct}% 유지`
  return "현금 비중 유지"
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [_historyRows]
 * @returns {ActionSignalView | null}
 */
export function resolveActionSignalView(panicData, _historyRows = []) {
  if (!panicData) return null
  const score = getFinalScore(panicData)
  if (!Number.isFinite(score)) return null

  const snapshot = resolveMarketStageSnapshot(Math.round(score))
  const actions = resolveTodayActionsFromSnapshot(snapshot, panicData)
  const market = currentMarketViewFromSnapshot(snapshot)
  const effective = resolveEffectiveMarketAllocation(panicData)
  if (!actions || !market) return null

  const raw = actions.actions.slice(0, 3)
  const signals = raw.map((text) => {
    const isCash = /현금/.test(text)
    const line = isCash ? formatCashSignalLine(effective) : text
    return { emoji: iconForAction(line), text: line }
  })

  while (signals.length < 3) {
    signals.push({ emoji: "✓", text: "기존 포지션 유지" })
  }

  const strategy = resolveStrategyMode(actions, effective, market)

  return {
    strategyEmoji: strategy.emoji,
    strategyLabel: strategy.label,
    strategyColor: strategy.color,
    signals: signals.slice(0, 3),
    contextLine: market.hint ?? "",
  }
}
