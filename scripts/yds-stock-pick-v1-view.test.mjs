/**
 * Stock pick Phase 2-3 integration test — node scripts/yds-stock-pick-v1-view.test.mjs
 */
import {
  getStockPickUniverse,
  getTop3Stocks,
  getRankingStocks,
  filterBySector,
  getStockPickByTicker,
} from "../vite-project/src/content/ydsStockPickModel.js"
import { YDS_SCORE_WEIGHTS } from "../vite-project/src/content/ydsStockScoreConfig.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const all = getStockPickUniverse()
assert(all.length === 45, `universe ${all.length}`)

const nvda = getStockPickByTicker("NVDA")
assert(nvda != null, "nvda")
assert(nvda.scores.trendScore > 0, "computed trend")
assert(nvda.scores.marketFitScore === 19, "manual market fit")
assert(
  nvda.scores.totalScore ===
    nvda.scores.trendScore +
      nvda.scores.volumeScore +
      nvda.scores.positionScore +
      nvda.scores.marketFitScore,
  "total equals sum",
)
assert(nvda.scoreMeta.volumeRatio > 0, "score meta")

const top3 = getTop3Stocks(all)
assert(top3.length === 3, "top3")
assert(top3[0].rank === 1, "rank1 dynamic")

const ranking = getRankingStocks(all, 5)
assert(ranking[0].scores.totalScore >= ranking[4].scores.totalScore, "rank order")

assert(filterBySector(all, "nuclear").length >= 4, "nuclear sector")
assert(YDS_SCORE_WEIGHTS.trend === 40, "weights")

console.log("OK stock pick phase 2-3", {
  total: all.length,
  top3: top3.map((s) => `${s.name} ${s.scores.totalScore} (T${s.scores.trendScore})`),
  nvdaTrend: nvda.scores.trendScore,
})
