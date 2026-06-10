import { buildStockPickViews, filterRecommendableStockPicks } from "../vite-project/src/content/ydsStockPickModel.js"
import { computeStockPickPipelineDebug } from "../vite-project/src/content/ydsStockPickPipelineDebug.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const all = buildStockPickViews()
const filtered = filterRecommendableStockPicks(all)
const debug = computeStockPickPipelineDebug(new Map(), all, filtered, [])

assert(debug.rawUs === 26, `rawUs ${debug.rawUs}`)
assert(debug.rawKr === 23, `rawKr ${debug.rawKr}`)
assert(debug.usPriceSuccess === 0, "no price offline")
assert(debug.scored === 49, `scored ${debug.scored}`)
assert(debug.filtered === 0, "filtered zero offline")

console.log("OK pipeline debug", debug)
