/**
 * 오늘 시장 리포트 — 실행형 카드·한줄 전략 요약
 */
import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { interpretPanicMetric } from "./panicMetricInterpretation.js"
import { clipReportLine, renderText } from "./renderReport.js"

/** @typedef {'market' | 'short' | 'mid' | 'risk'} ActionReportCardId */

/**
 * @typedef {{
 *   id: ActionReportCardId
 *   label: string
 *   emoji: string
 *   headline: string
 *   detail: string
 * }} ActionReportCard
 */

/** @param {import("./panicMarketActionEngine.js").MarketRegime} regime */
function cashAllocationHint(regime) {
  switch (regime) {
    case "extreme_fear":
      return "현금 40~50%"
    case "fear":
      return "현금 30~40%"
    case "extreme_greed":
      return "현금 30~40%"
    case "greed":
      return "현금 20~30%"
    default:
      return "현금 20~30%"
  }
}

/** @param {import("./panicMarketActionEngine.js").MarketRegime} regime @param {number | null} pc */
function shortTermSubHint(regime, pc) {
  if (regime === "greed" || regime === "extreme_greed") {
    if (pc != null && pc <= 0.55) return "과열 직전 · 추격 주의"
    if (regime === "extreme_greed") return "과열 구간 · 추격 주의"
    return "분할 접근 · 추격 주의"
  }
  if (regime === "fear" || regime === "extreme_fear") return "변동성 대비 · 소액 분할"
  return "범위 매매 · 포지션 제한"
}

/** @param {number | null} pc @param {number | null} fg */
function optionsPsychology(pc, fg) {
  if (pc != null && Number.isFinite(pc)) {
    if (pc <= 0.55) {
      return {
        headline: "과열 경계",
        detail: `P/C ${formatMetricValue("putCall", pc)} · 낙관 우세`,
      }
    }
    if (pc >= 0.85) {
      return {
        headline: "헤지 쏠림",
        detail: `P/C ${formatMetricValue("putCall", pc)} · 방어 우세`,
      }
    }
    return {
      headline: "중립권",
      detail: `P/C ${formatMetricValue("putCall", pc)} · 균형`,
    }
  }
  if (fg != null && fg >= 72) {
    return { headline: "탐욕 과열", detail: `공포탐욕 ${Math.round(fg)} · 콜 쏠림 주의` }
  }
  if (fg != null && fg <= 28) {
    return { headline: "공포 우세", detail: `공포탐욕 ${Math.round(fg)} · 풋 수요` }
  }
  return { headline: "옵션 중립", detail: "P/C · 심리 지표 확인" }
}

/** @param {string[]} parts */
function joinDetail(parts) {
  return parts.filter(Boolean).join(" · ")
}

/**
 * @param {import("./panicMarketReportEngine.js").PanicMarketReport | null} report
 * @param {object | null} panicData
 * @returns {ActionReportCard[]}
 */
export function buildActionReportCards(report, panicData) {
  const action = panicData ? computeMarketAction(panicData) : null
  const fg = panicData?.fearGreed != null ? Number(panicData.fearGreed) : null
  const pc = panicData?.putCall != null ? Number(panicData.putCall) : null
  const regime = action?.regime ?? "neutral"
  const regimeLabel = renderText(report?.regimeLabel) !== "—" ? renderText(report?.regimeLabel) : action?.regimeLabel ?? "중립"

  const fgIns = fg != null && Number.isFinite(fg) ? interpretPanicMetric("fearGreed", fg) : null
  const moodLine = fgIns ? `심리 ${fgIns.statusLabel}` : regimeLabel ? `심리 ${regimeLabel}` : ""

  const actionMode = renderText(report?.actionMode) !== "—" ? renderText(report?.actionMode) : action?.actionMode ?? "Neutral"
  const marketDetail = joinDetail([
    fg != null && Number.isFinite(fg) ? `공포탐욕${Math.round(fg)}` : "",
    moodLine,
  ])

  const shortHead =
    clipReportLine(report?.shortTerm || report?.short_strategy, 14) ||
    action?.shortTerm ||
    "관망 · 분할"
  const shortDetail = shortTermSubHint(regime, pc)

  const midHead =
    clipReportLine(report?.midTerm || report?.mid_strategy, 12) || action?.midTerm || "중립 유지"
  const sectorRaw = clipReportLine(report?.priority_sector || report?.sector, 28)
  const sectorLine =
    sectorRaw !== "—"
      ? sectorRaw
      : action?.sectors?.length
        ? action.sectors.slice(0, 3).join("·")
        : "대형주·ETF 분산"
  const cashHint = cashAllocationHint(regime).replace(/\s/g, "")
  const growthBias =
    action?.sectors?.some((s) => /AI|성장|반도체/i.test(s)) || /AI|성장|반도체/i.test(sectorLine)
      ? "AI 우세"
      : sectorLine.split("·")[0]?.trim() || "섹터 분산"
  const midDetail = joinDetail([growthBias, cashHint])

  const opt = optionsPsychology(pc, fg)
  const riskHead = opt.headline
  const riskDetail = opt.detail

  return [
    {
      id: "market",
      label: "AI 온도",
      emoji: "🔥",
      headline: fgIns?.statusLabel ?? regimeLabel ?? actionMode,
      detail: marketDetail || regimeLabel,
    },
    {
      id: "short",
      label: "단기 액션",
      emoji: "🎯",
      headline: shortHead,
      detail: shortDetail,
    },
    {
      id: "mid",
      label: "포지션",
      emoji: "📈",
      headline: midHead,
      detail: midDetail,
    },
    {
      id: "risk",
      label: "옵션 심리",
      emoji: "⚠",
      headline: riskHead,
      detail: riskDetail,
    },
  ]
}

/**
 * @param {import("./panicMarketReportEngine.js").PanicMarketReport | null} report
 * @param {object | null} panicData
 * @returns {string}
 */
export function buildStrategyBrief(report, panicData) {
  const action = panicData ? computeMarketAction(panicData) : null
  const cards = buildActionReportCards(report, panicData)
  const parts = []

  const mode = action?.actionMode ?? renderText(report?.actionMode)
  if (mode === "Risk-on") parts.push("위험선호 유지")
  else if (mode === "Risk-off") parts.push("방어·유동성 우선")
  else parts.push("균형·이벤트 대응")

  const short = cards.find((c) => c.id === "short")
  const mid = cards.find((c) => c.id === "mid")
  const risk = cards.find((c) => c.id === "risk")

  if (short?.headline) parts.push(`단기 ${short.headline.replace(/\.$/, "")}`)

  const sectorBit = mid?.detail?.split("·")[0]?.trim()
  if (sectorBit) {
    parts.push(sectorBit.includes("우위") ? sectorBit : `${sectorBit} 우위`)
  } else if (mid?.headline) {
    parts.push(`${mid.headline} 우위`)
  }

  if (risk?.headline) parts.push(`옵션 심리 ${risk.headline.replace(/\.$/, "")}`)

  const built = parts.filter(Boolean).join(" · ")
  if (built.length > 16) return built

  return built || "지표 저장 후 오늘 행동 지침이 생성됩니다."
}
