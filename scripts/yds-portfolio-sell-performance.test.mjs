/**
 * Sell performance — node scripts/yds-portfolio-sell-performance.test.mjs
 */
import { replayPortfolioFifoFromTrades } from "../vite-project/src/content/ydsPortfolioFifoEngine.js"
import {
  buildSellPerformanceReport,
  isDuplicateSell,
  previewSell,
} from "../vite-project/src/content/ydsPortfolioSellPerformance.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function buy(id, date, qty, price, country = "kr", createdAt = 1) {
  return {
    id,
    date,
    action: "buy",
    name: country === "us" ? "엔비디아" : "테스트",
    ticker: country === "us" ? "NVDA" : "TEST",
    country,
    quantity: qty,
    unitPrice: price,
    amount: qty * price,
    memo: "",
    createdAt,
    updatedAt: createdAt,
  }
}

function sell(id, date, qty, price, extra = {}, createdAt = 3) {
  return {
    id,
    date,
    action: "sell",
    name: extra.country === "us" ? "엔비디아" : "테스트",
    ticker: extra.country === "us" ? "NVDA" : "TEST",
    country: extra.country === "us" ? "us" : "kr",
    quantity: qty,
    unitPrice: price,
    amount: qty * price,
    memo: "",
    createdAt,
    updatedAt: createdAt,
    ...extra,
  }
}

const buys = [buy("b1", "2025-01-01", 10, 100, "kr", 1), buy("b2", "2025-02-01", 10, 120, "kr", 2)]
const partial = [...buys, sell("s1", "2025-03-01", 10, 150, {}, 3)]
const partialReplay = replayPortfolioFifoFromTrades(partial)
assert(partialReplay.lots.length === 1, "partial sell keeps the rest")
assert(partialReplay.lots[0].quantity === 10, "remaining 10")
assert(partialReplay.lots[0].avgUnitPrice === 120, "remaining lot is the second buy")
assert(partialReplay.totalRealizedPnl === 500, `partial realized ${partialReplay.totalRealizedPnl}`)
assert(partialReplay.settlements.length === 1, "one sell is one settlement")
assert(partialReplay.settlements[0].links.length === 1, "links the first buy only")
assert(partialReplay.settlements[0].links[0].buyTradeId === "b1", "buy id is kept")
assert(partialReplay.settlements[0].returnPct === 50, `return ${partialReplay.settlements[0].returnPct}`)
assert(partialReplay.settlements[0].fullClose === false, "partial is not a full close")
assert(buys.every((row) => partial.some((trade) => trade.id === row.id)), "buys stay in the ledger")

const full = [
  ...partial,
  sell("s2", "2025-04-01", 10, 80, { fee: 0, tax: 0 }, 4),
]
const fullReplay = replayPortfolioFifoFromTrades(full)
assert(fullReplay.lots.length === 0, "full sell leaves no open lot")
assert(fullReplay.closedLots.length === 1, "closed lot is retained")
assert(fullReplay.settlements.length === 2, "both sells remain")
assert(fullReplay.settlements[1].realizedLocal === -400, `loss ${fullReplay.settlements[1].realizedLocal}`)
assert(fullReplay.settlements[1].fullClose === true, "second sell closes the position")

const charged = [
  ...buys,
  sell("s-fee", "2025-03-01", 10, 150, { fee: 30, tax: 20 }, 3),
]
const chargedRow = replayPortfolioFifoFromTrades(charged).settlements[0]
assert(chargedRow.realizedLocal === 450, `fee tax pnl ${chargedRow.realizedLocal}`)
assert(chargedRow.cost === 1000, "cost is the sold quantity's buy cost")
assert(chargedRow.returnPct === 45, `fee return ${chargedRow.returnPct}`)

const splitLots = [
  buy("a", "2025-01-01", 5, 100, "kr", 1),
  buy("b", "2025-01-02", 5, 100, "kr", 2),
  sell("once", "2025-02-01", 10, 150, {}, 3),
]
const split = buildSellPerformanceReport(splitLots)
assert(split.closedCount === 1, "one sell across two lots is still one trade")
assert(split.winCount === 1, "does not count each lot as a win")
assert(split.winRate === 100, `win rate ${split.winRate}`)
assert(split.settlements[0].links.length === 2, "both buys are linked")

const mixed = buildSellPerformanceReport(full)
assert(mixed.winCount === 1 && mixed.lossCount === 1, "win and loss counted once")
assert(mixed.winRate === 50, `win rate ${mixed.winRate}`)
assert(mixed.realizedKrw === 100, `krw pnl ${mixed.realizedKrw}`)
assert(mixed.byMonth.length === 2, "monthly buckets")
assert(mixed.byYear.length === 1, "yearly bucket")
assert(mixed.winners.length === 1 && mixed.losers.length === 0, "net symbol return stays one winner")
assert(mixed.settlements[1].returnPct < 0, "the losing sell is still in the ledger")

const tooMany = previewSell(partial, {
  name: "테스트",
  ticker: "TEST",
  country: "kr",
  date: "2025-04-01",
  quantity: 11,
  unitPrice: 160,
})
assert(tooMany.ok === false, "oversell is rejected")

const early = previewSell(buys, {
  name: "테스트",
  ticker: "TEST",
  country: "kr",
  date: "2024-12-01",
  quantity: 1,
  unitPrice: 100,
})
assert(early.ok === false, "sell before the buy is rejected")

const okPartial = previewSell(buys, {
  name: "테스트",
  ticker: "TEST",
  country: "kr",
  date: "2025-03-01",
  quantity: 4,
  unitPrice: 150,
  fee: 10,
  tax: 0,
})
assert(okPartial.ok === true, okPartial.message)
assert(okPartial.preview.realizedLocal === 190, `preview pnl ${okPartial.preview.realizedLocal}`)
assert(okPartial.preview.fullClose === false, "preview stays partial")

assert(
  isDuplicateSell(charged, {
    name: "테스트",
    ticker: "TEST",
    date: "2025-03-01",
    quantity: 10,
    unitPrice: 150,
    fee: 30,
    tax: 20,
  }),
  "identical sell is a duplicate",
)

const usd = [
  buy("ub", "2025-01-01", 2, 100, "us", 1),
  sell("us1", "2025-02-01", 1, 130, { country: "us" }, 2),
  sell("us2", "2025-03-01", 1, 80, { country: "us", fxRate: 1400 }, 3),
]
const usdReport = buildSellPerformanceReport(usd, null)
assert(usdReport.settlements[0].currency === "USD", "usd currency")
assert(usdReport.settlements[0].realizedLocal === 30, "local pnl stays in dollars")
assert(usdReport.settlements[0].realizedKrw == null, "missing fx leaves won pnl empty")
assert(usdReport.settlements[1].fxRate === 1400, "recorded fx")
assert(usdReport.settlements[1].realizedKrw === -20 * 1400, `converted ${usdReport.settlements[1].realizedKrw}`)
assert(usdReport.missingFxCount === 1, "one sell excluded from won total")
assert(usdReport.realizedKrw === -28000, "won total uses only the recorded rate")
assert(usdReport.settlements[1].fullClose === true, "second usd sell closes")
assert(replayPortfolioFifoFromTrades(usd).lots.length === 0, "no open usd lot")

const live = buildSellPerformanceReport(
  [buy("ub", "2025-01-01", 1, 100, "us", 1), sell("us1", "2025-02-01", 1, 110, { country: "us" }, 2)],
  1300,
)
assert(live.settlements[0].fxSource === "live", "live rate is labeled")
assert(live.settlements[0].fxRate == null, "live rate is not written back as a stored rate")
assert(live.settlements[0].realizedKrw === 13000, `live convert ${live.settlements[0].realizedKrw}`)

const loserBook = buildSellPerformanceReport([
  ...full,
  {
    ...buy("kb", "2025-01-05", 1, 1000, "kr", 5),
    name: "다른종목",
    ticker: "OTHER",
  },
  {
    ...sell("ks", "2025-02-05", 1, 700, {}, 6),
    name: "다른종목",
    ticker: "OTHER",
  },
])
assert(loserBook.losers[0]?.name === "다른종목", `loser ${loserBook.losers[0]?.name}`)
assert(loserBook.winCount === 1 && loserBook.lossCount === 2, "symbol rank does not change the trade count")

console.log("OK sell performance", {
  partial: partialReplay.totalRealizedPnl,
  winRate: mixed.winRate,
  usd: usdReport.realizedKrw,
})
