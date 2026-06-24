/**
 * 시장분석 데스크 — 한줄 요약 (상태 · 유동성 · 행동)
 */

import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"

/**
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null | undefined} dualLiquidity
 * @returns {string[]}
 */
function buildLiquidityDeskSummaryLines(dualLiquidity) {
  const mode = dualLiquidity?.actionMode
  if (mode === "short_term") {
    return ["시장 자금 흐름 양호", "정책 환경 부담"]
  }
  if (mode === "medium_long") {
    return ["자금 흐름 약세", "정책 완화 기대 유지"]
  }
  if (mode === "aggressive") {
    return ["시장·정책 유동성 우호", "공격적 접근 여지"]
  }
  if (mode === "defense") {
    return ["시장·정책 유동성 약세", "방어 중심 접근"]
  }

  const lines = dualLiquidity?.synthesis?.lines
  if (Array.isArray(lines) && lines.length >= 2) {
    return lines.slice(0, 2).map((line) => compressDeskSummaryLine(line))
  }
  return ["시장·정책 유동성 균형", "선별적 접근 유지"]
}

/** @param {string} line */
function compressDeskSummaryLine(line) {
  return String(line ?? "")
    .replace(/입니다\.?$/, "")
    .replace(/은\s+/g, " ")
    .replace(/는\s+/g, " ")
    .replace(/이\s+/g, " ")
    .replace(/하지만/g, "")
    .replace(/아직\s+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * @param {ReturnType<typeof resolveMarketStateCenterView>} view
 * @param {string} [cycleLabel]
 * @returns {string[]}
 */
function buildStrategyDeskSummaryLines(view, cycleLabel = "") {
  if (/회복/.test(cycleLabel)) {
    return ["관심종목 분할진입 구간"]
  }
  if (/안정/.test(cycleLabel) && /조정/.test(cycleLabel)) {
    return ["관찰 우선 · 후보 정비"]
  }
  if (/진입/.test(cycleLabel)) {
    return ["조정 시작 · 현금·관심 균형"]
  }

  const narrative = view?.strategyNarrative ?? []
  if (narrative.length >= 2) {
    return narrative.slice(0, 2).map((line) => line.replace(/입니다\.?$/, ""))
  }
  if (view?.strategy) {
    return [view.strategy]
  }
  return []
}

/**
 * @param {object | null | undefined} panicData
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null | undefined} dualLiquidity
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null | undefined} cycleFlow
 */
export function buildMarketDeskSummary(panicData, dualLiquidity = null, cycleFlow = null) {
  const view = resolveMarketStateCenterView(panicData)
  if (!view) return null

  const cycleLabel = cycleFlow?.currentCycleLabel ?? view.position?.label ?? "시장 상태"
  const panicPart =
    view.panicScore != null ? `패닉${view.panicScore}` : view.panicLabel ?? ""

  /** @type {string[]} */
  const lines = [`${cycleLabel} · ${panicPart}`.trim()]
  lines.push(...buildLiquidityDeskSummaryLines(dualLiquidity))
  lines.push(...buildStrategyDeskSummaryLines(view, cycleLabel))

  return {
    title: "시장 한줄 요약",
    lines: lines.filter(Boolean).slice(0, 5),
  }
}
