/**
 * 패닉 → 섹터 점수 엔진 V1
 * @typedef {{
 *   panicIndex?: number | null
 *   vix?: number | null
 *   fearGreed?: number | null
 *   putCall?: number | null
 *   hyOas?: number | null
 *   marketState?: { stateKey?: string; label?: string; mood?: string } | null
 * }} SectorScoreInputs
 *
 * @typedef {{
 *   id: string
 *   label: string
 *   shortLabel: string
 *   score: number
 *   reasons: string[]
 * }} ScoredSector
 *
 * @typedef {{
 *   leaderSector: ScoredSector[]
 *   watchSector: ScoredSector[]
 *   avoidSector: ScoredSector[]
 *   scores: Record<string, number>
 *   marketMoodLabel: string
 *   marketStateLabel: string
 * }} SectorFlowResult
 */

import { KOREA_RADAR_ITEMS } from "../data/koreaGrowthSectorMap.js"
import { resolveMarketMood } from "./panicDeskMood.js"
import { getFinalScore } from "./tradingScores.js"

/** @type {Record<string, { label: string; shortLabel: string }>} */
export const SECTOR_SCORE_META = Object.fromEntries(
  KOREA_RADAR_ITEMS.map((r) => [r.sectorId, { label: r.label, shortLabel: r.shortLabel }]),
)

const SCORABLE_IDS = [
  "ai-semiconductor",
  "power-infra",
  "robot-automation",
  "shipbuilding",
  "bio-healthcare",
  "battery-materials",
  "defense-space",
]

function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {string} sectorId @param {number} score @param {string[]} reasons */
function scoredSector(sectorId, score, reasons) {
  const meta = SECTOR_SCORE_META[sectorId] ?? { label: sectorId, shortLabel: sectorId }
  return { id: sectorId, label: meta.label, shortLabel: meta.shortLabel, score, reasons }
}

/**
 * @param {SectorScoreInputs} inputs
 * @returns {SectorFlowResult}
 */
export function computeSectorFlow(inputs) {
  const fg = toNum(inputs.fearGreed)
  const hy = toNum(inputs.hyOas)
  const stateKey = inputs.marketState?.stateKey ?? "insufficient"
  const mood = resolveMarketMood(fg)

  /** @type {Record<string, number>} */
  const scores = Object.fromEntries(SCORABLE_IDS.map((id) => [id, 0]))
  /** @type {Record<string, string[]>} */
  const reasons = Object.fromEntries(SCORABLE_IDS.map((id) => [id, []]))

  const isGreedMood = mood.active && (mood.id === "greed" || mood.id === "extreme_greed")
  const isFearMood = mood.active && (mood.id === "fear" || mood.id === "extreme_fear")
  const isRiskOn = stateKey === "risk_on"
  const isNeutral = stateKey === "neutral"
  const isRiskOff =
    stateKey === "fear_dominant" || stateKey === "defensive" || stateKey === "volatility_expansion"

  const add = (id, pts, reason) => {
    if (!scores[id]) return
    scores[id] += pts
    reasons[id].push(reason)
  }

  // AI / 반도체: 탐욕(과열) + F&G>60 + HY OAS<3
  if (isGreedMood && fg != null && fg > 60 && hy != null && hy < 3) {
    add("ai-semiconductor", 3, "탐욕·신용 안정 → AI/반도체")
  } else if (fg != null && fg > 60 && hy != null && hy < 3) {
    add("ai-semiconductor", 2, "F&G>60·HY<3")
  }

  // 전력: AI 강세 연동
  if (scores["ai-semiconductor"] >= 2) {
    add("power-infra", 2, "AI 강세 → 전력 수요")
  }

  // 로봇: risk-on
  if (isRiskOn) {
    add("robot-automation", 2, "Risk-on → 자동화")
  }

  // 조선: 중립
  if (isNeutral) {
    add("shipbuilding", 1, "중립 → 조선 관찰")
  }

  // 바이오: risk-off
  if (isRiskOff) {
    add("bio-healthcare", 2, "Risk-off → 바이오")
  }

  // 2차전지: 공포
  if (isFearMood || stateKey === "fear_dominant") {
    add("battery-materials", 2, "공포 → 방어·2차전지")
  }

  // Risk-on·탐욕 구간: 방어·바이오 회피 가중
  if (isRiskOn || isGreedMood) {
    add("defense-space", -2, "Risk-on → 방산 상대 약세")
    if (!isRiskOff) add("bio-healthcare", -1, "Risk-on → 바이오 약세")
  }

  const ranked = SCORABLE_IDS.map((id) => scoredSector(id, scores[id], reasons[id])).sort(
    (a, b) => b.score - a.score,
  )

  const leaderSector = ranked.filter((s) => s.score >= 2).slice(0, 4)
  const watchSector = ranked
    .filter((s) => s.score >= 1 && s.score < 2 && !leaderSector.some((l) => l.id === s.id))
    .slice(0, 4)
  const avoidSector = ranked
    .filter((s) => s.score <= 0 || (s.id === "defense-space" && (isRiskOn || isGreedMood)))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)

  // 리더가 비었으면 상위 2개를 주도로
  if (!leaderSector.length && ranked[0]?.score > 0) {
    leaderSector.push(...ranked.filter((s) => s.score > 0).slice(0, 2))
  }
  if (!watchSector.length) {
    watchSector.push(
      ...ranked.filter(
        (s) =>
          s.score > 0 &&
          !leaderSector.some((l) => l.id === s.id) &&
          !avoidSector.some((a) => a.id === s.id),
      ).slice(0, 2),
    )
  }
  if (!avoidSector.length) {
    avoidSector.push(
      ...ranked
        .filter((s) => s.score <= 0)
        .slice(-2)
        .reverse(),
    )
  }

  return {
    leaderSector,
    watchSector,
    avoidSector,
    scores,
    marketMoodLabel: mood.active ? mood.label : "—",
    marketStateLabel: inputs.marketState?.label ?? "—",
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {{ stateKey?: string; label?: string }} [marketState]
 */
export function sectorFlowFromPanic(panicData, marketState) {
  const panicIndex =
    panicData && typeof panicData === "object"
      ? toNum(getFinalScore(panicData)) ?? toNum(panicData.panicIndex)
      : null
  return computeSectorFlow({
    panicIndex,
    vix: toNum(panicData?.vix),
    fearGreed: toNum(panicData?.fearGreed),
    putCall: toNum(panicData?.putCall),
    hyOas: toNum(panicData?.highYield ?? panicData?.hyOas),
    marketState: marketState ?? null,
  })
}
