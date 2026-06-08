import assert from "node:assert/strict"
import {
  regimeFromMarketContext,
  summarizePickPerformance,
  summarizeRegimePerformance,
} from "../vite-project/src/content/ydsValidationEngine.js"

const defensive = {
  macroId: "neutral",
  strategyLabel: "방어 모드",
  isDefensive: true,
}

const regime = regimeFromMarketContext(defensive)
assert.equal(regime.regimeLabel, "방어 모드")

const picks = [
  {
    id: "1",
    regimeLabel: "방어 모드",
    regimeId: "neutral",
    returnPct: 5,
  },
  {
    id: "2",
    regimeLabel: "관심 구간",
    regimeId: "interest",
    returnPct: -2,
  },
]

const regimeSum = summarizeRegimePerformance(picks)
const defense = regimeSum.find((g) => g.regimeLabel === "방어 모드")
assert.equal(defense?.count, 1)
assert.equal(defense?.avgReturn, 5)

const pickSum = summarizePickPerformance(picks)
assert.equal(pickSum.tracked, 2)
assert.equal(pickSum.avgReturn, 1.5)

console.log("yds-validation-engine.test.mjs OK")
