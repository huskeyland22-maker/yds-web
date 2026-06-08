/**
 * Portfolio V5 — node scripts/yds-portfolio-v5.test.mjs
 */
import {
  PORTFOLIO_DEMO_CURRENT_PRICES,
} from "../vite-project/src/content/ydsPortfolioPriceProvider.js"
import {
  buildV5Analysis,
  buildV5Holdings,
  replayPortfolioFromTrades,
} from "../vite-project/src/content/ydsPortfolioV5Engine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ctx = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)

const nvdaBuy = {
  id: "n1",
  date: "2025-01-01",
  action: "buy",
  name: "엔비디아",
  ticker: "NVDA",
  country: "us",
  quantity: 100,
  unitPrice: 120,
  amount: null,
  memo: "",
  createdAt: 1,
  updatedAt: 1,
}

const lsBuy = {
  id: "k1",
  date: "2025-01-02",
  action: "buy",
  name: "LS ELECTRIC",
  ticker: "010120",
  country: "kr",
  quantity: 10,
  unitPrice: 230_000,
  amount: null,
  memo: "",
  createdAt: 2,
  updatedAt: 2,
}

const trades = [nvdaBuy, lsBuy]
const replay = replayPortfolioFromTrades(trades)
assert(replay.lots.length === 2, "two lots")

const priceMap = new Map([
  [replay.lots.find((l) => l.ticker === "NVDA").id, PORTFOLIO_DEMO_CURRENT_PRICES.NVDA],
  [replay.lots.find((l) => l.ticker === "010120").id, PORTFOLIO_DEMO_CURRENT_PRICES["010120"]],
])

const holdings = buildV5Holdings(trades, 0, priceMap)
const nvdaRow = holdings.rows.find((r) => r.ticker === "NVDA")
const lsRow = holdings.rows.find((r) => r.ticker === "010120")

assert(nvdaRow.returnPct === 20.8, `nvda return ${nvdaRow.returnPct}`)
assert(lsRow.returnPct === -3.9, `ls return ${lsRow.returnPct}`)
assert(nvdaRow.unrealizedPnl > 0, "nvda unrealized profit")
assert(lsRow.unrealizedPnl < 0, "ls unrealized loss")
assert(holdings.totalValue > holdings.totalCostKrw, "total value above cost")

const analysis = buildV5Analysis(trades, 0, ctx, priceMap)
assert(analysis.compliance.compliancePct >= 0, "compliance")

const sorted = buildV5Holdings(trades, 0, priceMap, "returnPct")
assert(sorted.rows[0].ticker === "NVDA", "sort by return puts NVDA first")

console.log("OK portfolio v5", {
  nvdaReturn: nvdaRow.returnPct,
  lsReturn: lsRow.returnPct,
  totalReturn: holdings.totalReturnPct,
  compliance: analysis.compliance.compliancePct,
})
