/**
 * YDS V1 사이클 철학 — UI/카피 전용 (엔진·구간·가중치 무관)
 * @see docs/YDS_MARKET_CYCLE_PHILOSOPHY.md
 */

/** @typedef {"overheated"|"neutral"|"interest"|"dca"|"panicBuy"} YdsStageId */

/** @type {Record<YdsStageId, { role: string; hint: string; introLine: string; actionGuide: string; explain: string }>} */
export const YDS_STAGE_PHILOSOPHY = {
  overheated: {
    role: "리스크 관리",
    hint: "현금 확보 · 추격 자제",
    introLine: "과열 — 리스크 관리 · 현금 확보",
    actionGuide: "추격 제한 · 현금 비중 확대",
    explain: "과열 신호를 점검하고 보유 리스크를 관리하는 구간입니다.",
  },
  neutral: {
    role: "관찰·준비",
    hint: "시장 모니터링 · 관심 종목 정리",
    introLine: "중립 — 관찰 및 준비 · 종목 탐색",
    actionGuide: "종목 탐색 우선 · 추격매수 제한",
    explain: "공격적 신규 진입보다 기존 보유·관심 종목 정리가 유리합니다.",
  },
  interest: {
    role: "1차 기회",
    hint: "좋은 기업 탐색 · 초기 진입 검토",
    introLine: "관심 — 1차 기회 · 좋은 기업 탐색",
    actionGuide: "우량주 탐색 · 분할 준비 · 패닉을 기다리지 않음",
    explain: "1차 기회 구간입니다. 좋은 기업을 탐색하고 소량 분할 진입을 검토하세요.",
  },
  dca: {
    role: "핵심 매집",
    hint: "비중 확대 · 주력 투자 구간",
    introLine: "분할매수 — 핵심 매집 · 비중 확대 · 주력 투자",
    actionGuide: "핵심 매집 · 분할매수 실행 · 우량주 중심",
    explain: "YDS의 주력 실행 구간입니다. 계획대로 분할매수하며 비중을 확대하세요.",
  },
  panicBuy: {
    role: "보너스",
    hint: "극단적 공포 · 드문 기회",
    introLine: "패닉매수 — 보너스 · 극단 공포 · 드문 기회",
    actionGuide: "보너스 구간 · 계획 현금 투입 · 80+만이 기회는 아님",
    explain: "역사적으로 드물게 나타나는 보너스 구간입니다. 60–79 분할매수에서 이미 실행 중일 수 있습니다.",
  },
}

export const YDS_CYCLE_TAGLINE =
  "관심에서 준비하고, 분할매수에서 실행한다. 패닉매수는 보너스다."

export const YDS_CYCLE_TAGLINE_SUB =
  "패닉을 기다리는 시스템이 아닙니다. 관심·분할매수가 실전 기회의 중심입니다."

export const YDS_STAGE_INTRO_LIST = [
  YDS_STAGE_PHILOSOPHY.overheated.introLine,
  YDS_STAGE_PHILOSOPHY.neutral.introLine,
  YDS_STAGE_PHILOSOPHY.interest.introLine,
  YDS_STAGE_PHILOSOPHY.dca.introLine,
  YDS_STAGE_PHILOSOPHY.panicBuy.introLine,
]

export const YDS_STAGE_RAIL_LABELS = "🔵 과열 · 🟢 중립 · 🟡 관심 · 🟠 분할매수 · 🔴 패닉매수"

/**
 * @param {string | null | undefined} stageId
 */
export function getStagePhilosophy(stageId) {
  const id = /** @type {YdsStageId} */ (stageId)
  return YDS_STAGE_PHILOSOPHY[id] ?? YDS_STAGE_PHILOSOPHY.neutral
}
