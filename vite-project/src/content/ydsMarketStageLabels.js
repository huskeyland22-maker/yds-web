/**
 * 시장분석 전용 — 행동 중심 단계·패닉 라벨 (표시 전용 · 엔진 무관)
 * 분석 용어(사이클 후반·공포 부족) 대신 즉시 이해되는 행동 언어
 */

import { MACRO_STAGE_TO_PANIC_BAND } from "./ydsLanguage.js"
import { resolveYdsStatusSnapshot } from "./ydsStatusLabels.js"

/** @typedef {import("./ydsStatusLabels.js").CycleBandId} CycleBandId */
/** @typedef {import("./ydsStatusLabels.js").PanicBandId} PanicBandId */

/** @deprecated MARKET_LABEL_MARKET_STATE 사용 */
export const MARKET_LABEL_CURRENT_STAGE = "시장 상태"
export const MARKET_LABEL_MARKET_STATE = "시장 상태"
export const MARKET_LABEL_PANIC_INTENSITY = "패닉 강도"

/**
 * @typedef {{ label: string; hint: string }} MarketActionCopy
 */

/** @type {Record<CycleBandId, MarketActionCopy>} */
export const MARKET_STAGE_ACTION = {
  depression: {
    label: "극단 침체",
    hint: "시장이 깊은 침체에 있습니다. 바닥을 확인한 뒤 대응하세요.",
  },
  recovery: {
    label: "회복 관찰",
    hint: "회복이 시작됐습니다. 서두르지 말고 흐름을 확인하세요.",
  },
  growth: {
    label: "보유 구간",
    hint: "성장 국면입니다. 기존 포지션을 유지하세요.",
  },
  lateCycle: {
    label: "기회 대기",
    hint: "현재는 과열이 상당 부분 해소되었지만 아직 충분한 공포는 아닙니다. 좋은 기회를 기다리는 구간입니다.",
  },
  peakOverheat: {
    label: "현금 확보",
    hint: "과열 정점에 가깝습니다. 현금 비중을 늘리세요.",
  },
}

/** @type {Record<PanicBandId, MarketActionCopy>} */
export const MARKET_PANIC_ACTION = {
  noFear: {
    label: "리스크 관리",
    hint: "공포가 거의 없습니다. 추격매수는 자제하세요.",
  },
  lowFear: {
    label: "관망 유지",
    hint: "매수 기회가 충분하지 않습니다. 관망하며 준비하세요.",
  },
  interest: {
    label: "관심 구간",
    hint: "조정이 시작됐습니다. 분할매수를 준비하세요.",
  },
  dca: {
    label: "분할매수",
    hint: "공포가 커지고 있습니다. 계획대로 분할매수하세요.",
  },
  lifePoint: {
    label: "인생 타점",
    hint: "극단적 공포 구간입니다. 계획된 현금을 투입하세요.",
  },
}

/** @type {Record<CycleBandId, Record<PanicBandId, string>>} */
export const MARKET_STAGE_HEADLINE_MAP = {
  depression: {
    noFear: "극단 침체 · 리스크 관리",
    lowFear: "극단 침체 · 관망 유지",
    interest: "극단 침체 · 관심 구간",
    dca: "극단 침체 · 분할매수",
    lifePoint: "역사적 침체 · 인생 타점",
  },
  recovery: {
    noFear: "회복 관찰 · 리스크 관리",
    lowFear: "회복 관찰 · 관망 유지",
    interest: "회복 관찰 · 관심 구간",
    dca: "회복 · 분할매수 진행",
    lifePoint: "회복 중 공포 정점 · 인생 타점",
  },
  growth: {
    noFear: "보유 구간 · 리스크 관리",
    lowFear: "보유 구간 · 관망 유지",
    interest: "보유 구간 · 관심 구간",
    dca: "성장 중 조정 · 분할매수",
    lifePoint: "성장 중 급락 · 인생 타점",
  },
  lateCycle: {
    noFear: "기회 대기 · 리스크 관리",
    lowFear: "기회 대기 · 관망 유지",
    interest: "기회 대기 · 관심 구간",
    dca: "기회 대기 · 분할매수",
    lifePoint: "후반 급락 · 인생 타점",
  },
  peakOverheat: {
    noFear: "현금 확보 · 리스크 관리",
    lowFear: "현금 확보 · 관망 유지",
    interest: "현금 확보 · 관심 구간",
    dca: "과열 조정 · 분할매수",
    lifePoint: "극과열·공포 정점 · 인생 타점",
  },
}

/**
 * @param {CycleBandId | null | undefined} cycleId
 * @param {PanicBandId | null | undefined} panicId
 */
export function resolveMarketStageHeadline(cycleId, panicId) {
  if (!cycleId || !panicId) return null
  const text = MARKET_STAGE_HEADLINE_MAP[cycleId]?.[panicId]
  if (!text) return null
  return { text, emoji: "📍" }
}

/**
 * @param {CycleBandId | null | undefined} cycleId
 */
export function marketStageActionCopy(cycleId) {
  if (!cycleId) return null
  return MARKET_STAGE_ACTION[cycleId] ?? null
}

/**
 * @param {PanicBandId | null | undefined} panicId
 */
export function marketPanicActionCopy(panicId) {
  if (!panicId) return null
  return MARKET_PANIC_ACTION[panicId] ?? null
}

/**
 * @param {string | null | undefined} macroStageId
 */
export function marketPanicLabelForMacroStage(macroStageId) {
  const panicId = MACRO_STAGE_TO_PANIC_BAND[/** @type {import("./ydsLanguage.js").MacroV1StatusId} */ (macroStageId)]
  return marketPanicActionCopy(panicId)?.label ?? null
}

/**
 * @param {ReturnType<typeof resolveYdsStatusSnapshot>} snapshot
 */
export function applyMarketStageLabels(snapshot) {
  if (!snapshot?.cycle || !snapshot.panic) return snapshot

  const stageCopy = marketStageActionCopy(snapshot.cycle.id)
  const panicCopy = marketPanicActionCopy(snapshot.panic.id)

  return {
    ...snapshot,
    cycle: {
      ...snapshot.cycle,
      label: stageCopy?.label ?? snapshot.cycle.label,
      hint: stageCopy?.hint ?? "",
    },
    panic: {
      ...snapshot.panic,
      label: panicCopy?.label ?? snapshot.panic.label,
      hint: panicCopy?.hint ?? "",
    },
    headline:
      resolveMarketStageHeadline(snapshot.cycle.id, snapshot.panic.id) ??
      snapshot.headline,
  }
}

/**
 * @param {number | null | undefined} ydsScore
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [momentum]
 */
export function resolveMarketStageSnapshot(ydsScore, momentum) {
  return applyMarketStageLabels(resolveYdsStatusSnapshot(ydsScore, momentum))
}

/** @type {Record<CycleBandId, string[]>} — Hero·행동 카드 (시장 상태 단계 기준) */
export const MARKET_CYCLE_ACTION_ITEMS = {
  depression: ["바닥 확인 후 대응", "분할 접근 준비", "추격 매수 금지"],
  recovery: ["회복 흐름 관찰", "종목 리스트 정리", "추격 매수 금지"],
  growth: ["기본 비중 유지", "종목 감시", "추격 매수 자제"],
  lateCycle: ["기본 비중 유지", "종목 감시", "추격 매수 금지"],
  peakOverheat: ["현금 비중 확대", "신규 진입 축소", "수익 보호"],
}

/** 시장분석 레일 범례 (행동 중심) */
export const MARKET_STAGE_RAIL_LABELS =
  "🔵 극단 침체 · 🟢 회복 관찰 · 🟡 보유 구간 · 🟠 기회 대기 · 🔴 현금 확보"

export const MARKET_PANIC_RAIL_LABELS =
  "🔵 리스크 관리 · 🟢 관망 유지 · 🟡 관심 구간 · 🟠 분할매수 · 🔴 인생 타점"
