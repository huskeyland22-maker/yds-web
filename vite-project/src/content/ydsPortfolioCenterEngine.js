/**
 * 포트폴리오 센터 V1 — 시장 연동·적합도·리스크 (경량)
 */

import stockPickUniverse from "../data/stockPickUniverse.json" with { type: "json" }
import { STOCK_PICK_SECTORS } from "./ydsStockPickModel.js"
import { STOCK_PICK_THEMES_BY_TICKER } from "./ydsStockPickThemes.js"
import { buildV5Analysis } from "./ydsPortfolioV5Engine.js"

/** @typedef {import("./ydsPortfolioV5Engine.js").HoldingRow} HoldingRow */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/** @type {Map<string, string>} */
const SECTOR_LABEL_BY_ID = new Map(STOCK_PICK_SECTORS.map((s) => [s.id, s.label]))

/** @type {Map<string, string>} */
const TICKER_SECTOR = new Map(
  (stockPickUniverse.stocks ?? []).map((s) => [String(s.ticker), String(s.sector ?? "other")]),
)

/** @param {string | undefined} ticker */
export function sectorLabelForTicker(ticker) {
  const key = TICKER_SECTOR.get(String(ticker ?? "")) ?? "other"
  return SECTOR_LABEL_BY_ID.get(key) ?? key
}

/** @param {string | undefined} ticker */
function themesForTicker(ticker) {
  const key = String(ticker ?? "")
  return STOCK_PICK_THEMES_BY_TICKER[key] ?? STOCK_PICK_THEMES_BY_TICKER[key.toUpperCase()] ?? []
}

/** @param {number} score */
export function fitGradeFromScore(score) {
  if (score >= 85) return { grade: "A", label: "매우 양호" }
  if (score >= 70) return { grade: "B", label: "양호" }
  if (score >= 55) return { grade: "C", label: "보통" }
  if (score >= 40) return { grade: "D", label: "조정 필요" }
  return { grade: "F", label: "부적합" }
}

/**
 * @param {HoldingRow[]} rows
 * @param {number} cashPct
 */
function buildSectorBreakdown(rows, cashPct) {
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const row of rows) {
    const sector = sectorLabelForTicker(row.ticker)
    map.set(sector, (map.get(sector) ?? 0) + (row.weightPct ?? 0))
  }
  return [...map.entries()]
    .map(([sector, weightPct]) => ({
      sector,
      weightPct: Math.round(weightPct * 10) / 10,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)
}

/**
 * @param {HoldingRow[]} rows
 */
function buildThemeBreakdown(rows) {
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const row of rows) {
    const themes = themesForTicker(row.ticker)
    const list = themes.length ? themes : ["기타"]
    for (const theme of list) {
      map.set(theme, (map.get(theme) ?? 0) + (row.weightPct ?? 0) / list.length)
    }
  }
  return [...map.entries()]
    .map(([theme, weightPct]) => ({
      theme,
      weightPct: Math.round(weightPct * 10) / 10,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)
}

/**
 * @param {HoldingRow[]} rows
 * @param {{ sectors: { sector: string; weightPct: number }[] }} sectors
 * @param {{ themes: { theme: string; weightPct: number }[] }} themes
 * @param {number} actualCashPct
 * @param {number} recommendedCashPct
 */
function buildRiskChecks(rows, sectors, themes, actualCashPct, recommendedCashPct) {
  /** @type {{ id: string; label: string; status: 'ok' | 'warn'; message: string }[]} */
  const checks = []

  const topSector = sectors[0]
  if (!topSector || topSector.weightPct < 28) {
    checks.push({ id: "sector", label: "섹터 집중도", status: "ok", message: "업종 분산 양호" })
  } else if (topSector.weightPct >= 40) {
    checks.push({
      id: "sector",
      label: "섹터 집중도",
      status: "warn",
      message: `${topSector.sector} ${topSector.weightPct}% — 업종 과집중`,
    })
  } else {
    checks.push({
      id: "sector",
      label: "섹터 집중도",
      status: "warn",
      message: `${topSector.sector} ${topSector.weightPct}% — 분산 검토`,
    })
  }

  const topTheme = themes[0]
  if (!topTheme || topTheme.weightPct < 32) {
    checks.push({ id: "theme", label: "테마 집중도", status: "ok", message: "테마 분산 양호" })
  } else if (topTheme.weightPct >= 45) {
    checks.push({
      id: "theme",
      label: "테마 집중도",
      status: "warn",
      message: `${topTheme.theme} ${topTheme.weightPct}% — 테마 과집중`,
    })
  } else {
    checks.push({
      id: "theme",
      label: "테마 집중도",
      status: "warn",
      message: `${topTheme.theme} ${topTheme.weightPct}% — 테마 편중`,
    })
  }

  const cashGap = recommendedCashPct - actualCashPct
  if (cashGap <= 8) {
    checks.push({ id: "cash", label: "현금 부족", status: "ok", message: `현금 ${actualCashPct}% · 권장 ${recommendedCashPct}%` })
  } else {
    checks.push({
      id: "cash",
      label: "현금 부족",
      status: "warn",
      message: `현금 ${actualCashPct}% · 권장 ${recommendedCashPct}% (${Math.round(cashGap)}%p 부족)`,
    })
  }

  return checks
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {Map<string, unknown>} quoteMap
 * @param {number | null | undefined} usdkrw
 * @param {ReturnType<typeof import("./ydsPortfolioV5Engine.js").buildV5Holdings>} holdings
 */
export function buildPortfolioCenterV1Report(
  trades,
  cashAmount,
  marketContext,
  quoteMap,
  usdkrw,
  holdings,
) {
  const rows = holdings?.rows ?? []
  const analysis = buildV5Analysis(trades, cashAmount, marketContext, quoteMap, usdkrw)
  const recommended = analysis.recommended
  const fitScore = analysis.compliancePct ?? 0
  const fit = fitGradeFromScore(fitScore)

  const sectors = buildSectorBreakdown(rows, holdings?.cashPct ?? 0)
  const themes = buildThemeBreakdown(rows)
  const actualCashPct = analysis.actual?.cashPct ?? 0
  const stockPct = Math.round(100 - actualCashPct)

  const riskChecks = buildRiskChecks(rows, sectors, themes, actualCashPct, recommended.cashPct)

  const holdingsSimple = rows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    quantity: row.quantity,
    avgUnitPrice: row.avgUnitPrice,
    weightPct: row.weightPct,
    returnPct: row.returnPct,
    marketValueKrw: row.marketValueKrw,
    sectorLabel: sectorLabelForTicker(row.ticker),
  }))

  return {
    hasData: rows.length > 0 || (holdings?.cashAmount ?? 0) > 0,
    status: {
      totalAssets: holdings?.totalAssets ?? 0,
      totalReturnPct: holdings?.totalReturnPct ?? null,
      stockPct,
      cashPct: holdings?.cashPct ?? 0,
      cashAmount: holdings?.cashAmount ?? 0,
    },
    market: {
      stageLabel: marketContext?.strategyLabel ?? "—",
      stageEmoji: marketContext?.strategyEmoji ?? "",
      panicLabel: marketContext?.panicLabel ?? "—",
      recommendedCashPct: recommended.cashPct,
      recommendedStockPct: recommended.stockPct,
      note: recommended.note,
    },
    fit: {
      score: fitScore,
      grade: fit.grade,
      label: fit.label,
    },
    riskChecks,
    sectors,
    themes,
    holdings: holdingsSimple,
  }
}

/** @deprecated V1 사용 — buildPortfolioCenterV1Report */
export function buildPortfolioCenterReport(...args) {
  return buildPortfolioCenterV1Report(...args)
}
