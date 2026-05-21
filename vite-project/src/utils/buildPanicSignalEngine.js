/**
 * 9대 패닉지수 → 실전 판단 시그널 (Risk ON / 중립 / 주의 / 방어)
 * 핵심: 패닉 합성점수 + VIX·HY·F&G·MOVE — 채권·유동성은 보조 +1만
 */
import { deriveBondReferenceStatuses } from "../market-os/bondLiquidityReference.js"
import { pickMetricValue } from "./panicMarketActionEngine.js"
import { getFinalScore } from "./tradingScores.js"

/** @typedef {"risk_on" | "neutral" | "caution" | "defense"} PanicSignalId */

/**
 * @typedef {{
 *   ready: boolean
 *   signalId: PanicSignalId | null
 *   labelKo: string
 *   labelEn: string
 *   hint: string
 *   panicScore: number | null
 *   reasons: string[]
 *   flags: string[]
 *   bondAdjusted: boolean
 *   bondNote: string | null
 * }} PanicSignalEngineResult
 */

const TIERS = /** @type {const} */ (["risk_on", "neutral", "caution", "defense"])

const SIGNAL_COPY = {
  risk_on: {
    labelKo: "Risk ON",
    labelEn: "RISK ON",
    hint: "분할 매수 가능",
  },
  neutral: {
    labelKo: "중립",
    labelEn: "NEUTRAL",
    hint: "관망",
  },
  caution: {
    labelKo: "주의",
    labelEn: "WARNING",
    hint: "비중 조절",
  },
  defense: {
    labelKo: "방어",
    labelEn: "DEFENSE",
    hint: "익절 · 현금 확대",
  },
}

/** @param {number | null} score */
function baseTierFromPanicScore(score) {
  if (score == null || !Number.isFinite(score)) return null
  if (score < 30) return "risk_on"
  if (score < 45) return "neutral"
  if (score < 60) return "caution"
  return "defense"
}

/**
 * @param {object | null | undefined} panicData
 * @returns {{
 *   vix: number | null
 *   hy: number | null
 *   fg: number | null
 *   move: number | null
 *   vixStable: boolean
 *   hyStable: boolean
 *   fgOk: boolean
 *   vixRising: boolean
 *   moveRising: boolean
 *   hyWorse: boolean
 *   warnCount: number
 *   supportCount: number
 *   flags: string[]
 * }}
 */
function evaluateMetrics(panicData) {
  const vix = pickMetricValue(panicData, "vix")
  const hy = pickMetricValue(panicData, "highYield")
  const fg = pickMetricValue(panicData, "fearGreed")
  const move = pickMetricValue(panicData, "move")

  const vixStable = vix != null && vix < 20
  const hyStable = hy != null && hy < 5
  const fgOk = fg != null && fg >= 25 && fg <= 60

  const vixRising = vix != null && vix >= 22
  const moveRising = move != null && move >= 110
  const hyWorse = hy != null && hy >= 5.5

  /** @type {string[]} */
  const flags = []
  if (vixStable) flags.push("VIX 안정")
  else if (vixRising) flags.push("VIX 상승")
  if (hyStable) flags.push("HY 안정")
  else if (hyWorse) flags.push("HY 악화")
  if (fgOk) flags.push("F&G 공포~중립")
  else if (fg != null && fg < 25) flags.push("F&G 극공포")
  else if (fg != null && fg > 60) flags.push("F&G 과열")
  if (moveRising) flags.push("MOVE 상승")

  let warnCount = 0
  if (vixRising) warnCount++
  if (moveRising) warnCount++
  if (hyWorse) warnCount++
  if (fg != null && (fg < 25 || fg > 70)) warnCount++

  const supportCount = [vixStable, hyStable, fgOk].filter(Boolean).length

  return {
    vix,
    hy,
    fg,
    move,
    vixStable,
    hyStable,
    fgOk,
    vixRising,
    moveRising,
    hyWorse,
    warnCount,
    supportCount,
    flags,
  }
}

/**
 * @param {PanicSignalId | null} tier
 * @param {ReturnType<typeof evaluateMetrics>} m
 */
function refineTier(tier, m) {
  if (!tier) return null

  if (tier === "risk_on") {
    if (m.supportCount < 2) return "neutral"
    return "risk_on"
  }

  if (tier === "neutral") {
    if (m.warnCount >= 2 || (m.vixRising && m.hyWorse)) return "caution"
    return "neutral"
  }

  if (tier === "caution") {
    if (m.warnCount >= 3) return "defense"
    if (m.vixRising && m.moveRising && m.hyWorse) return "defense"
    return "caution"
  }

  return "defense"
}

/** @param {PanicSignalId} tier @param {boolean} bondAdjusted */
function buildReasons(tier, m, bondAdjusted) {
  /** @type {string[]} */
  const out = []

  if (tier === "risk_on") {
    if (m.vixStable) out.push("VIX 안정")
    if (m.hyStable) out.push("HY 안정")
    if (m.fgOk) out.push("F&G 공포~중립")
  } else if (tier === "neutral") {
    out.push("지표 혼합")
  } else if (tier === "caution") {
    if (m.vixRising) out.push("VIX 상승")
    if (m.moveRising) out.push("MOVE 상승")
    if (m.hyWorse) out.push("HY 악화")
    if (!out.length) out.push("패닉 상승 구간")
  } else {
    out.push("다중 경고")
    if (m.warnCount >= 2) {
      if (m.vixRising) out.push("VIX·변동성 부담")
      if (m.moveRising) out.push("채권 변동성")
      if (m.hyWorse) out.push("신용 스트레스")
    }
  }

  if (bondAdjusted) out.push("채권·유동성 보조 +1")

  return out.slice(0, 5)
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} input
 * @returns {PanicSignalEngineResult}
 */
export function buildPanicSignalEngine({ panicData = null, cycleScore = null, snapshot = null }) {
  if (!panicData) {
    return {
      ready: false,
      signalId: null,
      labelKo: "—",
      labelEn: "—",
      hint: "",
      panicScore: null,
      reasons: [],
      flags: [],
      bondAdjusted: false,
      bondNote: null,
    }
  }

  const panicScore = Number.isFinite(Number(cycleScore))
    ? Number(cycleScore)
    : getFinalScore(panicData)

  if (!Number.isFinite(panicScore)) {
    return {
      ready: false,
      signalId: null,
      labelKo: "—",
      labelEn: "—",
      hint: "",
      panicScore: null,
      reasons: [],
      flags: [],
      bondAdjusted: false,
      bondNote: null,
    }
  }

  const m = evaluateMetrics(panicData)
  let tier = refineTier(baseTierFromPanicScore(panicScore), m)
  if (!tier) {
    return {
      ready: false,
      signalId: null,
      labelKo: "—",
      labelEn: "—",
      hint: "",
      panicScore,
      reasons: [],
      flags: m.flags,
      bondAdjusted: false,
      bondNote: null,
    }
  }

  const bondStatuses = deriveBondReferenceStatuses(snapshot)
  const hasBondWarn = bondStatuses.length > 0
  let bondAdjusted = false
  if (hasBondWarn) {
    const idx = TIERS.indexOf(tier)
    if (idx >= 0 && idx < TIERS.length - 1) {
      tier = TIERS[idx + 1]
      bondAdjusted = true
    }
  }

  const copy = SIGNAL_COPY[tier]
  const bondNote = hasBondWarn ? bondStatuses.join(" · ") : null

  return {
    ready: true,
    signalId: tier,
    labelKo: copy.labelKo,
    labelEn: copy.labelEn,
    hint: copy.hint,
    panicScore: Math.round(panicScore),
    reasons: buildReasons(tier, m, bondAdjusted),
    flags: m.flags,
    bondAdjusted,
    bondNote,
  }
}

/** @param {PanicSignalId | null} id */
export function panicSignalBadgeClass(id) {
  switch (id) {
    case "risk_on":
      return "panic-signal-engine__badge--risk-on"
    case "neutral":
      return "panic-signal-engine__badge--neutral"
    case "caution":
      return "panic-signal-engine__badge--caution"
    case "defense":
      return "panic-signal-engine__badge--defense"
    default:
      return ""
  }
}
