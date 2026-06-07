/**
 * State Engine smoke test — node scripts/yds-state-engine.test.mjs
 */
import { resolveMarketState, buildStateSubtitles, resolveUnifiedMarketRegime, buildQuickReadContext } from "../vite-project/src/content/ydsStateEngine.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function buildHistory(points) {
  return points.map(([date, fearGreed, bofa]) => ({ date, fearGreed, bofa }))
}

const postPeakHistory = buildHistory([
  ["2026-03-15", 52, 5.8],
  ["2026-04-01", 58, 6.2],
  ["2026-05-01", 61, 6.6],
  ["2026-05-20", 55, 6.1],
  ["2026-06-01", 42, 6.6],
])

const unwind = resolveMarketState(
  { date: "2026-06-01", fearGreed: 42, bofa: 6.6 },
  postPeakHistory,
  { level: "warning", cnnDelta3d: -12, bofaDelta2w: -0.4, cnnLevel: "warning", bofaLevel: "none" },
)
assert(unwind?.label === "과열 해소 진행", `unwind ${unwind?.label}`)
assert(unwind?.subtitles.includes("최근 과열권 이탈"), unwind?.subtitles.join("|"))
assert(unwind?.subtitles.includes("투자심리 둔화"), unwind?.subtitles.join("|"))
assert(unwind?.source === "flow", unwind?.source)

const risingHistory = buildHistory([
  ["2026-04-01", 32, 4.5],
  ["2026-05-01", 36, 4.7],
  ["2026-06-01", 42, 5.0],
])

const rising = resolveMarketState(
  { date: "2026-06-01", fearGreed: 42, bofa: 5.0 },
  risingHistory,
  { level: "none", cnnDelta3d: 3, bofaDelta2w: 0.1, cnnLevel: "none", bofaLevel: "none" },
)
assert(
  rising?.label === "낙관 확대" || rising?.label === "회복 진행",
  `rising ${rising?.label}`,
)

const static42 = resolveMarketState(
  { date: "2026-06-01", fearGreed: 42, bofa: 5.2 },
  risingHistory,
  null,
)
assert(static42?.label !== unwind?.label || static42?.source === "absolute", "static differs from unwind")

const panicHistory = buildHistory([
  ["2026-04-01", 52, 5.5],
  ["2026-05-01", 50, 5.4],
  ["2026-05-25", 48, 5.3],
  ["2026-06-01", 38, 5.2],
])

const panic = resolveMarketState(
  { date: "2026-06-01", fearGreed: 38, bofa: 5.2 },
  panicHistory,
  { level: "strong", cnnDelta3d: -28, bofaDelta2w: -1.2, cnnLevel: "strong", bofaLevel: "warning" },
)
assert(panic?.label === "패닉 진행", panic?.label)

const subs = buildStateSubtitles("overheatUnwind", {
  peakCnn: 61,
  peakBofa: 6.6,
  cnn: 42,
  cnnDelta30d: -15,
  cnnDelta3d: -12,
  momentumTier: "slowdown",
  momentumLevel: "warning",
})
assert(subs[0] === "최근 과열권 이탈", subs.join("|"))

const unified = resolveUnifiedMarketRegime(
  { date: "2026-06-01", fearGreed: 42, bofa: 6.6 },
  postPeakHistory,
  { level: "warning", cnnDelta3d: -12, bofaDelta2w: -0.4, cnnLevel: "warning", bofaLevel: "none" },
)
assert(unified?.label === "과열 해소 진행", unified?.label)
assert(unified?.contextLines.includes("최근 과열권 이탈"), unified?.contextLines.join("|"))
assert(unified?.contextLines.includes("사이클 후반 진입"), unified?.contextLines.join("|"))
assert(!unified?.contextLines.some((l) => l.includes("후기 사이클")), "no duplicate regime label")
const quick = buildQuickReadContext("사이클 후반", unified)
assert(quick.includes("최근 과열권 이탈") && quick.includes("과열 해소 진행"), quick.join("|"))

console.log("OK state engine", {
  unwind: `${unwind?.label} · ${unwind?.subtitles.join(" · ")}`,
  rising: rising?.label,
  static42: `${static42?.label} (${static42?.source})`,
  panic: panic?.label,
})
