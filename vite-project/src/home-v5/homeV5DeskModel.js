import { resolveCoreMetricDataStatus } from "./homeV5CoreMetricLayers.js"
import { buildHomeV5CoreTrend } from "./homeV5CoreTrend.js"
import { resolveHomeV5StrategyRegime } from "./homeV5StrategyRegime.js"
import { buildMarketPolicy, resolveCoreMetricPolicyHint } from "../trading-zone/marketPolicyEngine.js"
import { buildHomeV5CoreSynthesis } from "./homeV5CoreSynthesis.js"
import {
  YDS_STAGE_ACTION,
  formatYdsStageTitle,
  resolveHomeV5StrategyTransition,
} from "./homeV5StrategyStage.js"

/** @typedef {"fearGreed" | "vix" | "bofa" | "strategy"} HomeV5CoreKey */

import { HOME_V5_CORE_METRIC_ORDER } from "./homeV5CoreMetricOrder.js"

export { HOME_V5_CORE_METRIC_ORDER } from "./homeV5CoreMetricOrder.js"

/** @typedef {{
 *   key: HomeV5CoreKey
 *   kind: "metric" | "strategy"
 *   role: string
 *   symbol?: string
 *   value: string
 *   trendLine: string
 *   timelineText: string
 *   timelineTextMobile?: string
 *   changeText: string
 *   changeDeltaText: string
 *   changeDeltaTextMobile?: string
 *   trendArrow: string
 *   trendDir: "up" | "down" | "flat"
 *   dataStatusLabel: string
 *   policyHint: string
 *   recentChangeLabel: string
 *   recentChangeTone: "up" | "down" | "flat"
 *   stageId?: string
 *   accentColor?: string
 * }} HomeV5CoreCardModel */

/** @typedef {{
 *   id: string
 *   emoji: string
 *   label: string
 *   color: string
 *   action: string
 *   rationale: string[]
 * }} HomeV5StrategyModel */

/** @typedef {{
 *   regimeId: string
 *   color: string
 *   segments: string[]
 * }} HomeV5StrategyStatusBarModel */

const CORE_ROLES = {
  fearGreed: "심리",
  vix: "변동성",
  bofa: "신용",
}

const VALUE_LINES = {
  fearGreed: "CNN",
  vix: "VIX",
  bofa: "BofA",
}

/** @param {unknown} v @param {number} [digits] */
function fmtNum(v, digits = 1) {
  const n = Number(v)
  if (!Number.isFinite(n)) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(digits)
}

/**
 * @param {HomeV5CoreKey} key
 * @param {object | null | undefined} panicData
 * @param {ReturnType<typeof buildMarketPolicy> | null} [marketPolicy]
 * @param {object[]} [historyRows]
 */
export function buildHomeV5CoreCard(key, panicData, marketPolicy = null, historyRows = []) {
  const raw = panicData?.[key]
  const n = Number(raw)
  const digits = key === "bofa" ? 1 : key === "vix" ? 2 : 0
  const trend = buildHomeV5CoreTrend(key, panicData, historyRows)
  const policy = marketPolicy ?? buildMarketPolicy({ panicData })
  const dataStatusLabel = resolveCoreMetricDataStatus(key, raw)
  let policyHint = resolveCoreMetricPolicyHint(key, policy)
  if (key === "vix" && dataStatusLabel === "낮은 변동성") {
    policyHint = "종목 탐색"
  }

  return {
    key,
    kind: "metric",
    role: CORE_ROLES[key],
    symbol: VALUE_LINES[key],
    value: Number.isFinite(n) ? fmtNum(n, digits) : "—",
    trendLine: trend.trendLine,
    timelineText: trend.timelineText,
    timelineTextMobile: trend.timelineTextMobile,
    changeText: trend.changeText,
    changeDeltaText: trend.changeDeltaText,
    changeDeltaTextMobile: trend.changeDeltaTextMobile,
    trendArrow: trend.trendArrow,
    trendDir: trend.trendDir,
    dataStatusLabel,
    policyHint,
    recentChangeLabel: "",
    recentChangeTone: "flat",
  }
}

/**
 * @param {NonNullable<ReturnType<typeof buildHomeV5StrategyEvaluation>>} evaluation
 * @param {ReturnType<typeof buildMarketPolicy>} marketPolicy
 * @param {object | null | undefined} panicData
 * @returns {HomeV5StrategyStatusBarModel}
 */
export function buildHomeV5StrategyStatusBar(evaluation, marketPolicy, panicData) {
  /** @type {string[]} */
  const segments = [evaluation.stageTitle, evaluation.actionLine]
  const vix = Number(panicData?.vix)

  if (Number.isFinite(vix) && vix < 18) {
    segments.push("종목 탐색 우선")
  } else {
    const primary = marketPolicy?.actionLines?.primary
    if (primary) segments.push(primary.includes("우선") ? primary : `${primary} 우선`)
  }

  const caution = marketPolicy?.actionLines?.caution ?? "추격 금지"
  if (caution && !segments.includes(caution)) segments.push(caution)

  const unique = segments.filter((s) => s && s !== "—")

  return {
    regimeId: evaluation.regimeId,
    color: evaluation.color,
    segments: unique,
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 */
export function buildHomeV5StrategyEvaluation(panicData, historyRows = [], synthesis = null) {
  const band = resolveHomeV5StrategyRegime(panicData)
  if (!band) return null

  const fg = Number(panicData?.fearGreed)
  const vix = Number(panicData?.vix)
  const bofa = Number(panicData?.bofa)
  const hy = Number(panicData?.highYield ?? panicData?.hyOas)
  const transition = resolveHomeV5StrategyTransition(band.id, panicData, historyRows, synthesis)
  const actionLine = YDS_STAGE_ACTION[band.id] ?? "—"

  return {
    regimeId: band.id,
    emoji: band.emoji,
    label: band.label,
    stageTitle: formatYdsStageTitle(band),
    color: band.color,
    action: actionLine,
    actionLine,
    transitionLine: transition.label,
    transitionTone: transition.tone,
    rationale: buildHomeV5StrategyRationale(panicData, band.id),
    metrics: {
      cnn: Number.isFinite(fg) ? fg : null,
      vix: Number.isFinite(vix) ? vix : null,
      bofa: Number.isFinite(bofa) ? bofa : null,
      hy: Number.isFinite(hy) ? hy : null,
    },
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {string} regimeId
 */
export function buildHomeV5StrategyRationale(panicData, regimeId) {
  const fg = Number(panicData?.fearGreed)
  const bofa = Number(panicData?.bofa)
  const vix = Number(panicData?.vix)
  const lines = []

  if (regimeId === "overheated") {
    if (Number.isFinite(fg) && fg >= 70) lines.push("CNN 70+")
    if (Number.isFinite(bofa) && bofa >= 7) lines.push("BofA 7+")
    if (Number.isFinite(fg) && fg >= 80) lines.push("CNN 80+")
    if (Number.isFinite(bofa) && bofa >= 7.5) lines.push("BofA ~8")
  } else if (regimeId === "interest") {
    if (Number.isFinite(fg) && fg < 30) lines.push("CNN < 30")
  } else if (regimeId === "dca") {
    if (Number.isFinite(fg) && fg < 25) lines.push("CNN < 25")
    if (Number.isFinite(vix) && vix >= 25) lines.push("VIX 25+")
  } else if (regimeId === "panicBuy") {
    if (Number.isFinite(fg) && fg < 10) lines.push("CNN < 10")
    if (Number.isFinite(vix) && vix >= 35) lines.push("VIX 35+")
  } else if (regimeId === "neutral") {
    lines.push("명확 신호 없음")
  }

  return lines.length ? lines : ["데이터 입력 후 근거 표시"]
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @returns {{
 *   core: HomeV5CoreCardModel[]
 *   strategyBar: HomeV5StrategyStatusBarModel | null
 *   strategy: HomeV5StrategyModel | null
 *   synthesis: import("./homeV5CoreSynthesis.js").HomeV5CoreSynthesisModel
 * }}
 */
export function buildHomeV5DeskModel(panicData, historyRows = []) {
  const marketPolicy = buildMarketPolicy({ panicData })
  const synthesis = buildHomeV5CoreSynthesis(panicData, marketPolicy)
  const core = HOME_V5_CORE_METRIC_ORDER.map((key) =>
    buildHomeV5CoreCard(key, panicData, marketPolicy, historyRows),
  )

  const evaluation = buildHomeV5StrategyEvaluation(panicData, historyRows, synthesis)

  if (!evaluation) {
    return { core, strategyBar: null, strategy: null, synthesis }
  }

  return {
    core,
    strategyBar: buildHomeV5StrategyStatusBar(evaluation, marketPolicy, panicData),
    synthesis,
    strategy: {
      id: evaluation.regimeId,
      emoji: evaluation.emoji,
      label: evaluation.label,
      color: evaluation.color,
      action: evaluation.action,
      rationale: evaluation.rationale,
    },
  }
}
