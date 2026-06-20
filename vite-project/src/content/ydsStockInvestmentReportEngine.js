/**
 * YDS 투자 리포트 — 점수·상태를 설명 가능한 리서치 리포트로 변환 (룰 기반)
 */

import { buildMarketFitReason } from "./ydsMarketAdapter.js"
import { buildStockPickWhyBrief } from "./ydsStockPickWhyBrief.js"
import { buildStockPickOpinion } from "./ydsStockPickOpinion.js"
import { resolveStockPickUxStatus, STOCK_PICK_UX_STATUS } from "./ydsStockPickUxStatus.js"

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   emoji: string
 * }} ReportVerdict
 */

/**
 * @typedef {{
 *   verdict: ReportVerdict
 *   recommendReasons: string[]
 *   riskFactors: string[]
 *   holdReasons: string[]
 *   timingGaps: string[]
 *   marketFit: { grade: string; score: number; max: number; explanation: string }
 *   strategy: { holder: string; nonHolder: string }
 *   keyPoint: string
 * }} StockInvestmentReport
 */

/** @param {string[]} items */
function uniqueNonEmpty(items) {
  return [...new Set(items.map((s) => String(s ?? "").trim()).filter(Boolean))]
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 */
function buildRecommendReasons(stock, marketContext) {
  /** @type {string[]} */
  const reasons = []

  for (const r of stock.recommendReasonsDetail ?? stock.recommendReasons ?? []) {
    if (r?.text) reasons.push(r.text)
  }

  const opinion = stock.opinion ?? buildStockPickOpinion(stock)
  reasons.push(...(opinion.bullets ?? []))

  const v4 = stock.v4Score
  if (v4?.qualityDisplayGrade === "A+" || v4?.qualityGrade === "A") {
    reasons.push("기업품질 최상위 그룹")
  } else if (v4?.qualityGrade === "B") {
    reasons.push("기업품질 양호")
  }

  const breakdown = stock.scoreBreakdown
  if (breakdown?.performance >= 24) reasons.push("실적·펀더멘털 강세")
  if (breakdown?.industry >= 18) reasons.push("산업 성장성 우위")
  if (breakdown?.sector >= 14) {
    reasons.push(`${stock.sectorLabel ?? "해당"} 섹터 적합`)
  }

  const themes = stock.investThemes ?? []
  if (themes.length) reasons.push(`${themes[0]} 수혜 테마`)

  if (stock.pickMeta?.longHoldCandidate) {
    reasons.push("장기 보유 후보 (품질 기준 충족)")
  }

  if (marketContext?.ready) {
    const statusId = stock.stockStatus?.id ?? stock.statusDiag?.statusId ?? "interest"
    const fitScore = stock.scores?.marketFitScore ?? stock.scoreBreakdown?.marketEnv ?? 0
    const detail = buildMarketFitReason(marketContext, statusId, fitScore)
    if (detail) reasons.push(detail)
  }

  if (stock.comment && !reasons.some((r) => r.includes(stock.comment.slice(0, 8)))) {
    reasons.push(stock.comment)
  }

  return uniqueNonEmpty(reasons).slice(0, 5)
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
function buildRiskFactors(stock) {
  /** @type {string[]} */
  const risks = []

  const penalties = stock.pickMeta?.timingPenaltyReasons ?? []
  risks.push(...penalties)

  risks.push(...(stock.pickMeta?.noChaseReasons ?? []))

  const v4 = stock.v4Score
  if (v4?.timingGrade === "F" || v4?.timingGrade === "D") {
    risks.push(`타이밍 등급 ${v4.timingDisplay ?? v4.timingGrade} — 진입 시점 불리`)
  }

  if (stock.stockStatus?.id === "overheat") {
    risks.push("단기 과열 구간 — 추격 매수 리스크")
  }

  const pos = stock.pickMeta?.pricePosition
  if (pos?.id === "overheat") {
    risks.push(`${pos.label} — 조정 가능성`)
  }

  const marketEnv = stock.scoreBreakdown?.marketEnv ?? 0
  if (marketEnv < 6) {
    risks.push("시장환경 점수 낮음 — 거시 환경과 괴리")
  }

  if (stock.scoreMeta?.drawdownPct != null && stock.scoreMeta.drawdownPct <= 2) {
    risks.push("52주 고점 근접 — 돌파 확인 전 변동성")
  }

  return uniqueNonEmpty(risks).slice(0, 3)
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
function buildHoldReasons(stock) {
  const ux = resolveStockPickUxStatus(stock)
  if (ux.id === "aggressiveBuy" || ux.id === "buy") return []

  /** @type {string[]} */
  const reasons = []

  if (ux.id === "watch") {
    reasons.push("기업은 양호하나 현재 진입 타이밍이 충분하지 않음")
  }
  if (ux.id === "scaleIn") {
    reasons.push("품질 대비 타이밍이 보통 — 전량 진입보다 분할 접근")
  }
  if (ux.id === "noChase") {
    reasons.push("최근 상승폭·기술적 위치상 추격 매수 부적합")
  }

  const v4 = stock.v4Score
  if (v4 && v4.quality >= 60 && (v4.timingGrade === "C" || v4.timingGrade === "D")) {
    reasons.push("좋은 기업이나 기술적 타이밍이 아직 따라오지 않음")
  }

  return uniqueNonEmpty(reasons).slice(0, 3)
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
function buildTimingGaps(stock) {
  /** @type {string[]} */
  const gaps = []

  const penalties = stock.pickMeta?.timingPenaltyReasons ?? []
  gaps.push(...penalties)

  const checks = stock.timingScore?.checks ?? []
  for (const c of checks) {
    if (c.pass) continue
    gaps.push(`${c.shortLabel ?? c.label} 미충족`)
  }

  const v4 = stock.v4Score
  if (v4?.timingGrade === "C") gaps.push("추세는 유지 중이나 기술적 돌파는 아직 부족")
  if (v4?.timingGrade === "D" || v4?.timingGrade === "F") {
    gaps.push("단기 모멘텀·이동평균 회복이 미흡")
  }

  return uniqueNonEmpty(gaps).slice(0, 4)
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 */
function buildMarketFitSection(stock, marketContext) {
  const score = stock.pickMeta?.marketFitScore ?? stock.scoreBreakdown?.marketEnv ?? 0
  const max = 15
  const grade = stock.pickMeta?.marketFitGrade ?? "—"

  /** @type {string} */
  let explanation = "시장환경 점수를 기준으로 현재 거시 환경과의 정합성을 평가합니다."

  if (marketContext?.ready) {
    const statusId = stock.stockStatus?.id ?? stock.statusDiag?.statusId ?? "interest"
    const fitScore = stock.scores?.marketFitScore ?? score
    const detail = buildMarketFitReason(marketContext, statusId, fitScore)
    if (detail) {
      explanation = `${marketContext.strategyEmoji} ${marketContext.strategyLabel} · ${marketContext.panicLabel} 환경에서 ${detail}.`
    } else if (score >= 9) {
      explanation = `${marketContext.panicLabel} 환경과 부분적으로 맞물리나, 종목 상태에 따라 진입 속도를 조절해야 합니다.`
    } else {
      explanation = `현 ${marketContext.strategyLabel} 국면에서 시장 적합도가 낮아 신규 비중 확대는 신중해야 합니다.`
    }
  } else if (score >= 12) {
    explanation = "시장환경 점수가 양호해 현재 거시 흐름과 비교적 잘 맞습니다."
  } else if (score < 6) {
    explanation = "시장환경 점수가 낮아 거시 환경 대비 방어적 접근이 유리합니다."
  }

  return { grade, score, max, explanation }
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
function buildKeyPoint(stock) {
  const brief = buildStockPickWhyBrief(stock)
  const themes = stock.investThemes ?? []
  const pos = stock.pickMeta?.pricePosition?.label
  const ux = resolveStockPickUxStatus(stock)

  const positive =
    themes[0] ??
    brief.bottleneck?.split("·")[0]?.trim() ??
    brief.industry?.split("·")[0]?.trim() ??
    stock.sectorLabel ??
    "핵심 성장 동력"

  const supplySide = brief.bottleneck ?? brief.performance ?? stock.comment ?? "수급·실적 모멘텀"

  /** @type {string} */
  let timingClause = ""
  const gaps = buildTimingGaps(stock)
  if (gaps.length) {
    timingClause = gaps[0].includes("돌파") ? gaps[0] : `${gaps[0]} — 기술적 확인 대기`
  } else if (ux.id === "aggressiveBuy" || ux.id === "buy") {
    timingClause = "타이밍 양호 — 분할 접근 가능"
  } else if (pos) {
    timingClause = `현재 ${pos} · 진입 속도 조절 필요`
  } else {
    timingClause = "기술적 돌파는 아직 부족"
  }

  const foreignFlow =
    stock.country === "KR" && (stock.scores?.volumeScore ?? 0) >= 13
      ? " · 외국인·기관 수급 개선 흐름"
      : ""

  return `${positive} 수혜와 ${supplySide.split("·")[0].trim()}이 확인되나${foreignFlow} · ${timingClause}`
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} [marketContext]
 * @returns {StockInvestmentReport}
 */
export function buildStockInvestmentReport(stock, marketContext = null) {
  const ux = resolveStockPickUxStatus(stock)
  const opinion = stock.opinion ?? buildStockPickOpinion(stock)

  const holder = String(opinion.holderAction ?? "")
    .replace(/^보유자\s*:\s*/i, "")
    .trim()
  const nonHolder = String(opinion.nonHolderAction ?? "")
    .replace(/^미보유자\s*:\s*/i, "")
    .trim()

  return {
    verdict: {
      id: ux.id,
      label: ux.label,
      emoji: ux.emoji,
    },
    recommendReasons: buildRecommendReasons(stock, marketContext),
    riskFactors: buildRiskFactors(stock),
    holdReasons: buildHoldReasons(stock),
    timingGaps: buildTimingGaps(stock),
    marketFit: buildMarketFitSection(stock, marketContext),
    strategy: {
      holder: holder || "홀딩",
      nonHolder: nonHolder || "관망",
    },
    keyPoint: buildKeyPoint(stock),
  }
}

/** @param {StockInvestmentReport} report */
export function formatReportVerdictLine(report) {
  const ux = STOCK_PICK_UX_STATUS[report.verdict.id]
  return `${ux?.emoji ?? report.verdict.emoji} ${report.verdict.label}`
}
