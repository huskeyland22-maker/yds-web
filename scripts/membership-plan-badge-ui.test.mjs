/**
 * Header membership badge wiring (no PROD / Premium access in top chrome).
 * node --test scripts/membership-plan-badge-ui.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("membership plan badge UI", () => {
  it("desktop topbar uses MembershipPlanBadge and drops PROD/Premium access", () => {
    const app = readFileSync(join(root, "vite-project/src/App.jsx"), "utf8")
    assert.match(app, /MembershipPlanBadge/)
    assert.doesNotMatch(app, /Premium access/)
    assert.doesNotMatch(app, /AppReleaseEnvBadge/)
  })

  it("mobile header uses MembershipPlanBadge and drops release-env badge", () => {
    const mobile = readFileSync(join(root, "vite-project/src/components/layout/MobileAppHeader.jsx"), "utf8")
    assert.match(mobile, /MembershipPlanBadge/)
    assert.doesNotMatch(mobile, /AppReleaseEnvBadge/)
  })

  it("admin dashboard still keeps AppReleaseEnvBadge for ops", () => {
    const admin = readFileSync(join(root, "vite-project/src/pages/AdminDashboardPage.jsx"), "utf8")
    assert.match(admin, /AppReleaseEnvBadge/)
  })
})
