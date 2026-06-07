/**
 * Stock pick platform smoke test — node scripts/yds-stock-pick-v1-view.test.mjs
 */
import {
  getStockPickUniverse,
  getTop3Stocks,
  getRankingStocks,
  filterBySector,
  getStockPickByTicker,
  STOCK_PICK_STATUS,
} from "../vite-project/src/content/ydsStockPickModel.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const all = getStockPickUniverse()
assert(all.length === 20, `universe ${all.length}`)

const top3 = getTop3Stocks(all)
assert(top3.length === 3, "top3")
assert(top3[0].ticker === "NVDA", "nvda #1")

const ranking = getRankingStocks(all, 5)
assert(ranking.length === 5, "ranking5")

const ai = filterBySector(all, "ai")
assert(ai.length >= 5, `ai sector ${ai.length}`)

const nvda = getStockPickByTicker("NVDA")
assert(nvda?.comment.length > 0, "comment")
assert(STOCK_PICK_STATUS.trend.label === "추세", "status label")

console.log("OK stock pick platform", {
  total: all.length,
  top3: top3.map((s) => s.name),
  ranking: ranking.map((s) => `${s.rank} ${s.name} ${s.score}`),
})
