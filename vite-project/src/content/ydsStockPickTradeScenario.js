/**
 * 매매 시나리오 — 상승·횡보·하락 확률 및 행동
 */

import { buildStockPickDetailPanelReport } from "./ydsStockPickDetailPanelEngine.js"
import { formatTransparencyPrice } from "./ydsStockPickTransparency.js"

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null} [marketContext]
 * @param {import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null} [dualLiquidity]
 */
export function buildStockPickTradeScenarioReport(stock, marketContext = null, dualLiquidity = null) {
  const detail = buildStockPickDetailPanelReport(stock, marketContext)
  const country = stock.country === "KR" ? "KR" : "US"
  const price = Number(stock.snapshot?.price ?? stock.snapshot?.close)
  const levels = detail.priceLevels

  const aiScore = detail.scoreBars.find((b) => b.id === "ai")?.score ?? 50
  const momentum = detail.scoreBars.find((b) => b.id === "momentum")?.score ?? 50
  const risk = detail.scoreBars.find((b) => b.id === "risk")?.score ?? 50

  let bull = 30 + momentum * 0.25 + aiScore * 0.15
  let bear = 20 + (100 - risk) * 0.2
  let flat = 100 - bull - bear

  const pos = marketContext?.marketPositionId
  const panic = marketContext?.ydsScore ?? 50
  const liq = dualLiquidity?.marketScore ?? 50

  if (pos === "fear" || pos === "panic") bull += 8
  if (pos === "overheat" || pos === "boundary") {
    bull -= 10
    bear += 8
  }
  if (panic >= 65) bear += 6
  if (panic <= 35) bull += 5
  if (liq < 45) bear += 5
  if (dualLiquidity?.actionMode === "defense") bear += 6

  const sum = Math.max(1, bull + flat + bear)
  bull = Math.round((bull / sum) * 100)
  bear = Math.round((bear / sum) * 100)
  flat = Math.max(0, 100 - bull - bear)

  const fmt = (v) => (Number.isFinite(v) && v > 0 ? formatTransparencyPrice(v, country) : "—")

  let targetPrice = null
  let stopPrice = null
  if (Number.isFinite(price) && price > 0) {
    targetPrice = price * (1.1 + momentum / 500)
    stopPrice = price * (0.9 - (100 - risk) / 500)
  }

  return {
    visible: stock.dataSource === "live",
    title: "매매 시나리오",
    scenarios: [
      {
        id: "bull",
        label: "상승 시나리오",
        probability: bull,
        target: levels.target1 !== "—" ? levels.target1 : fmt(targetPrice),
        range: null,
        action: momentum >= 60 ? "분할 매수 유지" : "목표가 도달 시 일부 익절",
        stop: null,
      },
      {
        id: "flat",
        label: "횡보 시나리오",
        probability: flat,
        target: null,
        range:
          Number.isFinite(price) && price > 0
            ? `${fmt(price * 0.97)} ~ ${fmt(price * 1.03)}`
            : "—",
        action: "관망 · 눌림 확인 후 분할 접근",
        stop: null,
      },
      {
        id: "bear",
        label: "하락 시나리오",
        probability: bear,
        target: null,
        range: null,
        action: risk < 50 ? "신규 진입 자제 · 현금 비중 확대" : "손절 기준 엄수 후 재진입 대기",
        stop: levels.stopLoss !== "—" ? levels.stopLoss : fmt(stopPrice),
      },
    ],
  }
}
