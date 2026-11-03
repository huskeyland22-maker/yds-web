/**
 * Unified ETF + equity FREE/PRO audience policy (CTA vs analysis).
 * node --test scripts/daily-bottom-buy-access-policy.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { MEMBERSHIP_STATUS } from "../vite-project/src/content/ydsMembership.js"
import {
  buildDbbMembershipAudienceCta,
  DBB_SHARED_PRO_LOCK_COPY,
} from "../vite-project/src/content/ydsDailyBottomBuyAccessPolicy.js"
import { buildDailyBottomBuyVisibility, DBB_PRO_LOCK_COPY } from "../vite-project/src/content/ydsDailyBottomBuyProGate.js"
import {
  buildEquityDailyBottomBuyVisibility,
  EQUITY_DBB_PRO_LOCK_COPY,
} from "../vite-project/src/content/ydsEquityDailyBottomBuyProGate.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("unified DBB access policy", () => {
  it("logged-out and FREE share locked analysis visibility; only CTA differs", () => {
    const etfFree = buildDailyBottomBuyVisibility(false)
    const etfPro = buildDailyBottomBuyVisibility(true)
    const eqFree = buildEquityDailyBottomBuyVisibility(false)
    const eqPro = buildEquityDailyBottomBuyVisibility(true)

    assert.equal(etfFree.proConditions, false)
    assert.equal(etfFree.proPrice, false)
    assert.equal(etfPro.proConditions, true)
    assert.equal(eqFree.proConditions, false)
    assert.equal(eqFree.proAtr, false)
    assert.equal(eqPro.proAtr, true)
    assert.equal(etfFree.freeScoreSummary, true)
    assert.equal(eqFree.freeScoreSummary, true)

    const loginCta = buildDbbMembershipAudienceCta({
      isPro: false,
      isLoggedOut: true,
      status: MEMBERSHIP_STATUS.LOGGED_OUT,
    })
    const upgradeCta = buildDbbMembershipAudienceCta({
      isPro: false,
      isLoggedOut: false,
      status: MEMBERSHIP_STATUS.FREE,
    })
    const proCta = buildDbbMembershipAudienceCta({
      isPro: true,
      isLoggedOut: false,
      status: MEMBERSHIP_STATUS.PRO,
    })

    assert.equal(loginCta.kind, "login")
    assert.equal(upgradeCta.kind, "upgrade")
    assert.equal(proCta, null)
    assert.notEqual(loginCta.title, upgradeCta.title)
  })

  it("ETF and equity share the same PRO lock copy", () => {
    assert.deepEqual(DBB_PRO_LOCK_COPY, DBB_SHARED_PRO_LOCK_COPY)
    assert.deepEqual(EQUITY_DBB_PRO_LOCK_COPY, DBB_SHARED_PRO_LOCK_COPY)
  })

  it("both pages wire audience CTA notice and shared lock gates", () => {
    const etf = readFileSync(join(root, "vite-project/src/pages/DailyBottomBuyPage.jsx"), "utf8")
    const equity = readFileSync(join(root, "vite-project/src/pages/EquityDailyBottomBuyPage.jsx"), "utf8")
    assert.match(etf, /buildDbbMembershipAudienceCta/)
    assert.match(etf, /DbbMembershipAccessNotice/)
    assert.match(etf, /visibility\.proPrice/)
    assert.match(equity, /buildDbbMembershipAudienceCta/)
    assert.match(equity, /DbbMembershipAccessNotice/)
    assert.match(equity, /visibility\.proPrice/)
  })
})
