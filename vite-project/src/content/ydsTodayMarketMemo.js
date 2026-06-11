/**
 * 오늘의 해석 — 시장 위치 + 패닉 강도 (메뉴·시장분석 공통)
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { resolveMarketPosition } from "./ydsMarketPositionEngine.js"
/** @typedef {import("./ydsMarketPositionEngine.js").MarketPositionId} MarketPositionId */
/** @typedef {import("./ydsLanguage.js").MacroV1StatusId} MacroV1StatusId */

/** @type {Record<MarketPositionId, string>} */
const POSITION_LINE = {
  overheat: "과열권이 유지되고 있습니다.",
  boundary: "과열 경계 구간에 있습니다.",
  adjustment: "조정 흐름이 이어지고 있습니다.",
  fear: "시장 위축이 확대되고 있습니다.",
  panic: "극단적 위험회피가 진행 중입니다.",
}

/** @type {Record<MacroV1StatusId, string>} */
const PANIC_CONTEXT = {
  overheated: "아직 적극 매수 구간은 아닙니다.",
  neutral: "아직 적극 매수 구간은 아닙니다.",
  interest: "관심 구간에서 기회를 준비합니다.",
  dca: "분할 진입을 점검할 수 있습니다.",
  panicBuy: "적극 매수 구간에 가깝습니다.",
}

/** @type {Record<MacroV1StatusId, string[]>} */
const ACTION_LINES = {
  overheated: ["추격매수를 자제하고", "현금 비중을 높일 시기입니다."],
  neutral: ["관망하며 종목 리스트를", "정리할 시기입니다."],
  interest: ["관심 종목을 정리하며", "기회를 준비할 시기입니다."],
  dca: ["분할매수 후보를", "점검할 시기입니다."],
  panicBuy: ["계획된 현금 투입을", "검토할 보너스 구간입니다."],
}

/** @type {Record<string, string[]>} */
const MEMO_OVERRIDES = {
  "overheat:overheated": [
    "과열권이 유지되고 있습니다.",
    "패닉 강도는 {score}으로",
    "아직 적극 매수 구간은 아닙니다.",
    "추격매수를 자제하고",
    "현금 비중을 높일 시기입니다.",
  ],
  "boundary:neutral": [
    "과열 해소가 시작되었습니다.",
    "패닉 강도는 {score}으로",
    "아직 적극 매수 구간은 아닙니다.",
    "현금과 관심 종목을 함께",
    "준비하는 구간입니다.",
  ],
  "boundary:interest": [
    "과열 해소가 진행 중입니다.",
    "패닉 강도는 {score}으로",
    "관심 구간에서 기회를 준비합니다.",
    "관심 종목 발굴을",
    "시작할 시기입니다.",
  ],
  "adjustment:neutral": [
    "과열 해소가 진행되고 있습니다.",
    "패닉 강도는 {score}으로",
    "아직 적극 매수 구간은 아닙니다.",
    "현금과 관심 종목을 함께",
    "준비하는 구간입니다.",
  ],
  "adjustment:interest": [
    "과열 해소가 진행되고 있습니다.",
    "패닉 강도는 {score}으로",
    "아직 적극 매수 구간은 아닙니다.",
    "관심 종목을 정리하며",
    "기회를 준비할 시기입니다.",
  ],
  "adjustment:dca": [
    "조정이 이어지고 있습니다.",
    "패닉 강도는 {score}으로",
    "분할 진입을 점검할 수 있습니다.",
    "분할매수 후보를",
    "점검할 시기입니다.",
  ],
  "fear:dca": [
    "시장 위축이 확대되고 있습니다.",
    "패닉 강도는 {score}으로",
    "분할 진입을 점검할 수 있습니다.",
    "분할매수 후보를",
    "점검할 시기입니다.",
  ],
  "panic:panicBuy": [
    "극단적 공포 구간에 진입했습니다.",
    "패닉 강도는 {score}으로",
    "적극 매수 구간에 가깝습니다.",
    "계획된 현금 투입을",
    "신중히 검토할 시기입니다.",
  ],
}

/**
 * @param {string[]} lines
 * @param {number} score
 */
function applyScoreTemplate(lines, score) {
  return lines.map((line) => line.replace("{score}", String(score)))
}

/**
 * @typedef {{
 *   title: string
 *   lines: string[]
 *   positionId: MarketPositionId | null
 *   macroStageId: MacroV1StatusId | null
 * }} TodayMarketMemo
 */

/**
 * @param {object | null | undefined} panicData
 * @returns {TodayMarketMemo | null}
 */
export function buildTodayMarketMemo(panicData) {
  const position = resolveMarketPosition(panicData)
  const score = getFinalScore(panicData ?? {})
  const macro = Number.isFinite(score) ? resolveMacroV1Status(score) : null

  if (!position || !macro) return null

  const key = `${position.id}:${macro.id}`
  const override = MEMO_OVERRIDES[key]

  let lines
  if (override) {
    lines = applyScoreTemplate(override, score)
  } else {
    lines = [
      POSITION_LINE[position.id],
      `패닉 강도는 ${score}으로`,
      PANIC_CONTEXT[macro.id],
      ...(ACTION_LINES[macro.id] ?? []),
    ].filter(Boolean)
  }

  return {
    title: "오늘의 해석",
    lines,
    positionId: position.id,
    macroStageId: macro.id,
  }
}
