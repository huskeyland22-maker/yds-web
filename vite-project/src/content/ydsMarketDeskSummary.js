/**
 * 시장분석 데스크 — 한줄 요약 (3줄 이내)
 */

import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"

/**
 * @param {object | null | undefined} panicData
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null | undefined} dualLiquidity
 */
export function buildMarketDeskSummary(panicData, dualLiquidity = null) {
  const view = resolveMarketStateCenterView(panicData)
  if (!view) return null

  /** @type {string[]} */
  const lines = []

  const posLabel = view.position?.label ?? "시장 상태"
  const posEmoji = view.position?.emoji ?? ""
  const panicPart =
    view.panicScore != null ? `패닉 ${view.panicScore}` : view.panicLabel ?? ""
  lines.push([posEmoji, posLabel, panicPart ? `· ${panicPart}` : ""].filter(Boolean).join(" "))

  const marketScore = dualLiquidity?.marketScore
  const policyScore = dualLiquidity?.policyScore
  if (marketScore != null && policyScore != null) {
    if (marketScore > policyScore + 5) {
      lines.push("시장 유동성 > 정책 유동성")
    } else if (policyScore > marketScore + 5) {
      lines.push("정책 유동성 > 시장 유동성")
    } else {
      lines.push("시장·정책 유동성 균형")
    }
  } else if (dualLiquidity?.synthesis?.headline) {
    lines.push(dualLiquidity.synthesis.headline)
  } else if (view.headline) {
    lines.push(view.headline)
  }

  const actions = view.actions ?? []
  if (actions[0]) lines.push(actions[0])
  if (lines.length < 3 && actions[1]) lines.push(actions[1])
  if (lines.length < 3 && view.strategy) lines.push(view.strategy)

  return {
    title: "시장 한줄 요약",
    lines: lines.slice(0, 3),
  }
}
