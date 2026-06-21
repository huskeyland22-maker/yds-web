import assert from "node:assert/strict"
import {
  buildSectorConcentration,
  classifyStockSectorGroup,
} from "../vite-project/src/content/ydsStockPickSectorConcentration.js"

assert.equal(classifyStockSectorGroup({ investThemes: ["HBM", "반도체"], sector: "semi" }), "반도체")
assert.equal(classifyStockSectorGroup({ sector: "power" }), "전력")

const stocks = [
  { dataSource: "live", investThemes: ["반도체"] },
  { dataSource: "live", investThemes: ["반도체"] },
  { dataSource: "live", investThemes: ["AI"] },
  { dataSource: "live", investThemes: ["전력"] },
  { dataSource: "live", sector: "nuclear" },
]

const view = buildSectorConcentration(stocks, 5)
assert.ok(view)
assert.equal(view.total, 5)
assert.equal(view.topSector, "반도체")
assert.equal(view.topPct, 40)
assert.ok(["양호", "주의", "과열"].includes(view.grade.label))

const overheated = buildSectorConcentration(
  Array.from({ length: 5 }, () => ({ dataSource: "live", investThemes: ["AI"] })),
  5,
)
assert.equal(overheated?.grade.label, "과열")

console.log("yds-stock-pick-sector-concentration.test.mjs OK")
