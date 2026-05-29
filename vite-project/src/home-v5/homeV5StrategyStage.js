import { resolveCoreMetricRecentChange } from "./homeV5CoreMetricTransition.js"

/** @typedef {import("../panic-v2/panicMacroV1Status.js").MacroV1StatusId} HomeV5RegimeId */

/** @type {Record<HomeV5RegimeId, string>} */
export const YDS_STAGE_ACTION = {
  overheated: "현금 비중 확대",
  neutral: "기본비중 유지",
  interest: "관심 종목 관찰",
  dca: "1차 진입 가능",
  panicBuy: "패닉 분할 대응",
}

/** @type {Record<HomeV5RegimeId, string>} */
const STAGE_TRANSITION_DEFAULT = {
  overheated: "과열 압력 유지",
  neutral: "흐름 유지",
  interest: "눌림 대기 우세",
  dca: "분할 진입 검토 중",
  panicBuy: "패닉 대응 구간",
}

/**
 * @param {string} label
 */
function withProgressSuffix(label) {
  if (!label || label === "—" || label === "흐름 유지") return null
  if (/진행|우세|유지|구간|검토/.test(label)) return label
  if (/완화|확대|강화|증가|개선|약화|전환/.test(label)) return `${label} 진행 중`
  return `${label} 진행 중`
}

/**
 * @param {import("./homeV5CoreSynthesis.js").HomeV5CoreSynthesisModel | null | undefined} synthesis
 */
function synthesisToTransition(synthesis) {
  const h = synthesis?.headline
  if (!h) return null
  return h.replace(/우위$/, "우세")
}

/**
 * @param {HomeV5RegimeId} regimeId
 * @param {object | null | undefined} panicData
 * @param {object[]} historyRows
 * @param {import("./homeV5CoreSynthesis.js").HomeV5CoreSynthesisModel | null | undefined} [synthesis]
 * @returns {{ label: string; tone: "up" | "down" | "flat" }}
 */
export function resolveHomeV5StrategyTransition(regimeId, panicData, historyRows = [], synthesis = null) {
  const fg = resolveCoreMetricRecentChange("fearGreed", panicData, historyRows)
  const vix = resolveCoreMetricRecentChange("vix", panicData, historyRows)
  const bofa = resolveCoreMetricRecentChange("bofa", panicData, historyRows)

  if (regimeId === "neutral") {
    const fgProg = withProgressSuffix(fg.label)
    if (fg.label === "과열 완화") return { label: "과열 완화 진행 중", tone: "up" }
    if (fg.label === "회복 강화") return { label: "회복 강화 진행 중", tone: "up" }
    if (vix.label === "변동성 완화") return { label: "변동성 완화 진행 중", tone: "up" }
    if (fgProg) return { label: fgProg, tone: fg.tone }
    const syn = synthesisToTransition(synthesis)
    if (syn) return { label: syn, tone: "flat" }
    return { label: STAGE_TRANSITION_DEFAULT.neutral, tone: "flat" }
  }

  if (regimeId === "interest") {
    const syn = synthesisToTransition(synthesis)
    if (syn) return { label: syn, tone: "flat" }
    if (fg.label === "공포 확대" || fg.label === "위험 증가") {
      return { label: "공포 확대 진행", tone: "down" }
    }
    if (fg.label === "회복 강화") return { label: "회복 전환 진행 중", tone: "up" }
    return { label: STAGE_TRANSITION_DEFAULT.interest, tone: "flat" }
  }

  if (regimeId === "dca") {
    if (fg.label === "공포 확대" || fg.label === "위험 증가") {
      return { label: "공포 확대 진행", tone: "down" }
    }
    if (fg.label === "회복 강화") return { label: "회복 전환 진행 중", tone: "up" }
    if (vix.label === "변동성 확대" || vix.label === "위험 증가") {
      return { label: "변동성 확대 진행", tone: "down" }
    }
  }

  if (regimeId === "overheated") {
    if (fg.label === "과열 완화") return { label: "과열 완화 진행 중", tone: "up" }
    if (fg.label === "탐욕 확대") return { label: "탐욕 확대 진행", tone: "down" }
    if (bofa.label === "낙관 확대") return { label: "낙관 확대 진행", tone: "down" }
    return { label: STAGE_TRANSITION_DEFAULT.overheated, tone: "flat" }
  }

  if (regimeId === "panicBuy") {
    if (vix.label === "변동성 완화" || vix.label === "안정 강화") {
      return { label: "안정화 진행 중", tone: "up" }
    }
    if (fg.label === "회복 강화") return { label: "회복 강화 진행 중", tone: "up" }
    return { label: STAGE_TRANSITION_DEFAULT.panicBuy, tone: "down" }
  }

  const active = [fg, vix, bofa].find((c) => c.tone !== "flat")
  const picked = active ?? fg
  const prog = withProgressSuffix(picked.label)
  if (prog) return { label: prog, tone: picked.tone }

  return { label: STAGE_TRANSITION_DEFAULT[regimeId] ?? "흐름 유지", tone: "flat" }
}

/**
 * @param {import("../panic-v2/panicMacroV1Status.js").MacroV1Status} band
 */
export function formatYdsStageTitle(band) {
  return `${band.emoji} ${band.label}`
}
