/**
 * 포트폴리오 적합도 V1 — 항목별 점수·감점·개선안
 */

import {
  ALLOCATION_OK_GAP_PCT,
  formatAllocationDelta,
  scoreFromAllocationGap,
} from "./ydsPortfolioAllocationCompare.js"

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsPortfolioAllocationCompare.js").AllocationCompareReport} AllocationCompareReport */

/** @param {number} score */
export function fitGradeFromScore(score) {
  if (score >= 85) return { grade: "A", label: "매우 양호" }
  if (score >= 70) return { grade: "B", label: "양호" }
  if (score >= 55) return { grade: "C", label: "보통" }
  if (score >= 40) return { grade: "D", label: "조정 필요" }
  return { grade: "F", label: "부적합" }
}

/** @type {readonly { id: string, label: string, max: number }[]} */
export const FIT_SCORE_COMPONENTS = [
  { id: "stockWeight", label: "주식비중", max: 30 },
  { id: "cashWeight", label: "현금비중", max: 20 },
  { id: "sectorDiversification", label: "섹터분산", max: 20 },
  { id: "themeDiversification", label: "테마분산", max: 15 },
  { id: "marketAlignment", label: "시장적합", max: 15 },
]

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   score: number
 *   max: number
 *   detail: string
 * }} FitScoreComponent
 */

/**
 * @typedef {{
 *   id: string
 *   reason: string
 * }} FitDeduction
 */

/**
 * @typedef {{
 *   id: string
 *   text: string
 * }} FitImprovement
 */

/**
 * @typedef {{
 *   total: number
 *   grade: string
 *   label: string
 *   components: FitScoreComponent[]
 *   deductions: FitDeduction[]
 *   improvements: FitImprovement[]
 * }} PortfolioFitDetail
 */

/** @param {number} gap @param {number} maxScore @param {number} [softGap] */
function scoreFromGap(gap, maxScore, softGap = 6) {
  if (gap <= softGap) return maxScore
  const excess = gap - softGap
  const ratio = Math.min(1, excess / (maxScore * 1.1))
  return Math.max(0, Math.round(maxScore * (1 - ratio)))
}

/**
 * @param {number} topWeightPct
 * @param {number} maxScore
 * @param {{ ok: number, warn: number, bad: number }} thresholds
 */
function scoreFromConcentration(topWeightPct, maxScore, thresholds) {
  if (topWeightPct <= thresholds.ok) return maxScore
  if (topWeightPct <= thresholds.warn) return Math.round(maxScore * 0.75)
  if (topWeightPct <= thresholds.bad) return Math.round(maxScore * 0.5)
  return Math.round(maxScore * 0.3)
}

/**
 * @param {{
 *   actualStockPct: number
 *   actualCashPct: number
 *   recommendedStockPct: number
 *   recommendedCashPct: number
 *   sectors: { sector: string, weightPct: number }[]
 *   themes: { theme: string, weightPct: number }[]
 *   marketContext?: YdsMarketAdapterContext | null
 *   allocationCompare?: AllocationCompareReport | null
 * }} input
 * @returns {PortfolioFitDetail}
 */
export function buildPortfolioFitDetail(input) {
  const {
    actualStockPct,
    actualCashPct,
    recommendedStockPct,
    recommendedCashPct,
    sectors,
    themes,
    marketContext,
    allocationCompare,
  } = input

  const stockDelta =
    allocationCompare?.stock.deltaPct ?? Math.round(actualStockPct - recommendedStockPct)
  const cashDelta = allocationCompare?.cash.deltaPct ?? Math.round(actualCashPct - recommendedCashPct)
  const stockGap = Math.abs(stockDelta)
  const cashGap = Math.abs(cashDelta)
  const stockSignedGap = recommendedStockPct - actualStockPct
  const cashSignedGap = recommendedCashPct - actualCashPct

  const stockScore = scoreFromAllocationGap(stockGap, 30)
  const cashScore = scoreFromAllocationGap(cashGap, 20)

  const topSector = sectors[0]
  const topTheme = themes[0]
  const sectorScore = sectors.length
    ? scoreFromConcentration(topSector?.weightPct ?? 0, 20, { ok: 28, warn: 38, bad: 48 })
    : 20
  const themeScore = themes.length
    ? scoreFromConcentration(topTheme?.weightPct ?? 0, 15, { ok: 32, warn: 42, bad: 52 })
    : 15

  const maxAllocGap = allocationCompare?.maxGapPct ?? Math.max(stockGap, cashGap)
  let marketScore = scoreFromAllocationGap(maxAllocGap, 15, ALLOCATION_OK_GAP_PCT)
  if (recommendedCashPct >= 35 && actualCashPct < recommendedCashPct - 12) {
    marketScore = Math.max(0, marketScore - 4)
  }
  if (recommendedStockPct >= 55 && actualStockPct < recommendedStockPct - 12) {
    marketScore = Math.max(0, marketScore - 4)
  }
  if (marketContext?.isDefensive && actualCashPct < recommendedCashPct - 8) {
    marketScore = Math.max(0, marketScore - 2)
  }

  /** @type {FitScoreComponent[]} */
  const components = [
    {
      id: "stockWeight",
      label: "주식비중",
      score: stockScore,
      max: 30,
      detail: `실제 ${actualStockPct}% · 권장 ${recommendedStockPct}% · ${formatAllocationDelta(stockDelta)}`,
    },
    {
      id: "cashWeight",
      label: "현금비중",
      score: cashScore,
      max: 20,
      detail: `실제 ${actualCashPct}% · 권장 ${recommendedCashPct}% · ${formatAllocationDelta(cashDelta)}`,
    },
    {
      id: "sectorDiversification",
      label: "섹터분산",
      score: sectorScore,
      max: 20,
      detail: topSector ? `최대 ${topSector.sector} ${topSector.weightPct}%` : "보유 종목 없음",
    },
    {
      id: "themeDiversification",
      label: "테마분산",
      score: themeScore,
      max: 15,
      detail: topTheme ? `최대 ${topTheme.theme} ${topTheme.weightPct}%` : "보유 종목 없음",
    },
    {
      id: "marketAlignment",
      label: "시장적합",
      score: marketScore,
      max: 15,
      detail: marketContext?.ready
        ? `${marketContext.strategyLabel ?? "시장"} · ${marketContext.panicLabel ?? ""}`.trim()
        : "시장상태 미연동",
    },
  ]

  const total = components.reduce((sum, c) => sum + c.score, 0)
  const { grade, label } = fitGradeFromScore(total)

  /** @type {FitDeduction[]} */
  const deductions = []

  if (stockScore < 24) {
    if (stockSignedGap > 5) {
      deductions.push({ id: "stock-low", reason: "주식 비중 부족 (시장 권장 대비)" })
    } else if (stockSignedGap < -5) {
      deductions.push({ id: "stock-high", reason: "시장 권장 주식비중 초과" })
    } else {
      deductions.push({ id: "stock-gap", reason: "주식·권장 비중 불일치" })
    }
  }

  if (cashScore < 16) {
    if (cashSignedGap > 5) {
      deductions.push({ id: "cash-low", reason: "현금 비중 부족" })
    } else if (cashSignedGap < -5) {
      deductions.push({ id: "cash-high", reason: "현금 비중 과다" })
    } else {
      deductions.push({ id: "cash-gap", reason: "현금·권장 비중 불일치" })
    }
  }

  if (sectorScore < 16 && topSector) {
    deductions.push({ id: "sector", reason: `${topSector.sector} 집중 (${topSector.weightPct}%)` })
  }

  if (themeScore < 12 && topTheme) {
    deductions.push({ id: "theme", reason: `${topTheme.theme} 테마 편중 (${topTheme.weightPct}%)` })
  }

  if (marketScore < 12) {
    deductions.push({ id: "market", reason: "현재 시장상태 대비 자산배분 미스매치" })
  }

  /** @type {FitImprovement[]} */
  const improvements = []

  if (cashSignedGap > 5) {
    improvements.push({
      id: "cash-up",
      text: `현금 비중 +${Math.round(Math.min(cashSignedGap, 20))}%p (권장 ${recommendedCashPct}%)`,
    })
  } else if (cashSignedGap < -5) {
    improvements.push({
      id: "cash-down",
      text: `현금 비중 ${Math.round(Math.max(cashSignedGap, -20))}%p 조정`,
    })
  }

  if (stockSignedGap > 5) {
    improvements.push({
      id: "stock-up",
      text: `주식 비중 +${Math.round(Math.min(stockSignedGap, 20))}%p`,
    })
  } else if (stockSignedGap < -5) {
    improvements.push({
      id: "stock-down",
      text: `주식 비중 ${Math.round(Math.max(stockSignedGap, -20))}%p 축소`,
    })
  }

  if (topSector && sectorScore < 16) {
    const altSector = pickAlternateSector(sectors)
    improvements.push({
      id: "sector-spread",
      text: altSector ? `${topSector.sector} 비중 감소 · ${altSector} 분산` : `${topSector.sector} 비중 감소`,
    })
  }

  if (topTheme && themeScore < 12) {
    const altTheme = pickAlternateTheme(themes)
    improvements.push({
      id: "theme-spread",
      text: altTheme ? `${topTheme.theme} 축소 · ${altTheme} 분산` : `${topTheme.theme} 비중 분산`,
    })
  }

  if (!improvements.length && total < 85) {
    improvements.push({ id: "maintain", text: "권장 비중 유지 · 분산 점검 주기적 확인" })
  }

  return { total, grade, label, components, deductions, improvements }
}

/** @param {{ sector: string, weightPct: number }[]} sectors */
function pickAlternateSector(sectors) {
  const candidates = ["전력/에너지", "헬스케어", "금융", "소비재", "산업재", "통신"]
  const held = new Set(sectors.map((s) => s.sector))
  return candidates.find((c) => !held.has(c) && !sectors.some((s) => s.sector.includes(c.slice(0, 2)))) ?? candidates[0]
}

/** @param {{ theme: string, weightPct: number }[]} themes */
function pickAlternateTheme(themes) {
  const candidates = ["전력주", "AI 인프라", "배당", "바이오", "방산"]
  const held = new Set(themes.map((t) => t.theme))
  return candidates.find((c) => !held.has(c)) ?? "기타 테마"
}
