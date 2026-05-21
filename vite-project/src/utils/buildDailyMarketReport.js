/**
 * YDS Daily Market Report — Cycle + 패닉 + 채권(10Y·30Y·DXY) 통합 브리핑 (순수 함수)
 */
import { buildMarketOsIntegrated } from "../market-os/buildMarketOsIntegrated.js"
import { deriveBondLiquidityStatuses } from "../market-os/bondLiquidityStatus.js"
import { resolveCyclePosition } from "../market-os/positionLabels.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { computeMarketTiming } from "./panicMarketTimingEngine.js"

/**
 * @typedef {{
 *   marketStatus: string
 *   cycleLine: string
 *   bondLine: string
 *   shortTerm: string
 *   midTerm: string
 *   longTerm: string
 *   practicalAction: string
 *   cashAllocation: string
 *   cautionSectors: string
 *   watchSectors: string
 *   actionMode: string
 *   ready: boolean
 * }} DailyMarketReport
 */

/** @param {string[]} items */
function joinKo(items) {
  return items.filter((x) => x && x !== "—").join(" · ")
}

/**
 * @param {string[]} sectors
 * @param {import("./panicMarketActionEngine.js").MarketRegime} regime
 * @param {boolean} bondStress
 */
function buildSectorLines(sectors, regime, bondStress) {
  const watch = [...sectors]
  if (bondStress && !watch.some((s) => /AI|반도체/i.test(s))) {
    watch.unshift("AI 관찰")
  }
  if (regime === "fear" || regime === "extreme_fear") {
    if (!watch.some((s) => /가치|배당/i.test(s))) watch.push("가치주 우호")
  }

  /** @type {string[]} */
  const caution = []
  if (regime === "greed" || regime === "extreme_greed") {
    caution.push("성장 추격")
    if (regime === "extreme_greed") caution.push("소형·테마")
  }
  if (bondStress) {
    caution.push("금리 민감 성장")
    caution.push("고베타")
  }
  if (regime === "extreme_fear") caution.push("레버리지·풀비중")

  return {
    watch: watch.length ? joinKo([...new Set(watch)].slice(0, 4)) : "분산·대형",
    caution: caution.length ? joinKo([...new Set(caution)].slice(0, 4)) : "—",
  }
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} input
 * @returns {DailyMarketReport}
 */
export function buildDailyMarketReport({ panicData = null, cycleScore = null, snapshot = null }) {
  const cycle = resolveCyclePosition(cycleScore)
  const action = computeMarketAction(panicData)
  const timing = computeMarketTiming(panicData)
  const os = snapshot ? buildMarketOsIntegrated({ cycleScore, snapshot }) : null
  const bondStatuses = deriveBondLiquidityStatuses(snapshot)
  const bondLine = bondStatuses.slice(0, 2).join(" · ") || "채권·유동성 확인"

  const hasCycle = Number.isFinite(Number(cycleScore))
  const hasPanic = Boolean(action && timing)
  const hasBond = Boolean(snapshot)
  const ready = hasCycle || hasPanic || hasBond

  const shortTerm =
    timing?.short?.actionShort || timing?.short?.action || action?.shortTerm || "—"
  const midTerm = timing?.mid?.actionShort || timing?.mid?.action || action?.midTerm || "—"
  const longTerm =
    timing?.long?.actionShort || timing?.long?.action || action?.longTerm || "—"

  const bondStress = bondStatuses.some((s) =>
    ["금리 재평가", "장기채 경고", "유동성 주의", "성장주 압박", "유동성 축소"].includes(s),
  )

  const practicalParts = []
  if (os?.forbiddenActions?.length) {
    const chase = os.forbiddenActions.find((x) => x.includes("추격"))
    if (chase) practicalParts.push(chase)
  }
  if (os?.actionNow?.today) practicalParts.push(os.actionNow.today)
  if (os?.actionNow?.ai) practicalParts.push(`${os.actionNow.ai}`)
  else if (action?.strategyThesis) practicalParts.push(action.strategyThesis)
  const practicalAction = joinKo(practicalParts) || action?.actionHeadline?.split("—")[0]?.trim() || "관망"

  const cashRaw = os?.actionNow?.cash
  const cashAllocation = cashRaw && cashRaw !== "—" ? `${cashRaw}%` : "20~30%"

  const regime = action?.regime ?? "neutral"
  const sectorLines = buildSectorLines(action?.sectors ?? [], regime, bondStress)

  const marketStatus =
    os?.positionSummary ||
    joinKo([cycle.position, action?.regimeLabel, bondLine]) ||
    "데이터 입력 후 자동 생성"

  const actionMode =
    action?.actionMode === "Risk-on"
      ? "Risk ON"
      : action?.actionMode === "Risk-off"
        ? "Risk OFF"
        : "Neutral"

  return {
    marketStatus,
    cycleLine: cycle.position,
    bondLine,
    shortTerm,
    midTerm,
    longTerm,
    practicalAction,
    cashAllocation,
    cautionSectors: sectorLines.caution === "—" ? "특이 없음" : sectorLines.caution,
    watchSectors: sectorLines.watch,
    actionMode,
    ready,
  }
}
