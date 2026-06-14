/**
 * V4 — YDS 실전 의견 (룰 기반, OpenAI 미사용)
 */

import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"

/**
 * @typedef {{
 *   headline: string
 *   bullets: string[]
 *   action: string
 *   fullText: string
 *   qualityLine: string
 *   timingLine: string
 *   summary: string
 *   holderAction: string
 *   nonHolderAction: string
 * }} StockPickOpinion
 */

/** @param {import("./ydsStockPickV4Scoring.js").ScoreLetterGrade} grade */
function qualityPhrase(grade) {
  if (grade === "A") return "기업품질 매우 우수"
  if (grade === "B") return "기업품질 양호"
  if (grade === "C") return "기업품질 보통"
  if (grade === "D") return "기업품질 다소 약함"
  return "기업품질 주의"
}

/** @param {import("./ydsStockPickV4Scoring.js").ScoreLetterGrade} grade */
function timingPhrase(grade) {
  if (grade === "A") return "현재 타이밍 매우 좋음"
  if (grade === "B") return "타이밍 양호"
  if (grade === "C") return "현재 추세는 보통"
  if (grade === "D") return "현재 추세는 약함"
  return "타이밍 매우 불리"
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {{ strength?: number | null; label?: string } | null} [sectorInfo]
 * @returns {StockPickOpinion}
 */
export function buildStockPickOpinion(stock, sectorInfo = null) {
  /** @type {string[]} */
  const bullets = []
  const breakdown = stock.scoreBreakdown
  const v4 = stock.v4Score
  const ux = resolveStockPickUxStatus(stock)
  const themes = stock.investThemes ?? []
  const sectorLabel = stock.sectorLabel ?? sectorInfo?.label ?? ""

  const qualityLine = v4
    ? v4.qualityDisplayGrade === "A+"
      ? `기업품질 최상위 (${v4.qualityDisplay})`
      : `${qualityPhrase(v4.qualityGrade)} (${v4.qualityDisplay})`
    : "기업품질 분석 중"
  const timingLine = v4
    ? `${timingPhrase(v4.timingGrade)} (${v4.timingDisplay})`
    : "타이밍 분석 중"

  if (v4?.qualityDisplayGrade === "A+" || v4?.qualityGrade === "A") {
    bullets.push("기업품질 최상위")
  } else if (breakdown?.performance >= 24) {
    bullets.push("실적·펀더멘털 강세")
  } else if (breakdown?.performance >= 18) {
    bullets.push("실적 양호")
  }

  if (themes.length) {
    bullets.push(`${themes[0]} 장기 성장`)
  } else if (stock.comment) {
    bullets.push(stock.comment)
  }

  if (sectorInfo?.strength != null && sectorInfo.strength >= 70) {
    bullets.push(`${sectorLabel} 섹터 강세 (${sectorInfo.strength}점)`)
  } else if (breakdown?.sector >= 14) {
    bullets.push(`${sectorLabel || "해당"} 섹터 적합`)
  }

  const statusId = stock.stockStatus?.id ?? stock.statusDiag?.statusId
  if (statusId === "trend" && (v4?.timingGrade === "A" || v4?.timingGrade === "B")) {
    bullets.push("상승 추세 + 양호한 타이밍")
  } else if (statusId === "trend") {
    bullets.push("추세는 유지 중")
  } else if (statusId === "dip") {
    bullets.push("단기 눌림·조정 구간")
  } else if (statusId === "overheat" || v4?.timingGrade === "F") {
    bullets.push("단기 과열·급등 구간")
  } else if (v4?.timingGrade === "C" || v4?.timingGrade === "D") {
    bullets.push("현재 추세는 약함")
  }

  /** @type {string} */
  let summary = ""
  if (ux.id === "aggressiveBuy") {
    summary = "기업·타이밍 모두 우수. 분할 접근 적극 검토."
  } else if (ux.id === "buy") {
    summary = "좋은 기업 + 매수 가능 타이밍. 분할 접근 가능."
  } else if (ux.id === "scaleIn") {
    summary = "좋은 기업이나 타이밍 보통. 소량 분할 접근."
  } else if (ux.id === "watch") {
    summary = "신규 진입은 추격보다 눌림 대기 유리."
  } else {
    summary = "최근 상승폭이 커 신규 진입은 눌림 확인 필요."
  }

  /** @type {string} */
  let holderAction = "보유자 : 홀딩"
  /** @type {string} */
  let nonHolderAction = "미보유자 : 관망"

  if (ux.id === "aggressiveBuy" || ux.id === "buy") {
    holderAction = "보유자 : 홀딩 · 추가는 분할"
    nonHolderAction = "미보유자 : 분할 접근"
  } else if (ux.id === "scaleIn") {
    holderAction = "보유자 : 홀딩"
    nonHolderAction = "미보유자 : 소량 분할 접근"
  } else if (ux.id === "watch") {
    holderAction = "보유자 : 홀딩"
    nonHolderAction = "미보유자 : 눌림 대기"
  } else {
    holderAction = "보유자 : 일부 차익·비중 조절 검토"
    nonHolderAction = "미보유자 : 추격 금지"
  }

  const uniqueBullets = [...new Set(bullets.filter(Boolean))].slice(0, 4)
  const headline = `[${stock.name}]`
  const action = summary
  const fullText = [
    headline,
    qualityLine,
    ...uniqueBullets,
    timingLine,
    summary,
    holderAction,
    nonHolderAction,
  ].join("\n")

  return {
    headline,
    bullets: uniqueBullets,
    action,
    fullText,
    qualityLine,
    timingLine,
    summary,
    holderAction,
    nonHolderAction,
  }
}
