/**
 * Market stage labels — node scripts/yds-market-stage-labels.test.mjs
 */
import {
  MARKET_LABEL_MARKET_STATE,
  MARKET_PANIC_ACTION,
  MARKET_STAGE_ACTION,
  resolveMarketStageSnapshot,
} from "../vite-project/src/content/ydsMarketStageLabels.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(MARKET_LABEL_MARKET_STATE === "시장 상태")
assert(MARKET_STAGE_ACTION.lateCycle.label === "기회 대기")
assert(
  MARKET_STAGE_ACTION.lateCycle.hint.includes("과열이 상당 부분 해소"),
  MARKET_STAGE_ACTION.lateCycle.hint,
)

const view = resolveMarketStageSnapshot(32, null)
assert(view.cycle?.label === "기회 대기", `cycle ${view.cycle?.label}`)
assert(view.panic?.label === "관망 유지", `panic ${view.panic?.label}`)
assert(view.headline?.text === "기회 대기 · 관망 유지", view.headline?.text)

const interestView = resolveMarketStageSnapshot(50, null)
assert(interestView.panic?.label === "관심 구간", interestView.panic?.label)
assert(MARKET_PANIC_ACTION.interest.label === "관심 구간")

console.log("OK market stage labels", {
  cycle: view.cycle.label,
  panic: view.panic.label,
  hint: view.cycle.hint.slice(0, 24),
})
