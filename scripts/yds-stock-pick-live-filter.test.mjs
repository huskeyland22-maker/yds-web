/**
 * Stock pick live-only filter + status diag — node scripts/yds-stock-pick-live-filter.test.mjs
 */
import {
  buildStockPickViews,
  filterRecommendableStockPicks,
  getTop5Stocks,
  isLiveStockPick,
} from "../vite-project/src/content/ydsStockPickModel.js"
import { explainStatusFromSnapshot } from "../vite-project/src/content/ydsStockPickStatusDiag.js"
import { computeStockPickLoadStats } from "../vite-project/src/content/ydsStockPickLoadStats.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const all = buildStockPickViews()
assert(all.every((s) => s.dataSource === "fallback"), "offline build uses fallback")
assert(filterRecommendableStockPicks(all).length === 0, "no recommendable without live")
assert(getTop5Stocks(all).length === 0, "top5 empty without live")

const mockSnapshots = new Map([
  [
    "010120",
    {
      engineSnapshot: {
        close: 209000,
        ma20: 243500,
        ma60: 188200,
        ma120: 180000,
        high52w: 280000,
        recentHigh: 260000,
        volumeToday: 120000,
        volumeAvg20: 100000,
      },
      extras: { rsi14: 42, position52w: 55 },
      apiBody: { dataSource: "kis" },
      quote: { price: 209000 },
      fetchedAt: new Date().toISOString(),
    },
  ],
  [
    "NVDA",
    {
      engineSnapshot: {
        close: 120,
        ma20: 115,
        ma60: 100,
        ma120: 95,
        high52w: 140,
        recentHigh: 130,
        volumeToday: 50_000_000,
        volumeAvg20: 40_000_000,
      },
      extras: { rsi14: 55, position52w: 82 },
      apiBody: { dataSource: "yahoo" },
      quote: { price: 120 },
      fetchedAt: new Date().toISOString(),
    },
  ],
])

const mixed = buildStockPickViews(null, mockSnapshots)
const live = filterRecommendableStockPicks(mixed)
assert(live.length === 2, `live count ${live.length}`)
assert(live.every(isLiveStockPick), "all filtered are live")

const ls = live.find((s) => s.ticker === "010120")
assert(ls != null, "LS ELECTRIC present")
assert(ls.quoteSource === "KIS", `source ${ls.quoteSource}`)
assert(ls.stockStatus.id === "dip", `LS status ${ls.stockStatus.id} expected dip`)

const nvda = live.find((s) => s.ticker === "NVDA")
assert(nvda?.quoteSource === "Yahoo", "yahoo source")

const lsDiag = explainStatusFromSnapshot(mockSnapshots.get("010120").engineSnapshot, {
  rsi14: 42,
  position52w: 55,
})
assert(lsDiag.statusId === "dip", `ls diag ${lsDiag.statusId}`)
assert(lsDiag.reasons.length > 0, "ls has reasons")

const top5 = getTop5Stocks(mixed)
assert(top5.length <= 2, "top5 only from live")
assert(top5.every(isLiveStockPick), "top5 live only")

const stats = computeStockPickLoadStats(mixed)
assert(stats.totalUniverse === 49, "universe 49")
assert(stats.totalLive === 2, `live ${stats.totalLive}`)
assert(stats.fallbackCount === 47, `fallback ${stats.fallbackCount}`)
assert(stats.totalMissing === 47, "missing count")

console.log("OK stock pick live filter", {
  live: stats.totalLive,
  missing: stats.totalMissing,
  fallback: stats.fallbackCount,
  lsStatus: ls.stockStatus.label,
})
