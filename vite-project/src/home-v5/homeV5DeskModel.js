import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { buildHomeV5CoreTrend } from "./homeV5CoreTrend.js"

/** @typedef {"fearGreed" | "vix" | "highYield"} HomeV5CoreKey */

/** @typedef {{
 *   key: HomeV5CoreKey
 *   role: string
 *   symbol: string
 *   value: string
 *   trendLine: string
 *   trendDir: "up" | "down" | "flat"
 *   caption: string
 *   sparkline: string | null
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
  highYield: "신용",
}

const VALUE_LINES = {
  fearGreed: "CNN",
  vix: "VIX",
  highYield: "HY",
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
 * @param {object[]} [historyRows]
 */
export function buildHomeV5CoreCard(key, panicData, historyRows = []) {
  const raw = panicData?.[key]
  const n = Number(raw)
  const digits = key === "highYield" ? 1 : 0
  const trend = buildHomeV5CoreTrend(key, panicData, historyRows)

  return {
    key,
    role: CORE_ROLES[key],
    symbol: VALUE_LINES[key],
    value: Number.isFinite(n) ? fmtNum(n, digits) : "—",
    trendLine: trend.trendLine,
    trendDir: trend.trendDir,
    caption: trend.caption,
    sparkline: trend.sparkline,
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
    if (Number.isFinite(vix) && vix >= 25 && vix <= 30) lines.push("VIX 25~30")
    else if (Number.isFinite(vix) && vix > 20) lines.push("VIX 상승")
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
  const core = /** @type {HomeV5CoreKey[]} */ (["fearGreed", "vix", "highYield"]).map((key) =>
    buildHomeV5CoreCard(key, panicData, historyRows),
  )

  const score = panicData ? getFinalScore(panicData) : null
  const band = resolveMacroV1Status(score)
  if (!band) {
    return { core, strategy: null }
  }

  const shortLabel = SHORT_REGIME_LABEL[band.id] ?? band.label

  return {
    core,
    strategy: {
      id: band.id,
      emoji: band.emoji,
      label: shortLabel,
      color: band.color,
      action: ACTION_BY_REGIME[band.id] ?? "—",
      rationale: buildHomeV5StrategyRationale(panicData, band.id),
    },
  }
}
