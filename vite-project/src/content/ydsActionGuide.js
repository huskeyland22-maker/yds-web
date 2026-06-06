/**
 * YDS 오늘의 행동 — UI 전용 (점수·가중치·구간 로직 무관)
 * 패닉 구간 기준 행동 지시 · 현금 비중은 macroStageAllocation 참조
 */

import { resolvePanicStatusLabel } from "./ydsStatusLabels.js"
import { resolveMacroStageAllocation } from "../trading-zone/macroStageAllocation.js"

/** @typedef {typeof PANIC_ACTION_GUIDE[keyof typeof PANIC_ACTION_GUIDE]["id"]} PanicActionBandId */

/** @typedef {{
 *   id: PanicActionBandId
 *   macroId: import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId
 *   emoji: string
 *   label: string
 *   actions: string[]
 * }} PanicActionGuide
 */

/** @type {Record<string, Omit<PanicActionGuide, "actions"> & { actions: (cashPct: number | null) => string[] }>} */
export const PANIC_ACTION_GUIDE = {
  noFear: {
    id: "overheat",
    macroId: "overheated",
    emoji: "🔵",
    label: "과열",
    actions: (cashPct) => [
      cashPct != null ? `현금 ${cashPct}% 확보` : "현금 확보",
      "신규 진입 축소",
      "수익 보호",
    ],
  },
  lowFear: {
    id: "neutral",
    macroId: "neutral",
    emoji: "🟢",
    label: "중립",
    actions: (cashPct) => [
      "추격매수 금지",
      cashPct != null ? `현금 ${cashPct}% 유지` : "현금 유지",
      "관심종목 관찰",
    ],
  },
  interest: {
    id: "interest",
    macroId: "interest",
    emoji: "🟡",
    label: "관심",
    actions: (cashPct) => [
      "관심종목 확대",
      "분할 진입 준비",
      cashPct != null ? `현금 ${cashPct}% 활용 검토` : "현금 활용 검토",
    ],
  },
  dca: {
    id: "dca",
    macroId: "dca",
    emoji: "🟠",
    label: "분할매수",
    actions: () => ["1차 매수", "분할 접근", "공포 활용"],
  },
  lifePoint: {
    id: "lifePoint",
    macroId: "panicBuy",
    emoji: "🔴",
    label: "인생 타점",
    actions: () => ["공격적 분할매수", "우량주 집중", "장기 시각 유지"],
  },
}

/** @type {Record<import("./ydsMomentumLayer.js").MomentumLayerView["level"] extends infer L ? L : never, string | null>} */
const MOMENTUM_ACTION_HINT = {
  none: null,
  warning: "단기 둔화 · 매수 속도 유지",
  strong: "급락 경고 · 분할 속도 조절",
}

/**
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} momentum
 */
function resolveMomentumActionHint(momentum) {
  if (!momentum || momentum.level === "none") return null
  const { level, cnnLevel, bofaLevel, cnnDelta3d } = momentum
  const cnnCritical =
    cnnLevel === "strong" || (cnnDelta3d != null && cnnDelta3d <= -25)
  const bofaStrong = bofaLevel === "strong"
  if (cnnCritical && (bofaStrong || (cnnDelta3d != null && cnnDelta3d <= -25))) {
    return "위험회피 · 신규 진입 보류"
  }
  if (level === "strong" || cnnLevel === "strong") {
    return MOMENTUM_ACTION_HINT.strong
  }
  return MOMENTUM_ACTION_HINT.warning
}

/**
 * @param {number | null | undefined} ydsScore
 * @param {import("./ydsMomentumLayer.js").MomentumLayerView | null | undefined} [momentum]
 */
export function resolveTodayActions(ydsScore, momentum) {
  const panic = resolvePanicStatusLabel(ydsScore)
  if (!panic?.id) return null

  const guide = PANIC_ACTION_GUIDE[panic.id]
  if (!guide) return null

  const alloc = resolveMacroStageAllocation(guide.macroId)
  const cashPct = alloc?.cashPct ?? null
  const actions = guide.actions(cashPct)
  const momentumHint = resolveMomentumActionHint(momentum)

  return {
    band: {
      id: guide.id,
      emoji: guide.emoji,
      label: guide.label,
      color: panic.color,
    },
    actions,
    momentumHint,
  }
}
