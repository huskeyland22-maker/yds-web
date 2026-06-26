/**
 * AI 포트폴리오 추천 — 시장상태 · 패닉 · 유동성 종합
 */

import { getRegimeTopStocks } from "./ydsStockPickMarketRegime.js"

/**
 * @typedef {'aggressive' | 'balanced' | 'defensive'} PortfolioStyleId
 */

/**
 * @typedef {{
 *   id: PortfolioStyleId
 *   label: string
 *   cashPct: number
 *   stockPct: number
 *   holdings: Array<{ ticker: string; name: string; weightPct: number; reason: string; sectorLabel: string }>
 *   sectorWeights: Array<{ label: string; pct: number }>
 *   summaryLine: string
 * }} AiPortfolioPlan
 */

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} ctx
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} dualLiquidity
 */
function resolveCashPct(ctx, dualLiquidity) {
  let cash = 25
  const pos = ctx?.marketPositionId ?? "adjustment"
  const panic = ctx?.ydsScore ?? 50
  const marketLiq = dualLiquidity?.marketScore ?? 50
  const policyLiq = dualLiquidity?.policyScore ?? 50

  if (pos === "overheat" || pos === "boundary") cash += 15
  if (pos === "panic" || pos === "fear") cash -= 10
  if (panic >= 70) cash -= 5
  if (panic <= 30) cash += 5
  if (marketLiq < 45) cash += 8
  if (policyLiq < 45) cash += 7
  if (dualLiquidity?.actionMode === "defense") cash += 10
  if (dualLiquidity?.actionMode === "aggressive") cash -= 8

  return Math.max(10, Math.min(55, Math.round(cash)))
}

/**
 * @param {PortfolioStyleId} style
 * @param {number} baseCash
 */
function styleCashPct(style, baseCash) {
  if (style === "aggressive") return Math.max(10, baseCash - 12)
  if (style === "defensive") return Math.min(55, baseCash + 15)
  return baseCash
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView[]} stocks
 * @param {PortfolioStyleId} style
 * @param {number} cashPct
 */
function buildHoldings(stocks, style, cashPct) {
  const count = style === "aggressive" ? 6 : style === "balanced" ? 5 : 4
  const picks = stocks.slice(0, count)
  const stockBudget = 100 - cashPct
  const base = Math.floor(stockBudget / Math.max(1, picks.length))
  let remainder = stockBudget - base * picks.length

  return picks.map((stock, index) => {
    const extra = remainder > 0 ? 1 : 0
    if (extra) remainder -= 1
    const weightPct = base + extra + (index === 0 && style === "aggressive" ? 2 : 0)
    const reason =
      stock.recommendRationales?.[0]?.text ??
      stock.recommendReasonSummary ??
      `${stock.sectorLabel ?? stock.sector} 섹터 우량주`
    return {
      ticker: stock.ticker,
      name: stock.name,
      weightPct,
      reason,
      sectorLabel: stock.sectorLabel ?? stock.sector ?? "기타",
    }
  })
}

/**
 * @param {Array<{ sectorLabel: string; weightPct: number }>} holdings
 */
function buildSectorWeights(holdings) {
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const h of holdings) {
    const key = h.sectorLabel || "기타"
    map.set(key, (map.get(key) ?? 0) + h.weightPct)
  }
  return [...map.entries()]
    .map(([label, pct]) => ({ label, pct: Math.round(pct) }))
    .sort((a, b) => b.pct - a.pct)
}

/**
 * @param {{
 *   stocks?: import("./ydsStockPickModel.js").StockPickView[]
 *   marketContext?: import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 * }} input
 */
export function buildAiPortfolioRecommendReport(input = {}) {
  const ctx = input.marketContext ?? null
  const limit = ctx?.pickDisplayLimit ?? 20
  const ranked = getRegimeTopStocks([...(input.stocks ?? [])], limit)
  const baseCash = resolveCashPct(ctx, input.dualLiquidity ?? null)

  /** @type {PortfolioStyleId[]} */
  const styles = ["aggressive", "balanced", "defensive"]
  const labels = { aggressive: "공격형", balanced: "균형형", defensive: "방어형" }

  const plans = styles.map((style) => {
    const cashPct = styleCashPct(style, baseCash)
    const stockPct = 100 - cashPct
    const holdings = buildHoldings(ranked, style, cashPct)
    const sectorWeights = buildSectorWeights(holdings)

    return {
      id: style,
      label: labels[style],
      cashPct,
      stockPct,
      holdings,
      sectorWeights: [{ label: "현금", pct: cashPct }, ...sectorWeights],
      summaryLine:
        style === "aggressive"
          ? "시장 환경이 우호적일 때 분할 매수 비중을 확대하는 구성입니다."
          : style === "defensive"
            ? "변동성·유동성 리스크를 고려해 현금 비중을 높인 구성입니다."
            : "성장과 방어를 균형 있게 배분한 기본 포트폴리오입니다.",
    }
  })

  return {
    visible: ranked.length >= 3,
    title: "AI 포트폴리오 추천",
    plans,
    marketLabel: ctx?.unifiedMarketStateLabel ?? ctx?.marketPositionLabel ?? "—",
    panicScore: ctx?.ydsScore ?? null,
  }
}
