/**
 * Phase 6-2 — node scripts/yds-portfolio-account.test.mjs
 */
import { computePortfolioCash } from "../vite-project/src/content/ydsPortfolioCashEngine.js"
import { replayPortfolioFifoFromTrades } from "../vite-project/src/content/ydsPortfolioFifoEngine.js"
import {
  buildV5Analysis,
  buildV5Holdings,
} from "../vite-project/src/content/ydsPortfolioV5Engine.js"
import { resolveMarketAdapterContext } from "../vite-project/src/content/ydsMarketAdapter.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ctx = resolveMarketAdapterContext(
  { fearGreed: 58, bofa: 6.5, vix: 15, putCall: 0.8 },
  [],
)

const ledger = [
  {
    id: "c1",
    date: "2025-01-01",
    type: "deposit",
    amount: 10_000_000,
    memo: "초기 입금",
    createdAt: 1,
  },
]

const hyundaiBuy = {
  id: "t1",
  date: "2025-01-02",
  action: "buy",
  name: "현대차",
  ticker: "005380",
  country: "kr",
  quantity: 10,
  unitPrice: 615_000,
  amount: 6_150_000,
  memo: "",
  createdAt: 2,
  updatedAt: 2,
}

const trades = [hyundaiBuy]
const cash = computePortfolioCash(trades, ledger)
assert(cash === 3_850_000, `cash ${cash}`)

const quoteMap = new Map([
  [
    "현대차",
    {
      price: 615_000,
      change: 0,
      currency: "KRW",
      updatedAt: "2025-06-03T00:00:00+09:00",
      status: "delayed",
    },
  ],
])

const holdings = buildV5Holdings(trades, cash, quoteMap)
assert(holdings.stockTotal === 6_150_000, `stock ${holdings.stockTotal}`)
assert(holdings.totalAssets === 10_000_000, `assets ${holdings.totalAssets}`)
assert(holdings.cashPct === 38.5, `cashPct ${holdings.cashPct}`)
assert(holdings.rows[0].weightPct === 61.5, `kr weight ${holdings.rows[0].weightPct}`)

const analysis = buildV5Analysis(trades, cash, ctx, quoteMap)
assert(analysis.actual.krPct === 62 || analysis.actual.krPct === 61, `kr pct ${analysis.actual.krPct}`)
assert(analysis.actual.cashPct === 38 || analysis.actual.cashPct === 39, `cash pct ${analysis.actual.cashPct}`)

const fifoTrades = [
  {
    id: "b1",
    date: "2025-01-01",
    action: "buy",
    name: "테스트",
    ticker: "TEST",
    country: "kr",
    quantity: 10,
    unitPrice: 100,
    amount: 1000,
    memo: "",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "b2",
    date: "2025-02-01",
    action: "buy",
    name: "테스트",
    ticker: "TEST",
    country: "kr",
    quantity: 10,
    unitPrice: 120,
    amount: 1200,
    memo: "",
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: "s1",
    date: "2025-03-01",
    action: "sell",
    name: "테스트",
    ticker: "TEST",
    country: "kr",
    quantity: 10,
    unitPrice: 150,
    amount: 1500,
    memo: "",
    createdAt: 3,
    updatedAt: 3,
  },
]

const fifo = replayPortfolioFifoFromTrades(fifoTrades)
assert(fifo.totalRealizedPnl === 500, `fifo realized ${fifo.totalRealizedPnl}`)
assert(fifo.lots[0].quantity === 10, "remaining qty")
assert(fifo.lots[0].avgUnitPrice === 120, `avg ${fifo.lots[0].avgUnitPrice}`)

console.log("OK portfolio account 6-2", {
  cash,
  totalAssets: holdings.totalAssets,
  fifoRealized: fifo.totalRealizedPnl,
})
