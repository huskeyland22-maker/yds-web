/**
 * Portfolio V6.4 — 보유 종목 YDS 행동 (시장 + 수익률 휴리스틱)
 */

import { DEFAULT_MARKET_CONTEXT } from "./ydsMarketAdapter.js"
import { buildStockActionResult } from "./ydsStockActionEngine.js"

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsPortfolioV5Engine.js").HoldingRow} HoldingRow */
/** @typedef {import("./ydsStockActionEngine.js").StockActionResult} StockActionResult */

/**
 * @param {HoldingRow | null | undefined} holding
 * @param {YdsMarketAdapterContext | null | undefined} marketContext
 * @returns {StockActionResult}
 */
export function derivePortfolioHoldingAction(holding, marketContext) {
  const ctx = marketContext && typeof marketContext === "object" ? marketContext : DEFAULT_MARKET_CONTEXT
  const returnPct = holding?.returnPct

  /** @type {import("./ydsStockActionEngine.js").StockActionStatusId} */
  let statusId = "interest"

  if (returnPct != null && Number.isFinite(returnPct)) {
    if (returnPct >= 25) statusId = "overheat"
    else if (returnPct >= 4) statusId = "trend"
    else if (returnPct <= -10) statusId = "dip"
    else if (returnPct < 0) statusId = "interest"
  } else if (holding?.priceReady) {
    statusId = "interest"
  }

  if (ctx.isDefensive) {
    if (returnPct != null && returnPct >= 25) {
      return buildStockActionResult(
        "overheat",
        `${ctx.strategyLabel} · 단기 과열 · 일부 익절 검토`,
      )
    }
    if (returnPct != null && returnPct >= 0) {
      return buildStockActionResult("trend", `${ctx.panicLabel} · 추세 유지 · 보유`)
    }
    if (statusId === "dip") {
      return buildStockActionResult(statusId, `${ctx.strategyLabel} · 눌림 관찰 · 신규 매수 자제`)
    }
    return buildStockActionResult(
      statusId,
      `${ctx.strategyLabel} · ${ctx.panicLabel} · 기존 비중 유지`,
    )
  }

  if (statusId === "trend") {
    return buildStockActionResult(statusId, `${ctx.panicLabel} · 추세 유지`)
  }
  if (statusId === "overheat") {
    return buildStockActionResult(statusId, "단기 과열 · 추격 매수 금지")
  }
  if (statusId === "dip") {
    return buildStockActionResult(statusId, `${ctx.panicLabel} · 눌림 구간 관찰`)
  }

  return buildStockActionResult(statusId, ctx.contextLine || `${ctx.panicLabel} · 관심 유지`)
}
