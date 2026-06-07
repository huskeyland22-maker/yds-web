/**
 * YDS V1.8 사이클 철학 — UI/카피 전용 (엔진·구간·가중치 무관)
 * @see docs/YDS_MARKET_CYCLE_PHILOSOPHY.md
 */

import {
  YDS_CYCLE_TAGLINE_SUB_V18,
  YDS_CYCLE_TAGLINE_V18,
  YDS_DUAL_LAYER_DISCOVERY,
  YDS_PANIC_RAIL_LABELS,
  macroStageDisplayLabel,
  resolvePanicBandForMacroStage,
} from "./ydsLanguage.js"

/** @typedef {import("./ydsLanguage.js").MacroV1StatusId} YdsStageId */

/** @type {Record<YdsStageId, { role: string; hint: string; introLine: string; actionGuide: string; explain: string; flowLabel: string; segmentLabel: string }>} */
export const YDS_STAGE_PHILOSOPHY = {
  overheated: {
    role: "리스크 관리",
    flowLabel: "리스크 관리",
    segmentLabel: "리스크 관리 단계",
    hint: "현금 확보 · 추격 자제",
    introLine: "공포 없음 — 리스크 관리",
    actionGuide: "추격 제한 · 현금 비중 확대",
    explain: "매수 기회가 적은 구간입니다. 과열 신호를 점검하고 보유 리스크를 관리하세요.",
  },
  neutral: {
    role: "관찰",
    flowLabel: "관찰",
    segmentLabel: "관찰 단계",
    hint: "시장 모니터링 · 종목 리스트",
    introLine: "공포 부족 — 관찰",
    actionGuide: "시장 모니터링 · 추격매수 제한",
    explain: "공포가 충분히 오르지 않은 구간입니다. 종목 리스트를 정리하며 관찰하세요.",
  },
  interest: {
    role: "매수 준비",
    flowLabel: "쌓기",
    segmentLabel: "쌓기 · 발굴 · 현금 확보",
    hint: "종목 발굴 · 현금 확보 · 매수 준비",
    introLine: "관심 — 종목 발굴 · 현금 확보",
    actionGuide: "종목 발굴 · 현금 확보 · 소량 진입 검토",
    explain: "분할매수 전 준비 구간입니다. 우량주를 발굴하고 현금을 확보하며 소량 진입을 검토하세요.",
  },
  dca: {
    role: "핵심 매집",
    flowLabel: "실행",
    segmentLabel: "핵심 실행 · 비중 확대",
    hint: "비중 확대 · 주력 투자",
    introLine: "분할매수 — 핵심 매집 · 비중 확대",
    actionGuide: "핵심 매집 · 분할매수 실행 · 우량주 중심",
    explain: "실전 매수 기회의 중심 구간입니다. 계획대로 분할매수하며 비중을 확대하세요.",
  },
  panicBuy: {
    role: "보너스",
    flowLabel: "보너스",
    segmentLabel: "보너스 · 극단 공포",
    hint: "극단적 공포 · 드문 기회",
    introLine: "인생 타점 — 보너스 · 극단적 공포",
    actionGuide: "보너스 구간 · 계획 현금 투입",
    explain: "역사적으로 드물게 나타나는 보너스 구간입니다. 분할매수에서 이미 실행 중일 수 있습니다.",
  },
}

export const YDS_BRAND_HERO_TITLE = "Y'DS의 시장 사이클 투자 시스템"

export const YDS_CYCLE_TAGLINE = YDS_CYCLE_TAGLINE_V18
export const YDS_CYCLE_TAGLINE_SUB = YDS_CYCLE_TAGLINE_SUB_V18

export const YDS_HARVEST_TAGLINE = "사이클 후반을 예측하지 않는다. 최고 과열을 관리한다."

export const YDS_DUAL_CYCLE_DISCOVERY = YDS_DUAL_LAYER_DISCOVERY

/** @type {{ id: YdsStageId; emoji: string; short: string; segment: string }[]} */
export const YDS_FEAR_CYCLE_RAIL = ["overheated", "neutral", "interest", "dca", "panicBuy"].map(
  (id) => {
    const band = resolvePanicBandForMacroStage(id)
    const phil = YDS_STAGE_PHILOSOPHY[/** @type {YdsStageId} */ (id)]
    return {
      id: /** @type {YdsStageId} */ (id),
      emoji: band?.emoji ?? "—",
      short: band?.label ?? macroStageDisplayLabel(id),
      segment: phil.segmentLabel.replace(" 단계", "").split(" · ")[0],
    }
  },
)

/** @type {{ id: YdsStageId; emoji: string; short: string }[]} */
export const YDS_STAGE_FLOW_RAIL = YDS_FEAR_CYCLE_RAIL.map(({ id, emoji, short }) => ({
  id,
  emoji,
  short,
}))

export const YDS_STAGE_INTRO_LIST = [
  YDS_STAGE_PHILOSOPHY.overheated.introLine,
  YDS_STAGE_PHILOSOPHY.neutral.introLine,
  YDS_STAGE_PHILOSOPHY.interest.introLine,
  YDS_STAGE_PHILOSOPHY.dca.introLine,
  YDS_STAGE_PHILOSOPHY.panicBuy.introLine,
]

export const YDS_STAGE_RAIL_LABELS = YDS_PANIC_RAIL_LABELS

/**
 * @param {string | null | undefined} stageId
 */
export function getStagePhilosophy(stageId) {
  const id = /** @type {YdsStageId} */ (stageId)
  return YDS_STAGE_PHILOSOPHY[id] ?? YDS_STAGE_PHILOSOPHY.neutral
}
