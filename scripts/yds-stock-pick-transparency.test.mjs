/**
 * Transparency — node scripts/yds-stock-pick-transparency.test.mjs
 */
import { getStockPickByTicker } from "../vite-project/src/content/ydsStockPickModel.js"
import {
  buildStockPickTransparency,
  buildTransparencyRationale,
} from "../vite-project/src/content/ydsStockPickTransparency.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const nvda = getStockPickByTicker("NVDA")
assert(nvda != null, "nvda")

const t = buildStockPickTransparency(nvda)
assert(t.badge === "fallback", "fallback badge offline")
assert(t.countryFlag === "🇺🇸", "us flag")
assert(t.metrics.length === 4, "4 metrics")
assert(t.metrics[0].label === "현재가", "close label")
assert(t.rationale.length >= 1, "rationale")

const hyosung = getStockPickByTicker("298040")
assert(hyosung?.country === "KR", "kr stock")
const krT = buildStockPickTransparency(hyosung)
assert(krT.countryFlag === "🇰🇷", "kr flag")

const rationale = buildTransparencyRationale({
  close: 207,
  ma20: 218,
  ma60: 199,
  high52w: 250,
  volumeRatio: 1.2,
})
assert(rationale.includes("20일선 아래"), "below ma20")
assert(rationale.includes("60일선 위"), "above ma60")
assert(rationale.length <= 3, "max 3")

console.log("OK transparency", { nvda: t, rationale })
