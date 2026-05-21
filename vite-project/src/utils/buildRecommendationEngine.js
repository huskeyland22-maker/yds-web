/**
 * 추천 엔진 — Cycle·채권 참고 → 실전 행동 (Daily Report 보조)
 */
import { buildBondReferenceDisplay } from "../market-os/bondLiquidityReference.js"
import { resolveCycleZone } from "./cycleZoneLabels.js"
import { buildDailyMarketReport } from "./buildDailyMarketReport.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { compactPhrase } from "./dailyReportCopy.js"

/** @typedef {"LOW" | "MID" | "HIGH"} RecommendationStrength */

/**
 * @typedef {{
 *   ready: boolean
 *   today: string
 *   reasons: string[]
 *   strength: RecommendationStrength
 *   practical: { short: string; mid: string; long: string; tactical: string }
 *   risk: string[]
 * }} RecommendationEngineResult
 */

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @param {string} key */
function metricValue(snapshot, key) {
  const rows = [
    ...(snapshot?.tieredMetrics?.tier1 ?? []),
    ...(snapshot?.tieredMetrics?.tier2 ?? []),
  ]
  const row = rows.find((r) => r.key === key)
  const n = Number(row?.current)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {number} score
 * @param {import("./cycleZoneLabels.js").CycleZone} zone
 */
function resolveTodayPrimary(score, zone) {
  const s = Number(score)
  if (!Number.isFinite(s) || !zone.zone) return "관망"

  if (s >= 80 || zone.zone === "floor") return "매수"
  if (s >= 60 || zone.zone === "low") return "분할"
  if (s >= 40 || zone.zone === "transition") return "관망"
  if (s >= 20 || zone.zone === "high") return "비중확대"
  return "익절"
}

/**
 * @param {import("./cycleZoneLabels.js").CycleZone} zone
 * @param {string[]} bondStatuses
 * @param {{ rateHigh: boolean; longHigh: boolean; dxyHigh: boolean }} flags
 */
function buildReasons(zone, bondStatuses, flags) {
  /** @type {string[]} */
  const out = []
  if (zone.zoneLabel && zone.zoneLabel !== "데이터 대기") out.push(zone.zoneLabel)

  for (const label of bondStatuses) {
    if (label === "장기채 경고" && !out.includes("장기채 경고")) out.push("장기채 경고")
    else if (label === "유동성 주의" && !out.includes("유동성 주의")) out.push("유동성 주의")
    else if (label === "유동성 축소" && !out.includes("유동성 축소")) out.push("유동성 축소")
    else if (label === "금리 재평가" && !out.includes("금리압박")) out.push("금리압박")
  }

  if (flags.longHigh && !out.includes("장기채 경고")) out.push("장기채 경고")
  if (flags.dxyHigh && !out.includes("유동성 주의")) out.push("유동성 주의")
  if (flags.rateHigh && !out.some((r) => /금리/.test(r))) out.push("금리 상승")

  return out.slice(0, 4)
}

/**
 * @param {import("./cycleZoneLabels.js").CycleZone} zone
 * @param {string[]} bondStatuses
 * @param {{ rateHigh: boolean; longHigh: boolean; dxyHigh: boolean }} flags
 * @param {number} score
 */
function resolveStrength(zone, bondStatuses, flags, score) {
  let penalty = 0
  if (flags.rateHigh) penalty += 1
  if (flags.longHigh) penalty += 1
  if (flags.dxyHigh) penalty += 1
  if (zone.zone === "peak" || zone.zone === "high") penalty += 1
  if (bondStatuses.length >= 2) penalty += 1
  if (Number.isFinite(score) && score < 25) penalty += 1

  if (penalty >= 3) return "LOW"
  if (penalty >= 1) return "MID"
  return "HIGH"
}

/**
 * 추천 단계 · 실전 전략 — 기간별 표준 문구
 * @param {import("./cycleZoneLabels.js").CycleZone} zone
 * @param {import("./buildDailyMarketReport.js").DailyStrategy} strategy
 */
function resolveRecommendationPeriods(zone, strategy) {
  const z = zone.zone

  if (z === "peak" || z === "high") {
    return {
      short: "익절 관리",
      mid: "비중 확대",
      long: "장기 보유",
      tactical: "분할 관심",
    }
  }

  if (z === "floor" || z === "low") {
    return {
      short: "눌림 대기",
      mid: "분할매수",
      long: "장기 보유",
      tactical: "분할 관심",
    }
  }

  if (z === "transition") {
    return {
      short: "관망",
      mid: "비중 조절",
      long: "장기 보유",
      tactical: "분할 관심",
    }
  }

  return {
    short: compactPhrase(strategy.short) || "관망",
    mid: compactPhrase(strategy.mid) || "관망",
    long: compactPhrase(strategy.long) || "장기 보유",
    tactical: compactPhrase(strategy.practical) || "분할 관심",
  }
}

/**
 * @param {import("./cycleZoneLabels.js").CycleZone} zone
 * @param {ReturnType<typeof computeMarketAction>} action
 * @param {ReturnType<typeof buildDailyMarketReport>} report
 */
function buildRiskActions(zone, action, report) {
  /** @type {string[]} */
  const out = []

  const today = report.actionToday.today
  if (
    zone.zone === "peak" ||
    zone.zone === "high" ||
    /추격/.test(today) ||
    action?.regime === "greed" ||
    action?.regime === "extreme_greed"
  ) {
    out.push("추격 금지")
  }

  const caution = report.sectors.caution.filter((c) => c !== "특이 없음")
  if (caution.some((c) => /고베타|성장/.test(c))) out.push("고베타 주의")
  else if (caution[0]) out.push(compactPhrase(caution[0]))

  if (report.actionToday.cash) out.push(`현금 ${report.actionToday.cash}`)
  if (report.actionToday.rate) out.push(report.actionToday.rate)

  return [...new Set(out)].slice(0, 4)
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} input
 * @returns {RecommendationEngineResult}
 */
export function buildRecommendationEngine({ panicData = null, cycleScore = null, snapshot = null }) {
  const score = Number(cycleScore)
  const hasCycle = Number.isFinite(score)
  const zone = resolveCycleZone(cycleScore)
  const report = buildDailyMarketReport({ panicData, cycleScore, snapshot })
  const action = computeMarketAction(panicData)
  const bondRef = buildBondReferenceDisplay(snapshot)

  const flags = {
    rateHigh: (() => {
      const v = metricValue(snapshot, "US10Y")
      return v != null && v > 4.5
    })(),
    longHigh: (() => {
      const v = metricValue(snapshot, "US30Y")
      return v != null && v > 5
    })(),
    dxyHigh: (() => {
      const v = metricValue(snapshot, "DXY")
      return v != null && v > 100
    })(),
  }

  const ready = hasCycle || report.ready

  if (!ready) {
    return {
      ready: false,
      today: "관망",
      reasons: ["Cycle·패닉 입력 대기"],
      strength: "MID",
      practical: { short: "—", mid: "—", long: "—", tactical: "—" },
      risk: [],
    }
  }

  const today = resolveTodayPrimary(score, zone)
  const reasons = buildReasons(zone, bondRef.statusLabels, flags)
  const strength = resolveStrength(zone, bondRef.statusLabels, flags, score)

  const periods = resolveRecommendationPeriods(zone, report.strategy)

  return {
    ready: true,
    today,
    reasons: reasons.length ? reasons : [zone.zoneLabel || "중립"],
    strength,
    practical: periods,
    risk: buildRiskActions(zone, action, report),
  }
}
