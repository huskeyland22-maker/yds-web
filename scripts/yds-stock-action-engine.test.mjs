/**
 * Phase 2-5 action engine — node scripts/yds-stock-action-engine.test.mjs
 */
import { deriveStockAction } from "../vite-project/src/content/ydsStockActionEngine.js"
import { buildRecommendReasons } from "../vite-project/src/content/ydsStockRecommendReasons.js"
import { getStockPickByTicker } from "../vite-project/src/content/ydsStockPickModel.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const nvda = getStockPickByTicker("NVDA")
assert(nvda != null, "nvda")
assert(nvda.stockAction.label === "보유 유지", `nvda action ${nvda.stockAction.label}`)
assert(nvda.stockStatus.label === "추세 유지", `nvda status ${nvda.stockStatus.label}`)
assert(nvda.recommendReasons.length >= 2, "nvda reasons on view")

const ls = getStockPickByTicker("010120")
if (ls) {
  assert(ls.stockAction.label.length > 0, "ls action")
  assert(ls.recommendReasons.length >= 1, "ls reasons")
}

const smci = getStockPickByTicker("SMCI")
if (smci?.stockStatus.id === "overheat") {
  assert(smci.stockAction.label === "추격 금지", "smci no chase")
}

const recomputed = deriveStockAction(
  nvda.scores,
  nvda.scoreMeta,
  buildRecommendReasons(nvda.scores, nvda.scoreMeta),
)
assert(recomputed.stockAction.id === "hold", "hold action id")

console.log("OK action engine", {
  nvda: { status: nvda.stockStatus.label, action: nvda.stockAction.label },
  reasons: nvda.recommendReasons.map((r) => r.text),
})
