/**
 * YDS V1 사이클 철학 — UI/카피 전용 (엔진·구간·가중치 무관)
 * @see docs/YDS_MARKET_CYCLE_PHILOSOPHY.md
 */

/** @typedef {"overheated"|"neutral"|"interest"|"dca"|"panicBuy"} YdsStageId */

/** @type {Record<YdsStageId, { role: string; hint: string; introLine: string; actionGuide: string; explain: string; flowLabel: string }>} */
export const YDS_STAGE_PHILOSOPHY = {
  overheated: {
    role: "리스크 관리",
    flowLabel: "리스크 관리",
    segmentLabel: "리스크 관리 단계",
    hint: "현금 확보 · 추격 자제",
    introLine: "과열 — 리스크 관리",
    actionGuide: "추격 제한 · 현금 비중 확대",
    explain: "과열 신호를 점검하고 보유 리스크를 관리하는 구간입니다.",
  },
  neutral: {
    role: "관찰",
    flowLabel: "관찰",
    segmentLabel: "관찰 단계",
    hint: "시장 모니터링 · 종목 리스트",
    introLine: "중립 — 관찰",
    actionGuide: "시장 모니터링 · 추격매수 제한",
    explain: "시장을 관찰하며 종목 리스트를 정리하는 구간입니다. 추격매수는 자제하세요.",
  },
  interest: {
    role: "매수 준비",
    flowLabel: "쌓기",
    segmentLabel: "쌓기 · 발굴 · 현금 확보",
    hint: "종목 발굴 · 현금 확보 · 매수 준비",
    introLine: "준비 — 종목 발굴 · 현금 확보 · 매수 준비",
    actionGuide: "종목 발굴 · 현금 확보 · 소량 진입 검토",
    explain: "분할매수 전 준비 구간입니다. 우량주를 발굴하고 현금을 확보하며 소량 진입을 검토하세요.",
  },
  dca: {
    role: "핵심 매집",
    flowLabel: "실행",
    segmentLabel: "핵심 실행 · 비중 확대",
    hint: "비중 확대 · 주력 투자",
    introLine: "분할매수 — 핵심 매집 · 비중 확대 · 주력 투자",
    actionGuide: "핵심 매집 · 분할매수 실행 · 우량주 중심",
    explain: "YDS의 주력 실행 구간입니다. 계획대로 분할매수하며 비중을 확대하세요.",
  },
  panicBuy: {
    role: "보너스",
    flowLabel: "보너스",
    segmentLabel: "보너스 · 극단 공포",
    hint: "극단적 공포 · 드문 기회",
    introLine: "패닉매수 — 보너스 · 극단적 공포",
    actionGuide: "보너스 구간 · 계획 현금 투입 · 80+만이 기회는 아님",
    explain: "역사적으로 드물게 나타나는 보너스 구간입니다. 60–79 분할매수에서 이미 실행 중일 수 있습니다.",
  },
}

export const YDS_BRAND_HERO_TITLE = "Y'DS의 시장 사이클 투자 시스템"

export const YDS_CYCLE_TAGLINE =
  "준비구간에서 쌓고, 분할매수에서 실행한다. 패닉매수는 보너스다."

export const YDS_CYCLE_TAGLINE_SUB =
  "패닉을 기다리는 시스템이 아닙니다. 준비·분할매수가 실전 기회의 중심입니다."

export const YDS_HARVEST_TAGLINE = "과열을 예측하지 않는다. 과열을 관리한다."

export const YDS_DUAL_CYCLE_DISCOVERY =
  "YDS 총점(장기) → Momentum(변화율) → Event(구간 이탈) · 3계층"

/** @type {{ id: YdsStageId; emoji: string; short: string; segment: string }[]} */
export const YDS_FEAR_CYCLE_RAIL = [
  { id: "overheated", emoji: "🔵", short: "과열", segment: "리스크 관리" },
  { id: "neutral", emoji: "🟢", short: "중립", segment: "관찰" },
  { id: "interest", emoji: "🟡", short: "준비", segment: "쌓기" },
  { id: "dca", emoji: "🟠", short: "분할매수", segment: "실행" },
  { id: "panicBuy", emoji: "🔴", short: "패닉", segment: "보너스" },
]

/** @type {{ id: YdsStageId; emoji: string; short: string }[]} */
export const YDS_STAGE_FLOW_RAIL = [
  { id: "overheated", emoji: "🔵", short: "과열" },
  { id: "neutral", emoji: "🟢", short: "중립" },
  { id: "interest", emoji: "🟡", short: "준비" },
  { id: "dca", emoji: "🟠", short: "분할매수" },
  { id: "panicBuy", emoji: "🔴", short: "패닉매수" },
]

export const YDS_STAGE_INTRO_LIST = [
  YDS_STAGE_PHILOSOPHY.overheated.introLine,
  YDS_STAGE_PHILOSOPHY.neutral.introLine,
  YDS_STAGE_PHILOSOPHY.interest.introLine,
  YDS_STAGE_PHILOSOPHY.dca.introLine,
  YDS_STAGE_PHILOSOPHY.panicBuy.introLine,
]

export const YDS_STAGE_RAIL_LABELS = "🔵 과열 · 🟢 중립 · 🟡 준비 · 🟠 분할매수 · 🔴 패닉매수"

/**
 * @param {string | null | undefined} stageId
 */
export function getStagePhilosophy(stageId) {
  const id = /** @type {YdsStageId} */ (stageId)
  return YDS_STAGE_PHILOSOPHY[id] ?? YDS_STAGE_PHILOSOPHY.neutral
}
