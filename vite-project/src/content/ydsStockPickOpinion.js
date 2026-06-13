/**
 * Phase 3 — YDS 투자 의견 (룰 기반, OpenAI 미사용)
 */

import { getStockPickTotalScore } from "./ydsStockPickUxStatus.js"
import { resolveStockPickUxStatus } from "./ydsStockPickUxStatus.js"

/**
 * @typedef {{
 *   headline: string
 *   bullets: string[]
 *   action: string
 *   fullText: string
 * }} StockPickOpinion
 */

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {{ strength?: number | null; label?: string } | null} [sectorInfo]
 * @returns {StockPickOpinion}
 */
export function buildStockPickOpinion(stock, sectorInfo = null) {
  /** @type {string[]} */
  const bullets = []
  const breakdown = stock.scoreBreakdown
  const tech = stock.technicalScore
  const ux = resolveStockPickUxStatus(stock)
  const themes = stock.investThemes ?? []
  const sectorLabel = stock.sectorLabel ?? sectorInfo?.label ?? ""
  const total = getStockPickTotalScore(stock)

  if (breakdown?.performance >= 24) {
    bullets.push("실적 강세")
  } else if (breakdown?.performance >= 18) {
    bullets.push("실적 양호")
  }

  if (themes.length) {
    bullets.push(`${themes[0]} 수요·테마 부각`)
  } else if (stock.comment) {
    bullets.push(stock.comment)
  }

  if (sectorInfo?.strength != null && sectorInfo.strength >= 70) {
    bullets.push(`${sectorLabel} 섹터 강세 (${sectorInfo.strength}점)`)
  } else if (breakdown?.sector >= 14) {
    bullets.push(`${sectorLabel || "해당"} 섹터 적합`)
  }

  const statusId = stock.stockStatus?.id ?? stock.statusDiag?.statusId
  if (statusId === "trend") {
    bullets.push("현재 상승 추세 유지")
  } else if (statusId === "dip") {
    bullets.push("단기 조정·눌림 구간")
  } else if (statusId === "overheat") {
    bullets.push("단기 과열·급등 구간")
  }

  if (tech?.score >= 7) {
    bullets.push("기술적 조건 양호")
  } else if (tech?.checks?.some((c) => c.id === "rsi" && !c.pass)) {
    bullets.push("RSI 과열 — 진입 타이밍 주의")
  }

  /** @type {string} */
  let action = ""
  if (ux.id === "buy") {
    action =
      total != null && total >= 75
        ? "추세 유지 중. 분할 접근 가능."
        : "조건 충족. 분할 접근 검토."
  } else if (ux.id === "wait") {
    action =
      statusId === "dip"
        ? "눌림 발생 시 분할 접근 가능."
        : "신규 진입은 눌림·지지 확인 필요."
  } else {
    action = "최근 상승폭이 커 신규 진입은 눌림 확인 필요."
  }

  const uniqueBullets = [...new Set(bullets.filter(Boolean))].slice(0, 4)
  const headline = `[${stock.name}]`
  const fullText = [headline, ...uniqueBullets, action].join("\n")

  return {
    headline,
    bullets: uniqueBullets,
    action,
    fullText,
  }
}
