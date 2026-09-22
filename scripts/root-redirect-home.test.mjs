/**
 * Root bookmark should land on Daily Bottom Buy, not the legacy home dashboard.
 * node --test scripts/root-redirect-home.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { getCoreNavItems } from "../vite-project/src/utils/ydsUiLabels.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("root → daily-bottom-buy redirect", () => {
  it("App.jsx redirects / to /daily-bottom-buy", () => {
    const src = readFileSync(join(root, "vite-project/src/App.jsx"), "utf8")
    assert.match(
      src,
      /path=["']\/["'][\s\S]*?Navigate\s+to=["']\/daily-bottom-buy["']/,
    )
    assert.doesNotMatch(src, /path=["']\/["'][\s\S]*?InvestmentHomePage/)
    assert.match(src, /path=["']\/daily-bottom-buy["']/)
    assert.match(src, /path=["']\/market-analysis["']/)
  })

  it("core nav stays daily-bottom-buy + market-analysis with display labels", () => {
    const items = getCoreNavItems()
    assert.deepEqual(
      items.map((i) => i.path),
      ["/daily-bottom-buy", "/market-analysis"],
    )
    assert.deepEqual(
      items.map((i) => i.label),
      ["일상 조정 매수", "공포·패닉 매수"],
    )
  })
})
