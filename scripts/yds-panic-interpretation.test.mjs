import assert from "node:assert/strict"
import {
  buildPanicIntensityInterpretation,
  buildPanicStageBar,
  resolvePanicSentimentStageIndex,
} from "../vite-project/src/content/ydsPanicIntensityInterpretation.js"
import { buildPanicEvidenceReport } from "../vite-project/src/content/ydsPanicEvidenceEngine.js"

assert.equal(resolvePanicSentimentStageIndex(15), 0)
assert.equal(resolvePanicSentimentStageIndex(44), 2)
assert.equal(resolvePanicSentimentStageIndex(46), 2)
assert.equal(resolvePanicSentimentStageIndex(72), 3)
assert.equal(resolvePanicSentimentStageIndex(90), 4)

assert.equal(buildPanicStageBar(2), "□ □ ■ □ □")

const neutral = buildPanicIntensityInterpretation(44)
assert.ok(neutral)
assert.equal(neutral.label, "중립")
assert.equal(neutral.buyStrength, "★★★☆☆")
assert.equal(neutral.actionLine, "관심종목 관찰 및 분할 접근")
assert.equal(neutral.currentLine, "현재 : 중립 (44)")

const neutral46 = buildPanicIntensityInterpretation(46)
assert.equal(neutral46?.label, "중립")

const interest = buildPanicIntensityInterpretation(72)
assert.equal(interest?.label, "관심")
assert.equal(interest?.buyStrength, "★★☆☆☆")

const extremeFear = buildPanicIntensityInterpretation(12)
assert.equal(extremeFear?.label, "극단적 공포")
assert.equal(extremeFear?.buyStrength, "★★★★★")

const evidence = buildPanicEvidenceReport({
  vix: 18.2,
  fearGreed: 41,
  bofa: 4.5,
  putCall: 0.87,
  highYield: 3.2,
})
assert.equal(evidence.metrics.length, 5)
assert.ok(evidence.briefChips.some((c) => c.text.includes("VIX")))

console.log("yds-panic-interpretation.test.mjs OK")
