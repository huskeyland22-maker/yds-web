/**
 * node --test scripts/yds-shell-nav-config.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SHELL_NAV_MAIN,
  getShellNavHub,
  shellNavItemIsActive,
} from "../vite-project/src/content/ydsShellNavConfig.js"

describe("ydsShellNavConfig rename", () => {
  it("renames sidebar market briefing to YDS 인사이트 without duplicating", () => {
    const labels = SHELL_NAV_MAIN.map((entry) => entry.label)
    assert.deepEqual(labels, [
      "YDS 인사이트",
      "신용 사이클",
      "조정 매수 전략",
      "리서치",
      "기타 기능",
    ])
    assert.equal(labels.includes("시장 브리핑"), false)
    const insight = SHELL_NAV_MAIN.find((entry) => entry.id === "market-briefing")
    assert.equal(insight?.path, "/")
    assert.equal(insight?.englishLabel, "YDS INSIGHT")
    assert.equal(getShellNavHub("market-briefing")?.title, "YDS 인사이트")
  })

  it("keeps root active exact and does not activate all routes", () => {
    const insight = SHELL_NAV_MAIN.find((entry) => entry.id === "market-briefing")
    assert.equal(shellNavItemIsActive(insight, { pathname: "/" }), true)
    assert.equal(shellNavItemIsActive(insight, { pathname: "/market-analysis" }), false)
    assert.equal(shellNavItemIsActive(insight, { pathname: "/daily-bottom-buy" }), false)
  })
})
