const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  GRADES,
  MATRIX,
  STUDY_SELECTED_STRATEGY,
  assertStoredFacts,
} from "./lib/equity-research-synthesis-v41.mjs"

const root = dirname(fileURLToPath(import.meta.url))

function check(condition, message) {
  if (process.env.VITEST) {
    if (!condition) throw new Error(message)
    return
  }
  assert.equal(condition, true, message)
}

function load() {
  return {
    technical: JSON.parse(readFileSync(join(root, "data", "equity-technical-sell-v1.json"), "utf8")),
    weekly: JSON.parse(readFileSync(join(root, "data", "equity-weekly-trend-sell-v1.json"), "utf8")),
    state: JSON.parse(readFileSync(join(root, ".cache", "equity-trend-state-research-v37-result.json"), "utf8")),
    buy: JSON.parse(readFileSync(join(root, ".cache", "equity-buy-validation-v38-result.json"), "utf8")),
    addon: JSON.parse(readFileSync(join(root, ".cache", "equity-addon-buy-v39-result.json"), "utf8")),
    recovery: JSON.parse(readFileSync(join(root, ".cache", "equity-addon-recovery-v40-result.json"), "utf8")),
  }
}

describe("v41 final synthesis", () => {
  it("keeps every rule unchanged", () => {
    const facts = assertStoredFacts(load())
    check(STUDY_SELECTED_STRATEGY === null && facts.selectedStrategy === null, "strategy null")
    check(facts.researchOnly === true && facts.productionChanged === false, "research only")
    check(facts.buyChanged === false && facts.sellChanged === false && facts.addChanged === false, "rules unchanged")
    check(facts.uiChanged === false && facts.apiChanged === false && facts.dbChanged === false, "surfaces unchanged")
    check(GRADES.BUY === "B" && GRADES.SELL === "D" && GRADES.WEEKLY_SELL === "D", "sell stays unadopted")
    check(GRADES.DEEP_RECOVERY === "D" && GRADES.BUY_AND_HOLD === "A", "deep recovery is not a rule")
    check(MATRIX.every((row) => row[0] !== "SELL" || row[3] === "채택 안 함"), "sell column")
    check(MATRIX.find((row) => row[0] === "ADD5")[3] === "자동규칙 금지", "add stays manual")
  })

  it("stops when a stored buy count is replaced", () => {
    const sources = load()
    sources.buy.integrity.episodes = 1
    let thrown = false
    try {
      assertStoredFacts(sources)
    } catch (error) {
      thrown = error.lines.some((line) => line.includes("episodes"))
    }
    check(thrown, "episode mismatch is reported")
  })
})
