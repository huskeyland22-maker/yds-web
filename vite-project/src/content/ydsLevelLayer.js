/**
 * YDS V2.0 Level Layer — CNN/BofA 절대값 (표시 전용 · 점수·엔진 무관)
 */

import { toNum } from "./ydsLayerHistory.js"

/** @typedef {"recovery"|"growth"|"late"|"extreme"} MarketLevelId */

/**
 * @typedef {{
 *   id: MarketLevelId
 *   emoji: string
 *   label: string
 *   color: string
 *   cnn: number | null
 *   bofa: number | null
 * }} MarketLevelView
 */

/** @type {{ id: MarketLevelId; cnnMin: number; bofaMin: number; emoji: string; label: string; color: string }[]} */
export const MARKET_LEVEL_RULES = [
  { id: "extreme", cnnMin: 80, bofaMin: 8, emoji: "🔴", label: "최고 과열", color: "#ef4444" },
  { id: "late", cnnMin: 70, bofaMin: 6.5, emoji: "🟠", label: "사이클 후반", color: "#f97316" },
  { id: "growth", cnnMin: 40, bofaMin: 4.5, emoji: "🟡", label: "성장", color: "#eab308" },
  { id: "recovery", cnnMin: 0, bofaMin: 0, emoji: "🟢", label: "회복", color: "#22c55e" },
]

/** @param {MarketLevelId} id */
function levelById(id) {
  const rule = MARKET_LEVEL_RULES.find((r) => r.id === id)
  return rule ?? MARKET_LEVEL_RULES[MARKET_LEVEL_RULES.length - 1]
}

/**
 * @param {number | null | undefined} fearGreed
 * @param {number | null | undefined} bofa
 * @returns {MarketLevelView | null}
 */
export function resolveMarketLevel(fearGreed, bofa) {
  const cnn = toNum(fearGreed)
  const b = toNum(bofa)
  if (cnn == null || b == null) return null

  for (const rule of MARKET_LEVEL_RULES) {
    if (rule.id === "recovery") continue
    if (cnn >= rule.cnnMin && b >= rule.bofaMin) {
      const tier = levelById(rule.id)
      return { id: tier.id, emoji: tier.emoji, label: tier.label, color: tier.color, cnn, bofa: b }
    }
  }

  const recovery = levelById("recovery")
  return {
    id: recovery.id,
    emoji: recovery.emoji,
    label: recovery.label,
    color: recovery.color,
    cnn,
    bofa: b,
  }
}
