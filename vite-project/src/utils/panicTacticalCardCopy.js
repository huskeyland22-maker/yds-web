/**
 * 전술 HUD 4카드 — 표준 행동 문구 (패닉1 거시 / 패닉2 실전 역할 분리)
 * UI 카드·추천 엔진·리포트 문구 통일용
 */

/** @type {{ short: string; mid: string; long: string; tactical: string }} */
export const PANIC_TACTICAL_CARD_ACTIONS = {
  short: "매수 타점",
  mid: "비중 조절",
  long: "장기 보유",
  tactical: "관심 종목",
}

/** 카드 표시용 (공백 제거) */
export const PANIC_TACTICAL_CARD_ACTIONS_COMPACT = {
  short: "매수타점",
  mid: "비중조절",
  long: "장기보유",
  tactical: "관심종목",
}

/** 패닉1 거시 — 장기보유 + 비중조절 */
export const PANIC_V1_MACRO_ROLE = "거시판단 · 장기보유 + 비중조절"

/** 패닉2 실전 — 매수타점 + 관심종목 */
export const PANIC_V2_TACTICAL_ROLE = "실전판단 · 매수타점 + 관심종목"
