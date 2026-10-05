/**
 * Leverage adjustment screen is a menu + universe shell only.
 * node --test scripts/leverage-adjustment-ui.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { getCoreNavItems } from "../vite-project/src/utils/ydsUiLabels.js"
import {
  LEVERAGE_ADJUSTMENT_UNIVERSE,
  leverageAdjustmentSymbols,
} from "../vite-project/src/content/leverageAdjustmentUniverse.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

describe("leverage adjustment UI shell", () => {
  it("adds the leverage menu and keeps the existing adjustment menu names", () => {
    const children = getCoreNavItems()[0].children
    assert.deepEqual(
      children.map((item) => item.label),
      ["ETF 조정매매", "개별 종목 조정매매", "레버리지 조정매매"],
    )
    assert.equal(
      children.find((item) => item.label === "레버리지 조정매매")?.path,
      "/leverage-adjustment",
    )
  })

  it("lists the five leverage symbols and excludes USD", () => {
    assert.deepEqual(leverageAdjustmentSymbols(), ["SOXL", "TQQQ", "FNGU", "TSLL", "CURE"])
    assert.equal(LEVERAGE_ADJUSTMENT_UNIVERSE.some((item) => item.symbol === "USD"), false)
    assert.deepEqual(
      LEVERAGE_ADJUSTMENT_UNIVERSE.map((item) => item.leverage),
      [3, 3, 3, 2, 3],
    )
  })

  it("routes a display-only page with pending buy and sell areas", () => {
    const app = read("vite-project/src/App.jsx")
    const page = read("vite-project/src/pages/LeverageAdjustmentPage.jsx")
    const universe = read("vite-project/src/content/leverageAdjustmentUniverse.js")
    assert.match(app, /path="\/leverage-adjustment"/)
    assert.match(page, /기준 준비 중/)
    assert.match(page, /대기/)
    assert.doesNotMatch(page, /rsiMax|stochKMax|bbPctBMax|ma20DevMax|15\.4|-4\.2/)
    assert.doesNotMatch(universe, /rsiMax|stochKMax|bbPctBMax|ma20DevMax|15\.4|-4\.2/)
    assert.doesNotMatch(page, /dailyBottomBuy|equityDailyBottomBuy|selectEquityBuyCandidates/)
  })
})
