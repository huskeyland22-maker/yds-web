/**
 * 메인 대시보드 — 오늘의 행동 가이드 (시장상태·패닉·유동성 규칙 · 종목 추천 없음)
 */

import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"
import { buildMarketPositionTimeline } from "./ydsMarketPositionTimeline.js"
import { resolveMarketRegime } from "./ydsRegimeLayer.js"
import { getFinalScore } from "../utils/tradingScores.js"

/**
 * @typedef {{
 *   visible: boolean
 *   title: string
 *   marketState: string
 *   panicScore: number | null
 *   liquidityScore: number | null
 *   checklist: string[]
 * }} DashboardActionGuideReport
 */

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 * @param {import("../market-os/liquidityEnvironment.js").LiquidityEnvironmentCard | null} liquidity
 * @returns {DashboardActionGuideReport}
 */
export function buildDashboardActionGuideReport(panicData, historyRows = [], liquidity = null) {
  const state = resolveMarketStateCenterView(panicData)
  if (!state) {
    return {
      visible: false,
      title: "오늘의 행동 가이드",
      marketState: "—",
      panicScore: null,
      liquidityScore: null,
      checklist: [],
    }
  }

  const regime = resolveMarketRegime(panicData, historyRows)
  const timeline = buildMarketPositionTimeline(historyRows, 5)
  const currentStep = timeline[timeline.length - 1] ?? null
  const phaseSuffix =
    currentStep?.phase && currentStep.phase !== "안정화" ? ` ${currentStep.phase}` : ""

  const marketState =
    regime?.summary ??
    `${state.position.label}${phaseSuffix} · ${state.strategyPhase.replace(/ 단계$/, "")}`

  const panicScore =
    state.panicScore ?? (panicData ? Math.round(getFinalScore(panicData) ?? NaN) : null)
  const liquidityScore = liquidity?.score ?? null

  /** @type {string[]} */
  const checklist = []
  const posId = state.position.id
  const liqId = liquidity?.verdict?.id ?? "neutral"
  const macroId = state.macroId

  if (posId === "overheat" || posId === "boundary" || macroId === "overheated") {
    checklist.push("공격적 추격매수 금지")
    checklist.push("현금 일부 유지")
  }

  if (posId === "adjustment" || posId === "fear" || macroId === "interest" || macroId === "dca") {
    checklist.push("관심종목 분할 접근")
  }

  if (posId === "overheat" || posId === "boundary") {
    checklist.push("단기 급등주 경계")
  }

  if (liqId === "favorable") {
    checklist.push("성장주 우위 유지")
  } else if (liqId === "alert") {
    checklist.push("포지션 크기 보수 운영")
    checklist.push("변동성 확대 대비")
  } else {
    checklist.push("선별적 종목 접근")
  }

  if (posId === "panic" || macroId === "panicBuy") {
    checklist.push("우량주 분할 검토")
  }

  if (posId === "fear" || (panicScore != null && panicScore >= 55)) {
    if (!checklist.includes("우량주 분할 검토")) {
      checklist.push("분할매수 리듬 유지")
    }
  }

  if (checklist.length < 3) {
    checklist.push("비중·현금 비율 점검")
  }

  return {
    visible: true,
    title: "오늘의 행동 가이드",
    marketState,
    panicScore: Number.isFinite(panicScore) ? panicScore : null,
    liquidityScore: Number.isFinite(liquidityScore) ? liquidityScore : null,
    checklist: [...new Set(checklist)].slice(0, 5),
  }
}
