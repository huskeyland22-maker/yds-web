/**
 * 메인 대시보드 — 오늘의 행동 가이드 (시장상태·패닉·유동성 규칙 · 종목 추천 없음)
 */

import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"
import {
  resolveUnifiedMarketStateGuide,
  resolveUnifiedMarketStateLabel,
} from "./ydsUnifiedMarketState.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { buildPanicCompositeVerdictReport } from "./ydsPanicCompositeVerdict.js"

/**
 * @typedef {{
 *   buy: number
 *   watch: number
 *   cash: number
 * }} ActionStarRatings
 */

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   marketState: string
 *   panicScore: number | null
 *   liquidityScore: number | null
 *   stars: ActionStarRatings
 *   buyStars: string
 *   watchStars: string
 *   cashStars: string
 *   recommendedActions: string[]
 *   liquidityLead: string | null
 * }} DashboardActionGuideReport
 */

/** @param {number} n */
function toStars(n) {
  const filled = Math.max(0, Math.min(5, Math.round(n)))
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`
}

/** @param {import("../market-os/liquidityDualEngine.js").LiquidityBandId} bandId */
function bandToLegacyLiqId(bandId) {
  if (bandId === "very_favorable" || bandId === "favorable") return "favorable"
  if (bandId === "alert" || bandId === "danger") return "alert"
  return "neutral"
}

/**
 * @param {string} posId
 * @param {string} macroId
 * @param {string} liqId
 * @param {import("./ydsPanicCompositeVerdict.js").PanicCompositeVerdictId | null | undefined} verdictId
 */
function resolveStarRatings(posId, macroId, liqId, verdictId) {
  let buy = 2
  let watch = 4
  let cash = 3

  if (posId === "overheat" || macroId === "overheated") {
    buy = 1
    watch = 4
    cash = 5
  } else if (posId === "boundary") {
    buy = 1
    watch = 5
    cash = 4
  } else if (posId === "adjustment") {
    buy = 2
    watch = 4
    cash = 3
  } else if (posId === "fear") {
    buy = 3
    watch = 3
    cash = 2
  } else if (posId === "panic" || macroId === "panicBuy") {
    buy = 4
    watch = 2
    cash = 2
  }

  if (liqId === "favorable") {
    buy = Math.min(5, buy + 1)
    cash = Math.max(1, cash - 1)
  } else if (liqId === "alert") {
    buy = Math.max(1, buy - 1)
    watch = Math.min(5, watch + 1)
    cash = Math.min(5, cash + 1)
  }

  if (verdictId === "trueFear") {
    buy = Math.max(buy, 5)
    watch = Math.min(watch, 2)
    cash = Math.min(cash, 2)
  } else if (verdictId === "earlyRecovery") {
    buy = Math.max(buy, 4)
    watch = Math.min(watch, 3)
    cash = Math.max(1, cash - 1)
  } else if (verdictId === "laggingFear") {
    buy = Math.min(buy, 2)
    watch = Math.max(watch, 4)
    cash = Math.min(5, cash + 1)
  } else if (verdictId === "overheat") {
    buy = Math.min(buy, 1)
    watch = Math.max(watch, 3)
    cash = Math.max(cash, 4)
  }

  return distinctifyActionDimensions({ buy, watch, cash })
}

/**
 * 분할매수·관망·현금비중 — 서로 겹치지 않게 정규화
 * @param {{ buy: number; watch: number; cash: number }} raw
 */
function distinctifyActionDimensions(raw) {
  const scaleIn = raw.buy
  const cashWeight = raw.cash
  let watch = Math.round((6 - scaleIn) * 0.38 + (6 - cashWeight) * 0.28 + 1)
  watch = Math.max(1, Math.min(5, watch))

  if (scaleIn >= 4 && cashWeight <= 2) watch = Math.min(watch, 2)
  if (cashWeight >= 4 && scaleIn <= 2) watch = Math.max(watch, 3)
  if (scaleIn <= 2 && cashWeight <= 2) watch = Math.max(watch, 4)

  return { buy: scaleIn, watch, cash: cashWeight }
}

/** @type {ReadonlyArray<{ key: 'buy' | 'watch' | 'cash'; label: string; hint: string }>} */
export const ACTION_DIMENSION_LABELS = [
  { key: "buy", label: "분할매수", hint: "신규 비중 확대 강도" },
  { key: "watch", label: "관망", hint: "관찰·대기 성향" },
  { key: "cash", label: "현금비중", hint: "현금 유지·확대" },
]

/**
 * @param {string} posId
 * @param {string} macroId
 * @param {string} liqId
 */
function resolveBaseActions(posId, macroId, liqId) {
  /** @type {string[]} */
  const actions = []

  if (posId === "overheat" || posId === "boundary" || macroId === "overheated") {
    actions.push("관심종목만 추적")
    actions.push("신규 진입은 분할 접근")
    actions.push("추격매수 금지")
  } else if (posId === "adjustment" || macroId === "interest") {
    actions.push("관심종목만 추적")
    actions.push("신규 진입은 분할 접근")
    actions.push("추격매수 금지")
  } else if (posId === "fear" || macroId === "dca") {
    actions.push("우량주 분할 접근")
    actions.push("관심종목 추적 강화")
    actions.push("추격매수 금지")
  } else if (posId === "panic" || macroId === "panicBuy") {
    actions.push("계획된 분할매수 검토")
    actions.push("우량주 중심 접근")
    actions.push("일괄 진입 금지")
  } else {
    actions.push("관심종목만 추적")
    actions.push("신규 진입은 분할 접근")
    actions.push("추격매수 금지")
  }

  if (liqId === "alert" && !actions.includes("현금 비중 점검")) {
    actions.push("현금 비중 점검")
  }

  return actions
}

/**
 * @param {ActionStarRatings} stars
 * @param {string[]} actions
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport['actionMode']} mode
 */
function applyLiquidityActionMode(stars, actions, mode) {
  if (!mode || mode === "balanced") return actions

  if (mode === "aggressive") {
    stars.buy = Math.min(5, stars.buy + 1)
    stars.watch = Math.max(1, stars.watch - 1)
    stars.cash = Math.max(1, stars.cash - 1)
    actions.unshift("공격 모드 · 분할 매수 확대")
  } else if (mode === "defense") {
    stars.buy = Math.max(1, stars.buy - 1)
    stars.watch = Math.min(5, stars.watch + 1)
    stars.cash = Math.min(5, stars.cash + 1)
    actions.unshift("방어 모드 · 현금 비중 확대")
  } else if (mode === "short_term") {
    stars.buy = Math.min(5, stars.buy + 1)
    actions.unshift("단기 매수 가능 · 분할 접근")
  } else if (mode === "medium_long") {
    stars.watch = Math.max(1, stars.watch - 1)
    actions.unshift("중장기 우호 · 우량주 중심")
  }

  return [...new Set(actions)].slice(0, 4)
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 * @param {import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null} [cycleFlow]
 * @param {{
 *   spyPrices?: Record<string, number>
 *   qqqPrices?: Record<string, number>
 *   asOfDate?: string | null
 * } | null} [priceContext]
 * @returns {DashboardActionGuideReport}
 */
export function buildDashboardActionGuideReport(
  panicData,
  historyRows = [],
  dualLiquidity = null,
  cycleFlow = null,
  priceContext = null,
) {
  const state = resolveMarketStateCenterView(panicData, {
    etfContext: priceContext
      ? {
          spyPrices: priceContext.spyPrices,
          qqqPrices: priceContext.qqqPrices,
          asOfDate: priceContext.asOfDate ?? null,
        }
      : null,
    dualLiquidity,
  })
  if (!state) {
    return {
      visible: false,
      title: "오늘 행동 가이드",
      marketState: "—",
      panicScore: null,
      liquidityScore: null,
      stars: { buy: 0, watch: 0, cash: 0 },
      buyStars: "☆☆☆☆☆",
      watchStars: "☆☆☆☆☆",
      cashStars: "☆☆☆☆☆",
      recommendedActions: [],
      liquidityLead: null,
    }
  }

  const unifiedLabel = resolveUnifiedMarketStateLabel(
    cycleFlow,
    state.position?.label ?? "—",
  )
  const unifiedGuide = resolveUnifiedMarketStateGuide(unifiedLabel)
  const marketState = `${unifiedLabel} · ${unifiedGuide.strategyPhase.replace(/ 단계$/, "")}`

  const panicScore =
    state.panicScore ?? (panicData ? Math.round(getFinalScore(panicData) ?? NaN) : null)
  const liquidityScore = dualLiquidity?.marketScore ?? null
  const posId = state.position.id
  const liqId = bandToLegacyLiqId(dualLiquidity?.market?.band?.id ?? "neutral")
  const macroId = state.macroId

  const composite = buildPanicCompositeVerdictReport(panicData, priceContext ?? undefined)
  const stars = resolveStarRatings(posId, macroId, liqId, composite.verdictId)
  const baseActions =
    unifiedGuide.actions.length > 0
      ? unifiedGuide.actions
      : resolveBaseActions(posId, macroId, liqId)
  const recommendedActions = applyLiquidityActionMode(
    stars,
    baseActions,
    dualLiquidity?.actionMode ?? "balanced",
  )
  const finalStars = distinctifyActionDimensions(stars)

  return {
    visible: true,
    title: "오늘 행동 가이드",
    marketState,
    panicScore: Number.isFinite(panicScore) ? panicScore : null,
    liquidityScore: Number.isFinite(liquidityScore) ? liquidityScore : null,
    stars: finalStars,
    buyStars: toStars(finalStars.buy),
    watchStars: toStars(finalStars.watch),
    cashStars: toStars(finalStars.cash),
    recommendedActions,
    liquidityLead: dualLiquidity?.synthesis?.leadSentence ?? null,
  }
}
