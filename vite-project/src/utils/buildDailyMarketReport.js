/**
 * YDS Daily Market Report — Cycle + 패닉 + 채권(10Y·30Y·DXY) 통합 브리핑 (순수 함수)
 * 단기/중기/장기 행동 문구는 포트 비중 수치 카드에만 표시 (중복 제거)
 */
import { buildMarketOsIntegrated } from "../market-os/buildMarketOsIntegrated.js"
import { deriveBondLiquidityStatuses } from "../market-os/bondLiquidityStatus.js"
import { resolveCyclePosition } from "../market-os/positionLabels.js"
import { buildSectorRotation } from "./buildSectorRotation.js"

/**
 * @typedef {{
 *   statusPills: string[]
 *   practicalAction: string
 *   cashAllocation: string
 *   cautionSectors: string
 *   watchSectors: string
 *   ready: boolean
 * }} DailyMarketReport
 */

const BOND_STRESS_STATUSES = new Set([
  "금리 재평가",
  "장기채 경고",
  "유동성 주의",
  "성장주 압박",
  "유동성 축소",
  "금리·유동성 경계",
])

/**
 * @param {string[]} bondStatuses
 * @param {string} cyclePosition
 */
function buildStatusPills(bondStatuses, cyclePosition) {
  /** @type {string[]} */
  const pills = []
  if (cyclePosition && cyclePosition !== "데이터 대기" && cyclePosition !== "—") {
    pills.push(cyclePosition)
  }
  for (const s of bondStatuses) {
    if (s === "보조 확인 양호" || s === "데이터 수집 중") continue
    if (BOND_STRESS_STATUSES.has(s) && !pills.includes(s)) pills.push(s)
  }
  if (!pills.length && bondStatuses[0]) pills.push(bondStatuses[0])
  return pills.slice(0, 4)
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
  const os = snapshot ? buildMarketOsIntegrated({ cycleScore, snapshot }) : null
  const bondStatuses = deriveBondLiquidityStatuses(snapshot)
  const rotation = buildSectorRotation({ panicData, cycleScore, snapshot })

  const hasCycle = Number.isFinite(Number(cycleScore))
  const hasPanic = Boolean(rotation.ready)
  const hasBond = Boolean(snapshot)
  const ready = hasCycle || hasPanic || hasBond

  const statusPills = buildStatusPills(bondStatuses, cycle.position)

  const practicalAction =
    os?.actionNow?.today ||
    os?.forbiddenActions?.find((x) => x.includes("추격")) ||
    "관망"

  const cashRaw = os?.actionNow?.cash
  const cashAllocation = cashRaw && cashRaw !== "—" ? `${cashRaw}%` : "20~30%"

  return {
    statusPills,
    practicalAction,
    cashAllocation,
    cautionSectors: rotation.cautionSummary,
    watchSectors: rotation.watchSummary,
    ready,
  }
}
