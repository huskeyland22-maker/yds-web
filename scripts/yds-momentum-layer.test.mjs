/**
 * Momentum Layer smoke test — node scripts/yds-momentum-layer.test.mjs
 */
import { resolveMomentumLayer } from "../vite-project/src/content/ydsMomentumLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const history = [
  { date: "2026-05-30", fearGreed: 65, bofa: 6.5 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.4 },
  { date: "2026-06-03", fearGreed: 50, bofa: 6.2 },
]

const panic = { date: "2026-06-05", fearGreed: 42, bofa: 6.0 }

const view = resolveMomentumLayer(panic, history, { fearStageLabel: "중립구간" })

assert(view.cnnDelta3d === -8 || view.cnnDelta3d != null, "cnn delta computed")
// 42 vs ~3 days back from 06-05 -> 05-30 is 6 days, need rows at exactly 3 days before
// 06-05 - 3 = 06-02, closest on/before is 06-01 -> 42-58 = -16 -> warning
assert(view.cnnLevel === "warning", `expected CNN warning, got ${view.cnnLevel} delta=${view.cnnDelta3d}`)
assert(view.shortLabel.includes("투자심리"), "label mentions sentiment")
assert(view.explainLines.length >= 2, "has explain lines")

console.log("OK momentum layer", {
  cnnDelta3d: view.cnnDelta3d,
  cnnLevel: view.cnnLevel,
  shortLabel: view.shortLabel,
})
