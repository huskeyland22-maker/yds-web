/**
 * Portfolio V4 — node scripts/yds-portfolio-v4.test.mjs
 */
import {
  buildV4Analysis,
  buildV4Holdings,
  deriveCashFromTrades,
  replayPortfolioFromTrades,
} from "../vite-project/src/content/ydsPortfolioV4Engine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ctx = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)

const trades = [
  {
    id: "t1",
    date: "2025-01-01",
    action: "buy",
    name: "엔비디아",
    country: "us",
    amount: 1_000_000,
    memo: "",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "t2",
    date: "2025-02-01",
    action: "buy",
    name: "엔비디아",
    country: "us",
    amount: 500_000,
    memo: "",
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: "t3",
    date: "2025-03-01",
    action: "sell",
    name: "엔비디아",
    country: "us",
    amount: 600_000,
    memo: "일부 익절",
    createdAt: 3,
    updatedAt: 3,
  },
]

const replay = replayPortfolioFromTrades(trades)
assert(replay.lots.length === 1, "one lot after partial sell")
assert(replay.lots[0].holdingAmount === 900_000, `holding ${replay.lots[0].holdingAmount}`)
assert(replay.lots[0].costBasis === 900_000, `cost ${replay.lots[0].costBasis}`)
assert(replay.totalRealizedPnl === 0, `realized ${replay.totalRealizedPnl}`)

const cash = deriveCashFromTrades(trades)
assert(cash === 0, `cash ${cash}`)

const holdings = buildV4Holdings(trades, cash)
assert(holdings.rows[0].purchaseAmount === 900_000, "purchase amount")
assert(holdings.rows[0].weightPct === 100, "weight")

const sellAll = replayPortfolioFromTrades([
  ...trades.slice(0, 2),
  {
    id: "t4",
    date: "2025-04-01",
    action: "sell",
    name: "엔비디아",
    country: "us",
    amount: 1_600_000,
    memo: "",
    createdAt: 4,
    updatedAt: 4,
  },
])
assert(sellAll.lots.length === 0, "full sell removes lot")
assert(sellAll.totalRealizedPnl === 100_000, `profit ${sellAll.totalRealizedPnl}`)

const analysis = buildV4Analysis(trades, 0, ctx)
assert(analysis.compliance.compliancePct >= 0, "compliance")

console.log("OK portfolio v4", {
  holding: replay.lots[0]?.holdingAmount,
  realized: sellAll.totalRealizedPnl,
  compliance: analysis.compliance.compliancePct,
})
