/**
 * Regime Layer smoke test — node scripts/yds-regime-layer.test.mjs
 */
import { resolveMarketLevel } from "../vite-project/src/content/ydsLevelLayer.js"
import {
  resolveMarketRegime,
  resolveRegimeSummary,
  resolveMarketLevelRegime,
} from "../vite-project/src/content/ydsRegimeLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function buildHistory(points) {
  return points.map(([date, fearGreed, bofa]) => ({ date, fearGreed, bofa }))
}

const level42 = resolveMarketLevel(42, 5.5)
assert(level42?.label === "성장", `level42 ${level42?.label}`)
assert(level42?.emoji === "🟡", level42?.emoji)

const stableHistory = buildHistory([
  ["2026-03-01", 38, 4.8],
  ["2026-04-01", 40, 4.9],
  ["2026-05-01", 41, 5.0],
  ["2026-06-01", 42, 5.2],
])

const stable = resolveMarketRegime(
  { date: "2026-06-01", fearGreed: 42, bofa: 5.2 },
  stableHistory,
)
assert(stable?.id === "earlyCycle" || stable?.id === "midCycle", `stable regime ${stable?.id}`)

const postPeakHistory = buildHistory([
  ["2026-03-01", 55, 5.5],
  ["2026-04-01", 72, 6.8],
  ["2026-05-01", 68, 6.2],
  ["2026-05-15", 55, 5.8],
  ["2026-06-01", 42, 5.2],
])

const postPeak = resolveMarketRegime(
  { date: "2026-06-01", fearGreed: 42, bofa: 5.2 },
  postPeakHistory,
  { cnnDelta3d: -12 },
)
assert(postPeak?.id === "lateCycle", `postPeak ${postPeak?.id}`)
assert(
  postPeak?.summary === "최근 과열권 해소 진행",
  `summary ${postPeak?.summary}`,
)

const extreme = resolveMarketLevel(82, 8.2)
assert(extreme?.label === "최고 과열", extreme?.label)

const combo = resolveMarketLevelRegime(
  { date: "2026-06-01", fearGreed: 42, bofa: 5.2 },
  postPeakHistory,
  { cnnDelta3d: -12 },
)
assert(combo.level?.label === "성장", combo.level?.label)
assert(combo.regime?.label === "후기 사이클", combo.regime?.label)

assert(
  resolveRegimeSummary("lateCycle", { cnn: 42, peakCnn: 75, cnnDelta3d: -5 }) ===
    "최근 과열권 해소 진행",
  "cooling summary",
)

console.log("OK regime layer", {
  level42: level42.label,
  stable: stable?.id,
  postPeak: `${postPeak?.label} · ${postPeak?.summary}`,
  combo: `${combo.level?.label} / ${combo.regime?.label}`,
})
