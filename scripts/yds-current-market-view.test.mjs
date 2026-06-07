/**
 * Current Market View smoke test — node scripts/yds-current-market-view.test.mjs
 */
import { resolveCurrentMarketView } from "../vite-project/src/content/ydsCurrentMarketView.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const history = [
  { date: "2026-05-20", fearGreed: 72, bofa: 7.2 },
  { date: "2026-05-28", fearGreed: 68, bofa: 6.8 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.4 },
]

const panic = { date: "2026-06-05", fearGreed: 42, bofa: 6.6 }

const view = resolveCurrentMarketView(panic, history)
assert(view != null, "view required")
assert(view.label.length > 0, "label required")
assert(view.cnn === 42, `cnn ${view.cnn}`)
assert(view.bofa === 6.6, `bofa ${view.bofa}`)
assert(typeof view.cause === "string", "cause string")

console.log("OK current market view", {
  label: view.label,
  cause: view.cause,
  metrics: `CNN ${view.cnn} BofA ${view.bofa}`,
})
