/**
 * Portfolio V2 — node scripts/yds-portfolio-v2.test.mjs
 */
import {
  buildPortfolioV2Analysis,
  buildPositionRows,
  computeActualAssetAllocation,
  computePositionRow,
} from "../vite-project/src/content/ydsPortfolioV2Engine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"
import {
  applyBuyToPositions,
  applySellToPositions,
  computeHoldingsFromTrades,
} from "../vite-project/src/content/ydsPortfolioTradeSync.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ctx = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)

const positions = [
  {
    id: "p1",
    name: "엔비디아",
    ticker: "NVDA",
    country: "us",
    buyDate: "2025-01-10",
    avgPrice: 100,
    quantity: 10,
    currentPrice: 120,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "p2",
    name: "삼성전자",
    ticker: "005930",
    country: "kr",
    buyDate: "2025-02-01",
    avgPrice: 70000,
    quantity: 5,
    currentPrice: null,
    createdAt: 1,
    updatedAt: 1,
  },
]

const asset = computeActualAssetAllocation(positions, 500_000)
assert(asset.usVal === 1200, `us val ${asset.usVal}`)
assert(asset.krVal === 350000, `kr val ${asset.krVal}`)
assert(asset.total === 851200, `total ${asset.total}`)

const row = computePositionRow(positions[0], asset.total)
assert(row.returnPct === 20, `return ${row.returnPct}`)
assert(row.valuation === 1200, `valuation ${row.valuation}`)

const { rows, totalValue } = buildPositionRows(positions, 500_000)
assert(rows.length === 2, "rows")
assert(totalValue === asset.total, "total value")

const analysis = buildPortfolioV2Analysis(positions, 500_000, ctx)
assert(analysis.recommended.usPct > 0, "recommended")
assert(analysis.compliance.compliancePct >= 0, "compliance")
assert(analysis.rebalance.conclusion.length > 0, "conclusion")

const bought = applyBuyToPositions([], {
  name: "엔비디아",
  quantity: 10,
  amount: 1_000_000,
  date: "2025-03-01",
})
assert(bought.length === 1 && bought[0].quantity === 10, "buy creates position")
assert(bought[0].avgPrice === 100_000, `buy avg ${bought[0].avgPrice}`)

const sold = applySellToPositions(bought, { name: "엔비디아", quantity: 4 })
assert(sold[0].quantity === 6, `sell qty ${sold[0].quantity}`)

const fromTrades = computeHoldingsFromTrades([], [
  {
    id: "t1",
    date: "2025-03-01",
    action: "buy",
    name: "삼성전자",
    amount: 350_000,
    quantity: 5,
    memo: "",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "t2",
    date: "2025-03-02",
    action: "sell",
    name: "삼성전자",
    amount: 80_000,
    quantity: 1,
    memo: "",
    createdAt: 2,
    updatedAt: 2,
  },
])
assert(fromTrades.length === 1 && fromTrades[0].quantity === 4, `trade replay ${fromTrades[0]?.quantity}`)

console.log("OK portfolio v2", {
  total: asset.total,
  compliance: analysis.compliance.compliancePct,
  gap: analysis.gapPct,
})
