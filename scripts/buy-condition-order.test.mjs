/**
 * node --test scripts/buy-condition-order.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { scoredCountRank, sortByBuyConditionCount } from "../vite-project/src/utils/buyConditionOrder.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("buy condition display order", () => {
  it("sorts scored rows by n/4 descending and keeps ties in the original order", () => {
    const rows = [
      { symbol: "A", ok: true, count: 1 },
      { symbol: "B", ok: true, count: 4 },
      { symbol: "C", ok: true, count: 4 },
      { symbol: "D", ok: true, count: 0 },
      { symbol: "E", ok: true, count: 2 },
      { symbol: "F", ok: true, count: 3 },
    ]
    assert.deepEqual(
      sortByBuyConditionCount(rows, (row) => scoredCountRank(row.ok, row.count)).map((row) => row.symbol),
      ["B", "C", "F", "E", "A", "D"],
    )
  })

  it("places missing scores below a real 0/4 without treating them as zero", () => {
    const rows = [
      { symbol: "MISS" },
      { symbol: "ZERO", ok: true, count: 0 },
      { symbol: "LATER" },
      { symbol: "ONE", ok: true, count: 1 },
    ]
    assert.deepEqual(
      sortByBuyConditionCount(rows, (row) => scoredCountRank(row.ok, row.count)).map((row) => row.symbol),
      ["ONE", "ZERO", "MISS", "LATER"],
    )
  })

  it("is used by the ETF, equity, and leverage lists only as display order", () => {
    const etf = readFileSync(join(root, "vite-project/src/pages/DailyBottomBuyPage.jsx"), "utf8")
    const equity = readFileSync(join(root, "vite-project/src/pages/EquityDailyBottomBuyPage.jsx"), "utf8")
    const leverage = readFileSync(join(root, "vite-project/src/pages/LeverageAdjustmentPage.jsx"), "utf8")
    assert.match(etf, /sortByBuyConditionCount\(payload\?\.all/)
    assert.match(equity, /sortByBuyConditionCount\(summaryCatalog/)
    assert.match(leverage, /sortByBuyConditionCount\(LEVERAGE_ADJUSTMENT_UNIVERSE/)
    assert.doesNotMatch(leverage, /rsiMax|stochKMax|bbPctBMax|ma20DevMax|selectEquityBuyCandidates/)
  })
})
