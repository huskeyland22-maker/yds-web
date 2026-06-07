/**
 * Action signal view smoke test — node scripts/yds-action-signal-view.test.mjs
 */
import { resolveActionSignalView } from "../vite-project/src/content/ydsActionSignalView.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const panic = { fearGreed: 42, bofa: 6.6, vix: 18, putCall: 0.9, highYield: 4.5 }
const history = [
  { date: "2026-05-20", fearGreed: 72, bofa: 7.2 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.4 },
]

const view = resolveActionSignalView(panic, history)
assert(view != null, "view required")
assert(view.signals.length === 3, view.signals.length)
assert(view.signals[0].emoji.length > 0, "emoji")
assert(view.stateLabel.length > 0, "state")

console.log("OK action signal view", {
  signals: view.signals.map((s) => `${s.emoji} ${s.text}`),
  state: `${view.stateEmoji} ${view.stateLabel}`,
})
