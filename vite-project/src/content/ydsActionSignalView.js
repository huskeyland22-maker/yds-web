/**
 * YDS 행동 신호 — 표시 전용 (3초 판단)
 */

import { resolveTodayActions } from "./ydsActionGuide.js"
import { resolveCurrentMarketView } from "./ydsCurrentMarketView.js"
import { resolveEffectiveMarketAllocation } from "./ydsOverheatAllocation.js"
import { resolveMomentumLayer } from "./ydsMomentumLayer.js"
import { getFinalScore } from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   emoji: string
 *   text: string
 * }} ActionSignalLine
 */

/**
 * @typedef {{
 *   signals: ActionSignalLine[]
 *   stateLabel: string
 *   stateEmoji: string
 *   stateColor: string
 * }} ActionSignalView
 */

/** @param {string} text */
function iconForAction(text) {
  const t = String(text ?? "")
  if (/추격|금지|보류|중단|관망/.test(t)) return "🚫"
  if (/현금/.test(t)) return "💵"
  if (/관심|탐색|관찰|발굴|리스트/.test(t)) return "👀"
  if (/매수|익절|정리|분할|집중/.test(t)) return "📌"
  return "✓"
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
 * @param {object[]} [historyRows]
 * @returns {ActionSignalView | null}
 */
export function resolveActionSignalView(panicData, historyRows = []) {
  if (!panicData) return null
  const score = getFinalScore(panicData)
  if (!Number.isFinite(score)) return null

  const momentum = resolveMomentumLayer(panicData, historyRows)
  const actions = resolveTodayActions(Math.round(score), momentum, panicData)
  const market = resolveCurrentMarketView(panicData, historyRows)
  const effective = resolveEffectiveMarketAllocation(panicData)
  if (!actions || !market) return null

  const raw = actions.actions.slice(0, 3)
  const signals = raw.map((text, index) => {
    const isCash = /현금/.test(text)
    const line = isCash ? formatCashSignalLine(effective) : text
    return { emoji: iconForAction(line), text: line }
  })

  while (signals.length < 3) {
    signals.push({ emoji: "✓", text: "기존 포지션 유지" })
  }

  return {
    signals: signals.slice(0, 3),
    stateLabel: market.label,
    stateEmoji: market.emoji,
    stateColor: market.color,
  }
}
