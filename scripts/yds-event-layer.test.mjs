/**
 * Event Layer V1.3 smoke test — node scripts/yds-event-layer.test.mjs
 */
import { resolveEventLayer } from "../vite-project/src/content/ydsEventLayer.js"
import { getFinalScore } from "../vite-project/src/utils/tradingScores.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const exitHistory = [
  { date: "2026-05-28", fearGreed: 72, bofa: 7.2 },
  { date: "2026-05-30", fearGreed: 68, bofa: 6.9 },
  { date: "2026-06-02", fearGreed: 55, bofa: 6.3 },
]
const exitPanic = { date: "2026-06-05", fearGreed: 42, bofa: 5.9 }

const exitView = resolveEventLayer(exitPanic, exitHistory)
assert(exitView.hasEvents, "expected exit events")
const cnnExit = exitView.events.find((e) => e.id === "cnn-exit")
assert(cnnExit?.title === "CNN 과열권 이탈", cnnExit?.title)
assert(cnnExit?.summary.includes("낙관"), cnnExit?.summary)
const bofaExit = exitView.events.find((e) => e.id === "bofa-exit")
assert(bofaExit?.title === "BofA 과열권 이탈", bofaExit?.title)

const entryHistory = [
  { date: "2026-05-28", fearGreed: 52, bofa: 5.8 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.0 },
]
const entryPanic = { date: "2026-06-05", fearGreed: 74, bofa: 6.2 }
const entryView = resolveEventLayer(entryPanic, entryHistory)
const cnnEntry = entryView.events.find((e) => e.id === "cnn-entry")
assert(cnnEntry?.title === "CNN 과열권 진입", cnnEntry?.title)
assert(cnnEntry?.summary.includes("낙관"), cnnEntry?.summary)

const lowRow = {
  date: "2026-05-28",
  vix: 14,
  putCall: 0.75,
  fearGreed: 55,
  bofa: 5.5,
  highYield: 3.2,
}
const highRow = {
  date: "2026-06-05",
  vix: 28,
  putCall: 1.25,
  fearGreed: 22,
  bofa: 4.8,
  highYield: 5.5,
}
const lowScore = getFinalScore(lowRow)
const highScore = getFinalScore(highRow)
assert(lowScore < 60, `low score ${lowScore}`)
assert(highScore >= 60, `high score ${highScore}`)

const panicHistory = [lowRow, { ...lowRow, date: "2026-06-01" }]
const panicView = resolveEventLayer(highRow, panicHistory)
const dcaEntry = panicView.events.find((e) => e.id === "yds-dca-entry")
assert(dcaEntry?.title === "분할매수 단계 진입", dcaEntry?.title)

const lifeLow = { ...lowRow, vix: 12, putCall: 0.7, fearGreed: 60, highYield: 3.0 }
const lifeHigh = {
  date: "2026-06-05",
  vix: 40,
  putCall: 1.5,
  fearGreed: 10,
  bofa: 3.5,
  highYield: 6.0,
}
assert(getFinalScore(lifeHigh) >= 80, `life score ${getFinalScore(lifeHigh)}`)
const lifeView = resolveEventLayer(lifeHigh, [lifeLow, { ...lifeLow, date: "2026-06-01" }])
const lifeEntry = lifeView.events.find((e) => e.id === "yds-life-entry")
assert(lifeEntry?.title === "인생 타점 진입", lifeEntry?.title)

console.log("OK event layer v1.3", {
  exit: exitView.events.map((e) => e.id),
  entry: cnnEntry?.id,
  panic: [dcaEntry?.id, lifeEntry?.id],
})
