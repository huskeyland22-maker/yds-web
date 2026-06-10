import { buildStockPickViews } from "../vite-project/src/content/ydsStockPickModel.js"
import { filterStockPicksByQuery } from "../vite-project/src/content/ydsStockPickSearch.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const all = buildStockPickViews()
const nvda = filterStockPicksByQuery(all, "nvda")
assert(nvda.some((s) => s.ticker === "NVDA"), "ticker search")

const kr = filterStockPicksByQuery(all, "삼성")
assert(kr.some((s) => s.ticker === "005930"), "korean name search")

assert(filterStockPicksByQuery(all, "").length === all.length, "empty query")

console.log("OK stock pick search (local filter only)")
