/**
 * 포트폴리오 센터 — 시장 연동 분석·종목 의견·리스크
 */

import stockPickUniverse from "../data/stockPickUniverse.json" with { type: "json" }
import { STOCK_PICK_SECTORS } from "./ydsStockPickModel.js"
import { buildV5Analysis } from "./ydsPortfolioV5Engine.js"
import { derivePortfolioHoldingAction } from "./ydsPortfolioHoldingAction.js"

/** @typedef {import("./ydsPortfolioV5Engine.js").HoldingRow} HoldingRow */
/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

export const HOLDING_OPINIONS = {
  hold: { id: "hold", label: "홀딩" },
  increase: { id: "increase", label: "비중확대" },
  decrease: { id: "decrease", label: "비중축소" },
  watch: { id: "watch", label: "관망" },
}

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

/**
 * @param {HoldingRow} row
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 */
export function deriveHoldingOpinion(row, ctx) {
  const action = derivePortfolioHoldingAction(row, ctx)
  const statusId = action.statusId
  const ret = row.returnPct
  const macro = ctx?.macroId ?? "neutral"

  if (statusId === "overheat" || (ret != null && ret >= 22)) {
    return HOLDING_OPINIONS.decrease
  }

  if (ctx?.isDefensive && statusId !== "trend") {
    return HOLDING_OPINIONS.watch
  }

  if ((macro === "dca" || macro === "panicBuy") && (statusId === "dip" || statusId === "interest")) {
    return HOLDING_OPINIONS.increase
  }

  if (statusId === "trend") return HOLDING_OPINIONS.hold
  if (statusId === "dip") return HOLDING_OPINIONS.watch
  if (statusId === "interest") return HOLDING_OPINIONS.watch

  return HOLDING_OPINIONS.hold
}

/**
 * @param {HoldingRow[]} rows
 */
function computeConcentration(rows) {
  if (!rows.length) return { maxWeight: 0, hhi: 0, label: "—" }
  const weights = rows.map((r) => r.weightPct ?? 0)
  const maxWeight = Math.max(...weights)
  const hhi = Math.round(weights.reduce((s, w) => s + (w / 100) ** 2, 0) * 1000) / 10
  let label = "분산"
  if (maxWeight >= 35 || hhi >= 0.25) label = "고집중"
  else if (maxWeight >= 22 || hhi >= 0.18) label = "주의"
  return { maxWeight, hhi, label }
}

/**
 * @param {HoldingRow[]} rows
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 */
function computeRiskLevel(rows, ctx) {
  const conc = computeConcentration(rows)
  const overheatCount = rows.filter((r) => {
    const a = derivePortfolioHoldingAction(r, ctx)
    return a.statusId === "overheat"
  }).length
  const overheatWeight = rows
    .filter((r) => derivePortfolioHoldingAction(r, ctx).statusId === "overheat")
    .reduce((s, r) => s + (r.weightPct ?? 0), 0)

  let score = 30
  if (conc.label === "고집중") score += 35
  else if (conc.label === "주의") score += 18
  if (overheatCount >= 2 || overheatWeight >= 25) score += 25
  else if (overheatCount >= 1) score += 12
  if (ctx?.isDefensive) score += 10
  score = Math.min(100, score)

  let label = "낮음"
  if (score >= 70) label = "높음"
  else if (score >= 45) label = "중간"

  return { score, label, overheatCount, overheatWeight: Math.round(overheatWeight * 10) / 10 }
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
  const sectors = [...map.entries()]
    .map(([sector, weightPct]) => ({
      sector,
      weightPct: Math.round(weightPct * 10) / 10,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)

  return {
    sectors,
    cashPct: Math.round(cashPct * 10) / 10,
    stockPct: Math.round((100 - cashPct) * 10) / 10,
  }
}

/**
 * @param {HoldingRow[]} rows
 * @param {{ sectors: { sector: string; weightPct: number }[] }} sectorBreakdown
 * @param {{ overheatCount: number; overheatWeight: number; label: string }} risk
 */
function buildRiskWarnings(rows, sectorBreakdown, risk) {
  /** @type {{ level: 'warn' | 'info'; message: string }[]} */
  const warnings = []

  const topSector = sectorBreakdown.sectors[0]
  if (topSector && topSector.weightPct >= 40) {
    warnings.push({
      level: "warn",
      message: `${topSector.sector} 업종 비중 ${topSector.weightPct}% — 특정 업종 집중`,
    })
  } else if (topSector && topSector.weightPct >= 28) {
    warnings.push({
      level: "info",
      message: `${topSector.sector} 업종 ${topSector.weightPct}% — 분산 검토`,
    })
  }

  if (risk.overheatCount >= 1) {
    warnings.push({
      level: "warn",
      message: `과열 종목 ${risk.overheatCount}개 · 비중 합 ${risk.overheatWeight}%`,
    })
  }

  const heavy = rows.filter((r) => (r.weightPct ?? 0) >= 30)
  for (const row of heavy.slice(0, 2)) {
    warnings.push({
      level: "warn",
      message: `${row.name} 단일 비중 ${row.weightPct}%`,
    })
  }

  return warnings
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @param {Map<string, unknown>} quoteMap
 * @param {number | null | undefined} usdkrw
 * @param {ReturnType<typeof import("./ydsPortfolioV5Engine.js").buildV5Holdings>} holdings
 */
export function buildPortfolioCenterReport(
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
  const concentration = computeConcentration(rows)
  const risk = computeRiskLevel(rows, marketContext)
  const sectorBreakdown = buildSectorBreakdown(rows, holdings?.cashPct ?? 0)

  const holdingsWithOpinion = rows.map((row) => ({
    ...row,
    sectorLabel: sectorLabelForTicker(row.ticker),
    opinion: deriveHoldingOpinion(row, marketContext),
    action: derivePortfolioHoldingAction(row, marketContext),
  }))

  const warnings = buildRiskWarnings(rows, sectorBreakdown, risk)

  return {
    hasHoldings: rows.length > 0 || (holdings?.cashAmount ?? 0) > 0,
    totalAssets: holdings?.totalAssets ?? 0,
    cashPct: holdings?.cashPct ?? 0,
    totalReturnPct: holdings?.totalReturnPct ?? null,
    analysis: {
      marketFitPct: analysis.compliancePct,
      marketFitLabel:
        analysis.compliancePct >= 75
          ? "양호"
          : analysis.compliancePct >= 50
            ? "보통"
            : "조정 필요",
      risk,
      concentration,
      rebalance: analysis.rebalance,
    },
    market: {
      stageLabel: marketContext?.strategyLabel ?? "—",
      stageEmoji: marketContext?.strategyEmoji ?? "",
      panicLabel: marketContext?.panicLabel ?? "—",
      recommendedCashPct: recommended.cashPct,
      recommendedStockPct: recommended.stockPct,
      recommendedUsPct: recommended.usPct,
      recommendedKrPct: recommended.krPct,
      note: recommended.note,
      actualCashPct: analysis.actual.cashPct,
      actualStockPct: 100 - analysis.actual.cashPct,
    },
    sectorBreakdown,
    holdings: holdingsWithOpinion,
    warnings,
  }
}
