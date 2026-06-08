/**
 * Stock pick Phase 2-3 integration test — node scripts/yds-stock-pick-v1-view.test.mjs
 */
import {
  getStockPickUniverse,
  getTop3Stocks,
  getRankingStocks,
  filterBySector,
  getStockPicksForCountry,
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
assert(nvda.scores.marketFitScore === 19, "manual market fit fallback")
assert(
  nvda.scores.totalScore ===
    nvda.scores.trendScore +
      nvda.scores.volumeScore +
      nvda.scores.positionScore +
      nvda.scores.marketFitScore,
  "total equals sum",
)
assert(nvda.scoreMeta.volumeRatio > 0, "score meta")
assert(nvda.recommendReasons.length >= 2, "recommend reasons")
assert(nvda.stockAction.label.length > 0, "stock action")
assert(nvda.stockStatus.label.length > 0, "stock status")
assert(nvda.snapshot?.country === "US", "snapshot provider")

const top3 = getTop3Stocks(all)
assert(top3.length === 3, "top3")
assert(top3[0].rank === 1, "rank1 dynamic")

const ranking = getRankingStocks(all, 5)
assert(ranking[0].scores.totalScore >= ranking[4].scores.totalScore, "rank order")

assert(filterBySector(all, "nuclear").length >= 4, "nuclear sector")
assert(YDS_SCORE_WEIGHTS.trend === 40, "weights")

const us = getStockPicksForCountry("US")
const kr = getStockPicksForCountry("KR")
assert(us.length === 26, `us count ${us.length}`)
assert(kr.length === 19, `kr count ${kr.length}`)
assert(us[0].country === "US" && us[0].rank === 1, "us rank1")
assert(kr[0].country === "KR" && kr[0].rank === 1, "kr rank1")

const nvdaGlobalRank = all.find((s) => s.ticker === "NVDA")?.rank
const nvdaUsRank = us.find((s) => s.ticker === "NVDA")?.rank
assert(nvdaUsRank != null && nvdaUsRank <= 3, "nvda us rank")
const hyosung = kr.find((s) => s.name.includes("효성"))
assert(hyosung != null, "hyosung in kr")
assert(!us.some((s) => s.ticker === hyosung.ticker), "hyosung not in us list")
assert(
  getStockPickByTicker(hyosung.ticker)?.rank === hyosung.rank,
  "detail country rank",
)

const usTop3 = getTop3Stocks(us)
const krTop3 = getTop3Stocks(kr)
assert(usTop3.every((s) => s.country === "US"), "us top3 country")
assert(krTop3.every((s) => s.country === "KR"), "kr top3 country")
assert(
  !usTop3.some((s) => krTop3.some((k) => k.ticker === s.ticker)),
  "top3 disjoint",
)

console.log("OK stock pick phase 2-7", {
  total: all.length,
  top3: top3.map((s) => `${s.name} ${s.scores.totalScore} (T${s.scores.trendScore})`),
  usTop3: usTop3.map((s) => s.name),
  krTop3: krTop3.map((s) => s.name),
  nvdaGlobalRank,
  nvdaUsRank,
  nvdaTrend: nvda.scores.trendScore,
  nvdaAction: nvda.stockAction.label,
  nvdaReasons: nvda.recommendReasons.map((r) => r.text),
})
