/**
 * Phase G — UI wiring + mock/live verification prep (not live auth).
 * node --test scripts/etf-phase-g-ops-prep.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import path from "node:path"

const root = path.resolve(".")
const page = readFileSync(path.join(root, "vite-project/src/pages/DailyBottomBuyPage.jsx"), "utf8")
const css = readFileSync(path.join(root, "vite-project/src/styles/yds-dbb-premium.css"), "utf8")
const cards = readFileSync(
  path.join(root, "vite-project/src/components/dbb/EtfInvestOverviewCards.jsx"),
  "utf8",
)
const banner = readFileSync(path.join(root, "vite-project/src/components/dbb/EtfDataAsOfBanner.jsx"), "utf8")
const checklist = readFileSync(path.join(root, "docs/yds-etf-phase-g-pro-free-verification.md"), "utf8")

describe("etf phase G ops prep", () => {
  it("keeps PC table and adds mobile cards + as-of banner on DailyBottomBuyPage", () => {
    assert.match(page, /EtfInvestOverviewTable/)
    assert.match(page, /EtfInvestOverviewCards/)
    assert.match(page, /EtfDataAsOfBanner/)
  })

  it("hides table on mobile and shows cards (does not delete table markup)", () => {
    assert.match(css, /yds-dbb-invest-cards\s*\{[\s\S]*display:\s*none/)
    assert.match(css, /@media \(max-width:\s*820px\)[\s\S]*yds-dbb-invest-cards[\s\S]*display:\s*block/)
    assert.match(css, /@media \(max-width:\s*820px\)[\s\S]*yds-dbb-invest-table-panel[\s\S]*display:\s*none/)
  })

  it("mobile cards surface pending + as-of without inventing scores", () => {
    assert.match(cards, /평가 보류/)
    assert.match(cards, /extractEtfAsOfDates/)
    assert.match(cards, /formatEtfPendingReason/)
  })

  it("banner shows mismatch and official AUM pending notice", () => {
    assert.match(banner, /기준일 불일치/)
    assert.match(banner, /공식 AUM 미확보/)
    assert.match(banner, /summarizeUniverseAsOf/)
  })

  it("checklist separates mock automation from live PRO account verification", () => {
    assert.match(checklist, /모의 인증 통과 ≠ 실계정 검증 완료/)
    assert.match(checklist, /PRO 실계정/)
    assert.match(checklist, /미실시/)
    assert.match(checklist, /적지 않는다/)
    assert.doesNotMatch(checklist, /password\s*=|idToken\s*=|Bearer\s+[A-Za-z0-9._-]+/i)
  })
})
