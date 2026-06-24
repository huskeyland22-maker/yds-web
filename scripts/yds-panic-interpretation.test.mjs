import assert from "node:assert/strict"
import { buildPanicIntensityInterpretation } from "../vite-project/src/content/ydsPanicIntensityInterpretation.js"
import { buildPanicEvidenceReport } from "../vite-project/src/content/ydsPanicEvidenceEngine.js"

const fear = buildPanicIntensityInterpretation(72)
assert.ok(fear)
assert.equal(fear.label, "공포")
assert.ok(fear.interpretationLines.includes("투자심리가 위축된 상태"))
assert.ok(fear.interpretationLines.includes("관심종목 분할매수 구간"))

const overheat = buildPanicIntensityInterpretation(15)
assert.equal(overheat?.label, "과열")
assert.equal(overheat?.actionGuide, "추격매수 주의")

const neutral = buildPanicIntensityInterpretation(50)
assert.equal(neutral?.label, "중립")
assert.equal(neutral?.actionGuide, null)

const panic = buildPanicIntensityInterpretation(90)
assert.equal(panic?.label, "패닉")

const evidence = buildPanicEvidenceReport({
  vix: 18.2,
  fearGreed: 41,
  bofa: 4.5,
  putCall: 0.87,
  highYield: 3.2,
})
assert.equal(evidence.metrics.length, 5)
assert.ok(evidence.briefChips.some((c) => c.text.includes("VIX")))
assert.ok(evidence.briefChips.some((c) => c.text.includes("CNN")))

console.log("yds-panic-interpretation.test.mjs OK")
