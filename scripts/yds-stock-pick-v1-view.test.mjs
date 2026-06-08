/**
 * Stock pick Phase 2-2 smoke test — node scripts/yds-stock-pick-v1-view.test.mjs
 */
import {
  getStockPickUniverse,
  getTop3Stocks,
  getRankingStocks,
  filterBySector,
  getStockPickByTicker,
  STOCK_PICK_STATUS,
} from "../vite-project/src/content/ydsStockPickModel.js"
import { YDS_SCORE_WEIGHTS, formatScoreBreakdownRows } from "../vite-project/src/content/ydsStockScoreConfig.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const all = getStockPickUniverse()
assert(all.length === 45, `universe ${all.length}`)
assert(all[0].scores.totalScore === all[0].score, "score alias")

const nvda = getStockPickByTicker("NVDA")
assert(nvda?.scores.trendScore === 38, "nvda trend")
assert(nvda?.scoreRows.length === 4, "score rows")
assert(nvda?.statusPhrase === "강한 추세", "status phrase")

const top3 = getTop3Stocks(all)
assert(top3[0].ticker === "NVDA", "top1")

const nuclear = filterBySector(all, "nuclear")
assert(nuclear.length >= 4, `nuclear ${nuclear.length}`)

const infra = filterBySector(all, "infra")
assert(infra.length >= 4, `infra ${infra.length}`)

assert(YDS_SCORE_WEIGHTS.trend === 40, "trend weight")
assert(STOCK_PICK_STATUS.trend.phrase === "강한 추세", "phrase")

const rows = formatScoreBreakdownRows(nvda.scores)
assert(rows[0].display === "38/40", rows[0].display)

console.log("OK stock pick phase 2-2", {
  total: all.length,
  top3: top3.map((s) => `${s.name} ${s.scores.totalScore}`),
  sectors: ["ai", "nuclear", "infra"].map((id) => `${id}:${filterBySector(all, id).length}`),
})
