/**
 * 오늘 시장 한줄 결론 — 시장상태 · 사이클 · 패닉 · 유동성 종합 (최대 3줄)
 */

import { buildDashboardActionGuideReport } from "./ydsDashboardActionGuide.js"
import { buildPanicCompositeVerdictReport } from "./ydsPanicCompositeVerdict.js"
import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"
import {
  resolveUnifiedMarketStateGuide,
  resolveUnifiedMarketStateLabel,
} from "./ydsUnifiedMarketState.js"

/**
 * @typedef {'defensive' | 'cautious' | 'neutral' | 'opportunity' | 'aggressive'} ConclusionSignalId
 */

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   signalId: ConclusionSignalId
 *   signalEmoji: string
 *   lines: string[]
 *   actions: string[]
 * }} TodayMarketConclusionReport
 */

/** @type {Record<ConclusionSignalId, string>} */
const SIGNAL_EMOJI = {
  defensive: "🔴",
  cautious: "🟡",
  neutral: "🟡",
  opportunity: "🟢",
  aggressive: "🟢",
}

/** @type {Record<ConclusionSignalId, string>} */
const SIGNAL_HEADLINE = {
  defensive: "지금은 공격 매수보다 방어가 우선입니다.",
  cautious: "아직 공격적으로 매수할 구간은 아닙니다.",
  neutral: "선별적 접근이 필요한 구간입니다.",
  opportunity: "분할매수 기회를 검토할 수 있습니다.",
  aggressive: "공격적 분할매수 구간에 가깝습니다.",
}

/** @param {string} liqId */
function bandToLegacyLiqId(liqId) {
  if (liqId === "very_favorable" || liqId === "favorable") return "favorable"
  if (liqId === "alert" || liqId === "danger") return "alert"
  return "neutral"
}

/**
 * @param {{
 *   posId: string
 *   macroId: string
 *   liqId: string
 *   panicStageId: string
 *   liquidityMode: string
 *   unifiedLabel: string
 * }} input
 * @returns {ConclusionSignalId}
 */
function resolveConclusionSignal(input) {
  const { posId, macroId, liqId, panicStageId, liquidityMode, unifiedLabel } = input
  let score = 0

  if (posId === "panic" || macroId === "panicBuy") score += 2
  else if (posId === "fear" || macroId === "dca") score += 1.5
  else if (posId === "adjustment" || macroId === "interest") score += 0
  else if (posId === "boundary") score -= 1.5
  else if (posId === "overheat" || macroId === "overheated") score -= 2

  if (/조정회복/.test(unifiedLabel)) score += 1
  else if (/조정안정/.test(unifiedLabel)) score -= 0.5
  else if (/조정진입/.test(unifiedLabel)) score -= 0.8
  else if (/과열|상승확산/.test(unifiedLabel)) score -= 2
  else if (/위축|충격/.test(unifiedLabel)) score += 1.5
  else if (/상승초기|경계회복/.test(unifiedLabel)) score += 0.5

  if (panicStageId === "trueFear" || panicStageId === "earlyRecovery") score += 1.5
  else if (panicStageId === "laggingFear") score -= 0.8
  else if (panicStageId === "overheat") score -= 2
  else if (panicStageId === "neutral") score += 0

  if (liqId === "favorable" || liquidityMode === "aggressive" || liquidityMode === "short_term") {
    score += 0.5
  }
  if (liqId === "alert" || liquidityMode === "defense") score -= 1

  if (score <= -1.5) return "defensive"
  if (score <= -0.3) return "cautious"
  if (score <= 0.8) return "neutral"
  if (score <= 1.8) return "opportunity"
  return "aggressive"
}

/** @param {string} line */
function compressLine(line) {
  return String(line ?? "")
    .replace(/입니다\.?$/, "")
    .replace(/하세요\.?$/, "하세요")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * @param {ConclusionSignalId} signalId
 * @param {ReturnType<typeof resolveUnifiedMarketStateGuide>} guide
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 * @returns {string[]}
 */
function buildBodyLines(signalId, guide, dualLiquidity) {
  const narrative = guide.strategyNarrative.map(compressLine).filter(Boolean)
  if (narrative.length >= 2) {
    return narrative.slice(0, 2)
  }

  const mode = dualLiquidity?.actionMode
  if (signalId === "defensive") {
    return ["현금 비중을 늘리고", "보유 종목 익절·비중을 점검하세요"]
  }
  if (signalId === "cautious") {
    return ["관심 종목을 정리하면서", "분할매수를 준비하세요"]
  }
  if (signalId === "opportunity" || signalId === "aggressive") {
    return ["우량주 중심으로", "계획된 비중으로 접근하세요"]
  }
  if (mode === "defense") {
    return ["유동성 부담을 감안해", "방어적 비중을 유지하세요"]
  }
  return narrative.length === 1
    ? [narrative[0], "추격매수는 자제하세요"]
    : ["관심 종목을 추리며", "분할 접근을 준비하세요"]
}

/**
 * @param {import("./ydsDashboardActionGuide.js").DashboardActionGuideReport['stars']} stars
 * @param {ConclusionSignalId} signalId
 * @param {string[]} guideActions
 * @returns {string[]}
 */
function buildActionTags(stars, signalId, guideActions) {
  /** @type {string[]} */
  const tags = []

  const ranked = [
    { label: "분할매수", score: stars.buy },
    { label: "관망", score: stars.watch },
    { label: "현금 유지", score: stars.cash },
  ].sort((a, b) => b.score - a.score)

  for (const item of ranked) {
    if (item.score >= 3 && tags.length < 2 && !tags.includes(item.label)) {
      tags.push(item.label)
    }
  }

  const shortFromGuide = guideActions
    .map((action) =>
      String(action)
        .replace(/신규\s*/g, "")
        .replace(/접근/g, "")
        .replace(/·.*/g, "")
        .trim(),
    )
    .filter((action) => action.length <= 8)

  for (const action of shortFromGuide) {
    if (tags.length >= 2) break
    const normalized =
      /분할/.test(action) ? "분할매수" : /현금/.test(action) ? "현금 유지" : /관망|관찰/.test(action) ? "관망" : null
    if (normalized && !tags.includes(normalized)) tags.push(normalized)
  }

  if (signalId !== "aggressive" && !tags.includes("추격 금지")) {
    tags.push("추격 금지")
  } else if (signalId === "aggressive" && tags.length < 3) {
    tags.push("일괄 진입 금지")
  }

  while (tags.length < 3) {
    const fallback = ranked.find((item) => !tags.includes(item.label))
    if (!fallback) break
    tags.push(fallback.label)
  }

  return [...new Set(tags)].slice(0, 3)
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null} cycleFlow
 * @param {{
 *   spyPrices?: Record<string, number>
 *   qqqPrices?: Record<string, number>
 *   asOfDate?: string | null
 * } | null} [priceContext]
 * @returns {TodayMarketConclusionReport}
 */
export function buildTodayMarketConclusion(
  panicData,
  historyRows = [],
  dualLiquidity = null,
  cycleFlow = null,
  priceContext = null,
) {
  const view = resolveMarketStateCenterView(panicData, {
    etfContext: priceContext ?? null,
  })
  if (!view) {
    return {
      visible: false,
      title: "오늘 한줄 결론",
      signalId: "neutral",
      signalEmoji: "🟡",
      lines: [],
      actions: [],
    }
  }

  const actionGuide = buildDashboardActionGuideReport(
    panicData,
    historyRows,
    dualLiquidity,
    cycleFlow,
    priceContext,
  )
  const unifiedLabel = resolveUnifiedMarketStateLabel(cycleFlow, view.position?.label ?? "—")
  const guide = resolveUnifiedMarketStateGuide(unifiedLabel)
  const composite = buildPanicCompositeVerdictReport(panicData, priceContext ?? undefined)

  const liqId = bandToLegacyLiqId(dualLiquidity?.market?.band?.id ?? "neutral")
  let signalId = resolveConclusionSignal({
    posId: view.position.id,
    macroId: view.macroId,
    liqId,
    panicStageId: composite.verdictId ?? "neutral",
    liquidityMode: dualLiquidity?.actionMode ?? "balanced",
    unifiedLabel,
  })

  if (composite.visible) {
    if (composite.verdictId === "trueFear") signalId = "aggressive"
    else if (composite.verdictId === "earlyRecovery") signalId = "opportunity"
    else if (composite.verdictId === "laggingFear") signalId = "cautious"
    else if (composite.verdictId === "overheat") signalId = "defensive"
  }

  const headline = SIGNAL_HEADLINE[signalId]
  let body = buildBodyLines(signalId, guide, dualLiquidity)
  if (composite.visible && composite.verdictId === "laggingFear") {
    body = composite.narrative.slice(0, 2)
  } else if (composite.visible && composite.narrative.length >= 2) {
    body = composite.narrative.slice(0, 2)
  }
  const lines = [headline, ...body].filter(Boolean).slice(0, 3)
  let actions = buildActionTags(actionGuide.stars, signalId, guide.actions)
  if (composite.visible && composite.verdictId === "laggingFear" && !actions.includes("추격 금지")) {
    actions = ["추격 금지", ...actions.filter((a) => a !== "추격 금지")].slice(0, 3)
  }

  return {
    visible: lines.length > 0,
    title: "오늘 한줄 결론",
    signalId,
    signalEmoji: SIGNAL_EMOJI[signalId],
    lines,
    actions,
  }
}
