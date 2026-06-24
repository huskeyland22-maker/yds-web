import assert from "node:assert/strict"
import {
  buildPanicIntensityInterpretation,
  buildPanicStageBar,
  resolvePanicSentimentStageIndex,
} from "../vite-project/src/content/ydsPanicIntensityInterpretation.js"
import { buildPanicEvidenceReport } from "../vite-project/src/content/ydsPanicEvidenceEngine.js"

assert.equal(resolvePanicSentimentStageIndex(15), 0)
assert.equal(resolvePanicSentimentStageIndex(44), 2)
assert.equal(resolvePanicSentimentStageIndex(72), 3)
assert.equal(resolvePanicSentimentStageIndex(90), 4)

assert.equal(buildPanicStageBar(2), "□ □ ■ □ □")

const neutral = buildPanicIntensityInterpretation(44)
assert.ok(neutral)
assert.equal(neutral.label, "중립")
assert.equal(neutral.currentLine, "현재 : 중립 (44)")
assert.ok(neutral.descriptionLines.includes("시장 심리가 균형 상태"))
assert.ok(neutral.descriptionLines.includes("추격매수 자제"))

const greed = buildPanicIntensityInterpretation(72)
assert.equal(greed?.label, "탐욕")

const extremeFear = buildPanicIntensityInterpretation(12)
assert.equal(extremeFear?.label, "극도 공포")

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
