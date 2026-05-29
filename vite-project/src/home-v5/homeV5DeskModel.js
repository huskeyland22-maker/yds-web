import { resolveCoreMetricDataStatus } from "./homeV5CoreMetricLayers.js"
import { buildHomeV5CoreTrend } from "./homeV5CoreTrend.js"
import { resolveHomeV5StrategyRegime } from "./homeV5StrategyRegime.js"
import { buildMarketPolicy, resolveCoreMetricPolicyHint } from "../trading-zone/marketPolicyEngine.js"

/** @typedef {"fearGreed" | "vix" | "bofa" | "strategy"} HomeV5CoreKey */

/** @typedef {{
 *   key: HomeV5CoreKey
 *   kind: "metric" | "strategy"
 *   role: string
 *   symbol?: string
 *   value: string
 *   trendLine: string
 *   timelineText: string
 *   changeText: string
 *   trendDir: "up" | "down" | "flat"
 *   dataStatusLabel: string
 *   policyHint: string
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

const ACTION_BY_REGIME = {
  overheated: "현금 준비",
  neutral: "관망 · 기본 비중",
  interest: "저점 관찰",
  dca: "분할 진입 검토",
  panicBuy: "패닉 구간 대응",
}

const SHORT_REGIME_LABEL = {
  overheated: "과열",
  neutral: "중립",
  interest: "관심",
  dca: "분할매수",
  panicBuy: "패닉매수",
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

  return {
    key,
    kind: "metric",
    role: CORE_ROLES[key],
    symbol: VALUE_LINES[key],
    value: Number.isFinite(n) ? fmtNum(n, digits) : "—",
    trendLine: trend.trendLine,
    timelineText: trend.timelineText,
    changeText: trend.changeText,
    trendDir: trend.trendDir,
    dataStatusLabel: resolveCoreMetricDataStatus(key, raw),
    policyHint: resolveCoreMetricPolicyHint(key, policy),
  }
}

/**
 * @param {NonNullable<ReturnType<typeof buildHomeV5StrategyEvaluation>>} evaluation
 * @returns {HomeV5CoreCardModel}
 */
function buildHomeV5StrategyHudCard(evaluation) {
  const actionCompact = String(evaluation.action).replace("기본 비중", "기본비중")
  return {
    key: "strategy",
    kind: "strategy",
    role: "전략",
    value: `${evaluation.emoji} ${evaluation.label}`,
    trendLine: actionCompact,
    timelineText: "",
    changeText: actionCompact,
    trendDir: "flat",
    dataStatusLabel: "거시 레짐",
    policyHint: actionCompact,
    accentColor: evaluation.color,
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 */
export function buildHomeV5StrategyEvaluation(panicData, historyRows = []) {
  void historyRows
  const band = resolveHomeV5StrategyRegime(panicData)
  if (!band) return null

  const fg = Number(panicData?.fearGreed)
  const vix = Number(panicData?.vix)
  const bofa = Number(panicData?.bofa)
  const hy = Number(panicData?.highYield ?? panicData?.hyOas)

  return {
    regimeId: band.id,
    emoji: band.emoji,
    label: SHORT_REGIME_LABEL[band.id] ?? band.label,
    color: band.color,
    action: ACTION_BY_REGIME[band.id] ?? "—",
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
 * @returns {{ core: HomeV5CoreCardModel[]; strategy: HomeV5StrategyModel | null }}
 */
export function buildHomeV5DeskModel(panicData, historyRows = []) {
  const marketPolicy = buildMarketPolicy({ panicData })
  const metrics = /** @type {("fearGreed" | "vix" | "bofa")[]} */ ([
    "fearGreed",
    "vix",
    "bofa",
  ]).map((key) => buildHomeV5CoreCard(key, panicData, marketPolicy, historyRows))

  const evaluation = buildHomeV5StrategyEvaluation(panicData, historyRows)
  const core = evaluation ? [...metrics, buildHomeV5StrategyHudCard(evaluation)] : metrics

  if (!evaluation) {
    return { core, strategy: null }
  }

  return {
    core,
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
