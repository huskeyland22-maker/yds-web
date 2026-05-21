/**
 * YDS Daily Market Report — Cycle + 패닉 + 채권(10Y·30Y·DXY) 통합 브리핑 (순수 함수)
 * 단기/중기/장기 행동 문구는 포트 비중 수치 카드에만 표시 (중복 제거)
 */
import { buildMarketOsIntegrated } from "../market-os/buildMarketOsIntegrated.js"
import { deriveBondLiquidityStatuses } from "../market-os/bondLiquidityStatus.js"
import { resolveCyclePosition } from "../market-os/positionLabels.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"

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

/** @param {string[]} items */
function joinKo(items) {
  return items.filter((x) => x && x !== "—").join(" · ")
}

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
  const os = snapshot ? buildMarketOsIntegrated({ cycleScore, snapshot }) : null
  const bondStatuses = deriveBondLiquidityStatuses(snapshot)

  const hasCycle = Number.isFinite(Number(cycleScore))
  const hasPanic = Boolean(action)
  const hasBond = Boolean(snapshot)
  const ready = hasCycle || hasPanic || hasBond

  const bondStress = bondStatuses.some((s) => BOND_STRESS_STATUSES.has(s))
  const statusPills = buildStatusPills(bondStatuses, cycle.position)

  const practicalAction =
    os?.actionNow?.today ||
    os?.forbiddenActions?.find((x) => x.includes("추격")) ||
    action?.actionHeadline?.split("—")[0]?.trim() ||
    "관망"

  const cashRaw = os?.actionNow?.cash
  const cashAllocation = cashRaw && cashRaw !== "—" ? `${cashRaw}%` : "20~30%"

  const regime = action?.regime ?? "neutral"
  const sectorLines = buildSectorLines(action?.sectors ?? [], regime, bondStress)

  return {
    statusPills,
    practicalAction,
    cashAllocation,
    cautionSectors: sectorLines.caution === "—" ? "특이 없음" : sectorLines.caution,
    watchSectors: sectorLines.watch,
    ready,
  }
}
