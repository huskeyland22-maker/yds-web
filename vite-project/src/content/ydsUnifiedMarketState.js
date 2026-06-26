/**
 * YDS 통합 시장 상태 — 시장 상태 · 사이클 · 한줄 요약 · 행동 가이드 단일 기준
 *
 * cycleCompositeLabel(positionId, phase) 결과가 모든 표시의 기준 라벨입니다.
 */

import { cycleCompositeLabel } from "./ydsMarketCycleFlow.js"
import { MARKET_STATE_STRATEGY } from "./ydsMarketStateCenter.js"

export { cycleCompositeLabel }

/**
 * @typedef {{
 *   strategyPhase: string
 *   strategyNarrative: string[]
 *   actions: string[]
 * }} UnifiedMarketStateGuide
 */

/**
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null | undefined} cycleFlow
 * @param {string} [fallbackLabel]
 */
export function resolveUnifiedMarketStateLabel(cycleFlow, fallbackLabel = "—") {
  const label = String(cycleFlow?.currentCycleLabel ?? "").trim()
  return label || fallbackLabel
}

/**
 * @param {string} unifiedLabel
 * @returns {UnifiedMarketStateGuide}
 */
export function resolveUnifiedMarketStateGuide(unifiedLabel) {
  const label = String(unifiedLabel ?? "").trim()

  if (/조정회복\(경고\)/.test(label)) {
    return {
      strategyPhase: "회복 둔화 관찰 단계",
      strategyNarrative: [
        "회복 구간이나 지수 약세가 둔화 신호를 보입니다.",
        "분할 속도를 조절하며 관찰을 유지하세요.",
      ],
      actions: ["관찰 우선 · 분할 접근", "신규 비중 확대 자제", "지수 민감도 점검"],
    }
  }
  if (/조정회복/.test(label)) {
    return {
      strategyPhase: "분할진입 검토 단계",
      strategyNarrative: [
        "조정 이후 회복 신호가 나타나는 구간입니다.",
        "관심종목 분할진입을 검토하세요.",
      ],
      actions: ["관심종목 분할 진입", "우량주 중심", "추격매수 금지"],
    }
  }
  if (/조정안정/.test(label)) {
    return {
      strategyPhase: "관심 종목 발굴 단계",
      strategyNarrative: [
        "조정 후 안정화되는 구간입니다.",
        "후보 종목을 정비하며 기회를 관찰하세요.",
      ],
      actions: ["관심 종목 발굴", "현금 유지", "추격 금지"],
    }
  }
  if (/조정진입/.test(label)) {
    return {
      strategyPhase: "조정 대응 준비 단계",
      strategyNarrative: [
        "조정이 시작되는 구간입니다.",
        "현금과 관심 리스트 균형을 유지하세요.",
      ],
      actions: ["현금·관심 균형", "관심종목 정비", "추격 금지"],
    }
  }
  if (/상승초기|경계회복|위축회복/.test(label)) {
    return {
      strategyPhase: "선별적 진입 단계",
      strategyNarrative: [
        "상승 초기 또는 회복 전환 구간입니다.",
        "신규 진입은 선별적으로 접근하세요.",
      ],
      actions: ["선별적 분할 접근", "비중 점검", "추격 자제"],
    }
  }
  if (/상승확산|과열/.test(label)) {
    const block = MARKET_STATE_STRATEGY.overheat
    return {
      strategyPhase: block.strategyPhase,
      strategyNarrative: block.strategyNarrative,
      actions: block.actions,
    }
  }
  if (/경계/.test(label)) {
    const block = MARKET_STATE_STRATEGY.boundary
    return {
      strategyPhase: block.strategyPhase,
      strategyNarrative: block.strategyNarrative,
      actions: block.actions,
    }
  }
  if (/위축|충격/.test(label)) {
    const block = /충격/.test(label) ? MARKET_STATE_STRATEGY.panic : MARKET_STATE_STRATEGY.fear
    return {
      strategyPhase: block.strategyPhase,
      strategyNarrative: block.strategyNarrative,
      actions: block.actions,
    }
  }

  const block = MARKET_STATE_STRATEGY.adjustment
  return {
    strategyPhase: block.strategyPhase,
    strategyNarrative: block.strategyNarrative,
    actions: block.actions,
  }
}

/**
 * @param {ReturnType<typeof resolveUnifiedMarketStateGuide>} guide
 * @returns {string[]}
 */
export function buildUnifiedDeskStrategyLines(guide) {
  if (guide.strategyNarrative.length >= 2) {
    return guide.strategyNarrative.slice(0, 2).map((line) => line.replace(/입니다\.?$/, ""))
  }
  if (guide.strategyPhase) {
    return [guide.strategyPhase.replace(/ 단계$/, "")]
  }
  return []
}
