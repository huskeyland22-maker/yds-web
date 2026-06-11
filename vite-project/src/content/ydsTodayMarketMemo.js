/**
 * 메뉴 하단 — 오늘의 한줄 (시장 위치 + 패닉 강도 해석)
 * 상단 카드와 역할 분리: 위치·행동 단계는 카드, 여기서는 1~2문장 해석만 제공
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
const ACTION_LINE = {
  overheated: "추격매수를 자제하고 비중을 점검할 시기입니다.",
  neutral: "관망하며 종목 리스트를 정리할 시기입니다.",
  interest: "관심 종목 발굴을 시작할 시기입니다.",
  dca: "분할매수 후보를 점검할 시기입니다.",
  panicBuy: "계획된 현금 투입을 검토할 보너스 구간입니다.",
}

/** @type {Record<string, [string, string]>} */
const MEMO_OVERRIDES = {
  "overheat:overheated": ["과열권이 유지되고 있습니다.", "추격매수를 자제하고 현금 비중을 높일 시기입니다."],
  "overheat:neutral": ["과열권 내 심리가 조정되고 있습니다.", "비중을 점검하며 관망할 시기입니다."],
  "boundary:overheated": ["과열 경계에 접근하고 있습니다.", "추격매수를 자제하고 비중을 줄일 시기입니다."],
  "boundary:neutral": ["과열 해소가 시작되었습니다.", "현금과 관심 종목을 함께 준비하는 구간입니다."],
  "boundary:interest": ["과열 해소가 진행 중입니다.", "관심 종목 발굴을 시작할 시기입니다."],
  "adjustment:overheated": ["과열 해소 초기입니다.", "추격매수를 자제하고 현금을 확보할 시기입니다."],
  "adjustment:neutral": ["과열 해소 진행 중.", "현금과 관심 종목을 함께 준비하는 구간."],
  "adjustment:interest": ["조정 구간 진입.", "관심 종목 발굴을 시작할 시기."],
  "adjustment:dca": ["조정이 이어지고 있습니다.", "분할매수 후보를 점검할 시기입니다."],
  "fear:interest": ["위축 국면이 이어지고 있습니다.", "관심 종목을 선별하며 관망할 시기입니다."],
  "fear:dca": ["시장 위축이 확대되고 있습니다.", "분할매수 후보를 점검할 시기입니다."],
  "fear:panicBuy": ["공포 심리가 정점에 가깝습니다.", "계획된 분할매수를 검토할 시기입니다."],
  "panic:panicBuy": ["극단적 공포 구간에 진입했습니다.", "인생 타점 후보를 신중히 점검할 시기입니다."],
  "panic:dca": ["패닉 매도 압력이 고조되고 있습니다.", "분할매수 실행을 준비할 시기입니다."],
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
  const lines = override
    ? [...override]
    : [POSITION_LINE[position.id], ACTION_LINE[macro.id]].filter(Boolean)

  return {
    title: "오늘의 한줄",
    lines,
    positionId: position.id,
    macroStageId: macro.id,
  }
}
