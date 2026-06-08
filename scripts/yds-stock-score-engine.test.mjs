/**
 * Stock score engine test — node scripts/yds-stock-score-engine.test.mjs
 */
import {
  calcTrendScore,
  calcVolumeScore,
  calcPositionScore,
  computeStockScores,
  scoreMaAlignment,
} from "../vite-project/src/content/ydsStockScoreEngine.js"
import { buildStockPriceSnapshot } from "../vite-project/src/content/stockPickSnapshotProfiles.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const strong = {
  close: 125,
  ma20: 118,
  ma60: 110,
  ma120: 98,
  high52w: 128,
  recentHigh: 130,
  volumeToday: 1_500_000,
  volumeAvg20: 1_000_000,
}

const trend = calcTrendScore(strong)
assert(trend.score >= 35 && trend.score <= 40, `trend ${trend.score}`)
assert(scoreMaAlignment(125, 118) === 10, "ma20 align")

const vol = calcVolumeScore(strong)
assert(vol.score === 16, `volume ${vol.score}`)

const pullback = { ...strong, close: 112, recentHigh: 130 }
assert(calcPositionScore(pullback).score >= 14, "pullback position")
const pos = calcPositionScore(strong)
assert(pos.score >= 10, `position ${pos.score}`)

const computed = computeStockScores(strong, { marketFitScore: 19 })
assert(computed.scores.totalScore === trend.score + vol.score + pos.score + 19, "total sum")
assert(computed.meta.volumeRatio === 1.5, "ratio meta")

const nvdaSnap = buildStockPriceSnapshot("NVDA", "trend")
const nvda = computeStockScores(nvdaSnap, { marketFitScore: 19 })
assert(nvda.scores.trendScore >= 36, `nvda trend ${nvda.scores.trendScore}`)
assert(nvda.scores.totalScore >= 85, `nvda total ${nvda.scores.totalScore}`)

console.log("OK stock score engine", {
  strong: computed.scores,
  nvda: nvda.scores,
})
